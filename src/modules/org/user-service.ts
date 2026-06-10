import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import { BusinessError } from '@/shared/errors';
import { tryCreateUnique } from '@/shared/prisma-helpers';

type TxOrClient = Prisma.TransactionClient | typeof prisma;

interface CreateUserInput {
  username: string; employeeId: string; name: string; password: string;
  email?: string; phone?: string;
  departmentId?: number;
  hourlyCost?: number;
  roleIds: number[];
  primaryRoleId?: number;
}

export async function createUser(input: CreateUserInput) {
  // 前置 dup-check: 给更友好的错误文案 (没分别提示用户名 / 工号, 暂时按"任一冲突"统一处理)
  const dup = await prisma.user.findFirst({ where: { OR: [{ username: input.username }, { employeeId: input.employeeId }] } });
  if (dup) throw new BusinessError('用户名或工号已存在', 'DUPLICATE');

  const passwordHash = await hashPassword(input.password);
  // tryCreateUnique 兜底: dup-check 和 create 之间的并发窗口
  return tryCreateUnique(
    () =>
      prisma.user.create({
        data: {
          username: input.username, employeeId: input.employeeId, name: input.name,
          email: input.email, phone: input.phone,
          passwordHash,
          departmentId: input.departmentId,
          hourlyCost: input.hourlyCost,
          roles: { create: input.roleIds.map((rid) => ({ roleId: rid, isPrimary: rid === (input.primaryRoleId ?? input.roleIds[0]) })) },
        },
        include: { department: true, roles: { include: { role: true } } },
      }),
    '用户名或工号已存在',
  );
}

export async function listUsers(opts: { departmentId?: number; includeInactive?: boolean } = {}) {
  const users = await prisma.user.findMany({
    where: {
      ...(opts.departmentId ? { departmentId: opts.departmentId } : {}),
      ...(opts.includeInactive ? {} : { isActive: true }),
    },
    include: { department: true, roles: { include: { role: true } } },
    orderBy: { id: 'asc' },
  });
  return users.map((u) => ({
    id: u.id, username: u.username, employeeId: u.employeeId, name: u.name,
    email: u.email, phone: u.phone, isActive: u.isActive,
    department: u.department,
    hourlyCost: u.hourlyCost,
    roles: u.roles.map((ur) => ({ code: ur.role.code, name: ur.role.name, isPrimary: ur.isPrimary })),
  }));
}

export async function updateUser(
  id: number,
  input: Partial<Pick<CreateUserInput, 'name' | 'email' | 'phone' | 'departmentId' | 'hourlyCost'>> & { isActive?: boolean },
  client: TxOrClient = prisma,
) {
  return client.user.update({ where: { id }, data: input });
}

/**
 * @param client 可传入 prisma.$transaction 的 tx; 不传则用全局 prisma 客户端自己开 tx
 */
export async function setUserRoles(
  userId: number,
  roles: Array<{ roleId: number; isPrimary?: boolean }>,
  client?: TxOrClient,
) {
  if (client) {
    await client.userRole.deleteMany({ where: { userId } });
    if (roles.length) {
      await client.userRole.createMany({ data: roles.map((r) => ({ userId, roleId: r.roleId, isPrimary: r.isPrimary ?? false })) });
    }
    return;
  }
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    ...(roles.length
      ? [prisma.userRole.createMany({ data: roles.map((r) => ({ userId, roleId: r.roleId, isPrimary: r.isPrimary ?? false })) })]
      : []),
  ]);
}

export async function resetPassword(userId: number, newPassword: string, client: TxOrClient = prisma) {
  const passwordHash = await hashPassword(newPassword);
  // bump tokenVersion 让旧 token 立即失效 (修改自己密码后所有设备需重新登录)
  return client.user.update({
    where: { id: userId },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });
}
