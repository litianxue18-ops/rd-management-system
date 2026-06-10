import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { createExceptionNote } from '@/modules/reconciliation/exception-service';

const Input = z.object({
  reason: z.string().min(1),
});

export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const jwt = await requireAuth(req);
    const { id } = await params;
    const body = Input.parse(await readJson(req));
    return Response.json({
      data: await createExceptionNote(jwt.userId, {
        reconciliationId: Number(id),
        reason: body.reason,
      }),
    });
  },
);
