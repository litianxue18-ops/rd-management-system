import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import {
  createConfig,
  computeProjectSharedCost,
} from './shared-resource-service';

let deptId: number, typeId: number, userId: number, userId2: number;
let projA: number, projB: number;

async function mkProject(code: string) {
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
        status: 'active',
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
      data: { username: 'u', employeeId: 'U1', name: 'u', passwordHash: 'x' },
    })
  ).id;
  userId2 = (
    await prisma.user.create({
      data: { username: 'u2', employeeId: 'U2', name: 'u2', passwordHash: 'x' },
    })
  ).id;
  projA = await mkProject('PA');
  projB = await mkProject('PB');
});

describe('createConfig', () => {
  it('创建共用资源配置 + 同年同名拒绝', async () => {
    const c = await createConfig(userId, {
      year: 2026,
      resourceName: '设备折旧',
      annualAmount: 120000,
      allocBasis: 'workhour',
    });
    expect(c.id).toBeGreaterThan(0);
    expect(Number(c.annualAmount)).toBe(120000);
    expect(c.allocBasis).toBe('workhour');
    expect(c.enabled).toBe(true);

    await expect(
      createConfig(userId, {
        year: 2026,
        resourceName: '设备折旧',
        annualAmount: 50000,
        allocBasis: 'equal',
      }),
    ).rejects.toThrow(/同名资源/);
  });
});

describe('computeProjectSharedCost', () => {
  it('workhour: 月度额 × 项目工时占比', async () => {
    // 年度 120000 → 月度 10000. projA 30h, projB 70h, 公司 100h.
    // projA 分摊 = 10000 × 30/100 = 3000
    await createConfig(userId, {
      year: 2026,
      resourceName: '设备折旧',
      annualAmount: 120000,
      allocBasis: 'workhour',
    });
    await prisma.workhourEntry.create({
      data: {
        userId,
        projectId: projA,
        workDate: new Date('2026-05-10'),
        hours: 30,
        workContent: 'x',
        status: 'approved',
      },
    });
    await prisma.workhourEntry.create({
      data: {
        userId: userId2,
        projectId: projB,
        workDate: new Date('2026-05-12'),
        hours: 70,
        workContent: 'x',
        status: 'approved',
      },
    });

    const a = await computeProjectSharedCost(projA, 2026, 5);
    expect(a).toBeCloseTo(3000, 2);
    const b = await computeProjectSharedCost(projB, 2026, 5);
    expect(b).toBeCloseTo(7000, 2);

    // 全公司当月无工时 → 0 不报错
    const empty = await computeProjectSharedCost(projA, 2026, 6);
    expect(empty).toBe(0);
  });

  it('equal: 月度额 / 当月有工时项目数', async () => {
    // 年度 120000 → 月度 10000. 当月 projA/projB 各有工时 → 2 个项目
    // 每项目 = 10000 / 2 = 5000
    await createConfig(userId, {
      year: 2026,
      resourceName: '场地租金',
      annualAmount: 120000,
      allocBasis: 'equal',
    });
    await prisma.workhourEntry.create({
      data: {
        userId,
        projectId: projA,
        workDate: new Date('2026-05-10'),
        hours: 10,
        workContent: 'x',
        status: 'approved',
      },
    });
    await prisma.workhourEntry.create({
      data: {
        userId: userId2,
        projectId: projB,
        workDate: new Date('2026-05-12'),
        hours: 999.9,
        workContent: 'x',
        status: 'approved',
      },
    });

    const a = await computeProjectSharedCost(projA, 2026, 5);
    expect(a).toBeCloseTo(5000, 2);
    // 当月无工时项目 → 不分摊
    const none = await computeProjectSharedCost(projA, 2026, 7);
    expect(none).toBe(0);
  });
});
