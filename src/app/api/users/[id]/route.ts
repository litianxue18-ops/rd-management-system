import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { updateUser, setUserRoles, resetPassword } from '@/modules/org/user-service';
import { prisma } from '@/shared/prisma';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import { z } from 'zod';

const UpdateInput = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  departmentId: z.number().optional(),
  hourlyCost: z.number().optional(),
  isActive: z.boolean().optional(),
  roles: z.array(z.object({ roleId: z.number(), isPrimary: z.boolean().optional() })).optional(),
  newPassword: z.string().min(4).optional(),
});

export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.ADMIN_USER_MANAGE);
  const { id } = await params;
  const userId = Number(id);
  const input = UpdateInput.parse(await readJson(req));
  const { roles, newPassword, ...userFields } = input;

  // 同一个 tx 保证: 角色 / 密码 / 字段三个更新要么全成要么全回滚
  await prisma.$transaction(async (tx) => {
    if (roles) await setUserRoles(userId, roles, tx);
    if (newPassword) await resetPassword(userId, newPassword, tx);
    if (Object.keys(userFields).length) await updateUser(userId, userFields, tx);
  });
  return Response.json({ data: { ok: true } });
});
