import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { runMonthlyReconciliation } from '@/modules/reconciliation/reconciliation-service';

const RunInput = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const { year, month } = RunInput.parse(await readJson(req));
  return Response.json({ data: await runMonthlyReconciliation(year, month) });
});
