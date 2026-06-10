import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { appendLedger } from './ledger';
import { generateDocNo } from './doc-no-generator';
import type { InventoryChangeType } from '@prisma/client';

export interface InboundInput {
  materialId: number;
  warehouseId: number;
  /** 正数. 单位与 material.unit 一致. */
  quantity: number;
  unitPrice?: number;
  /** 默认 'inbound'. 'init' 仅由 importInitInbound 用. */
  changeType?: 'init' | 'inbound' | 'adjust';
  supplier?: string;
  batchNo?: string;
  expiryDate?: Date;
  receivedAt: Date;
  note?: string;
}

/**
 * 创建入库单 + 同步写 ledger (事务内一气呵成).
 * - 数量必须 > 0
 * - changeType 默认 'inbound'; 'init' 期初路径走 importInitInbound
 */
export async function createInbound(operatorId: number, input: InboundInput) {
  if (input.quantity <= 0) throw new BusinessError('入库数量必须 > 0');
  const changeType = (input.changeType ?? 'inbound') as InventoryChangeType;

  return prisma.$transaction(async (tx) => {
    const docNo = await generateDocNo(tx, 'in');
    const inbound = await tx.inventoryInbound.create({
      data: {
        docNo,
        materialId: input.materialId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        changeType,
        supplier: input.supplier,
        batchNo: input.batchNo,
        expiryDate: input.expiryDate,
        note: input.note,
        receivedAt: input.receivedAt,
        operatorId,
      },
      include: { material: true, warehouse: true },
    });
    await appendLedger(tx, {
      materialId: input.materialId,
      warehouseId: input.warehouseId,
      changeType,
      changeQty: input.quantity,
      sourceType: changeType === 'init' ? 'init' : 'inbound',
      sourceId: inbound.id,
      operatorId,
      note: input.note,
    });
    return inbound;
  });
}

export async function listInbound(
  opts: {
    materialId?: number;
    warehouseId?: number;
    from?: Date;
    to?: Date;
  } = {},
) {
  return prisma.inventoryInbound.findMany({
    where: {
      ...(opts.materialId ? { materialId: opts.materialId } : {}),
      ...(opts.warehouseId ? { warehouseId: opts.warehouseId } : {}),
      ...(opts.from || opts.to
        ? { receivedAt: { gte: opts.from, lt: opts.to } }
        : {}),
    },
    include: { material: true, warehouse: true },
    orderBy: { id: 'desc' },
  });
}

export async function getInbound(id: number) {
  return prisma.inventoryInbound.findUnique({
    where: { id },
    include: { material: true, warehouse: true },
  });
}

export interface InitInboundRow {
  materialCode: string;
  warehouseCode: string;
  quantity: number;
  unitPrice?: number;
  batchNo?: string;
  note?: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * 期初 Excel 批量导入 (一行一物料).
 * - 行级容错: 单行失败不影响其他
 * - 同 (material, warehouse) 已 init 过则跳过 (skipped++)
 * - 预拉 material / warehouse map, 减少 DB 往返
 */
export async function importInitInbound(
  operatorId: number,
  rows: InitInboundRow[],
): Promise<ImportResult> {
  const errors: Array<{ row: number; message: string }> = [];
  let created = 0;
  let skipped = 0;

  const mats = new Map(
    (await prisma.material.findMany()).map((m) => [m.code, m.id]),
  );
  const whs = new Map(
    (await prisma.warehouse.findMany()).map((w) => [w.code, w.id]),
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Excel 第 1 行是表头
    try {
      const matId = mats.get(row.materialCode);
      if (!matId) {
        errors.push({
          row: rowNum,
          message: `物料编码不存在: ${row.materialCode}`,
        });
        continue;
      }
      const whId = whs.get(row.warehouseCode);
      if (!whId) {
        errors.push({
          row: rowNum,
          message: `仓库编码不存在: ${row.warehouseCode}`,
        });
        continue;
      }
      if (!(row.quantity > 0)) {
        errors.push({ row: rowNum, message: '数量必须 > 0' });
        continue;
      }

      const existing = await prisma.inventoryInbound.findFirst({
        where: { materialId: matId, warehouseId: whId, changeType: 'init' },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await createInbound(operatorId, {
        materialId: matId,
        warehouseId: whId,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        changeType: 'init',
        batchNo: row.batchNo,
        receivedAt: new Date(),
        note: row.note ?? '期初导入',
      });
      created++;
    } catch (e: any) {
      errors.push({ row: rowNum, message: e?.message ?? String(e) });
    }
  }
  return { created, skipped, errors };
}
