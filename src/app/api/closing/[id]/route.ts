import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { getClosing, updateDraft } from '@/modules/closing/closing-service';
import { BusinessError } from '@/shared/errors';

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await params;
    const r = await getClosing(Number(id));
    if (!r) throw new BusinessError('结项报告不存在', 'NOT_FOUND');
    return Response.json({ data: r });
  },
);

const PatchInput = z.object({
  basicSummary: z.string().min(1).optional(),
  goalReview: z.string().min(1).optional(),
  outputs: z.string().min(1).optional(),
  budgetReview: z.string().min(1).optional(),
  lessons: z.string().min(1).optional(),
  conversionPlan: z.string().min(1).optional(),
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
