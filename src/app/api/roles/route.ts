import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  return Response.json({ data: await prisma.role.findMany({ orderBy: { id: 'asc' } }) });
});
