import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { createSample, listSamples } from '@/modules/sample/sample-service';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  return Response.json({
    data: await listSamples({
      projectId: sp.get('projectId') ? Number(sp.get('projectId')) : undefined,
      type: (sp.get('type') as 'sample' | 'scrap' | null) ?? undefined,
      status: sp.get('status') ?? undefined,
    }),
  });
});

const CreateInput = z.object({
  projectId: z.number().int().positive(),
  type: z.enum(['sample', 'scrap']),
  sourceOutboundId: z.number().int().positive().optional(),
  materialId: z.number().int().positive(),
  warehouseId: z.number().int().positive(),
  consumedQty: z.number().positive(),
  productName: z.string().optional(),
  productQty: z.number().positive().optional(),
  productUnit: z.string().optional(),
  disposalMethod: z.enum(['retained', 'destroyed', 'sold', 'internal_use']),
  disposalIncome: z.number().positive().optional(),
  note: z.string().optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.SAMPLE_SCRAP_REGISTER);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await createSample(jwt.userId, input) });
});
