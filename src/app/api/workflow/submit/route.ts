import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { submit } from '@/modules/workflow/engine';
import { z } from 'zod';

const Input = z.object({ workflowCode: z.string(), entityId: z.number() });

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const input = Input.parse(await readJson(req));
  return Response.json({ data: await submit(jwt, input) });
});
