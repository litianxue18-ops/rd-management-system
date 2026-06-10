import { NextRequest } from 'next/server';
import { z } from 'zod';
import '@/app/bootstrap';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { getWeekEntries, upsertEntry } from '@/modules/workhour/workhour-service';
import { BusinessError } from '@/shared/errors';

const QuerySchema = z.object({ weekStart: z.string().min(1) });

const BatchUpsertSchema = z.object({
  entries: z.array(
    z.object({
      projectId: z.number().int().positive(),
      workDate: z.string().transform((s) => new Date(s)),
      hours: z.number().min(0).max(24),
      workContent: z.string(),
    }),
  ),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const weekStartRaw = sp.get('weekStart');
  if (!weekStartRaw) throw new BusinessError('缺少 weekStart');
  const { weekStart } = QuerySchema.parse({ weekStart: weekStartRaw });
  const list = await getWeekEntries(jwt.userId, new Date(weekStart));
  return Response.json({ data: list });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const { entries } = BatchUpsertSchema.parse(await readJson(req));
  const results = [];
  for (const entry of entries) {
    results.push(await upsertEntry(jwt.userId, entry));
  }
  return Response.json({ data: results });
});
