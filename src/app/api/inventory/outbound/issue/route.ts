import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { issueOutbound } from '@/modules/inventory/outbound-service';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';

const Input = z.object({
  outboundId: z.number().int().positive(),
  issuedQty: z.number().positive().optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.INVENTORY_OUTBOUND_EXEC);
  const input = Input.parse(await readJson(req));
  return Response.json({
    data: await issueOutbound(jwt.userId, input.outboundId, input.issuedQty),
  });
});
