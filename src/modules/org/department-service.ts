import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { tryCreateUnique } from '@/shared/prisma-helpers';

export async function createDepartment(input: { code: string; name: string }) {
  const existing = await prisma.department.findUnique({ where: { code: input.code } });
  if (existing) throw new BusinessError(`部门编码已存在: ${input.code}`, 'DUPLICATE');
  return tryCreateUnique(() => prisma.department.create({ data: input }), `部门编码已存在: ${input.code}`);
}

export async function listDepartments(opts: { includeDisabled?: boolean } = {}) {
  return prisma.department.findMany({
    where: opts.includeDisabled ? {} : { enabled: true },
    orderBy: { id: 'asc' },
  });
}

export async function updateDepartment(id: number, input: { name?: string; enabled?: boolean }) {
  return prisma.department.update({ where: { id }, data: input });
}

export async function disableDepartment(id: number) {
  return prisma.department.update({ where: { id }, data: { enabled: false } });
}
