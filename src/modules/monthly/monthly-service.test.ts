import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { ROLE_CODES as R } from '@/modules/permission/nodes';
import { createReport, updateDraft } from './monthly-service';

let deptId: number;
let typeId: number;
let lead_id: number;
let member_id: number;
let outsider_id: number;
let activeProject_id: number;
let draftProject_id: number;

beforeEach(async () => {
  deptId = (await prisma.department.create({ data: { code: 'rd', name: '研发' } })).id;
  typeId = (await prisma.projectType.create({ data: { code: 'MAT', name: '新材料' } })).id;
  await prisma.projectNumberRule.create({
    data: { code: 'default', pattern: 'RD-{TYPE}-{YYYY}-{NNN}' },
  });

  async function makeUser(username: string, roleCode: string) {
    const role = await prisma.role.upsert({
      where: { code: roleCode },
      update: {},
      create: { code: roleCode, name: roleCode },
    });
    const u = await prisma.user.create({
      data: {
        username,
        employeeId: username.toUpperCase(),
        name: username,
        passwordHash: 'x',
        departmentId: deptId,
      },
    });
    await prisma.userRole.create({
      data: { userId: u.id, roleId: role.id, isPrimary: true },
    });
    return u.id;
  }
  lead_id = await makeUser('plead', R.PROJECT_LEAD);
  member_id = await makeUser('member', R.RESEARCHER);
  outsider_id = await makeUser('out', R.RESEARCHER);

  const baseProj = {
    name: 'p',
    projectTypeId: typeId,
    departmentId: deptId,
    leadUserId: lead_id,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2027-01-01'),
    budget: 100000,
    background: 'x',
    goals: 'x',
    techPlan: 'x',
    schedule: 'x',
    budgetDetail: 'x',
    expectedOutput: 'x',
    createdById: lead_id,
  };
  activeProject_id = (
    await prisma.project.create({
      data: {
        ...baseProj,
        code: 'P1',
        status: 'active',
        members: {
          create: [
            { userId: lead_id, role: '负责人', isLead: true },
            { userId: member_id, role: '主研' },
          ],
        },
      },
    })
  ).id;
  draftProject_id = (
    await prisma.project.create({
      data: { ...baseProj, code: 'P2-draft', status: 'draft' },
    })
  ).id;
});

function baseInput(overrides: Partial<Parameters<typeof createReport>[1]> = {}) {
  return {
    projectId: activeProject_id,
    reportYear: 2026,
    reportMonth: 6,
    monthPlan: '计划 A/B/C',
    actualCompletion: '已完成 A/B',
    outputs: '样品 2 批',
    problems: '材料供应延迟',
    resourceUsage: '人 3 / 设备 2',
    nextMonthPlan: '完成 C',
    ...overrides,
  };
}

describe('createReport', () => {
  it('happy path → lead 在 active 项目上创建, status=draft', async () => {
    const r = await createReport(lead_id, baseInput());
    expect(r.status).toBe('draft');
    expect(r.projectId).toBe(activeProject_id);
    expect(r.reportYear).toBe(2026);
    expect(r.reportMonth).toBe(6);
    expect(r.createdById).toBe(lead_id);
  });

  it('member 也能在 active 项目上创建', async () => {
    const r = await createReport(member_id, baseInput({ reportMonth: 7 }));
    expect(r.status).toBe('draft');
    expect(r.createdById).toBe(member_id);
  });

  it('非 active 项目 → BusinessError', async () => {
    await expect(
      createReport(lead_id, baseInput({ projectId: draftProject_id })),
    ).rejects.toThrow(/仅 active 项目可建月报/);
  });

  it('非项目成员 → BusinessError', async () => {
    await expect(createReport(outsider_id, baseInput())).rejects.toThrow(
      /仅项目成员可建月报/,
    );
  });

  it('重复 (project/year/month) → DUPLICATE BusinessError', async () => {
    await createReport(lead_id, baseInput());
    await expect(createReport(lead_id, baseInput())).rejects.toThrow(
      /2026-6 月报已存在/,
    );
  });
});

describe('updateDraft', () => {
  it('draft 状态可由创建人编辑', async () => {
    const r = await createReport(lead_id, baseInput());
    const updated = await updateDraft(r.id, lead_id, { outputs: '改成 3 批' });
    expect(updated.outputs).toBe('改成 3 批');
  });

  it('非 draft 状态 → BusinessError', async () => {
    const r = await createReport(lead_id, baseInput());
    await prisma.monthlyReport.update({
      where: { id: r.id },
      data: { status: 'reviewing' },
    });
    await expect(updateDraft(r.id, lead_id, { outputs: 'no' })).rejects.toThrow(
      /仅 draft 可编辑/,
    );
  });

  it('非创建人 → BusinessError', async () => {
    const r = await createReport(lead_id, baseInput());
    await expect(updateDraft(r.id, member_id, { outputs: 'no' })).rejects.toThrow(
      /仅创建人可编辑/,
    );
  });
});
