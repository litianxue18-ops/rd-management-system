import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { withdraw } from '@/modules/workflow/engine';
import { z } from 'zod';

const Input = z.object({ instanceId: z.number() });

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const input = Input.parse(await readJson(req));
  await withdraw(jwt, input);
  return Response.json({ data: { ok: true } });
});
