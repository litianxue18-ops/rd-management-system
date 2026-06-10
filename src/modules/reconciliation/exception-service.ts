import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { generateDocNo } from '@/modules/inventory/doc-no-generator';

/**
 * 异常核对单状态机:
 *  open → resolved (整改完成, 填解决方案)
 *
 * 流程上由审计组针对 isException=true 的 reconciliation_check 创建.
 */

export async function createExceptionNote(
  raisedById: number,
  input: { reconciliationId: number; reason: string },
) {
  if (!input.reason?.trim()) throw new BusinessError('异常原因必填');

  const rec = await prisma.reconciliationCheck.findUnique({
    where: { id: input.reconciliationId },
  });
  if (!rec) throw new BusinessError('对应的勾稽记录不存在');

  return prisma.$transaction(async (tx) => {
    const docNo = await generateDocNo(tx, 'exc');
    return tx.exceptionNote.create({
      data: {
        docNo,
        reconciliationId: input.reconciliationId,
        reason: input.reason.trim(),
        raisedById,
        status: 'open',
      },
    });
  });
}

export async function resolveExceptionNote(
  resolverId: number,
  id: number,
  resolution: string,
) {
  if (!resolution?.trim()) throw new BusinessError('解决方案必填');
  const n = await prisma.exceptionNote.findUnique({ where: { id } });
  if (!n) throw new BusinessError('异常单不存在');
  if (n.status !== 'open') throw new BusinessError('仅 open 状态可解决');
  return prisma.exceptionNote.update({
    where: { id },
    data: {
      status: 'resolved',
      resolution: resolution.trim(),
      resolvedById: resolverId,
      resolvedAt: new Date(),
    },
  });
}

export async function listOpenExceptions() {
  return prisma.exceptionNote.findMany({
    where: { status: 'open' },
    include: { reconciliation: true },
    orderBy: { id: 'desc' },
  });
}

export async function listExceptionsByReconciliation(reconciliationId: number) {
  return prisma.exceptionNote.findMany({
    where: { reconciliationId },
    orderBy: { id: 'desc' },
  });
}

export async function getExceptionNote(id: number) {
  return prisma.exceptionNote.findUnique({
    where: { id },
    include: { reconciliation: true },
  });
}
