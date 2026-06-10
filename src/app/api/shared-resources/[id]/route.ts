import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { updateConfig } from '@/modules/finance/shared-resource-service';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import { z } from 'zod';

const PatchInput = z.object({
  resourceName: z.string().min(1).optional(),
  annualAmount: z.number().nonnegative().optional(),
  allocBasis: z.enum(['workhour', 'equal']).optional(),
  note: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});

export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const jwt = await requireAuth(req);
    await requireNode(jwt, PERMISSION_NODES.SHARED_RESOURCE_CONFIG);
    const { id } = await params;
    const input = PatchInput.parse(await readJson(req));
    return Response.json({ data: await updateConfig(Number(id), input) });
  },
);
