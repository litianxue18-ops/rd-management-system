import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { generateDocNo } from '@/modules/inventory/doc-no-generator';
import type { Prisma } from '@prisma/client';

export interface TrialOrderInput {
  projectId: number;
  title: string;
  description: string;
  plannedQty: number;
  plannedUnit: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
}

/**
 * 创建试制生产任务单 (status=draft).
 * 校验:
 *  - plannedQty > 0
 *  - 项目存在 + status=active
 *  - requester 必须是 project lead 或 member
 */
export async function createTrialOrder(requesterId: number, input: TrialOrderInput) {
  if (!(input.plannedQty > 0)) throw new BusinessError('计划数量必须 > 0');
  const proj = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!proj) throw new BusinessError('项目不存在');
  if (proj.status !== 'active') throw new BusinessError('仅 active 项目可创建试制任务');
  const isLead = proj.leadUserId === requesterId;
  const isMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: input.projectId, userId: requesterId } },
  });
  if (!isLead && !isMember) throw new BusinessError('仅项目成员可发起试制任务');

  return prisma.$transaction(async (tx) => {
    const docNo = await generateDocNo(tx, 'tpo');
    return tx.trialProductionOrder.create({
      data: {
        docNo,
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        plannedQty: input.plannedQty,
        plannedUnit: input.plannedUnit,
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd,
        requesterId,
        status: 'draft',
      },
      include: { project: { select: { id: true, code: true, name: true } } },
    });
  });
}

export async function listTrialOrders(opts: { projectId?: number; status?: string } = {}) {
  return prisma.trialProductionOrder.findMany({
    where: {
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(opts.status ? { status: opts.status as any } : {}),
    },
    include: { project: { select: { id: true, code: true, name: true } } },
    orderBy: { id: 'desc' },
  });
}

export async function getTrialOrder(id: number) {
  return prisma.trialProductionOrder.findUnique({
    where: { id },
    include: {
      project: true,
      transfers: { orderBy: { id: 'desc' } },
    },
  });
}

export async function updateDraft(
  id: number,
  userId: number,
  patch: Partial<TrialOrderInput>,
) {
  const o = await prisma.trialProductionOrder.findUnique({ where: { id } });
  if (!o) throw new BusinessError('试制任务不存在');
  if (o.status !== 'draft') throw new BusinessError('仅 draft 可编辑');
  if (o.requesterId !== userId) throw new BusinessError('仅申请人可编辑');
  const data: Prisma.TrialProductionOrderUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.plannedQty !== undefined) {
    if (!(patch.plannedQty > 0)) throw new BusinessError('计划数量必须 > 0');
    data.plannedQty = patch.plannedQty;
  }
  if (patch.plannedUnit !== undefined) data.plannedUnit = patch.plannedUnit;
  if (patch.scheduledStart !== undefined) data.scheduledStart = patch.scheduledStart;
  if (patch.scheduledEnd !== undefined) data.scheduledEnd = patch.scheduledEnd;
  return prisma.trialProductionOrder.update({ where: { id }, data });
}

/** workflow hook (onSubmit): draft → reviewing. */
export async function setReviewing(id: number, tx: Prisma.TransactionClient) {
  await tx.trialProductionOrder.update({
    where: { id },
    data: { status: 'reviewing' },
  });
}

/** workflow hook (onApproved 最后一步=生产部接单): reviewing → approved + 记 productionLeadId. */
export async function setApproved(
  id: number,
  productionLeadId: number | null,
  tx: Prisma.TransactionClient,
) {
  await tx.trialProductionOrder.update({
    where: { id },
    data: { status: 'approved', productionLeadId },
  });
}

/** workflow hook (onRejected): → rejected + 存原因. */
export async function setRejected(
  id: number,
  reason: string,
  tx: Prisma.TransactionClient,
) {
  await tx.trialProductionOrder.update({
    where: { id },
    data: { status: 'rejected', rejectedReason: reason },
  });
}

/**
 * 生产部接单后填实际产出 → completed.
 * 不走 workflow (单按钮操作).
 * - 必须 status='approved'
 * - 仅 productionLeadId === operatorId 可调
 * - actualQty > 0
 * - 若未填 actualStart, 默认填当下
 */
export async function completeOrder(
  productionLeadId: number,
  id: number,
  actualQty: number,
  actualEnd: Date,
) {
  if (!(actualQty > 0)) throw new BusinessError('实际产出必须 > 0');
  return prisma.$transaction(async (tx) => {
    const o = await tx.trialProductionOrder.findUnique({ where: { id } });
    if (!o) throw new BusinessError('试制任务不存在');
    if (o.status !== 'approved') throw new BusinessError('仅 approved 可完成');
    if (o.productionLeadId !== productionLeadId) {
      throw new BusinessError('仅领单生产部可完成');
    }
    return tx.trialProductionOrder.update({
      where: { id },
      data: {
        status: 'completed',
        actualQty,
        actualEnd,
        actualStart: o.actualStart ?? new Date(),
      },
    });
  });
}
