import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import {
  getCapitalization,
  updateDraft,
} from '@/modules/capitalization/capitalization-service';
import { BusinessError } from '@/shared/errors';

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await params;
    const r = await getCapitalization(Number(id));
    if (!r) throw new BusinessError('资本化报告不存在', 'NOT_FOUND');
    return Response.json({ data: r });
  },
);

const PatchInput = z.object({
  condTechnical: z.boolean().optional(),
  condIntent: z.boolean().optional(),
  condUsability: z.boolean().optional(),
  condMarket: z.boolean().optional(),
  condResource: z.boolean().optional(),
  evidenceTechnical: z.string().optional(),
  evidenceMarket: z.string().optional(),
  evidenceResource: z.string().optional(),
  evidenceCost: z.string().optional(),
  capitalizationAmount: z.number().positive().optional(),
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
