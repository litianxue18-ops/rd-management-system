import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { appendLedger } from '@/modules/inventory/ledger';
import { generateDocNo } from '@/modules/inventory/doc-no-generator';
import type { Prisma } from '@prisma/client';

export interface SampleInput {
  projectId: number;
  type: 'sample' | 'scrap';
  sourceOutboundId?: number;
  materialId: number;
  warehouseId: number;
  consumedQty: number;
  productName?: string;
  productQty?: number;
  productUnit?: string;
  disposalMethod: 'retained' | 'destroyed' | 'sold' | 'internal_use';
  disposalIncome?: number;
  note?: string;
}

/**
 * 登记样品/废料.
 * - 校验: consumedQty > 0; disposalMethod=sold → disposalIncome > 0
 * - 事务: 生成 docNo + INSERT log
 * - 若 type='scrap' → 调 appendLedger 写 scrap 流水 (-consumedQty)
 * - 若 type='sample' (合格品留样) → 不写 ledger; 原料消耗已通过 outbound 时扣过
 */
export async function createSample(registrantId: number, input: SampleInput) {
  if (!(input.consumedQty > 0)) throw new BusinessError('消耗量必须 > 0');
  if (
    input.disposalMethod === 'sold' &&
    (!input.disposalIncome || input.disposalIncome <= 0)
  ) {
    throw new BusinessError('处置方式为出售时必须填收入');
  }
  return prisma.$transaction(async (tx) => {
    const docNo = await generateDocNo(tx, 'ss');
    const log = await tx.sampleScrapLog.create({
      data: {
        docNo,
        projectId: input.projectId,
        type: input.type,
        sourceOutboundId: input.sourceOutboundId,
        materialId: input.materialId,
        warehouseId: input.warehouseId,
        consumedQty: input.consumedQty,
        productName: input.productName,
        productQty: input.productQty,
        productUnit: input.productUnit,
        disposalMethod: input.disposalMethod,
        disposalIncome: input.disposalIncome,
        note: input.note,
        registeredById: registrantId,
        status: 'draft',
      },
    });
    if (input.type === 'scrap') {
      await appendLedger(tx, {
        materialId: input.materialId,
        warehouseId: input.warehouseId,
        changeType: 'scrap',
        changeQty: -input.consumedQty,
        sourceType: 'sample_scrap_log',
        sourceId: log.id,
        projectId: input.projectId,
        operatorId: registrantId,
        note: `废料登记 ${log.docNo}`,
      });
    }
    return log;
  });
}

export async function listSamples(
  opts: { projectId?: number; type?: 'sample' | 'scrap'; status?: string } = {},
) {
  return prisma.sampleScrapLog.findMany({
    where: {
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    },
    include: {
      material: { select: { id: true, code: true, name: true, unit: true } },
      project: { select: { id: true, code: true, name: true } },
    },
    orderBy: { id: 'desc' },
  });
}

export async function getSample(id: number) {
  return prisma.sampleScrapLog.findUnique({
    where: { id },
    include: { material: true, project: true },
  });
}

/** workflow hook (1 步 财务监销 approve): status draft → supervised. */
export async function setSupervised(
  id: number,
  supervisorId: number,
  tx: Prisma.TransactionClient,
) {
  await tx.sampleScrapLog.update({
    where: { id },
    data: {
      status: 'supervised',
      supervisedById: supervisorId,
      supervisedAt: new Date(),
    },
  });
}

/** 直接监销 (不走 workflow, M5 简化: 1 步, 走"监销"按钮直接调). */
export async function superviseDirectly(id: number, supervisorId: number) {
  return prisma.$transaction(async (tx) => {
    const log = await tx.sampleScrapLog.findUnique({ where: { id } });
    if (!log) throw new BusinessError('记录不存在');
    if (log.status !== 'draft') throw new BusinessError('已监销');
    await setSupervised(id, supervisorId, tx);
  });
}
