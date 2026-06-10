import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import {
  createConfig,
  listConfigs,
} from '@/modules/finance/shared-resource-service';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import { z } from 'zod';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const includeDisabled = sp.get('includeDisabled') === '1';
  const yearStr = sp.get('year');
  const year = yearStr ? Number(yearStr) : undefined;
  return Response.json({
    data: await listConfigs({ year, includeDisabled }),
  });
});

const CreateInput = z.object({
  year: z.number().int(),
  resourceName: z.string().min(1),
  annualAmount: z.number().nonnegative(),
  allocBasis: z.enum(['workhour', 'equal']),
  note: z.string().optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.SHARED_RESOURCE_CONFIG);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await createConfig(jwt.userId, input) });
});
