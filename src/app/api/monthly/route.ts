import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { createReport, listReports } from '@/modules/monthly/monthly-service';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const list = await listReports({
    projectId: sp.get('projectId') ? Number(sp.get('projectId')) : undefined,
    year: sp.get('year') ? Number(sp.get('year')) : undefined,
    month: sp.get('month') ? Number(sp.get('month')) : undefined,
    status: sp.get('status') ?? undefined,
  });
  return Response.json({ data: list });
});

const CreateInput = z.object({
  projectId: z.number().int().positive(),
  reportYear: z.number().int().min(2000).max(2100),
  reportMonth: z.number().int().min(1).max(12),
  monthPlan: z.string().min(1),
  actualCompletion: z.string().min(1),
  outputs: z.string().min(1),
  problems: z.string().min(1),
  resourceUsage: z.string().min(1),
  nextMonthPlan: z.string().min(1),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await createReport(jwt.userId, input) });
});
