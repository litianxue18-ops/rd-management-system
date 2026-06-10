import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';

export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const jwt = await requireAuth(req);
    const { id } = await params;
    const n = await prisma.notification.findUnique({ where: { id: Number(id) } });
    if (!n || n.recipientId !== jwt.userId) {
      throw new BusinessError('通知不存在', 'NOT_FOUND');
    }
    await prisma.notification.update({
      where: { id: Number(id) },
      data: { readAt: new Date() },
    });
    return Response.json({ data: { ok: true } });
  },
);
