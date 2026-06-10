import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { getProject, updateDraftProject } from '@/modules/project/project-service';
import { BusinessError } from '@/shared/errors';
import { z } from 'zod';

export const GET = withErrorHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAuth(_req);
    const { id } = await params;
    const proj = await getProject(Number(id));
    if (!proj) throw new BusinessError('项目不存在', 'NOT_FOUND');
    return Response.json({ data: proj });
  },
);

const PatchInput = z.object({
  name: z.string().min(1).optional(),
  projectTypeId: z.number().optional(),
  departmentId: z.number().optional(),
  leadUserId: z.number().optional(),
  startDate: z.string().transform((s) => new Date(s)).optional(),
  endDate: z.string().transform((s) => new Date(s)).optional(),
  budget: z.number().positive().optional(),
  background: z.string().min(1).optional(),
  goals: z.string().min(1).optional(),
  techPlan: z.string().min(1).optional(),
  schedule: z.string().min(1).optional(),
  budgetDetail: z.string().min(1).optional(),
  expectedOutput: z.string().min(1).optional(),
  attachmentsNote: z.string().optional(),
});

export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const jwt = await requireAuth(req);
    const { id } = await params;
    const patch = PatchInput.parse(await readJson(req));
    return Response.json({
      data: await updateDraftProject(Number(id), jwt.userId, patch),
    });
  },
);
