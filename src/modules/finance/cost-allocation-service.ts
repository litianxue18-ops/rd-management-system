import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import type { Prisma } from '@prisma/client';
import { computeProjectSharedCost } from './shared-resource-service';

/**
 * 研发支出分摊计算表 (制度 form 4): 月度按项目归集辅助账.
 *
 * 与 cost-summary (累计) 的本质区别: 这里是**当月区间** [当月 1 号, 次月 1 号)
 * 的 6 项费用归集, 形成一项目一月一条的辅助账, 走 3 步审批 (财务 → 研发 → 总经理).
 *
 * 6 项费用:
 *  - laborCost     当月已审批工时 × 人工单价
 *  - materialCost  当月领料净消耗 (issued - returned) × 单价
 *  - trialCost     当月 settled 试制转嫁总额
 *  - outsourceCost 当月委外付款
 *  - sharedCost    共用资源分摊 (Task B computeProjectSharedCost)
 *  - equityCost    股份支付摊销 (手填)
 */

/** 月份范围 [start, end) — end 为次月 1 号 (含整月). UTC 与 shared-resource 一致. */
function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** 当月人工费 = SUM(hours × hourlyCost), 已审批工时, workDate 在当月. */
async function monthLaborCost(
  projectId: number,
  start: Date,
  end: Date,
): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ labor: string | null }>>`
    SELECT COALESCE(SUM(w.hours * COALESCE(u.hourly_cost, 0)), 0)::text AS labor
    FROM workhour_entry w
    JOIN "user" u ON u.id = w.user_id
    WHERE w.project_id = ${projectId}
      AND w.status = 'approved'
      AND w.work_date >= ${start} AND w.work_date < ${end}
  `;
  return round2(Number(rows[0]?.labor ?? 0));
}

/** 当月材料净消耗 = SUM((issued - returned) × unitPrice), issuedAt 在当月. */
async function monthMaterialCost(
  projectId: number,
  start: Date,
  end: Date,
): Promise<number> {
  const rows = await prisma.inventoryOutbound.findMany({
    where: {
      projectId,
      status: { in: ['issued', 'returned'] },
      issuedAt: { gte: start, lt: end },
    },
    select: { issuedQty: true, returnedQty: true, unitPrice: true },
  });
  const sum = rows.reduce(
    (acc, o) =>
      acc +
      (Number(o.issuedQty) - Number(o.returnedQty)) * Number(o.unitPrice ?? 0),
    0,
  );
  return round2(sum);
}

/** 当月试制转嫁 = SUM(totalAmount), status=settled, settledAt 在当月. */
async function monthTrialCost(
  projectId: number,
  start: Date,
  end: Date,
): Promise<number> {
  const agg = await prisma.trialCostTransfer.aggregate({
    _sum: { totalAmount: true },
    where: {
      projectId,
      status: 'settled',
      settledAt: { gte: start, lt: end },
    },
  });
  return round2(Number(agg._sum.totalAmount ?? 0));
}

/** 当月委外付款 = SUM(payment.amount), paidDate 在当月, 合同属于该项目. */
async function monthOutsourceCost(
  projectId: number,
  start: Date,
  end: Date,
): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ amt: string | null }>>`
    SELECT COALESCE(SUM(p.amount), 0)::text AS amt
    FROM outsource_payment p
    JOIN outsource_contract c ON c.id = p.contract_id
    WHERE c.project_id = ${projectId}
      AND p.paid_date >= ${start} AND p.paid_date < ${end}
  `;
  return round2(Number(rows[0]?.amt ?? 0));
}

/** docNo = CA-{year}-{MM}-{NNN}, NNN 为当年当月已有分摊单序号. 事务内调用. */
async function nextDocNo(
  tx: Prisma.TransactionClient,
  year: number,
  month: number,
): Promise<string> {
  const count = await tx.costAllocation.count({ where: { year, month } });
  const mm = String(month).padStart(2, '0');
  const nnn = String(count + 1).padStart(3, '0');
  return `CA-${year}-${mm}-${nnn}`;
}

export interface AllocationAmounts {
  laborCost: number;
  materialCost: number;
  trialCost: number;
  outsourceCost: number;
  sharedCost: number;
  equityCost: number;
  totalCost: number;
}

/** 聚合某项目某月 6 项费用 (equity 入参手填). */
export async function computeAllocationAmounts(
  projectId: number,
  year: number,
  month: number,
  equityCost = 0,
): Promise<AllocationAmounts> {
  const { start, end } = monthRange(year, month);
  const [laborCost, materialCost, trialCost, outsourceCost, sharedCost] =
    await Promise.all([
      monthLaborCost(projectId, start, end),
      monthMaterialCost(projectId, start, end),
      monthTrialCost(projectId, start, end),
      monthOutsourceCost(projectId, start, end),
      computeProjectSharedCost(projectId, year, month),
    ]);
  const equity = round2(equityCost);
  const totalCost = round2(
    laborCost + materialCost + trialCost + outsourceCost + sharedCost + equity,
  );
  return {
    laborCost,
    materialCost,
    trialCost,
    outsourceCost,
    sharedCost,
    equityCost: equity,
    totalCost,
  };
}

