import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { generateDocNo } from './doc-no-generator';
import { appendLedger } from './ledger';
import type { Prisma } from '@prisma/client';

export interface OutboundInput {
  projectId: number;
  materialId: number;
  warehouseId: number;
  requestedQty: number;
  purpose: string;
}

/**
 * 创建领料单 (草稿).
 * - 项目必须 active
 * - 申请人必须是项目 lead 或 member
 * - 数量必须 > 0
 */
export async function createOutbound(
  requesterId: number,
  input: OutboundInput,
) {
  if (!(input.requestedQty > 0)) throw new BusinessError('数量必须 > 0');
  if (!input.purpose?.trim()) throw new BusinessError('用途必填');

  const proj = await prisma.project.findUnique({
    where: { id: input.projectId },
  });
  if (!proj) throw new BusinessError('项目不存在');
  if (proj.status !== 'active')
    throw new BusinessError('仅 active 项目可领料');

  const isLead = proj.leadUserId === requesterId;
  const isMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId: input.projectId, userId: requesterId },
    },
  });
  if (!isLead && !isMember) throw new BusinessError('仅项目成员可领料');

  return prisma.$transaction(async (tx) => {
    const docNo = await generateDocNo(tx, 'out');
    // M6-T4: 自动从最近一笔有填价的 inbound 取 unitPrice; 没有则 null.
    // cost-summary 物料费 SQL 用 COALESCE(o.unit_price, 0), 所以 null 安全.
    const lastInbound = await tx.inventoryInbound.findFirst({
      where: {
        materialId: input.materialId,
        warehouseId: input.warehouseId,
        unitPrice: { not: null },
      },
      orderBy: { receivedAt: 'desc' },
      select: { unitPrice: true },
    });
    const unitPrice = lastInbound?.unitPrice ?? null;
    return tx.inventoryOutbound.create({
      data: {
        docNo,
        projectId: input.projectId,
        materialId: input.materialId,
        warehouseId: input.warehouseId,
        requestedQty: input.requestedQty,
        unitPrice,
        purpose: input.purpose,
        requesterId,
        status: 'draft',
      },
      include: {
        material: true,
        warehouse: true,
        project: { select: { id: true, code: true, name: true } },
      },
    });
  });
}

export async function listOutbound(
  opts: { projectId?: number; status?: string; requesterId?: number } = {},
) {
  return prisma.inventoryOutbound.findMany({
    where: {
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(opts.status ? { status: opts.status as any } : {}),
      ...(opts.requesterId ? { requesterId: opts.requesterId } : {}),
    },
    include: {
      material: true,
      warehouse: true,
      project: { select: { id: true, code: true, name: true } },
    },
    orderBy: { id: 'desc' },
  });
}

export async function getOutbound(id: number) {
  return prisma.inventoryOutbound.findUnique({
    where: { id },
    include: {
      material: true,
      warehouse: true,
      project: { select: { id: true, code: true, name: true } },
      returns: { orderBy: { id: 'desc' } },
    },
  });
}

/** 仅 draft 状态的申请人可编辑. */
export async function updateDraftOutbound(
  id: number,
  userId: number,
  patch: Partial<OutboundInput>,
) {
  const o = await prisma.inventoryOutbound.findUnique({ where: { id } });
  if (!o) throw new BusinessError('领料单不存在');
  if (o.status !== 'draft') throw new BusinessError('仅 draft 可编辑');
  if (o.requesterId !== userId) throw new BusinessError('仅申请人可编辑');

  // projectId / requesterId 不允许改 (避免逃避权限校验)
  const { projectId: _p, ...safe } = patch;
  return prisma.inventoryOutbound.update({
    where: { id },
    data: safe,
  });
}

/** workflow hook (onSubmit): draft → reviewing. */
export async function setReviewing(id: number, tx: Prisma.TransactionClient) {
  await tx.inventoryOutbound.update({
    where: { id },
    data: { status: 'reviewing' },
  });
}

/** workflow hook (onApproved): reviewing → approved + 记 approverId. */
export async function setApproved(
  id: number,
  tx: Prisma.TransactionClient,
  approverId: number,
) {
  await tx.inventoryOutbound.update({
    where: { id },
    data: {
      status: 'approved',
      approvedById: approverId,
      approvedAt: new Date(),
    },
  });
}

/** workflow hook (onRejected): → rejected + 存原因. */
export async function setRejected(
  id: number,
  reason: string,
  tx: Prisma.TransactionClient,
) {
  await tx.inventoryOutbound.update({
    where: { id },
    data: { status: 'rejected', rejectedReason: reason },
  });
}

/**
 * 仓管员出库执行 (审批通过后由仓库单方触发, 不走 workflow).
 * - 必须 status='approved'
 * - issuedQty 默认 = requestedQty; 允许少于 (实际出库 ≤ 申请量), 不允许 0/负
 * - 事务内锁 material 行 (与 appendLedger 串行化), 校验余量, ledger 写负数
 * - 成功: outbound → issued + 记 issuedById / issuedAt / issuedQty
 */
export async function issueOutbound(
  operatorId: number,
  outboundId: number,
  issuedQty?: number,
) {
  return prisma.$transaction(async (tx) => {
    const o = await tx.inventoryOutbound.findUnique({
      where: { id: outboundId },
    });
    if (!o) throw new BusinessError('领料单不存在');
    if (o.status !== 'approved')
      throw new BusinessError('仅 approved 可出库, 当前: ' + o.status);

    const requested = Number(o.requestedQty);
    const qty = issuedQty ?? requested;
    if (!(qty > 0)) throw new BusinessError('出库数量必须 > 0');
    if (qty > requested)
      throw new BusinessError(`出库数量不能超过申请量 ${requested}`);

    // 悲观锁 material 行 (与 appendLedger 一致, 同 material 写串行)
    await tx.$queryRaw`SELECT id FROM material WHERE id = ${o.materialId} FOR UPDATE`;

    const cur = await tx.$queryRaw<Array<{ balance: string }>>`
      SELECT COALESCE(SUM(change_qty), 0)::text AS balance
      FROM inventory_ledger
      WHERE material_id = ${o.materialId} AND warehouse_id = ${o.warehouseId}
    `;
    const balance = Number(cur[0].balance);
    if (balance < qty)
      throw new BusinessError(`库存不足, 当前余量 ${balance}`);

    await appendLedger(tx, {
      materialId: o.materialId,
      warehouseId: o.warehouseId,
      changeType: 'outbound',
      changeQty: -qty,
      sourceType: 'outbound',
      sourceId: outboundId,
      projectId: o.projectId,
      operatorId,
    });

    return tx.inventoryOutbound.update({
      where: { id: outboundId },
      data: {
        status: 'issued',
        issuedQty: qty,
        issuedById: operatorId,
        issuedAt: new Date(),
      },
      include: {
        material: true,
        warehouse: true,
        project: { select: { id: true, code: true, name: true } },
      },
    });
  });
}
