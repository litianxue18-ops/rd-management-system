import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { getReport, updateDraft } from '@/modules/monthly/monthly-service';
import { BusinessError } from '@/shared/errors';

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await params;
    const r = await getReport(Number(id));
    if (!r) throw new BusinessError('月报不存在', 'NOT_FOUND');
    return Response.json({ data: r });
  },
);

const PatchInput = z.object({
  monthPlan: z.string().min(1).optional(),
  actualCompletion: z.string().min(1).optional(),
  outputs: z.string().min(1).optional(),
  problems: z.string().min(1).optional(),
  resourceUsage: z.string().min(1).optional(),
  nextMonthPlan: z.string().min(1).optional(),
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
