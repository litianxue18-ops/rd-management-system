import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { submitWeek } from '@/modules/workhour/workhour-service';

const InputSchema = z.object({ weekStart: z.string().min(1) });

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const { weekStart } = InputSchema.parse(await readJson(req));
  const result = await submitWeek(jwt.userId, new Date(weekStart));
  return Response.json({ data: { count: result.count } });
});
