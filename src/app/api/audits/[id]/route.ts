import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { getAudit } from '@/modules/audit/audit-service';
import { BusinessError } from '@/shared/errors';

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await params;
    const r = await getAudit(Number(id));
    if (!r) throw new BusinessError('内审报告不存在', 'NOT_FOUND');
    return Response.json({ data: r });
  },
);
