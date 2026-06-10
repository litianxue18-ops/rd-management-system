import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { listReconciliations } from '@/modules/reconciliation/reconciliation-service';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const year = sp.get('year') ? Number(sp.get('year')) : undefined;
  const month = sp.get('month') ? Number(sp.get('month')) : undefined;
  return Response.json({ data: await listReconciliations({ year, month }) });
});
