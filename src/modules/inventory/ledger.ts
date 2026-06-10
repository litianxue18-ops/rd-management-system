import type { Prisma, InventoryChangeType } from '@prisma/client';
import { prisma } from '@/shared/prisma';

export interface LedgerEntryInput {
  materialId: number;
  warehouseId: number;
  changeType: InventoryChangeType;
  /** 入正出负. 单位与 material.unit 一致. */
  changeQty: number;
  /** 'inbound' / 'outbound' / 'return' / 'init' / 'adjust' / 'scrap' */
  sourceType: string;
  sourceId: number;
  projectId?: number;
  operatorId: number;
  note?: string;
}

/**
 * 写一条 ledger 记录, 自动计算 balanceAfter. 必须在事务内调用.
 *
 * - 先 SELECT ... FOR UPDATE 锁住该 material 行, 让同 material 的并发写串行化
 *   (不同 material 之间互不阻塞)
 * - 再 SUM(change_qty) 拿当前 (material, warehouse) 余量
 * - balanceAfter = current + input.changeQty 然后 INSERT
 */
export async function appendLedger(
  tx: Prisma.TransactionClient,
  input: LedgerEntryInput,
) {
  await tx.$queryRaw`SELECT id FROM material WHERE id = ${input.materialId} FOR UPDATE`;
  const current = await tx.$queryRaw<Array<{ balance: string }>>`
    SELECT COALESCE(SUM(change_qty), 0)::text AS balance
    FROM inventory_ledger
    WHERE material_id = ${input.materialId} AND warehouse_id = ${input.warehouseId}
  `;
  const balanceAfter = Number(current[0].balance) + input.changeQty;
  return tx.inventoryLedger.create({
    data: {
      materialId: input.materialId,
      warehouseId: input.warehouseId,
      changeType: input.changeType,
      changeQty: input.changeQty,
      balanceAfter,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      projectId: input.projectId,
      operatorId: input.operatorId,
      note: input.note,
    },
  });
}

/** 查 (material, warehouse) 当前余量. 不锁. T4 view 上线后这里保持兼容. */
export async function getBalance(
  materialId: number,
  warehouseId: number,
  tx?: Prisma.TransactionClient,
): Promise<number> {
  const client = tx ?? prisma;
  const rows = await client.$queryRaw<Array<{ balance: string }>>`
    SELECT COALESCE(SUM(change_qty), 0)::text AS balance
    FROM inventory_ledger
    WHERE material_id = ${materialId} AND warehouse_id = ${warehouseId}
  `;
  return Number(rows[0].balance);
}
