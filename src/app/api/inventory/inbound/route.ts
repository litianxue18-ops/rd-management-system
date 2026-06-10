import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { createInbound, listInbound } from '@/modules/inventory/inbound-service';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  return Response.json({
    data: await listInbound({
      materialId: sp.get('materialId') ? Number(sp.get('materialId')) : undefined,
      warehouseId: sp.get('warehouseId')
        ? Number(sp.get('warehouseId'))
        : undefined,
      from: sp.get('from') ? new Date(sp.get('from')!) : undefined,
      to: sp.get('to') ? new Date(sp.get('to')!) : undefined,
    }),
  });
});

const CreateInput = z.object({
  materialId: z.number().int().positive(),
  warehouseId: z.number().int().positive(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative().optional(),
  /** init 仅通过 import 路径产生; API 限制 inbound/adjust. */
  changeType: z.enum(['inbound', 'adjust']).optional(),
  supplier: z.string().optional(),
  batchNo: z.string().optional(),
  expiryDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  receivedAt: z.string().transform((s) => new Date(s)),
  note: z.string().optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.INVENTORY_INBOUND);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await createInbound(jwt.userId, input) });
});
