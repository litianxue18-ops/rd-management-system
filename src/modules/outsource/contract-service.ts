import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { tryCreateUnique } from '@/shared/prisma-helpers';
import type { Prisma } from '@prisma/client';

export interface ContractInput {
  contractNo: string; // 用户输入的合同号
  projectId: number;
  supplierId: number;
  title: string;
  scope: string;
  ipOwnership: string;
  totalAmount: number;
  signedDate: Date;
  startDate: Date;
  endDate: Date;
}

/**
 * 创建委外合同 (status=draft).
 * 校验:
 *  - totalAmount > 0
 *  - 项目存在 + status=active
 *  - 合同号唯一
 *  - 制度 6.5: 成果归属必填 (字段 schema 已强制)
 */
export async function createContract(requesterId: number, input: ContractInput) {
  if (input.totalAmount <= 0) throw new BusinessError('合同金额必须 > 0');
  if (!input.contractNo.trim()) throw new BusinessError('合同号必填');
  if (!input.ipOwnership.trim()) throw new BusinessError('成果归属必填');
  const proj = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!proj) throw new BusinessError('项目不存在');
  if (proj.status !== 'active') {
    throw new BusinessError('仅 active 项目可签委外合同');
  }
  const supplier = await prisma.outsourceSupplier.findUnique({
    where: { id: input.supplierId },
  });
  if (!supplier) throw new BusinessError('供应商不存在');

  return tryCreateUnique(
    () =>
      prisma.outsourceContract.create({
        data: { ...input, requesterId, status: 'draft' },
        include: {
          project: { select: { id: true, code: true, name: true } },
          supplier: { select: { id: true, code: true, name: true } },
        },
      }),
    `合同号已存在: ${input.contractNo}`,
  );
}

export async function listContracts(
  opts: { projectId?: number; status?: string } = {},
) {
  return prisma.outsourceContract.findMany({
    where: {
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(opts.status ? { status: opts.status as any } : {}),
    },
    include: {
      project: { select: { id: true, code: true, name: true } },
      supplier: { select: { id: true, code: true, name: true } },
    },
    orderBy: { id: 'desc' },
  });
}

export async function getContract(id: number) {
  return prisma.outsourceContract.findUnique({
    where: { id },
    include: {
      project: true,
      supplier: true,
      payments: { orderBy: { id: 'desc' } },
    },
  });
}

export async function updateDraft(
  id: number,
  userId: number,
  patch: Partial<ContractInput>,
) {
  const c = await prisma.outsourceContract.findUnique({ where: { id } });
  if (!c) throw new BusinessError('合同不存在');
  if (c.status !== 'draft') throw new BusinessError('仅 draft 可编辑');
  if (c.requesterId !== userId) throw new BusinessError('仅申请人可编辑');
  const data: Prisma.OutsourceContractUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.scope !== undefined) data.scope = patch.scope;
  if (patch.ipOwnership !== undefined) {
    if (!patch.ipOwnership.trim()) throw new BusinessError('成果归属必填');
    data.ipOwnership = patch.ipOwnership;
  }
  if (patch.totalAmount !== undefined) {
    if (patch.totalAmount <= 0) throw new BusinessError('合同金额必须 > 0');
    data.totalAmount = patch.totalAmount;
  }
  if (patch.signedDate !== undefined) data.signedDate = patch.signedDate;
  if (patch.startDate !== undefined) data.startDate = patch.startDate;
  if (patch.endDate !== undefined) data.endDate = patch.endDate;
  return prisma.outsourceContract.update({ where: { id }, data });
}

// ===== workflow hooks =====

/** workflow hook (onSubmit): draft → reviewing. */
export async function setReviewing(id: number, tx: Prisma.TransactionClient) {
  await tx.outsourceContract.update({
    where: { id },
    data: { status: 'reviewing' },
  });
}

/** workflow hook (onApproved 最后一步=总经理): → active. */
export async function setActive(id: number, tx: Prisma.TransactionClient) {
  await tx.outsourceContract.update({
    where: { id },
    data: { status: 'active' },
  });
}

/** 由 payment-service.registerPayment 触发 (累计 == 总额时调用). */
export async function setCompleted(id: number, tx: Prisma.TransactionClient) {
  await tx.outsourceContract.update({
    where: { id },
    data: { status: 'completed' },
  });
}

/** workflow hook (onRejected): → rejected + 存原因. */
export async function setRejected(
  id: number,
  reason: string,
  tx: Prisma.TransactionClient,
) {
  await tx.outsourceContract.update({
    where: { id },
    data: { status: 'rejected', rejectedReason: reason },
  });
}
