import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import {
  upsertBookEntry,
  getBookEntry,
} from '@/modules/finance/finance-book-service';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get('year'));
  const month = Number(sp.get('month'));
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return Response.json({ data: null });
  }
  return Response.json({ data: await getBookEntry(year, month) });
});

const UpsertInput = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  bookAmount: z.number().nonnegative(),
  note: z.string().optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.MONTHLY_RECONCILIATION);
  const input = UpsertInput.parse(await readJson(req));
  return Response.json({
    data: await upsertBookEntry(
      jwt.userId,
      input.year,
      input.month,
      input.bookAmount,
      input.note,
    ),
  });
});