/**
 * 生成 (或重生成) 某项目某月分摊单, status=draft.
 * 若已存在且非 draft (已提交/已批准) 则报错, 不可重生成.
 */
export async function generateAllocation(
  creatorId: number,
  projectId: number,
  year: number,
  month: number,
  equityCost = 0,
) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new BusinessError('年月非法', 'INVALID_INPUT');
  }
  if (!(equityCost >= 0)) {
    throw new BusinessError('股份支付摊销不能为负', 'INVALID_INPUT');
  }
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new BusinessError('项目不存在', 'NOT_FOUND');

  const existing = await prisma.costAllocation.findUnique({
    where: { projectId_year_month: { projectId, year, month } },
  });
  if (existing && existing.status !== 'draft') {
    throw new BusinessError('该分摊单已提交审批, 不可重新生成', 'INVALID_STATE');
  }

  // 重生成保留 draft 已手填的 equityCost (除非显式传入)
  const eq = equityCost || (existing ? Number(existing.equityCost) : 0);
  const amounts = await computeAllocationAmounts(projectId, year, month, eq);

  return prisma.$transaction(async (tx) => {
    if (existing) {
      return tx.costAllocation.update({
        where: { id: existing.id },
        data: { ...amounts, status: 'draft' },
        include: { project: { select: { id: true, code: true, name: true } } },
      });
    }
    const docNo = await nextDocNo(tx, year, month);
    return tx.costAllocation.create({
      data: {
        docNo,
        projectId,
        year,
        month,
        ...amounts,
        status: 'draft',
        createdById: creatorId,
      },
      include: { project: { select: { id: true, code: true, name: true } } },
    });
  });
}

/** 给当月所有 active/closed 项目批量生成分摊单. 返回生成/更新数. */
export async function generateMonthAll(
  creatorId: number,
  year: number,
  month: number,
): Promise<number> {
  const projects = await prisma.project.findMany({
    where: { status: { in: ['active', 'closed'] } },
    select: { id: true },
  });
  let count = 0;
  for (const p of projects) {
    const existing = await prisma.costAllocation.findUnique({
      where: { projectId_year_month: { projectId: p.id, year, month } },
    });
    // 已提交/已批准的跳过 (不覆盖)
    if (existing && existing.status !== 'draft') continue;
    await generateAllocation(creatorId, p.id, year, month);
    count += 1;
  }
  return count;
}

export async function listAllocations(
  opts: { year?: number; month?: number; projectId?: number; status?: string } = {},
) {
  return prisma.costAllocation.findMany({
    where: {
      ...(opts.year ? { year: opts.year } : {}),
      ...(opts.month ? { month: opts.month } : {}),
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(opts.status ? { status: opts.status as any } : {}),
    },
    include: { project: { select: { id: true, code: true, name: true } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { id: 'desc' }],
  });
}

export async function getAllocation(id: number) {
  return prisma.costAllocation.findUnique({
    where: { id },
    include: { project: { select: { id: true, code: true, name: true } } },
  });
}

/** 修改股份支付摊销 (仅 draft + 创建人), 重算 total. */
export async function updateEquity(id: number, userId: number, equityCost: number) {
  if (!(equityCost >= 0)) {
    throw new BusinessError('股份支付摊销不能为负', 'INVALID_INPUT');
  }
  const a = await prisma.costAllocation.findUnique({ where: { id } });
  if (!a) throw new BusinessError('分摊单不存在', 'NOT_FOUND');
  if (a.status !== 'draft') throw new BusinessError('仅草稿可编辑', 'INVALID_STATE');
  if (a.createdById !== userId) throw new BusinessError('仅创建人可编辑', 'FORBIDDEN');

  const equity = round2(equityCost);
  const total = round2(
    Number(a.laborCost) +
      Number(a.materialCost) +
      Number(a.trialCost) +
      Number(a.outsourceCost) +
      Number(a.sharedCost) +
      equity,
  );
  return prisma.costAllocation.update({
    where: { id },
    data: { equityCost: equity, totalCost: total },
    include: { project: { select: { id: true, code: true, name: true } } },
  });
}

/** workflow hook (onSubmit): draft → reviewing. */
export async function setReviewing(id: number, tx: Prisma.TransactionClient) {
  await tx.costAllocation.update({ where: { id }, data: { status: 'reviewing' } });
}

/** workflow hook (onApproved 最后一步=总经理): → approved. */
export async function setApproved(id: number, tx: Prisma.TransactionClient) {
  await tx.costAllocation.update({ where: { id }, data: { status: 'approved' } });
}

/** workflow hook (onRejected): → draft (退回可改后重提), 原因写 note. */
export async function setRejected(
  id: number,
  reason: string,
  tx: Prisma.TransactionClient,
) {
  await tx.costAllocation.update({
    where: { id },
    data: { status: 'draft', note: reason },
  });
}
