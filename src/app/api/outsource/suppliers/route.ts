import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import { listSuppliers, createSupplier } from '@/modules/outsource/supplier-service';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  return Response.json({
    data: await listSuppliers({
      includeDisabled: sp.get('includeDisabled') === '1',
    }),
  });
});

const CreateInput = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.ADMIN_OUTSOURCE_MANAGE);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await createSupplier(input) });
});
