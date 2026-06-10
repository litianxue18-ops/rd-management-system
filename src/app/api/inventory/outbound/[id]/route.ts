import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import {
  getOutbound,
  updateDraftOutbound,
} from '@/modules/inventory/outbound-service';
import { BusinessError } from '@/shared/errors';

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await params;
    const r = await getOutbound(Number(id));
    if (!r) throw new BusinessError('领料单不存在', 'NOT_FOUND');
    return Response.json({ data: r });
  },
);

const PatchInput = z.object({
  materialId: z.number().int().positive().optional(),
  warehouseId: z.number().int().positive().optional(),
  requestedQty: z.number().positive().optional(),
  purpose: z.string().min(1).optional(),
});

export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const jwt = await requireAuth(req);
    const { id } = await params;
    const patch = PatchInput.parse(await readJson(req));
    return Response.json({
      data: await updateDraftOutbound(Number(id), jwt.userId, patch),
    });
  },
);
