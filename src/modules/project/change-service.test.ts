import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import {
  createProject,
  activateProject,
} from './project-service';
import {
  createChangeRequest,
  applyChange,
} from './change-service';

let deptId: number;
let typeId: number;
let leadId: number;

beforeEach(async () => {
  deptId = (await prisma.department.create({ data: { code: 'rd', name: '研发中心' } })).id;
  typeId = (await prisma.projectType.create({ data: { code: 'MAT', name: '新材料' } })).id;
  await prisma.projectNumberRule.create({
    data: { code: 'default', pattern: 'RD-{TYPE}-{YYYY}-{NNN}' },
  });
  const role = await prisma.role.create({ data: { code: 'project_lead', name: '项目负责人' } });
  const u = await prisma.user.create({
    data: {
      username: 'lead',
      employeeId: 'L1',
      name: 'lead',
      passwordHash: 'x',
      departmentId: deptId,
    },
  });
  await prisma.userRole.create({ data: { userId: u.id, roleId: role.id, isPrimary: true } });
  leadId = u.id;
});

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'p',
    projectTypeId: typeId,
    departmentId: deptId,
    leadUserId: leadId,
    startDate: new Date('2026-07-01'),
    endDate: new Date('2027-12-31'),
    budget: 100000,
    background: 'x',
    goals: 'x',
    techPlan: 'x',
    schedule: 'x',
    budgetDetail: 'x',
    expectedOutput: 'x',
    ...overrides,
  };
}

describe('createChangeRequest', () => {
  it('active 项目可发起 → 返回 draft change', async () => {
    const p = await createProject(leadId, baseInput());
    await prisma.$transaction(async (tx) => activateProject(p.id, tx));
    const ch = await createChangeRequest(p.id, leadId, {
      reason: '原材料价格变动',
      scope: '预算 + 工期',
      details: '+ 20% 预算, 延期 2 月',
      newBudget: 120000,
      newEndDate: new Date('2028-02-29'),
    });
    expect(ch.id).toBeGreaterThan(0);
    expect(ch.status).toBe('draft');
    expect(ch.newBudget?.toString()).toBe('120000');
  });

  it('draft 项目发起 → BusinessError', async () => {
    const p = await createProject(leadId, baseInput());
    await expect(
      createChangeRequest(p.id, leadId, {
        reason: 'r',
        scope: 's',
        details: 'd',
      }),
    ).rejects.toThrow(/仅 active 项目/);
  });
});

describe('applyChange', () => {
  it('套用到主项目 → budget + endDate 改, change status=active', async () => {
    const p = await createProject(leadId, baseInput({ budget: 100000 }));
    await prisma.$transaction(async (tx) => activateProject(p.id, tx));
    const ch = await createChangeRequest(p.id, leadId, {
      reason: 'r',
      scope: 's',
      details: 'd',
      newBudget: 150000,
      newEndDate: new Date('2028-06-30'),
    });
    await prisma.$transaction(async (tx) => applyChange(ch.id, tx));
    const reloaded = await prisma.project.findUniqueOrThrow({ where: { id: p.id } });
    expect(reloaded.budget.toString()).toBe('150000');
    expect(reloaded.endDate.toISOString().slice(0, 10)).toBe('2028-06-30');
    const reChange = await prisma.projectChangeRequest.findUniqueOrThrow({
      where: { id: ch.id },
    });
    expect(reChange.status).toBe('active');
    expect(reChange.appliedAt).toBeTruthy();
  });
});
