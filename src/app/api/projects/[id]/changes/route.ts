import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import {
  createChangeRequest,
  listChanges,
} from '@/modules/project/change-service';
import { z } from 'zod';

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await params;
    return Response.json({ data: await listChanges(Number(id)) });
  },
);

const CreateInput = z.object({
  reason: z.string().min(1),
  scope: z.string().min(1),
  details: z.string().min(1),
  newBudget: z.number().positive().optional(),
  newEndDate: z.string().transform((s) => new Date(s)).optional(),
});

export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const jwt = await requireAuth(req);
    const { id } = await params;
    const input = CreateInput.parse(await readJson(req));
    return Response.json({
      data: await createChangeRequest(Number(id), jwt.userId, input),
    });
  },
);
