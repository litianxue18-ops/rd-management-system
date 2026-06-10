import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { appendLedger } from './ledger';

/**
 * 退库 (一次性操作, 不走 workflow):
 * - 必须 outbound.status='issued'
 * - quantity > 0 且 ≤ (issuedQty - returnedQty)
 * - 事务: 创建 InventoryReturn + 写 ledger (正数) + 更新 outbound.returnedQty
 *   全退 → status='returned', 部分退保持 'issued'
 */
export async function returnOutbound(
  operatorId: number,
  outboundId: number,
  quantity: number,
  reason?: string,
) {
  if (!(quantity > 0)) throw new BusinessError('退库数量必须 > 0');

  return prisma.$transaction(async (tx) => {
    const o = await tx.inventoryOutbound.findUnique({
      where: { id: outboundId },
    });
    if (!o) throw new BusinessError('领料单不存在');
    if (o.status !== 'issued')
      throw new BusinessError('仅已出库的领料单可退库, 当前: ' + o.status);

    const issued = Number(o.issuedQty);
    const returned = Number(o.returnedQty);
    const remaining = issued - returned;
    if (quantity > remaining)
      throw new BusinessError(`退库数量超过可退余量, 可退: ${remaining}`);

    const ret = await tx.inventoryReturn.create({
      data: {
        outboundId,
        quantity,
        reason,
        operatorId,
      },
    });

    await appendLedger(tx, {
      materialId: o.materialId,
      warehouseId: o.warehouseId,
      changeType: 'return',
      changeQty: quantity,
      sourceType: 'return',
      sourceId: ret.id,
      projectId: o.projectId,
      operatorId,
      note: reason,
    });

    const newReturned = returned + quantity;
    const allReturned = newReturned >= issued;
    await tx.inventoryOutbound.update({
      where: { id: outboundId },
      data: {
        returnedQty: newReturned,
        ...(allReturned ? { status: 'returned' as const } : {}),
      },
    });

    return ret;
  });
}
