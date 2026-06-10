import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { tryCreateUnique } from '@/shared/prisma-helpers';

export async function listProjectTypes(opts: { includeDisabled?: boolean } = {}) {
  return prisma.projectType.findMany({
    where: opts.includeDisabled ? {} : { enabled: true },
    orderBy: { id: 'asc' },
  });
}

export async function createProjectType(input: { code: string; name: string; description?: string }) {
  const existing = await prisma.projectType.findUnique({ where: { code: input.code } });
  if (existing) throw new BusinessError(`项目类型编码已存在: ${input.code}`, 'DUPLICATE');
  return tryCreateUnique(
    () => prisma.projectType.create({ data: input }),
    `项目类型编码已存在: ${input.code}`,
  );
}

export async function updateProjectType(
  id: number,
  input: { name?: string; description?: string; enabled?: boolean },
) {
  return prisma.projectType.update({ where: { id }, data: input });
}
