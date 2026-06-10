import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { getChange } from '@/modules/project/change-service';
import { BusinessError } from '@/shared/errors';

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string; cid: string }> }) => {
    await requireAuth(req);
    const { cid } = await params;
    const ch = await getChange(Number(cid));
    if (!ch) throw new BusinessError('变更申请不存在', 'NOT_FOUND');
    return Response.json({ data: ch });
  },
);
