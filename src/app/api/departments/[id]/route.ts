import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { updateDepartment, disableDepartment } from '@/modules/org/department-service';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import { z } from 'zod';

const UpdateInput = z.object({ name: z.string().min(1).optional(), enabled: z.boolean().optional() });

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.ADMIN_DEPT_MANAGE);
  const { id } = await params;
  const input = UpdateInput.parse(await readJson(req));
  return Response.json({ data: await updateDepartment(Number(id), input) });
});

export const DELETE = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.ADMIN_DEPT_MANAGE);
  const { id } = await params;
  return Response.json({ data: await disableDepartment(Number(id)) });
});
