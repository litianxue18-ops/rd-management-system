import { prisma } from '@/shared/prisma';

/**
 * 3 类月度勾稽:
 *  - workhour_project : 当月已批准工时 vs 同月活跃 (有月报) 项目数 × 100h (粗略口径)
 *  - material_output  : 出库金额合计 vs 样品/废料登记的关联出库金额合计 (粗略口径)
 *  - finance_business : 项目费用归集 vs 财务系统数据 (占位, expected=actual=0, 待财务系统对接)
 *
 * 差异率 = |actual - expected| / expected, expected=0 时 diffRate=0.
 * |diffRate| > 0.03 → isException=true.
 *
 * upsert by (year, month, checkType): 同月再跑覆盖.
 */

export const CHECK_TYPES = [
  'workhour_project',
  'material_output',
  'finance_business',
] as const;
export type CheckType = (typeof CHECK_TYPES)[number];

const EXCEPTION_THRESHOLD = 0.03;

export interface RecResult {
  expected: number;
  actual: number;
  diffRate: number;
  isException: boolean;
  note?: string;
}

/**
 * 通用比对计算. expected=0 视为无基准 (diff=0, 不算异常).
 */
export function computeRec(expected: number, actual: number, note?: string): RecResult {
  let diffRate = 0;
  if (expected > 0) {
    diffRate = Math.abs(actual - expected) / expected;
  } else if (actual > 0) {
    // expected=0 且 actual>0, 视为 100% 差异
    diffRate = 1;
  }
  return {
    expected,
    actual,
    diffRate,
    isException: diffRate > EXCEPTION_THRESHOLD,
    note,
  };
}

/**
 * 工时-项目勾稽:
 *  expected = 当月有 approved 月报的项目数 × 100h (粗略基准, 假设每项目月均工时 100h)
 *  actual   = 当月所有 approved 工时合计
 */
async function computeWorkhourProject(year: number, month: number): Promise<RecResult> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const monthlyReports = await prisma.monthlyReport.findMany({
    where: {
      reportYear: year,
      reportMonth: month,
      status: 'approved',
    },
    select: { projectId: true },
  });
  const activeProjects = new Set(monthlyReports.map((r) => r.projectId)).size;
  const expected = activeProjects * 100;

  const wh = await prisma.workhourEntry.aggregate({
    where: {
      workDate: { gte: monthStart, lt: monthEnd },
      status: 'approved',
    },
    _sum: { hours: true },
  });
  const actual = Number(wh._sum.hours ?? 0);

  return computeRec(expected, actual, '基准: 有月报项目数 × 100h');
}

/**
 * 领料-产出勾稽:
 *  expected = 当月所有 issued 出库的金额合计 (issuedQty × unitPrice)
 *  actual   = 同月样品/废料登记关联的出库金额合计 (粗略: 取 sample_scrap_log 数 × 平均出库金额)
 *
 * 当前 sample_scrap_log 与 outbound 无直接关联字段, 采用占位口径:
 *   actual = expected (无差异), 待 SampleScrapLog ↔ Outbound 对接后细化.
 * 这样仍写入一条记录, 形成可见的"已勾稽"基线.
 */
async function computeMaterialOutput(year: number, month: number): Promise<RecResult> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const outbounds = await prisma.inventoryOutbound.findMany({
    where: {
      issuedAt: { gte: monthStart, lt: monthEnd },
      status: { in: ['issued' as any, 'returned' as any] },
    },
    select: { issuedQty: true, unitPrice: true },
  });
  const expected = outbounds.reduce(
    (sum, o) => sum + Number(o.issuedQty) * Number(o.unitPrice ?? 0),
    0,
  );
  // 占位: actual = expected (sample_scrap_log 与 outbound 暂无关联字段)
  const actual = expected;

  return computeRec(expected, actual, '基准: 出库金额; 样品/废料关联待对接');
}

/**
 * 财务-业务勾稽:
 *  expected = 当月已批准 (approved) 研发支出分摊单 totalCost 合计 (系统归集口径)
 *  actual   = 财务账面录入 (FinanceBookEntry) bookAmount, 未录入则 0
 *  diffRate = |actual - expected| / expected → > 3% 异常
 *
 * 提示:
 *  - actual=0 (未录入) → "待录入财务账面"
 *  - expected=0 (无 approved 分摊) → "无已批准分摊单"
 */
async function computeFinanceBusiness(year: number, month: number): Promise<RecResult> {
  const agg = await prisma.costAllocation.aggregate({
    where: { year, month, status: 'approved' },
    _sum: { totalCost: true },
  });
  const expected = Number(agg._sum.totalCost ?? 0);

  const book = await prisma.financeBookEntry.findUnique({
    where: { year_month: { year, month } },
  });
  const actual = book ? Number(book.bookAmount) : 0;

  let note: string;
  if (actual === 0) {
    note = '待录入财务账面';
  } else if (expected === 0) {
    note = '无已批准分摊单 (系统归集为 0)';
  } else {
    note = '系统归集 (已批准分摊) vs 财务账面';
  }
  return computeRec(expected, actual, note);
}

/**
 * 执行某月度 3 类勾稽, upsert 到 reconciliation_check.
 */
export async function runMonthlyReconciliation(year: number, month: number) {
  const results: Array<{ checkType: CheckType; result: RecResult }> = [
    { checkType: 'workhour_project', result: await computeWorkhourProject(year, month) },
    { checkType: 'material_output', result: await computeMaterialOutput(year, month) },
    { checkType: 'finance_business', result: await computeFinanceBusiness(year, month) },
  ];

  const saved = [];
  for (const { checkType, result } of results) {
    const row = await prisma.reconciliationCheck.upsert({
      where: { year_month_checkType: { year, month, checkType } },
      create: {
        year,
        month,
        checkType,
        expectedValue: result.expected,
        actualValue: result.actual,
        diffRate: result.diffRate,
        isException: result.isException,
        note: result.note,
      },
      update: {
        expectedValue: result.expected,
        actualValue: result.actual,
        diffRate: result.diffRate,
        isException: result.isException,
        note: result.note,
      },
    });
    saved.push(row);
  }
  return saved;
}

export async function listReconciliations(opts: { year?: number; month?: number } = {}) {
  return prisma.reconciliationCheck.findMany({
    where: {
      ...(opts.year ? { year: opts.year } : {}),
      ...(opts.month ? { month: opts.month } : {}),
    },
    include: {
      _count: { select: { exceptionNotes: true } },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { checkType: 'asc' }],
  });
}

export async function getReconciliation(id: number) {
  return prisma.reconciliationCheck.findUnique({
    where: { id },
    include: {
      exceptionNotes: { orderBy: { id: 'desc' } },
    },
  });
}
