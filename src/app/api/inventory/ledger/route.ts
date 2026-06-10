import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';

const ALLOWED_TYPES = new Set([
  'init',
  'inbound',
  'outbound',
  'return',
  'scrap',
  'adjust',
]);

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const materialId = sp.get('materialId');
  const warehouseId = sp.get('warehouseId');
  const from = sp.get('from');
  const to = sp.get('to');
  const type = sp.get('type');

  const where: any = {};
  if (materialId) where.materialId = Number(materialId);
  if (warehouseId) where.warehouseId = Number(warehouseId);
  if (type && ALLOWED_TYPES.has(type)) where.changeType = type;
  if (from || to) {
    where.occurredAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lt: new Date(to) } : {}),
    };
  }

  const rows = await prisma.inventoryLedger.findMany({
    where,
    include: {
      material: { select: { id: true, code: true, name: true, unit: true } },
      warehouse: { select: { id: true, code: true, name: true } },
    },
    orderBy: { id: 'desc' },
    take: 200,
  });
  return Response.json({ data: rows });
});
