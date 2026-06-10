import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const list = await prisma.notification.findMany({
    where: { recipientId: jwt.userId },
    orderBy: { id: 'desc' },
    take: 100,
  });
  return Response.json({ data: list });
});
