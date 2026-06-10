import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import {
  createContract,
  listContracts,
} from '@/modules/outsource/contract-service';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  return Response.json({
    data: await listContracts({
      projectId: sp.get('projectId') ? Number(sp.get('projectId')) : undefined,
      status: sp.get('status') ?? undefined,
    }),
  });
});

const CreateInput = z.object({
  contractNo: z.string().min(1),
  projectId: z.number().int().positive(),
  supplierId: z.number().int().positive(),
  title: z.string().min(1),
  scope: z.string().min(1),
  ipOwnership: z.string().min(1),
  totalAmount: z.number().positive(),
  signedDate: z.string().transform((s) => new Date(s)),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await createContract(jwt.userId, input) });
});
