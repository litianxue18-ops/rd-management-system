import { prisma } from '@/shared/prisma';
import { ForbiddenError } from '@/shared/errors';
import type { JwtPayload } from '@/modules/auth/jwt';

export async function can(user: JwtPayload, nodeCode: string): Promise<boolean> {
  if (user.roles.length === 0) return false;
  const rights = await prisma.rolePermissionNode.findMany({
    where: {
      nodeCode,
      role: { code: { in: user.roles } },
      raci: { in: ['R', 'A'] },
    },
  });
  return rights.length > 0;
}

export async function requireNode(user: JwtPayload, nodeCode: string): Promise<void> {
  if (!(await can(user, nodeCode))) throw new ForbiddenError(`无权执行节点: ${nodeCode}`);
}

/**
 * 交叉权限: 节点权限 + entity 归属判断
 */
export async function canActOn<T>(
  user: JwtPayload,
  nodeCode: string,
  entity: T,
  ownerCheck: (u: JwtPayload, e: T) => boolean,
): Promise<boolean> {
  if (!(await can(user, nodeCode))) return false;
  return ownerCheck(user, entity);
}
