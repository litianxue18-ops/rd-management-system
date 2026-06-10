import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../src/modules/auth/password';
import { ROLE_CODES } from '../../src/modules/permission/nodes';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

export async function seedAdmin(prisma: PrismaClient) {
  const existing = await prisma.user.findFirst({ where: { roles: { some: { role: { code: ROLE_CODES.SUPER_ADMIN } } } } });
  if (existing) {
    console.log(`super_admin 已存在: ${existing.username}, 跳过`);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const username = (await rl.question('super_admin 用户名 (默认 admin): ')).trim() || 'admin';
  const name = (await rl.question('姓名 (默认 系统管理员): ')).trim() || '系统管理员';
  const password = (await rl.question('密码 (>=8 位): ')).trim();
  rl.close();
  if (password.length < 8) throw new Error('密码至少 8 位');

  const role = await prisma.role.findUnique({ where: { code: ROLE_CODES.SUPER_ADMIN } });
  if (!role) throw new Error('super_admin 角色未 seed, 请先 pnpm seed');

  await prisma.user.create({
    data: {
      username, employeeId: 'ADMIN', name,
      passwordHash: await hashPassword(password),
      roles: { create: [{ roleId: role.id, isPrimary: true }] },
    },
  });
  console.log(`已创建 super_admin: ${username}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const prisma = new PrismaClient();
  seedAdmin(prisma).finally(() => prisma.$disconnect());
}
