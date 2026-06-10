import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { ROLE_CODES as R } from '@/modules/permission/nodes';
import {
  getProjectLaborCost,
  getProjectLaborCostBreakdown,
} from './labor-cost';

let deptId: number;
let typeId: number;
let researcher_id: number;
let other_researcher_id: number;
let projectLead_id: number;
let project_id: number;

const MONDAY = new Date('2026-06-01');
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
  other_researcher_id = await makeUser('res2', R.RESEARCHER, 200);
  projectLead_id = await makeUser('plead', R.PROJECT_LEAD, 150);

  project_id = (
    await prisma.project.create({
      data: {
        code: 'P1',
        name: 'p',
        projectTypeId: typeId,
        departmentId: deptId,
        leadUserId: projectLead_id,
        status: 'active',
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
      },
    })
  ).id;
});

describe('getProjectLaborCost', () => {
  it('项目有 0 工时 → labor_cost = 0', async () => {
    const r = await getProjectLaborCost(project_id);
    expect(r).not.toBeNull();
    expect(r?.laborCost).toBe(0);
    expect(r?.totalHours).toBe(0);
    expect(r?.participantCount).toBe(0);
  });

  it('1 个用户 hourly_cost=100 填了 8 小时 approved → labor_cost = 800', async () => {
    await prisma.workhourEntry.create({
      data: {
        userId: researcher_id,
        projectId: project_id,
        workDate: MONDAY,
        hours: 8,
        workContent: 'x',
        status: 'approved',
      },
    });
    const r = await getProjectLaborCost(project_id);
    expect(r?.laborCost).toBe(800);
    expect(r?.totalHours).toBe(8);
    expect(r?.participantCount).toBe(1);
  });

  it('draft 工时不计入 (只算 approved)', async () => {
    await prisma.workhourEntry.create({
      data: {
        userId: researcher_id,
        projectId: project_id,
        workDate: MONDAY,
        hours: 8,
        workContent: 'x',
        status: 'draft',
      },
    });
    const r = await getProjectLaborCost(project_id);
    expect(r?.laborCost).toBe(0);
    expect(r?.totalHours).toBe(0);
  });
});

describe('getProjectLaborCostBreakdown', () => {
  it('按 sub_cost desc 排序, 含每人工时与小时成本', async () => {
    // researcher (100/h) 填 8h
    await prisma.workhourEntry.create({
      data: {
        userId: researcher_id,
        projectId: project_id,
        workDate: MONDAY,
        hours: 8,
        workContent: 'a',
        status: 'approved',
      },
    });
    // other_researcher (200/h) 填 10h → sub_cost 2000 排第一
    await prisma.workhourEntry.create({
      data: {
        userId: other_researcher_id,
        projectId: project_id,
        workDate: TUESDAY,
        hours: 10,
        workContent: 'b',
        status: 'approved',
      },
    });
    // researcher 再加一天 → 共 16h x 100 = 1600
    await prisma.workhourEntry.create({
      data: {
        userId: researcher_id,
        projectId: project_id,
        workDate: WEDNESDAY,
        hours: 8,
        workContent: 'c',
        status: 'approved',
      },
    });

    const list = await getProjectLaborCostBreakdown(project_id);
    expect(list).toHaveLength(2);
    expect(list[0].userId).toBe(other_researcher_id);
    expect(list[0].subCost).toBe(2000);
    expect(list[0].hours).toBe(10);
    expect(list[0].hourlyCost).toBe(200);
    expect(list[1].userId).toBe(researcher_id);
    expect(list[1].subCost).toBe(1600);
    expect(list[1].hours).toBe(16);
  });
});
