import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';

/**
 * 月度趋势: 近 N 月 (默认 12) 的:
 *  - newProjects     当月新立项 (createdAt)
 *  - closedProjects  当月新结项 (status=closed, updatedAt 落在该月)
 *  - totalLaborCost  当月已批准工时 × user.hourlyCost
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);

  const sp = req.nextUrl.searchParams;
  const months = Math.min(36, Math.max(1, Number(sp.get('months') ?? 12)));

  const now = new Date();
  // 月份起点 = 当月 1 号回退 months-1 个月
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const buckets: Array<{
    year: number;
    month: number;
    label: string;
    start: Date;
    end: Date;
  }> = [];
  for (let i = 0; i < months; i++) {
    const s = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const e = new Date(start.getFullYear(), start.getMonth() + i + 1, 1);
    buckets.push({
      year: s.getFullYear(),
      month: s.getMonth() + 1,
      label: `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}`,
      start: s,
      end: e,
    });
  }

  // 全月项目活动一次拉, 减少 RTT
  const [newRows, closedRows, laborRows] = await Promise.all([
    prisma.$queryRaw<Array<{ y: number; m: number; cnt: bigint }>>`
      SELECT EXTRACT(YEAR FROM created_at)::int AS y,
             EXTRACT(MONTH FROM created_at)::int AS m,
             COUNT(*)::bigint AS cnt
      FROM project
      WHERE created_at >= ${start}
      GROUP BY y, m
    `,
    prisma.$queryRaw<Array<{ y: number; m: number; cnt: bigint }>>`
      SELECT EXTRACT(YEAR FROM updated_at)::int AS y,
             EXTRACT(MONTH FROM updated_at)::int AS m,
             COUNT(*)::bigint AS cnt
      FROM project
      WHERE status = 'closed' AND updated_at >= ${start}
      GROUP BY y, m
    `,
    prisma.$queryRaw<Array<{ y: number; m: number; labor: string }>>`
      SELECT EXTRACT(YEAR FROM w.work_date)::int AS y,
             EXTRACT(MONTH FROM w.work_date)::int AS m,
             COALESCE(SUM(w.hours * COALESCE(u.hourly_cost, 0)), 0)::text AS labor
      FROM workhour_entry w
      JOIN "user" u ON u.id = w.user_id
      WHERE w.status = 'approved' AND w.work_date >= ${start}
      GROUP BY y, m
    `,
  ]);

  function get<T extends { y: number; m: number }>(
    rows: T[],
    y: number,
    m: number,
  ): T | undefined {
    return rows.find((r) => r.y === y && r.m === m);
  }

  return Response.json({
    data: buckets.map((b) => ({
      label: b.label,
      year: b.year,
      month: b.month,
      newProjects: Number(get(newRows, b.year, b.month)?.cnt ?? 0),
      closedProjects: Number(get(closedRows, b.year, b.month)?.cnt ?? 0),
      totalLaborCost: Number(get(laborRows, b.year, b.month)?.labor ?? 0),
    })),
  });
});
