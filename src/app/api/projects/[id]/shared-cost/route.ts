import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';
import { computeProjectSharedCost } from '@/modules/finance/shared-resource-service';

/**
 * 项目费用归集: 共用资源分摊 (Task B 第 5 项).
 *
 * 逐月累加项目存续期 (activatedAt 或 startDate → min(now, endDate)) 各月
 * 的 computeProjectSharedCost. 控制循环月数 (一般几个月到 1~2 年).
 */
export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await params;
    const projectId = Number(id);
    if (!Number.isFinite(projectId)) {
      return Response.json(
        { error: { code: 'BAD_ID', message: '项目 id 非法' } },
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { activatedAt: true, startDate: true, endDate: true },
    });
    if (!project) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 },
      );
    }

    const startSrc = project.activatedAt ?? project.startDate;
    const now = new Date();
    // 结束边界: min(now, endDate)
    const endBound = project.endDate < now ? project.endDate : now;

    const breakdown: Array<{ year: number; month: number; amount: number }> = [];
    let total = 0;

    // 逐月迭代 (含起始月与结束月). 安全上限 60 个月防御异常数据.
    let y = startSrc.getUTCFullYear();
    let m = startSrc.getUTCMonth() + 1; // 1-based
    const endY = endBound.getUTCFullYear();
    const endM = endBound.getUTCMonth() + 1;
    let guard = 0;
    while ((y < endY || (y === endY && m <= endM)) && guard < 60) {
      const amount = await computeProjectSharedCost(projectId, y, m);
      if (amount > 0) {
        breakdown.push({ year: y, month: m, amount });
        total += amount;
      }
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      guard += 1;
    }

    total = Math.round(total * 100) / 100;
    return Response.json({ data: { total, breakdown } });
  },
);
