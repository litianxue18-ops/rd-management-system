import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';

export interface UsageInput {
  outboundId: number;
  usageDate: Date;
  quantity: number;
  eventType: 'testing' | 'trial_prep' | 'sample_making' | 'loss' | 'other';
  description: string;
}

/**
 * 领料人/项目成员登记消耗 (领料后去向追踪, 不写 ledger).
 * 校验: 已消耗 + 已退 + 本次 ≤ 已出 (在手量 = 已出 - 已退 - 已消耗).
 */
export async function createUsage(operatorId: number, input: UsageInput) {
  if (input.quantity <= 0) throw new BusinessError('消耗量必须 > 0');
  return prisma.$transaction(async (tx) => {
    const o = await tx.inventoryOutbound.findUnique({
      where: { id: input.outboundId },
    });
    if (!o) throw new BusinessError('领料单不存在');
    if (o.status !== 'issued' && o.status !== 'returned')
      throw new BusinessError('仅已出库的领料单可登记消耗');
    // 权限: 领料人 或 项目成员
    if (o.requesterId !== operatorId) {
      const isMember = await tx.projectMember.findUnique({
        where: {
          projectId_userId: { projectId: o.projectId, userId: operatorId },
        },
      });
      if (!isMember)
        throw new BusinessError('仅领料人或项目成员可登记消耗');
    }
    // 校验: 已消耗 + 已退 + 本次 ≤ 已出
    const consumed = await tx.materialUsageLog.aggregate({
      where: { outboundId: input.outboundId },
      _sum: { quantity: true },
    });
    const totalConsumed = Number(consumed._sum.quantity ?? 0);
    const available =
      Number(o.issuedQty) - Number(o.returnedQty) - totalConsumed;
    if (input.quantity > available) {
      throw new BusinessError(`超过在手量, 当前可消耗 ${available}`);
    }
    return tx.materialUsageLog.create({
      data: {
        outboundId: input.outboundId,
        materialId: o.materialId,
        projectId: o.projectId,
        usageDate: input.usageDate,
        quantity: input.quantity,
        eventType: input.eventType,
        description: input.description,
        operatorId,
      },
    });
  });
}

export async function listUsageByOutbound(outboundId: number) {
  return prisma.materialUsageLog.findMany({
    where: { outboundId },
    orderBy: { usageDate: 'asc' },
  });
}

export async function listUsageByProject(projectId: number) {
  return prisma.materialUsageLog.findMany({
    where: { projectId },
    include: { material: true, outbound: { select: { docNo: true } } },
    orderBy: { usageDate: 'desc' },
  });
}

/** 单领料单在手量 = 已出 - 已退 - 已消耗. */
export async function computeOutboundBalance(outboundId: number) {
  const o = await prisma.inventoryOutbound.findUniqueOrThrow({
    where: { id: outboundId },
  });
  const consumed = await prisma.materialUsageLog.aggregate({
    where: { outboundId },
    _sum: { quantity: true },
  });
  const issued = Number(o.issuedQty);
  const returned = Number(o.returnedQty);
  const consumedQty = Number(consumed._sum.quantity ?? 0);
  return {
    issued,
    returned,
    consumed: consumedQty,
    inHand: issued - returned - consumedQty,
  };
}
