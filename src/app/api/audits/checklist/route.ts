import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { gatherChecklist } from '@/modules/audit/checklist';
import { BusinessError } from '@/shared/errors';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get('year') ?? new Date().getFullYear());
  const quarter = Number(
    sp.get('quarter') ?? Math.floor(new Date().getMonth() / 3) + 1,
  );
  if (quarter < 1 || quarter > 4)
    throw new BusinessError('季度必须 1-4');
  return Response.json({ data: await gatherChecklist(year, quarter) });
});
