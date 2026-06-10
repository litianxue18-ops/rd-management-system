import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const entityType = sp.get('entityType');
  const entityIdRaw = sp.get('entityId');
  if (!entityType || !entityIdRaw) {
    throw new BusinessError('entityType / entityId 必填', 'BAD_PARAMS');
  }
  const list = await prisma.approvalInstance.findMany({
    where: { entityType, entityId: Number(entityIdRaw) },
    include: { steps: { orderBy: { stepIndex: 'asc' } } },
    orderBy: { id: 'desc' },
  });
  return Response.json({ data: list });
});
