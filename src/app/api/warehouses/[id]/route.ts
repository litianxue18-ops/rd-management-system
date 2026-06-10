import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { updateWarehouse } from '@/modules/material/warehouse-service';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import { z } from 'zod';

const PatchInput = z.object({
  name: z.string().min(1).optional(),
  location: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.ADMIN_INVENTORY_MANAGE);
  const { id } = await params;
  const input = PatchInput.parse(await readJson(req));
  return Response.json({ data: await updateWarehouse(Number(id), input as any) });
});
