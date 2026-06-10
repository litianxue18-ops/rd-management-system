import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { deleteEntry } from '@/modules/workhour/workhour-service';

export const DELETE = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const jwt = await requireAuth(req);
    const { id } = await params;
    await deleteEntry(jwt.userId, Number(id));
    return Response.json({ data: { ok: true } });
  },
);
