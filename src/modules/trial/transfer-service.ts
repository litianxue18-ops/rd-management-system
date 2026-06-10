import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { generateDocNo } from '@/modules/inventory/doc-no-generator';
import type { Prisma } from '@prisma/client';

export interface TransferInput {
  trialOrderId: number;
  laborCost: number;
  machineCost: number;
  materialCost: number;
  description: string;
}

/**
 * 创建试制费用转嫁单 (status=draft).
 * 校验:
 *  - 3 项金额 >= 0
 *  - 关联 trialOrder.status='completed'
 * 副作用:
 *  - 自动算 totalAmount
 *  - 冗余 projectId = trialOrder.projectId (便于聚合 SQL 不 JOIN)
 */
export async function createTransfer(requesterId: number, input: TransferInput) {
  if (input.laborCost < 0 || input.machineCost < 0 || input.materialCost < 0) {
    throw new BusinessError('费用金额不能为负');
  }
  if (!input.description.trim()) throw new BusinessError('转嫁说明必填');
  const order = await prisma.trialProductionOrder.findUnique({
    where: { id: input.trialOrderId },
  });
  if (!order) throw new BusinessError('试制任务不存在');
  if (order.status !== 'completed') {
    throw new BusinessError('仅完成的试制任务可发起转嫁单');
  }
  const total = input.laborCost + input.machineCost + input.materialCost;
  if (!(total > 0)) throw new BusinessError('总额必须 > 0');

  return prisma.$transaction(async (tx) => {
    const docNo = await generateDocNo(tx, 'tct');
    return tx.trialCostTransfer.create({
      data: {
        docNo,
        trialOrderId: input.trialOrderId,
        projectId: order.projectId,
        laborCost: input.laborCost,
        machineCost: input.machineCost,
        materialCost: input.materialCost,
        totalAmount: total,
        description: input.description,
        requesterId,
        status: 'draft',
      },
      include: {
        trialOrder: { select: { id: true, docNo: true, title: true } },
        project: { select: { id: true, code: true, name: true } },
      },
    });
  });
}

export async function listTransfers(
  opts: { projectId?: number; status?: string; trialOrderId?: number } = {},
) {
  return prisma.trialCostTransfer.findMany({
    where: {
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(opts.status ? { status: opts.status as any } : {}),
      ...(opts.trialOrderId ? { trialOrderId: opts.trialOrderId } : {}),
    },
    include: {
      trialOrder: { select: { id: true, docNo: true, title: true } },
      project: { select: { id: true, code: true, name: true } },
    },
    orderBy: { id: 'desc' },
  });
}

export async function getTransfer(id: number) {
  return prisma.trialCostTransfer.findUnique({
    where: { id },
    include: { trialOrder: true, project: true },
  });
}

export async function updateDraft(
  id: number,
  userId: number,
  patch: Partial<TransferInput>,
) {
  const t = await prisma.trialCostTransfer.findUnique({ where: { id } });
  if (!t) throw new BusinessError('转嫁单不存在');
  if (t.status !== 'draft') throw new BusinessError('仅 draft 可编辑');
  if (t.requesterId !== userId) throw new BusinessError('仅申请人可编辑');

  const data: Prisma.TrialCostTransferUpdateInput = {};
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.laborCost !== undefined) {
    if (patch.laborCost < 0) throw new BusinessError('人工费不能为负');
    data.laborCost = patch.laborCost;
  }
  if (patch.machineCost !== undefined) {
    if (patch.machineCost < 0) throw new BusinessError('机台费不能为负');
    data.machineCost = patch.machineCost;
  }
  if (patch.materialCost !== undefined) {
    if (patch.materialCost < 0) throw new BusinessError('材料费不能为负');
    data.materialCost = patch.materialCost;
  }
  if (
    patch.laborCost !== undefined ||
    patch.machineCost !== undefined ||
    patch.materialCost !== undefined
  ) {
    const l = patch.laborCost ?? Number(t.laborCost);
    const m = patch.machineCost ?? Number(t.machineCost);
    const mat = patch.materialCost ?? Number(t.materialCost);
    data.totalAmount = l + m + mat;
  }
  return prisma.trialCostTransfer.update({ where: { id }, data });
}

/** workflow hook (onSubmit): draft → reviewing. */
export async function setReviewing(id: number, tx: Prisma.TransactionClient) {
  await tx.trialCostTransfer.update({
    where: { id },
    data: { status: 'reviewing' },
  });
}

/**
 * workflow hook (onApproved 最后一步=总经理): 通过 → settled.
 * 简化: 跳过中间 "approved 等结转" 状态, 总经理批准即结转.
 */
export async function setApproved(id: number, tx: Prisma.TransactionClient) {
  await tx.trialCostTransfer.update({
    where: { id },
    data: { status: 'settled', settledAt: new Date() },
  });
}

/** workflow hook (onRejected): → rejected + 存原因. */
export async function setRejected(
  id: number,
  reason: string,
  tx: Prisma.TransactionClient,
) {
  await tx.trialCostTransfer.update({
    where: { id },
    data: { status: 'rejected', rejectedReason: reason },
  });
}

/**
 * 报表 1.5: 按项目聚合转嫁费用.
 * 返回 [{ projectId, projectCode, projectName, count, totalAmount, settledAmount }]
 * 简化: 用 Prisma groupBy + 二次拉项目 metadata.
 */
export async function statsByProject() {
  const grouped = await prisma.trialCostTransfer.groupBy({
    by: ['projectId'],
    _count: { _all: true },
    _sum: { totalAmount: true },
  });
  if (grouped.length === 0) return [];
  const projects = await prisma.project.findMany({
    where: { id: { in: grouped.map((g) => g.projectId) } },
    select: { id: true, code: true, name: true },
  });
  const settledGrouped = await prisma.trialCostTransfer.groupBy({
    by: ['projectId'],
    where: { status: 'settled' },
    _sum: { totalAmount: true },
  });
  const settledMap = new Map(
    settledGrouped.map((s) => [s.projectId, Number(s._sum.totalAmount ?? 0)]),
  );
  const projMap = new Map(projects.map((p) => [p.id, p]));
  return grouped.map((g) => ({
    projectId: g.projectId,
    projectCode: projMap.get(g.projectId)?.code ?? '',
    projectName: projMap.get(g.projectId)?.name ?? '',
    count: g._count._all,
    totalAmount: Number(g._sum.totalAmount ?? 0),
    settledAmount: settledMap.get(g.projectId) ?? 0,
  }));
}
