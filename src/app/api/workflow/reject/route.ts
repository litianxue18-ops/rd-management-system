import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { reject } from '@/modules/workflow/engine';
import { z } from 'zod';

const Input = z.object({ stepId: z.number(), comments: z.string().optional() });

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const input = Input.parse(await readJson(req));
  await reject(jwt, input);
  return Response.json({ data: { ok: true } });
});
