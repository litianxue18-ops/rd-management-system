import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { createMaterial, listMaterials } from '@/modules/material/material-service';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import { z } from 'zod';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const includeDisabled = req.nextUrl.searchParams.get('includeDisabled') === '1';
  const category = req.nextUrl.searchParams.get('category') ?? undefined;
  return Response.json({ data: await listMaterials({ includeDisabled, category }) });
});

const CreateInput = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  spec: z.string().optional(),
  category: z.string().optional(),
  isHazmat: z.boolean().optional(),
  safetyStock: z.number().nonnegative().optional(),
  maxStock: z.number().nonnegative().optional(),
  shelfLifeDays: z.number().int().nonnegative().optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.ADMIN_INVENTORY_MANAGE);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await createMaterial(input) });
});
