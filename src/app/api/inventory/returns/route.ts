import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { returnOutbound } from '@/modules/inventory/return-service';

const Input = z.object({
  outboundId: z.number().int().positive(),
  quantity: z.number().positive(),
  reason: z.string().optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  // M4 简化: 申请人或仓管员都可发起退库, 仅 requireAuth, 业务规则在 service 内验
  const input = Input.parse(await readJson(req));
  return Response.json({
    data: await returnOutbound(
      jwt.userId,
      input.outboundId,
      input.quantity,
      input.reason,
    ),
  });
});
