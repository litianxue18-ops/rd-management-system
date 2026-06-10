import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { tryCreateUnique } from '@/shared/prisma-helpers';

export interface WarehouseInput {
  code: string;
  name: string;
  location?: string;
}

export interface WarehousePatch extends Partial<WarehouseInput> {
  enabled?: boolean;
}

export async function listWarehouses(opts: { includeDisabled?: boolean } = {}) {
  return prisma.warehouse.findMany({
    where: opts.includeDisabled ? {} : { enabled: true },
    orderBy: { id: 'asc' },
  });
}

export async function createWarehouse(input: WarehouseInput) {
  if (!input.code || !input.name) {
    throw new BusinessError('编码 / 名称 必填', 'INVALID_INPUT');
  }
  return tryCreateUnique(
    () => prisma.warehouse.create({ data: { ...input } }),
    `仓库编码已存在: ${input.code}`,
  );
}

export async function updateWarehouse(id: number, patch: WarehousePatch) {
  return prisma.warehouse.update({ where: { id }, data: patch });
}
