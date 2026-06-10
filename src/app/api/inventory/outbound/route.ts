import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import {
  createOutbound,
  listOutbound,
} from '@/modules/inventory/outbound-service';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  return Response.json({
    data: await listOutbound({
      projectId: sp.get('projectId') ? Number(sp.get('projectId')) : undefined,
      status: sp.get('status') ?? undefined,
      requesterId: sp.get('requesterId')
        ? Number(sp.get('requesterId'))
        : undefined,
    }),
  });
});

const CreateInput = z.object({
  projectId: z.number().int().positive(),
  materialId: z.number().int().positive(),
  warehouseId: z.number().int().positive(),
  requestedQty: z.number().positive(),
  purpose: z.string().min(1),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.MATERIAL_REQUEST_CREATE);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await createOutbound(jwt.userId, input) });
});
