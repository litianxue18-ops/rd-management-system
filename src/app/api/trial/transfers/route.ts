import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { createTransfer, listTransfers } from '@/modules/trial/transfer-service';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  return Response.json({
    data: await listTransfers({
      projectId: sp.get('projectId') ? Number(sp.get('projectId')) : undefined,
      status: sp.get('status') ?? undefined,
      trialOrderId: sp.get('trialOrderId')
        ? Number(sp.get('trialOrderId'))
        : undefined,
    }),
  });
});

const CreateInput = z.object({
  trialOrderId: z.number().int().positive(),
  laborCost: z.number().nonnegative(),
  machineCost: z.number().nonnegative(),
  materialCost: z.number().nonnegative(),
  description: z.string().min(1),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await createTransfer(jwt.userId, input) });
});
