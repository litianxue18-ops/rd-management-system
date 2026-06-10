import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { ROLE_CODES as R } from '@/modules/permission/nodes';
import {
  upsertEntry,
  deleteEntry,
  getWeekEntries,
  listReviewing,
  submitWeek,
  approveEntries,
  rejectEntries,
  monthlyAggregate,
} from './workhour-service';

let deptId: number;
let typeId: number;
let researcher_id: number;
let other_researcher_id: number;
let projectLead_id: number;
let project_id: number;
let other_project_id: number;

const MONDAY = new Date('2026-06-01'); // 2026-06-01 是周一
const TUESDAY = new Date('2026-06-02');
const WEDNESDAY = new Date('2026-06-03');

beforeEach(async () => {
  deptId = (await prisma.department.create({ data: { code: 'rd', name: '研发' } })).id;
  typeId = (await prisma.projectType.create({ data: { code: 'MAT', name: '新材料' } })).id;
  await prisma.projectNumberRule.create({
    data: { code: 'default', pattern: 'RD-{TYPE}-{YYYY}-{NNN}' },
  });

  async function makeUser(username: string, roleCode: string, hourlyCost?: number) {
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
        hourlyCost: hourlyCost ?? null,
      },
    });
    await prisma.userRole.create({
      data: { userId: u.id, roleId: role.id, isPrimary: true },
    });
    return u.id;
  }

  researcher_id = await makeUser('res', R.RESEARCHER, 100);
  other_researcher_id = await makeUser('res2', R.RESEARCHER, 80);
  projectLead_id = await makeUser('plead', R.PROJECT_LEAD, 150);

  const baseProj = {
    code: 'TMP',
    name: 'p',
    projectTypeId: typeId,
    departmentId: deptId,
    leadUserId: projectLead_id,
    status: 'active' as const,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2027-01-01'),
    budget: 100000,
    background: 'x',
    goals: 'x',
    techPlan: 'x',
    schedule: 'x',
    budgetDetail: 'x',
    expectedOutput: 'x',
    createdById: projectLead_id,
  };
  project_id = (await prisma.project.create({ data: { ...baseProj, code: 'P1' } })).id;
  other_project_id = (
    await prisma.project.create({
      data: { ...baseProj, code: 'P2', leadUserId: other_researcher_id },
    })
  ).id;
});

describe('upsertEntry', () => {
  it('新增 → status=draft', async () => {
    const e = await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: MONDAY,
      hours: 8,
      workContent: '配方调试',
    });
    expect(e.status).toBe('draft');
    expect(Number(e.hours)).toBe(8);
    expect(e.workContent).toBe('配方调试');
  });

  it('同 (user, project, date) 再 upsert → 更新, 状态回 draft', async () => {
    const first = await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: MONDAY,
      hours: 8,
      workContent: '草稿',
    });
    // 模拟先提交后再次编辑
    await prisma.workhourEntry.update({
      where: { id: first.id },
      data: { status: 'approved', approvedAt: new Date() },
    });
    const updated = await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: MONDAY,
      hours: 4,
      workContent: '改了',
    });
    expect(updated.id).toBe(first.id);
    expect(Number(updated.hours)).toBe(4);
    expect(updated.workContent).toBe('改了');
    expect(updated.status).toBe('draft');
    expect(updated.approvedAt).toBeNull();
  });

  it('hours 非 0.5 步长 → BusinessError', async () => {
    await expect(
      upsertEntry(researcher_id, {
        projectId: project_id,
        workDate: MONDAY,
        hours: 1.3,
        workContent: 'x',
      }),
    ).rejects.toThrow(/0.5/);
  });

  it('hours > 24 → BusinessError', async () => {
    await expect(
      upsertEntry(researcher_id, {
        projectId: project_id,
        workDate: MONDAY,
        hours: 25,
        workContent: 'x',
      }),
    ).rejects.toThrow(/0-24/);
  });
});

describe('deleteEntry', () => {
  it('删 draft 成功', async () => {
    const e = await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: MONDAY,
      hours: 8,
      workContent: 'x',
    });
    await deleteEntry(researcher_id, e.id);
    expect(await prisma.workhourEntry.findUnique({ where: { id: e.id } })).toBeNull();
  });

  it('删 approved → BusinessError', async () => {
    const e = await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: MONDAY,
      hours: 8,
      workContent: 'x',
    });
    await prisma.workhourEntry.update({
      where: { id: e.id },
      data: { status: 'approved' },
    });
    await expect(deleteEntry(researcher_id, e.id)).rejects.toThrow(/draft/);
  });

  it('删别人的 → BusinessError', async () => {
    const e = await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: MONDAY,
      hours: 8,
      workContent: 'x',
    });
    await expect(deleteEntry(other_researcher_id, e.id)).rejects.toThrow(/本人/);
  });
});

describe('getWeekEntries', () => {
  it('只返回该周的记录', async () => {
    await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: MONDAY,
      hours: 8,
      workContent: 'a',
    });
    await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: TUESDAY,
      hours: 7.5,
      workContent: 'b',
    });
    // 上一周的数据
    await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: new Date('2026-05-25'),
      hours: 6,
      workContent: 'old',
    });
    const list = await getWeekEntries(researcher_id, MONDAY);
    expect(list).toHaveLength(2);
    expect(list.map((e) => e.workContent).sort()).toEqual(['a', 'b']);
  });
});

