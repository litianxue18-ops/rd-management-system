import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { createTrialOrder, listTrialOrders } from '@/modules/trial/production-service';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  return Response.json({
    data: await listTrialOrders({
      projectId: sp.get('projectId') ? Number(sp.get('projectId')) : undefined,
      status: sp.get('status') ?? undefined,
    }),
  });
});

const CreateInput = z.object({
  projectId: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
  plannedQty: z.number().positive(),
  plannedUnit: z.string().min(1),
  scheduledStart: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  scheduledEnd: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
});

// 创建仅需登录: 候选审批人 (项目负责人 / 生产部) 把关后续步骤.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await createTrialOrder(jwt.userId, input) });
});
