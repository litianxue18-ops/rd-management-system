import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const steps = await prisma.approvalStep.findMany({
    where: { actedBy: jwt.userId, status: { in: ['approved', 'rejected'] } },
    include: { instance: true },
    orderBy: { actedAt: 'desc' },
    take: 200,
  });
  return Response.json({
    data: steps.map((s) => ({
      stepId: s.id,
      instanceId: s.instanceId,
      entityType: s.instance.entityType,
      entityId: s.instance.entityId,
      workflowCode: s.instance.workflowCode,
      stepName: s.stepName,
      action: s.status, // approved / rejected
      actedAt: s.actedAt,
      comments: s.comments,
    })),
  });
});
