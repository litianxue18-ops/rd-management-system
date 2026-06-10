import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { resolveExceptionNote } from '@/modules/reconciliation/exception-service';

const Input = z.object({
  resolution: z.string().min(1),
});

export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const jwt = await requireAuth(req);
    const { id } = await params;
    const { resolution } = Input.parse(await readJson(req));
    return Response.json({
      data: await resolveExceptionNote(jwt.userId, Number(id), resolution),
    });
  },
);
