import type { Prisma } from '@prisma/client';

const TYPE_PREFIX = {
  in: 'IN', out: 'OUT', ss: 'SS', tpo: 'TPO', tct: 'TCT',
  cl: 'CL', cap: 'CAP', exc: 'EXC',
} as const;
const TYPE_TABLE = {
  in: 'inventory_inbound',
  out: 'inventory_outbound',
  ss: 'sample_scrap_log',
  tpo: 'trial_production_order',
  tct: 'trial_cost_transfer',
  cl: 'closing_report',
  cap: 'capitalization_report',
  exc: 'exception_note',
} as const;
// sample_scrap_log 用 registered_at; 其它表用 created_at
const TYPE_TIME_COL: Record<keyof typeof TYPE_PREFIX, string> = {
  in: 'created_at',
  out: 'created_at',
  ss: 'registered_at',
  tpo: 'created_at',
  tct: 'created_at',
  cl: 'created_at',
  cap: 'created_at',
  exc: 'created_at',
};

/**
 * 生成入库/出库单号: `IN-2026-001` / `OUT-2026-001`.
 * 必须在事务内调用以避免并发. 用 created_at 年度计数.
 */
export async function generateDocNo(
  tx: Prisma.TransactionClient,
  type: keyof typeof TYPE_PREFIX,
  today: Date = new Date(),
): Promise<string> {
  const prefix = TYPE_PREFIX[type];
  const table = TYPE_TABLE[type];
  const timeCol = TYPE_TIME_COL[type];
  const year = today.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const rows = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "${timeCol}" >= $1 AND "${timeCol}" < $2`,
    yearStart,
    yearEnd,
  );
  const nnn = String(Number(rows[0].count) + 1).padStart(3, '0');
  return `${prefix}-${year}-${nnn}`;
}
