import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';
import { AuthError } from '@/shared/errors';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  const user = await prisma.user.findUnique({
    where: { id: jwt.userId },
    include: { department: true, roles: { include: { role: true } } },
  });
  if (!user) throw new AuthError('用户不存在或已被禁用');
  return Response.json({
    data: {
      id: user.id, username: user.username, name: user.name,
      department: user.department,
      roles: user.roles.map((ur) => ({ code: ur.role.code, name: ur.role.name, isPrimary: ur.isPrimary })),
      primaryRole: jwt.primaryRole,
    },
  });
});
