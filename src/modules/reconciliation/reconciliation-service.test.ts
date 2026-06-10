import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import {
  computeRec,
  runMonthlyReconciliation,
  listReconciliations,
} from './reconciliation-service';

let deptId: number;
let typeId: number;
let userId: number;
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

  const role = await prisma.role.upsert({
    where: { code: 'project_lead' },
    update: {},
    create: { code: 'project_lead', name: 'project_lead' },
  });
  const u = await prisma.user.create({
    data: {
      username: 'u',
      employeeId: 'U1',
      name: 'u',
      passwordHash: await hashPassword('p'),
      departmentId: deptId,
    },
  });
  await prisma.userRole.create({
    data: { userId: u.id, roleId: role.id, isPrimary: true },
  });
  userId = u.id;

  projectId = (
    await prisma.project.create({
      data: {
        code: 'P1',
        name: 'p',
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

describe('computeRec', () => {
  it('expected=0 actual=0 → diffRate=0 不算异常', () => {
    const r = computeRec(0, 0);
    expect(r.diffRate).toBe(0);
    expect(r.isException).toBe(false);
  });

  it('actual=expected → diffRate=0', () => {
    const r = computeRec(100, 100);
    expect(r.diffRate).toBe(0);
    expect(r.isException).toBe(false);
  });

  it('差异 2% → 不算异常 (阈值 3%)', () => {
    const r = computeRec(100, 102);
    expect(r.diffRate).toBeCloseTo(0.02, 5);
    expect(r.isException).toBe(false);
  });

  it('差异 5% → 异常', () => {
    const r = computeRec(100, 105);
    expect(r.diffRate).toBeCloseTo(0.05, 5);
    expect(r.isException).toBe(true);
  });

  it('expected=0 actual>0 → 视为 100% 异常', () => {
    const r = computeRec(0, 50);
    expect(r.diffRate).toBe(1);
    expect(r.isException).toBe(true);
  });
});

describe('runMonthlyReconciliation', () => {
  it('落库 3 类 (workhour_project / material_output / finance_business)', async () => {
    // 准备: 1 项目 1 月报 approved + 工时 50h (远小于 100h 基准, 应触发异常)
    await prisma.monthlyReport.create({
      data: {
        projectId,
        reportYear: 2026,
        reportMonth: 5,
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
        workDate: new Date('2026-05-15'),
        hours: 50,
        workContent: 'x',
        status: 'approved',
      },
    });

    const saved = await runMonthlyReconciliation(2026, 5);
    expect(saved.length).toBe(3);
    const map = new Map(saved.map((r) => [r.checkType, r]));

    const wh = map.get('workhour_project')!;
    expect(Number(wh.expectedValue)).toBe(100); // 1 项目 × 100h
    expect(Number(wh.actualValue)).toBe(50);
    expect(Number(wh.diffRate)).toBeCloseTo(0.5, 4);
    expect(wh.isException).toBe(true);

    const mo = map.get('material_output')!;
    expect(Number(mo.expectedValue)).toBe(0); // 无出库
    expect(mo.isException).toBe(false);

    const fb = map.get('finance_business')!;
    expect(Number(fb.expectedValue)).toBe(0);
    expect(fb.isException).toBe(false);
  });

  it('重复执行同月度 → upsert 覆盖 (不重复落库)', async () => {
    await runMonthlyReconciliation(2026, 6);
    await runMonthlyReconciliation(2026, 6);
    const list = await listReconciliations({ year: 2026, month: 6 });
    expect(list.length).toBe(3);
  });

  it('finance_business 真勾稽: approved 分摊 vs 财务账面 (差异 > 3% 异常)', async () => {
    // 系统归集 = approved 分摊 totalCost = 100000
    await prisma.costAllocation.create({
      data: {
        docNo: 'CA-2026-08-001',
        projectId,
        year: 2026,
        month: 8,
        laborCost: 100000,
        materialCost: 0,
        trialCost: 0,
        outsourceCost: 0,
        sharedCost: 0,
        equityCost: 0,
        totalCost: 100000,
        status: 'approved',
        createdById: userId,
      },
    });
    // 财务账面录入 110000 → 差异 10% > 3% → 异常
    await prisma.financeBookEntry.create({
      data: { year: 2026, month: 8, bookAmount: 110000, recordedById: userId },
    });

    const saved = await runMonthlyReconciliation(2026, 8);
    const fb = new Map(saved.map((r) => [r.checkType, r])).get('finance_business')!;
    expect(Number(fb.expectedValue)).toBe(100000);
    expect(Number(fb.actualValue)).toBe(110000);
    expect(Number(fb.diffRate)).toBeCloseTo(0.1, 4);
    expect(fb.isException).toBe(true);
  });

  it('finance_business 未录入账面 → actual=0 提示待录入', async () => {
    await prisma.costAllocation.create({
      data: {
        docNo: 'CA-2026-09-001',
        projectId,
        year: 2026,
        month: 9,
        laborCost: 50000,
        materialCost: 0,
        trialCost: 0,
        outsourceCost: 0,
        sharedCost: 0,
        equityCost: 0,
        totalCost: 50000,
        status: 'approved',
        createdById: userId,
      },
    });
    const saved = await runMonthlyReconciliation(2026, 9);
    const fb = new Map(saved.map((r) => [r.checkType, r])).get('finance_business')!;
    expect(Number(fb.expectedValue)).toBe(50000);
    expect(Number(fb.actualValue)).toBe(0);
    expect(fb.isException).toBe(true); // expected>0 actual=0 → 100% 差异
    expect(fb.note).toContain('待录入财务账面');
  });
});
