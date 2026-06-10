import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { AppError } from '@/shared/errors';
import {
  getAllocation,
  updateEquity,
} from '@/modules/finance/cost-allocation-service';

export const GET = withErrorHandler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await ctx.params;
    const row = await getAllocation(Number(id));
    if (!row) throw new AppError('NOT_FOUND', '分摊单不存在', 404);
    return Response.json({ data: row });
  },
);

const PatchInput = z.object({ equityCost: z.number().nonnegative() });

export const PATCH = withErrorHandler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const jwt = await requireAuth(req);
    const { id } = await ctx.params;
    const input = PatchInput.parse(await readJson(req));
    return Response.json({
      data: await updateEquity(Number(id), jwt.userId, input.equityCost),
    });
  },
);
