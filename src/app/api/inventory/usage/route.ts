import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import {
  createUsage,
  listUsageByOutbound,
  listUsageByProject,
} from '@/modules/inventory/usage-service';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import { BusinessError } from '@/shared/errors';

const Input = z.object({
  outboundId: z.number().int().positive(),
  usageDate: z.coerce.date(),
  quantity: z.number().positive(),
  eventType: z.enum(['testing', 'trial_prep', 'sample_making', 'loss', 'other']),
  description: z.string().min(1),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const outboundId = sp.get('outboundId');
  const projectId = sp.get('projectId');
  if (outboundId) {
    return Response.json({
      data: await listUsageByOutbound(Number(outboundId)),
    });
  }
  if (projectId) {
    return Response.json({
      data: await listUsageByProject(Number(projectId)),
    });
  }
  throw new BusinessError('需提供 outboundId 或 projectId');
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.MATERIAL_USAGE_LOG);
  const input = Input.parse(await readJson(req));
  return Response.json({ data: await createUsage(jwt.userId, input) });
});
