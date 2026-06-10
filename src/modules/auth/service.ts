import { prisma } from '@/shared/prisma';
import { verifyPassword } from './password';
import { signToken } from './jwt';
import { BusinessError } from '@/shared/errors';

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { roles: { include: { role: true } } },
  });
  if (!user || !user.isActive) throw new BusinessError('用户名或密码错误', 'LOGIN_FAILED');

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new BusinessError('用户名或密码错误', 'LOGIN_FAILED');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const roleCodes = user.roles.map((ur) => ur.role.code);
  const primaryRole = user.roles.find((ur) => ur.isPrimary)?.role.code ?? roleCodes[0] ?? 'researcher';

  const token = signToken({ userId: user.id, roles: roleCodes, primaryRole, tokenVersion: user.tokenVersion });
  return {
    token,
    user: { id: user.id, username: user.username, name: user.name, roles: roleCodes, primaryRole },
  };
}
