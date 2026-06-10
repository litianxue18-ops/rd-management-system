import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { getTransfer, updateDraft } from '@/modules/trial/transfer-service';
import { BusinessError } from '@/shared/errors';

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await params;
    const r = await getTransfer(Number(id));
    if (!r) throw new BusinessError('转嫁单不存在', 'NOT_FOUND');
    return Response.json({ data: r });
  },
);

const PatchInput = z.object({
  laborCost: z.number().nonnegative().optional(),
  machineCost: z.number().nonnegative().optional(),
  materialCost: z.number().nonnegative().optional(),
  description: z.string().min(1).optional(),
});

export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const jwt = await requireAuth(req);
    const { id } = await params;
    const patch = PatchInput.parse(await readJson(req));
    return Response.json({
      data: await updateDraft(Number(id), jwt.userId, patch),
    });
  },
);
