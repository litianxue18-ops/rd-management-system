import { NextRequest } from 'next/server';
import { withErrorHandler, requireScoped, readJson } from '@/shared/api-helpers';
import { createProject, listProjects } from '@/modules/project/project-service';
import { z } from 'zod';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const ctx = await requireScoped(req);
  const sp = req.nextUrl.searchParams;
  const list = await listProjects(ctx, {
    status: sp.get('status') ?? undefined,
    typeCode: sp.get('type') ?? undefined,
    departmentId: sp.get('departmentId') ? Number(sp.get('departmentId')) : undefined,
  });
  return Response.json({ data: list });
});

const MemberInput = z.object({ userId: z.number(), role: z.string().min(1) });

const CreateInput = z.object({
  name: z.string().min(1),
  projectTypeId: z.number(),
  departmentId: z.number(),
  leadUserId: z.number(),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)),
  budget: z.number().positive(),
  background: z.string().min(1),
  goals: z.string().min(1),
  techPlan: z.string().min(1),
  schedule: z.string().min(1),
  budgetDetail: z.string().min(1),
  expectedOutput: z.string().min(1),
  attachmentsNote: z.string().optional(),
  members: z.array(MemberInput).optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const ctx = await requireScoped(req);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await createProject(ctx.user.userId, input) });
});
