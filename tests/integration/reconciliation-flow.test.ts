import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import {
  runMonthlyReconciliation,
  listReconciliations,
  CHECK_TYPES,
} from '@/modules/reconciliation/reconciliation-service';
import {
  createExceptionNote,
  resolveExceptionNote,
} from '@/modules/reconciliation/exception-service';

let deptId: number;
let typeId: number;
let userId: number;
let auditorId: number;
let projectId: number;

beforeEach(async () => {
  deptId = (
    await prisma.department.create({ data: { code: 'rd', name: '研发' } })
  ).id;
  typeId = (
    await prisma.projectType.create({ data: { code: 'MAT', name: '新材料' } })
  ).id;
  await prisma.projectNumberRule.create({
    data: { code: 'default', pattern: 'RD-{TYPE}-{YYYY}-{NNN}' },
  });

  async function makeUser(name: string, roleCode: string) {
    const role = await prisma.role.upsert({
      where: { code: roleCode },
      update: {},
      create: { code: roleCode, name: roleCode },
    });
    const u = await prisma.user.create({
      data: {
        username: name,
        employeeId: name.toUpperCase(),
        name,
        passwordHash: await hashPassword('p'),
        departmentId: deptId,
      },
    });
    await prisma.userRole.create({
      data: { userId: u.id, roleId: role.id, isPrimary: true },
    });
    return u.id;
  }
  userId = await makeUser('plead', 'project_lead');
  auditorId = await makeUser('aud', 'audit_lead');

  projectId = (
    await prisma.project.create({
      data: {
        code: 'P-REC-1',
        name: 'E2E 勾稽',
        projectTypeId: typeId,
        departmentId: deptId,
        leadUserId: userId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
        budget: 200000,
        background: 'x',
        goals: 'x',
        techPlan: 'x',
        schedule: 'x',
        budgetDetail: 'x',
        expectedOutput: 'x',
        createdById: userId,
        status: 'active',
      },
    })
  ).id;
});

describe('月度勾稽端到端: 3 类落库 + 异常单 open → resolved', () => {
  it('run → 落 3 类 → 创建 ExceptionNote → 解决', async () => {
    // 准备: 1 月报 approved + 工时仅 50h (远小于 100h 基准 → 异常)
    await prisma.monthlyReport.create({
      data: {
        projectId,
        reportYear: 2026,
        reportMonth: 7,
        monthPlan: 'plan',
        actualCompletion: 'done',
        outputs: 'o',
        problems: 'p',
        resourceUsage: 'x',
        nextMonthPlan: 'y',
        status: 'approved',
        createdById: userId,
      },
    });
    await prisma.workhourEntry.create({
      data: {
        userId,
        projectId,
        workDate: new Date('2026-07-15'),
        hours: 50,
        workContent: '研发',
        status: 'approved',
      },
    });

    // 1. run
    const saved = await runMonthlyReconciliation(2026, 7);
    expect(saved.length).toBe(3);
    for (const t of CHECK_TYPES) {
      expect(saved.find((r) => r.checkType === t)).toBeTruthy();
    }
    const wh = saved.find((r) => r.checkType === 'workhour_project')!;
    expect(wh.isException).toBe(true);
    expect(Number(wh.expectedValue)).toBe(100);
    expect(Number(wh.actualValue)).toBe(50);

    // 2. createExceptionNote
    const note = await createExceptionNote(auditorId, {
      reconciliationId: wh.id,
      reason: '7 月工时录入不全, 仅 50h, 与基准 100h 差异 50%',
    });
    expect(note.status).toBe('open');
    expect(note.docNo).toMatch(/^EXC-\d{4}-\d{3}$/);

    // 3. resolveExceptionNote
    const resolved = await resolveExceptionNote(
      auditorId,
      note.id,
      '研发部已于 8/5 补录 7 月剩余工时, 调整后差异 < 3%',
    );
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedById).toBe(auditorId);
    expect(resolved.resolvedAt).toBeTruthy();

    // 4. listReconciliations 仍可见 + isException 不变
    const list = await listReconciliations({ year: 2026, month: 7 });
    expect(list.length).toBe(3);
    expect(list.find((r) => r.checkType === 'workhour_project')!.isException).toBe(true);
  });
});
