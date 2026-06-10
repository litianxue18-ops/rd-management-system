import { prisma } from '@/shared/prisma';
import { tryCreateUnique } from '@/shared/prisma-helpers';

export interface SupplierInput {
  code: string;
  name: string;
  contactPerson?: string;
  contactPhone?: string;
}

export async function listSuppliers(opts: { includeDisabled?: boolean } = {}) {
  return prisma.outsourceSupplier.findMany({
    where: opts.includeDisabled ? {} : { enabled: true },
    orderBy: { id: 'asc' },
  });
}

export async function createSupplier(input: SupplierInput) {
  return tryCreateUnique(
    () => prisma.outsourceSupplier.create({ data: input }),
    `供应商编码已存在: ${input.code}`,
  );
}

export interface SupplierPatch {
  name?: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  enabled?: boolean;
}

export async function updateSupplier(id: number, patch: SupplierPatch) {
  return prisma.outsourceSupplier.update({ where: { id }, data: patch });
}