describe('submitWeek', () => {
  it('一周 draft 全部 → reviewing', async () => {
    await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: MONDAY,
      hours: 8,
      workContent: 'a',
    });
    await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: TUESDAY,
      hours: 8,
      workContent: 'b',
    });
    const result = await submitWeek(researcher_id, MONDAY);
    expect(result.count).toBe(2);
    const list = await getWeekEntries(researcher_id, MONDAY);
    for (const e of list) {
      expect(e.status).toBe('reviewing');
      expect(e.submittedAt).toBeTruthy();
    }
  });
});

describe('approveEntries', () => {
  it('reviewer 是项目负责人 → approved', async () => {
    const e = await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: MONDAY,
      hours: 8,
      workContent: 'a',
    });
    await submitWeek(researcher_id, MONDAY);
    const result = await approveEntries(projectLead_id, [e.id]);
    expect(result.count).toBe(1);
    const reloaded = await prisma.workhourEntry.findUniqueOrThrow({ where: { id: e.id } });
    expect(reloaded.status).toBe('approved');
    expect(reloaded.approvedAt).toBeTruthy();
  });

  it('reviewer 非项目负责人 → BusinessError', async () => {
    const e = await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: MONDAY,
      hours: 8,
      workContent: 'a',
    });
    await submitWeek(researcher_id, MONDAY);
    await expect(approveEntries(other_researcher_id, [e.id])).rejects.toThrow(/非你负责/);
  });

  it('记录不在 reviewing 状态 → BusinessError', async () => {
    const e = await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: MONDAY,
      hours: 8,
      workContent: 'a',
    });
    // 还是 draft, 没提交
    await expect(approveEntries(projectLead_id, [e.id])).rejects.toThrow(/reviewing/);
  });
});

describe('rejectEntries', () => {
  it('reviewer 是项目负责人 → rejected + 理由落库', async () => {
    const e = await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: MONDAY,
      hours: 8,
      workContent: 'a',
    });
    await submitWeek(researcher_id, MONDAY);
    await rejectEntries(projectLead_id, [e.id], '工作内容写得太简单');
    const reloaded = await prisma.workhourEntry.findUniqueOrThrow({ where: { id: e.id } });
    expect(reloaded.status).toBe('rejected');
    expect(reloaded.rejectedReason).toBe('工作内容写得太简单');
  });

  it('reviewer 非项目负责人 → BusinessError', async () => {
    const e = await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: MONDAY,
      hours: 8,
      workContent: 'a',
    });
    await submitWeek(researcher_id, MONDAY);
    await expect(
      rejectEntries(other_researcher_id, [e.id], '不行'),
    ).rejects.toThrow(/非你负责/);
  });

  it('reason 空 → BusinessError', async () => {
    const e = await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: MONDAY,
      hours: 8,
      workContent: 'a',
    });
    await submitWeek(researcher_id, MONDAY);
    await expect(rejectEntries(projectLead_id, [e.id], '')).rejects.toThrow(/原因/);
  });
});

describe('listReviewing', () => {
  it('只列出项目负责人名下的 reviewing 记录', async () => {
    // researcher 在 project_id 填 2 条 (lead = projectLead_id)
    await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: MONDAY,
      hours: 8,
      workContent: 'a',
    });
    await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: TUESDAY,
      hours: 8,
      workContent: 'b',
    });
    await submitWeek(researcher_id, MONDAY);

    // researcher 在 other_project_id 填 1 条 (lead = other_researcher_id)
    await upsertEntry(researcher_id, {
      projectId: other_project_id,
      workDate: WEDNESDAY,
      hours: 4,
      workContent: 'c',
    });
    await submitWeek(researcher_id, MONDAY);

    const list = await listReviewing(projectLead_id);
    expect(list).toHaveLength(2);
    expect(list.every((e) => e.projectId === project_id)).toBe(true);
  });
});

describe('monthlyAggregate', () => {
  it('返回正确的 (user × project) 汇总', async () => {
    // researcher 在 project_id 填 3 天, 共 22 小时
    const e1 = await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: MONDAY,
      hours: 8,
      workContent: 'a',
    });
    const e2 = await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: TUESDAY,
      hours: 7.5,
      workContent: 'b',
    });
    const e3 = await upsertEntry(researcher_id, {
      projectId: project_id,
      workDate: WEDNESDAY,
      hours: 6.5,
      workContent: 'c',
    });
    // 全部走到 approved
    await prisma.workhourEntry.updateMany({
      where: { id: { in: [e1.id, e2.id, e3.id] } },
      data: { status: 'approved' },
    });

    // 另一人在另一项目, 也 approved
    const e4 = await upsertEntry(other_researcher_id, {
      projectId: other_project_id,
      workDate: MONDAY,
      hours: 5,
      workContent: 'd',
    });
    await prisma.workhourEntry.update({
      where: { id: e4.id },
      data: { status: 'approved' },
    });

    // draft 那条不算
    await upsertEntry(researcher_id, {
      projectId: other_project_id,
      workDate: TUESDAY,
      hours: 4,
      workContent: 'ignore me',
    });

    const result = await monthlyAggregate(2026, 6);
    expect(result).toHaveLength(2);
    const myRow = result.find(
      (r) => r.userId === researcher_id && r.projectId === project_id,
    );
    expect(Number(myRow?._sum.hours ?? 0)).toBe(22);
    const otherRow = result.find(
      (r) => r.userId === other_researcher_id && r.projectId === other_project_id,
    );
    expect(Number(otherRow?._sum.hours ?? 0)).toBe(5);
  });
});
