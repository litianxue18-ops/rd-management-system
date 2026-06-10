import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { createAudit, listAudits } from '@/modules/audit/audit-service';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  return Response.json({
    data: await listAudits({
      year: sp.get('year') ? Number(sp.get('year')) : undefined,
      quarter: sp.get('quarter') ? Number(sp.get('quarter')) : undefined,
    }),
  });
});

const CreateInput = z.object({
  year: z.number().int().min(2020).max(2100),
  quarter: z.number().int().min(1).max(4),
  checkProject: z.string().default(''),
  checkBudget: z.string().default(''),
  checkMaterial: z.string().default(''),
  checkOutsource: z.string().default(''),
  checkArchive: z.string().default(''),
  compliantProject: z.boolean(),
  compliantBudget: z.boolean(),
  compliantMaterial: z.boolean(),
  compliantOutsource: z.boolean(),
  compliantArchive: z.boolean(),
  overallOpinion: z.string().min(1),
  rectifyRequired: z.string().optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await createAudit(jwt.userId, input) });
});
