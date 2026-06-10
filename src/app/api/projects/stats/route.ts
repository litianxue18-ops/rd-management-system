import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';

/**
 * 全公司项目统计 (用于 CEO 工作台).
 *
 * 返回:
 * - active / reviewing / draft / total: 各状态下的项目数
 * - byType: { [projectTypeName]: count } 按项目类型分组
 *
 * 实现注: groupBy 一次拉完, 不在前端循环 status query.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);

  const [byStatus, byTypeRaw, total] = await Promise.all([
    prisma.project.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.project.groupBy({
      by: ['projectTypeId'],
      _count: { _all: true },
    }),
    prisma.project.count(),
  ]);

  const statusMap: Record<string, number> = {};
  for (const row of byStatus) {
    statusMap[row.status] = row._count._all;
  }

  // 把 typeId 转 typeName, 避免前端再查一次
  const typeIds = byTypeRaw.map((r) => r.projectTypeId);
  const types = typeIds.length
    ? await prisma.projectType.findMany({
        where: { id: { in: typeIds } },
        select: { id: true, name: true, code: true },
      })
    : [];
  const typeNameById = new Map(types.map((t) => [t.id, t.name]));
  const byType: Record<string, number> = {};
  for (const row of byTypeRaw) {
    const name = typeNameById.get(row.projectTypeId) ?? `type#${row.projectTypeId}`;
    byType[name] = row._count._all;
  }

  return Response.json({
    data: {
      total,
      active: statusMap.active ?? 0,
      reviewing: statusMap.reviewing ?? 0,
      draft: statusMap.draft ?? 0,
      rejected: statusMap.rejected ?? 0,
      closed: statusMap.closed ?? 0,
      cancelled: statusMap.cancelled ?? 0,
      byType,
    },
  });
});
