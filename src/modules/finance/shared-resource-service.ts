import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';

export interface SharedResourceInput {
  year: number;
  resourceName: string;
  annualAmount: number;
  allocBasis: 'workhour' | 'equal';
  note?: string;
}

export interface SharedResourcePatch {
  resourceName?: string;
  annualAmount?: number;
  allocBasis?: 'workhour' | 'equal';
  note?: string | null;
  enabled?: boolean;
}

export async function listConfigs(
  opts: { year?: number; includeDisabled?: boolean } = {},
) {
  return prisma.sharedResourceConfig.findMany({
    where: {
      ...(opts.year ? { year: opts.year } : {}),
      ...(opts.includeDisabled ? {} : { enabled: true }),
    },
    orderBy: [{ year: 'desc' }, { id: 'asc' }],
  });
}

export async function createConfig(
  creatorId: number,
  input: SharedResourceInput,
) {
  if (!input.resourceName?.trim()) {
    throw new BusinessError('资源名称必填', 'INVALID_INPUT');
  }
  if (!Number.isInteger(input.year)) {
    throw new BusinessError('年度非法', 'INVALID_INPUT');
  }
  if (!(input.annualAmount >= 0)) {
    throw new BusinessError('年度总额非法', 'INVALID_INPUT');
  }
  if (input.allocBasis !== 'workhour' && input.allocBasis !== 'equal') {
    throw new BusinessError('分摊依据非法', 'INVALID_INPUT');
  }
  // 同年同名不允许重复 (无 DB unique 约束, 应用层校验)
  const dup = await prisma.sharedResourceConfig.findFirst({
    where: { year: input.year, resourceName: input.resourceName.trim() },
  });
  if (dup) {
    throw new BusinessError(
      `${input.year} 年已存在同名资源: ${input.resourceName}`,
      'DUPLICATE',
    );
  }
  return prisma.sharedResourceConfig.create({
    data: {
      year: input.year,
      resourceName: input.resourceName.trim(),
      annualAmount: input.annualAmount,
      allocBasis: input.allocBasis,
      note: input.note ?? null,
      createdById: creatorId,
    },
  });
}

export async function updateConfig(id: number, patch: SharedResourcePatch) {
  if (
    patch.allocBasis !== undefined &&
    patch.allocBasis !== 'workhour' &&
    patch.allocBasis !== 'equal'
  ) {
    throw new BusinessError('分摊依据非法', 'INVALID_INPUT');
  }
  return prisma.sharedResourceConfig.update({
    where: { id },
    data: {
      ...(patch.resourceName !== undefined
        ? { resourceName: patch.resourceName.trim() }
        : {}),
      ...(patch.annualAmount !== undefined
        ? { annualAmount: patch.annualAmount }
        : {}),
      ...(patch.allocBasis !== undefined ? { allocBasis: patch.allocBasis } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    },
  });
}

export async function disableConfig(id: number) {
  return prisma.sharedResourceConfig.update({
    where: { id },
    data: { enabled: false },
  });
}

/** 月份范围 [start, end) — end 为下月 1 号 (含整月). */
function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

/**
 * 计算某项目某年某月的共用资源分摊额 (该月所有 enabled 配置分摊之和).
 *
 * - 每个 config 月度额 = annualAmount / 12
 * - allocBasis='workhour': 项目当月已审批工时 / 全公司当月已审批工时 × 月度额
 *   (全公司当月工时为 0 → 该 config 分摊 0, 不报错)
 * - allocBasis='equal':   月度额 / 当月有工时的 active+closed 项目数
 *   (该项目当月无工时 → 不分到; 项目数 0 → 0)
 *
 * 返回该项目当月所有 config 分摊额之和 (number).
 */
export async function computeProjectSharedCost(
  projectId: number,
  year: number,
  month: number,
): Promise<number> {
  const configs = await prisma.sharedResourceConfig.findMany({
    where: { year, enabled: true },
  });
  if (configs.length === 0) return 0;

  const { start, end } = monthRange(year, month);

  // 项目当月已审批工时
  const projAgg = await prisma.workhourEntry.aggregate({
    _sum: { hours: true },
    where: {
      projectId,
      status: 'approved',
      workDate: { gte: start, lt: end },
    },
  });
  const projectHours = Number(projAgg._sum.hours ?? 0);

  // 全公司当月已审批工时
  const totalAgg = await prisma.workhourEntry.aggregate({
    _sum: { hours: true },
    where: { status: 'approved', workDate: { gte: start, lt: end } },
  });
  const companyHours = Number(totalAgg._sum.hours ?? 0);

  // 当月有已审批工时的项目数 (用于 equal 平均)
  const grouped = await prisma.workhourEntry.groupBy({
    by: ['projectId'],
    where: { status: 'approved', workDate: { gte: start, lt: end } },
  });
  const activeProjectCount = grouped.length;
  const projectHasHours = grouped.some((g) => g.projectId === projectId);

  let total = 0;
  for (const c of configs) {
    const monthlyAmount = Number(c.annualAmount) / 12;
    if (c.allocBasis === 'workhour') {
      if (companyHours > 0) {
        total += monthlyAmount * (projectHours / companyHours);
      }
    } else {
      // equal: 仅当本项目当月有工时才参与平均
      if (activeProjectCount > 0 && projectHasHours) {
        total += monthlyAmount / activeProjectCount;
      }
    }
  }
  // 金额精度 2 位
  return Math.round(total * 100) / 100;
}
