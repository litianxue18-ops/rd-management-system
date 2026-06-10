import { prisma } from '@/shared/prisma';

export interface BalanceRow {
  materialId: number;
  materialCode: string;
  materialName: string;
  unit: string;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  balance: number;
  safetyStock: number | null;
  maxStock: number | null;
  /**
   * low: balance ≤ safetyStock (告警)
   * over: balance ≥ maxStock (积压)
   * stale: 超 180 天没动 (呆滞)
   * normal: 否则
   * 判定顺序: low > over > stale > normal (low 优先)
   */
  status: 'normal' | 'low' | 'stale' | 'over';
  lastMovementAt: Date | null;
  daysSinceMovement: number;
  /** 近 30 天入库量 (change_type='inbound', 取正) */
  inbound30d: number;
  /** 近 30 天出库量 (change_type='outbound', 取绝对值) */
  outbound30d: number;
  /** 近 30 天报废量 (change_type='scrap', 取绝对值) */
  scrap30d: number;
  /** 周转天数 = 余量 / (近 90 天出库总量 / 90); 近 90 天无出库 → null */
  turnoverDays: number | null;
  /** 最近一笔有单价的入库单价; 无则 null */
  unitPrice: number | null;
  /** 库存价值 = 余量 × COALESCE(最近单价, 0) */
  stockValue: number;
}

/**
 * 库存余量列表 (走 v_inventory_balance view).
 * 注意: view 用 INNER JOIN, 从来没库存流水的 (material, warehouse) 组合不会出现.
 * 这是预期 - 余量 0 但从来没动过的不应该展示, 减少噪音.
 */
export async function listBalance(
  opts: {
    materialId?: number;
    warehouseId?: number;
    status?: BalanceRow['status'];
  } = {},
): Promise<BalanceRow[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  if (opts.materialId) {
    params.push(opts.materialId);
    conditions.push(`material_id = $${params.length}`);
  }
  if (opts.warehouseId) {
    params.push(opts.warehouseId);
    conditions.push(`warehouse_id = $${params.length}`);
  }
  const where = conditions.length
    ? `WHERE ${conditions.map((c) => c.replace(/(material_id|warehouse_id)/, 'b.$1')).join(' AND ')}`
    : '';
  // numeric → text 走 Prisma; JS 端 Number() 不丢精度 (业务规模 12,2 仅 ~10 位)
  // 滚动指标从 inventory_ledger 直接聚合 (per material+warehouse):
  //   - 近 30 天入/出/报废: FILTER by change_type + occurred_at
  //   - 近 90 天出库总量算日均 → 周转天数 (前端用)
  //   - 最近单价: 子查询取最近一笔有单价的 inventory_inbound
  //   - 注意 outbound/scrap 的 change_qty 是负数 → 取 -SUM(...) 转正
  const sql = `
    SELECT b.material_id, b.material_code, b.material_name, b.unit,
      b.warehouse_id, b.warehouse_code, b.warehouse_name,
      b.balance::text AS balance,
      b.safety_stock::text AS safety_stock,
      b.max_stock::text AS max_stock,
      b.last_movement_at,
      COALESCE(agg.inbound_30d, 0)::text AS inbound_30d,
      COALESCE(agg.outbound_30d, 0)::text AS outbound_30d,
      COALESCE(agg.scrap_30d, 0)::text AS scrap_30d,
      COALESCE(agg.outbound_90d, 0)::text AS outbound_90d,
      (
        SELECT i.unit_price::text
        FROM inventory_inbound i
        WHERE i.material_id = b.material_id
          AND i.warehouse_id = b.warehouse_id
          AND i.unit_price IS NOT NULL
        ORDER BY i.received_at DESC, i.id DESC
        LIMIT 1
      ) AS unit_price
    FROM v_inventory_balance b
    LEFT JOIN (
      SELECT material_id, warehouse_id,
        SUM(change_qty) FILTER (
          WHERE change_type = 'inbound' AND occurred_at >= now() - interval '30 days'
        ) AS inbound_30d,
        -SUM(change_qty) FILTER (
          WHERE change_type = 'outbound' AND occurred_at >= now() - interval '30 days'
        ) AS outbound_30d,
        -SUM(change_qty) FILTER (
          WHERE change_type = 'scrap' AND occurred_at >= now() - interval '30 days'
        ) AS scrap_30d,
        -SUM(change_qty) FILTER (
          WHERE change_type = 'outbound' AND occurred_at >= now() - interval '90 days'
        ) AS outbound_90d
      FROM inventory_ledger
      GROUP BY material_id, warehouse_id
    ) agg ON agg.material_id = b.material_id AND agg.warehouse_id = b.warehouse_id
    ${where}
    ORDER BY b.material_code, b.warehouse_code
  `;
  const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...params);

  const result: BalanceRow[] = rows.map((r) => {
    const balance = Number(r.balance);
    const safety = r.safety_stock !== null ? Number(r.safety_stock) : null;
    const max = r.max_stock !== null ? Number(r.max_stock) : null;
    const daysSince = r.last_movement_at
      ? Math.floor(
          (Date.now() - new Date(r.last_movement_at).getTime()) /
            (24 * 3600 * 1000),
        )
      : 9999;
    let status: BalanceRow['status'] = 'normal';
    if (safety !== null && balance <= safety) status = 'low';
    else if (max !== null && balance >= max) status = 'over';
    else if (daysSince > 180) status = 'stale';

    const inbound30d = Number(r.inbound_30d);
    const outbound30d = Number(r.outbound_30d);
    const scrap30d = Number(r.scrap_30d);
    const outbound90d = Number(r.outbound_90d);
    // 周转天数 = 余量 / 近 90 天日均出库; 无出库 → null (前端显 "—"/"∞")
    const turnoverDays =
      outbound90d > 0 ? balance / (outbound90d / 90) : null;
    const unitPrice =
      r.unit_price !== null && r.unit_price !== undefined
        ? Number(r.unit_price)
        : null;
    const stockValue = balance * (unitPrice ?? 0);

    return {
      materialId: r.material_id,
      materialCode: r.material_code,
      materialName: r.material_name,
      unit: r.unit,
      warehouseId: r.warehouse_id,
      warehouseCode: r.warehouse_code,
      warehouseName: r.warehouse_name,
      balance,
      safetyStock: safety,
      maxStock: max,
      status,
      lastMovementAt: r.last_movement_at ? new Date(r.last_movement_at) : null,
      daysSinceMovement: daysSince,
      inbound30d,
      outbound30d,
      scrap30d,
      turnoverDays,
      unitPrice,
      stockValue,
    };
  });

  if (opts.status) return result.filter((r) => r.status === opts.status);
  return result;
}
