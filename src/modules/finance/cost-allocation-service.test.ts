import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import {
  generateAllocation,
  generateMonthAll,
  updateEquity,
} from './cost-allocation-service';

let deptId: number, typeId: number, userId: number, userId2: number;
let projA: number, projB: number;

async function mkProject(code: string, status: 'active' | 'closed' | 'draft' = 'active') {
  return (
    await prisma.project.create({
      data: {
        code,
        name: code,
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
        status,
      },
    })
  ).id;
}

beforeEach(async () => {
  deptId = (await prisma.department.create({ data: { code: 'rd', name: '研发' } }))
    .id;
  typeId = (
    await prisma.projectType.create({ data: { code: 'MAT', name: '新材料' } })
  ).id;
  userId = (
    await prisma.user.create({
      data: {
        username: 'u',
        employeeId: 'U1',
        name: 'u',
        passwordHash: 'x',
        hourlyCost: 100,
      },
    })
  ).id;
  userId2 = (
    await prisma.user.create({
      data: {
        username: 'u2',
        employeeId: 'U2',
        name: 'u2',
        passwordHash: 'x',
        hourlyCost: 200,
      },
    })
  ).id;
  projA = await mkProject('PA');
  projB = await mkProject('PB');
});

describe('generateAllocation', () => {
  it('当月人工费按工时 × 单价归集 (仅当月 + 仅 approved)', async () => {
    // projA 当月 (2026-05): u 10h×100 + u2 5h×200 = 1000 + 1000 = 2000
    await prisma.workhourEntry.createMany({
      data: [
        {
          userId,
          projectId: projA,
          workDate: new Date('2026-05-10'),
          hours: 10,
          workContent: 'x',
          status: 'approved',
        },
        {
          userId: userId2,
          projectId: projA,
          workDate: new Date('2026-05-12'),
          hours: 5,
          workContent: 'x',
          status: 'approved',
        },
        // 非当月 (4 月) — 不计入
        {
          userId,
          projectId: projA,
          workDate: new Date('2026-04-30'),
          hours: 99,
          workContent: 'x',
          status: 'approved',
        },
        // 未审批 — 不计入
        {
          userId,
          projectId: projA,
          workDate: new Date('2026-05-20'),
          hours: 88,
          workContent: 'x',
          status: 'draft',
        },
      ],
    });

    const a = await generateAllocation(userId, projA, 2026, 5);
    expect(Number(a.laborCost)).toBeCloseTo(2000, 2);
    expect(Number(a.totalCost)).toBeCloseTo(2000, 2);
    expect(a.status).toBe('draft');
    expect(a.docNo).toBe('CA-2026-05-001');
  });

  it('已提交 (非 draft) 不可重新生成', async () => {
    const a = await generateAllocation(userId, projA, 2026, 5);
    await prisma.costAllocation.update({
      where: { id: a.id },
      data: { status: 'reviewing' },
    });
    await expect(generateAllocation(userId, projA, 2026, 5)).rejects.toThrow(
      /不可重新生成/,
    );
  });
});

describe('updateEquity', () => {
  it('改股份支付重算 total (仅 draft + 创建人)', async () => {
    const a = await generateAllocation(userId, projA, 2026, 5);
    const before = Number(a.totalCost);
    const updated = await updateEquity(a.id, userId, 5000);
    expect(Number(updated.equityCost)).toBeCloseTo(5000, 2);
    expect(Number(updated.totalCost)).toBeCloseTo(before + 5000, 2);

    // 非创建人拒绝
    await expect(updateEquity(a.id, userId2, 100)).rejects.toThrow(/创建人/);
  });
});

describe('generateMonthAll', () => {
  it('给当月所有 active/closed 项目批量生成', async () => {
    await mkProject('PD', 'draft'); // draft 不参与
    const n = await generateMonthAll(userId, 2026, 5);
    expect(n).toBe(2); // projA + projB (active), PD draft 跳过
    const rows = await prisma.costAllocation.findMany({
      where: { year: 2026, month: 5 },
    });
    expect(rows.length).toBe(2);
    const docNos = rows.map((r) => r.docNo).sort();
    expect(docNos).toEqual(['CA-2026-05-001', 'CA-2026-05-002']);
  });
});
