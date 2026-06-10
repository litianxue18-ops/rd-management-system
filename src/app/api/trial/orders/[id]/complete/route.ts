import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { completeOrder } from '@/modules/trial/production-service';

const Input = z.object({
  actualQty: z.number().positive(),
  actualEnd: z.string().transform((v) => new Date(v)),
});

export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const jwt = await requireAuth(req);
    const { id } = await params;
    const { actualQty, actualEnd } = Input.parse(await readJson(req));
    return Response.json({
      data: await completeOrder(jwt.userId, Number(id), actualQty, actualEnd),
    });
  },
);
