import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { tryCreateUnique } from '@/shared/prisma-helpers';

export interface MaterialInput {
  code: string;
  name: string;
  spec?: string;
  unit: string;
  category?: string;
  isHazmat?: boolean;
  safetyStock?: number;
  maxStock?: number;
  shelfLifeDays?: number;
}

export interface MaterialPatch extends Partial<MaterialInput> {
  enabled?: boolean;
}

export async function listMaterials(opts: { includeDisabled?: boolean; category?: string } = {}) {
  return prisma.material.findMany({
    where: {
      ...(opts.includeDisabled ? {} : { enabled: true }),
      ...(opts.category ? { category: opts.category } : {}),
    },
    orderBy: { id: 'asc' },
  });
}

export async function createMaterial(input: MaterialInput) {
  if (!input.code || !input.name || !input.unit) {
    throw new BusinessError('编码 / 名称 / 单位 必填', 'INVALID_INPUT');
  }
  return tryCreateUnique(
    () => prisma.material.create({ data: { ...input } }),
    `物料编码已存在: ${input.code}`,
  );
}

export async function updateMaterial(id: number, patch: MaterialPatch) {
  return prisma.material.update({ where: { id }, data: patch });
}
