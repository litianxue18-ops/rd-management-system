import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import { updateSupplier } from '@/modules/outsource/supplier-service';

const PatchInput = z.object({
  name: z.string().min(1).optional(),
  contactPerson: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});

export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const jwt = await requireAuth(req);
    await requireNode(jwt, PERMISSION_NODES.ADMIN_OUTSOURCE_MANAGE);
    const { id } = await params;
    const input = PatchInput.parse(await readJson(req));
    return Response.json({ data: await updateSupplier(Number(id), input) });
  },
);
