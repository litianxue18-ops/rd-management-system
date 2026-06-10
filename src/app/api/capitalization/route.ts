import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import {
  createCapitalization,
  listCapitalizations,
} from '@/modules/capitalization/capitalization-service';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  return Response.json({
    data: await listCapitalizations({
      projectId: sp.get('projectId') ? Number(sp.get('projectId')) : undefined,
      status: sp.get('status') ?? undefined,
    }),
  });
});

const CreateInput = z.object({
  projectId: z.number().int().positive(),
  condTechnical: z.boolean(),
  condIntent: z.boolean(),
  condUsability: z.boolean(),
  condMarket: z.boolean(),
  condResource: z.boolean(),
  evidenceTechnical: z.string().default(''),
  evidenceMarket: z.string().default(''),
  evidenceResource: z.string().default(''),
  evidenceCost: z.string().default(''),
  capitalizationAmount: z.number().positive(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await createCapitalization(jwt.userId, input) });
});
