import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';

/**
 * BI 大屏: 全局快照.
 *
 * 项目状态分布 + 本季 KPI + 部门人工费排名 top 5.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);

  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const qStart = new Date(year, (quarter - 1) * 3, 1);
  const qEnd = new Date(year, quarter * 3, 1);

  const [byStatus, totalProjects, newProjects, closedProjects, newCaps, todoCount, deptLabor] =
    await Promise.all([
      prisma.project.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.project.count(),
      prisma.project.count({
        where: { createdAt: { gte: qStart, lt: qEnd } },
      }),
      prisma.project.count({
        where: { status: 'closed', updatedAt: { gte: qStart, lt: qEnd } },
      }),
      prisma.capitalizationReport.count({
        where: { status: 'approved', createdAt: { gte: qStart, lt: qEnd } },
      }),
      prisma.approvalStep.count({
        where: { status: 'pending' },
      }),
      // 部门人工费 top: workhour × user.hourlyCost 按 department 聚合
      prisma.$queryRaw<
        Array<{ department_id: number | null; dept_name: string | null; labor_cost: string }>
      >`
        SELECT u.department_id, d.name AS dept_name,
               COALESCE(SUM(w.hours * COALESCE(u.hourly_cost, 0)), 0)::text AS labor_cost
        FROM workhour_entry w
        JOIN "user" u ON u.id = w.user_id
        LEFT JOIN department d ON d.id = u.department_id
        WHERE w.status = 'approved'
        GROUP BY u.department_id, d.name
        ORDER BY labor_cost DESC
        LIMIT 5
      `,
    ]);

  const statusMap: Record<string, number> = {};
  for (const row of byStatus) {
    statusMap[row.status] = row._count._all;
  }

  return Response.json({
    data: {
      period: { year, quarter },
      projectStats: {
        total: totalProjects,
        draft: statusMap.draft ?? 0,
        reviewing: statusMap.reviewing ?? 0,
        rejected: statusMap.rejected ?? 0,
        active: statusMap.active ?? 0,
        closed: statusMap.closed ?? 0,
        cancelled: statusMap.cancelled ?? 0,
      },
      thisQuarter: {
        newProjects,
        closedProjects,
        newCapitalizations: newCaps,
      },
      todoTotal: todoCount,
      deptLaborTop: deptLabor.map((d) => ({
        deptId: d.department_id,
        deptName: d.dept_name ?? '未分配',
        laborCost: Number(d.labor_cost),
      })),
    },
  });
});
