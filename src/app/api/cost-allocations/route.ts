import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import {
  listAllocations,
  generateAllocation,
  generateMonthAll,
} from '@/modules/finance/cost-allocation-service';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  return Response.json({
    data: await listAllocations({
      year: sp.get('year') ? Number(sp.get('year')) : undefined,
      month: sp.get('month') ? Number(sp.get('month')) : undefined,
      projectId: sp.get('projectId') ? Number(sp.get('projectId')) : undefined,
      status: sp.get('status') ?? undefined,
    }),
  });
});

const GenerateInput = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('single'),
    projectId: z.number().int().positive(),
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    equityCost: z.number().nonnegative().optional(),
  }),
  z.object({
    mode: z.literal('month'),
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
  }),
]);

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.WORKHOUR_MONTHLY_AGGREGATE);
  const input = GenerateInput.parse(await readJson(req));
  if (input.mode === 'single') {
    return Response.json({
      data: await generateAllocation(
        jwt.userId,
        input.projectId,
        input.year,
        input.month,
        input.equityCost ?? 0,
      ),
    });
  }
  const count = await generateMonthAll(jwt.userId, input.year, input.month);
  return Response.json({ data: { generated: count } });
});
