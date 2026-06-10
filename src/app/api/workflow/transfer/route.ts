import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { transfer } from '@/modules/workflow/engine';
import { z } from 'zod';

const Input = z.object({ stepId: z.number(), toUserId: z.number(), comments: z.string().optional() });

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const input = Input.parse(await readJson(req));
  await transfer(jwt, input);
  return Response.json({ data: { ok: true } });
});
