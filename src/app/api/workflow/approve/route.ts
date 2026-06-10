import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { approve } from '@/modules/workflow/engine';
import { z } from 'zod';

const Input = z.object({ stepId: z.number(), comments: z.string().optional() });

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const input = Input.parse(await readJson(req));
  return Response.json({ data: await approve(jwt, input) });
});
