import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import {
  registerPayment,
  listPayments,
} from '@/modules/outsource/payment-service';
import { BusinessError } from '@/shared/errors';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const contractId = sp.get('contractId')
    ? Number(sp.get('contractId'))
    : null;
  if (!contractId) throw new BusinessError('contractId 必填');
  return Response.json({ data: await listPayments(contractId) });
});

const CreateInput = z.object({
  contractId: z.number().int().positive(),
  amount: z.number().positive(),
  paidDate: z.string().transform((s) => new Date(s)),
  installmentNo: z.number().int().positive(),
  note: z.string().optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  // 财务部 (OUTSOURCE_CONTRACT_REVIEW = finance_lead R+A) 或 super_admin 可登记
  await requireNode(jwt, PERMISSION_NODES.OUTSOURCE_CONTRACT_REVIEW);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await registerPayment(jwt.userId, input) });
});
