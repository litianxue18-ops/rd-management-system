import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { createUser, listUsers } from '@/modules/org/user-service';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import { z } from 'zod';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const deptId = req.nextUrl.searchParams.get('departmentId');
  const includeInactive = req.nextUrl.searchParams.get('includeInactive') === '1';
  return Response.json({ data: await listUsers({
    departmentId: deptId ? Number(deptId) : undefined, includeInactive,
  }) });
});

const CreateInput = z.object({
  username: z.string().min(1),
  employeeId: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(4),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  departmentId: z.number().optional(),
  hourlyCost: z.number().optional(),
  roleIds: z.array(z.number()).min(1),
  primaryRoleId: z.number().optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.ADMIN_USER_MANAGE);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await createUser(input) });
});
