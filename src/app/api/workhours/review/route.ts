import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import {
  listReviewing,
  approveEntries,
  rejectEntries,
} from '@/modules/workhour/workhour-service';
import { BusinessError } from '@/shared/errors';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  return Response.json({ data: await listReviewing(jwt.userId) });
});

const ActionInput = z.object({
  action: z.enum(['approve', 'reject']),
  entryIds: z.array(z.number().int().positive()).min(1),
  reason: z.string().optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const input = ActionInput.parse(await readJson(req));
  if (input.action === 'approve') {
    await approveEntries(jwt.userId, input.entryIds);
  } else {
    if (!input.reason || input.reason.trim().length === 0) {
      throw new BusinessError('驳回必须填原因');
    }
    await rejectEntries(jwt.userId, input.entryIds, input.reason);
  }
  return Response.json({ data: { ok: true, count: input.entryIds.length } });
});
