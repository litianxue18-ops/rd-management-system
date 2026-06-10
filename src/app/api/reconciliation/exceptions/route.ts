import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { listOpenExceptions } from '@/modules/reconciliation/exception-service';

/**
 * GET /api/reconciliation/exceptions?status=open
 * 当前仅支持 status=open (审计工作台用).
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const status = sp.get('status') ?? 'open';
  if (status !== 'open') {
    return Response.json({ data: [] });
  }
  return Response.json({ data: await listOpenExceptions() });
});
