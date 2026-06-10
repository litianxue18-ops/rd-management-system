import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import {
  createClosing,
  listClosings,
} from '@/modules/closing/closing-service';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  return Response.json({
    data: await listClosings({
      projectId: sp.get('projectId') ? Number(sp.get('projectId')) : undefined,
      status: sp.get('status') ?? undefined,
    }),
  });
});

const CreateInput = z.object({
  projectId: z.number().int().positive(),
  basicSummary: z.string().min(1),
  goalReview: z.string().min(1),
  outputs: z.string().min(1),
  budgetReview: z.string().min(1),
  lessons: z.string().min(1),
  conversionPlan: z.string().min(1),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await createClosing(jwt.userId, input) });
});
