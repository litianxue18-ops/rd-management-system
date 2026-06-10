import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { listBalance, type BalanceRow } from '@/modules/inventory/balance-query';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const status = sp.get('status');
  return Response.json({
    data: await listBalance({
      materialId: sp.get('materialId') ? Number(sp.get('materialId')) : undefined,
      warehouseId: sp.get('warehouseId')
        ? Number(sp.get('warehouseId'))
        : undefined,
      status: (status && ['normal', 'low', 'stale', 'over'].includes(status)
        ? (status as BalanceRow['status'])
        : undefined),
    }),
  });
});
