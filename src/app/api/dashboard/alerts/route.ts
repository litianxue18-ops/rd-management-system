import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';

/**
 * 红线预警面板.
 *  - lowWorkhourCount     当月填工时 < 240h 人数 (50% 红线)
 *  - reconExceptions      最近 1 月勾稽 isException=true 类别数
 *  - openExceptions       异常单 open 数
 *  - sampleDraft          样品销售待监销 (status='draft') 数
 *  - inventoryWarnings    库存安全 (现有口径: 物料 safetyStock 设置且接近, 简化为 placeholder=0)
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [workhourPerUser, reconRows, openExceptions, sampleDraft] = await Promise.all([
    prisma.workhourEntry.groupBy({
      by: ['userId'],
      where: {
        workDate: { gte: monthStart, lt: nextMonth },
        status: 'approved',
      },
      _sum: { hours: true },
    }),
    prisma.reconciliationCheck.findMany({
      where: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      },
      select: { isException: true },
    }),
    prisma.exceptionNote.count({ where: { status: 'open' } }),
    prisma.sampleScrapLog.count({ where: { status: 'draft' } }),
  ]);

  const lowWorkhourCount = workhourPerUser.filter(
    (u) => Number(u._sum.hours ?? 0) < 240,
  ).length;
  const reconExceptions = reconRows.filter((r) => r.isException).length;

  return Response.json({
    data: {
      lowWorkhourCount,
      reconExceptions,
      openExceptions,
      sampleDraft,
      inventoryWarnings: 0, // 暂占位; 实际口径后续接入 balance-query
    },
  });
});
