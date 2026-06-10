import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { getReconciliation } from '@/modules/reconciliation/reconciliation-service';
import { BusinessError } from '@/shared/errors';

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await params;
    const r = await getReconciliation(Number(id));
    if (!r) throw new BusinessError('勾稽记录不存在', 'NOT_FOUND');
    return Response.json({ data: r });
  },
);
