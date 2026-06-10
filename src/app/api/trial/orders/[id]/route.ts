import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { getTrialOrder, updateDraft } from '@/modules/trial/production-service';
import { BusinessError } from '@/shared/errors';

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await params;
    const r = await getTrialOrder(Number(id));
    if (!r) throw new BusinessError('试制任务不存在', 'NOT_FOUND');
    return Response.json({ data: r });
  },
);

const PatchInput = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  plannedQty: z.number().positive().optional(),
  plannedUnit: z.string().min(1).optional(),
  scheduledStart: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  scheduledEnd: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
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
