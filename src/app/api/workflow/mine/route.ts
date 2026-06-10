import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';

/**
 * 工作台 KPI 用. 返回当前用户的:
 * - submitted_running: 我发起的且仍在审批中的实例数
 * - acted_this_week: 本周我审过的步骤数 (approved + rejected)
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);

  // 本周一 00:00:00
  const now = new Date();
  const day = now.getDay() || 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - day + 1);
  weekStart.setHours(0, 0, 0, 0);

  const [submittedRunning, actedThisWeek] = await Promise.all([
    prisma.approvalInstance.count({
      where: { submittedBy: jwt.userId, status: 'running' },
    }),
    prisma.approvalStep.count({
      where: {
        actedBy: jwt.userId,
        status: { in: ['approved', 'rejected'] },
        actedAt: { gte: weekStart },
      },
    }),
  ]);

  return Response.json({
    data: {
      submittedRunning,
      actedThisWeek,
    },
  });
});
