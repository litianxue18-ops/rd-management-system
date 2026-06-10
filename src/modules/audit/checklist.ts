import { prisma } from '@/shared/prisma';

/**
 * 季度内审参考数据 (新建内审时显示, 辅助审计员填表).
 * 全部从已有业务表聚合, 不持久化.
 *
 * 返回 6 项:
 *  - newResearchers     该季度新入职 researcher 数
 *  - activeProjects     该季度已激活的 active 项目数
 *  - lowWorkhourCount   该季度填工时 < 240h 的人数 (粗略, 60d×8h=480h 的 50%)
 *  - sampleSoldCount    该季度 disposalMethod='sold' 样品销售单数
 *  - sampleSoldIncome   该季度 sold 收入合计
 *  - newCapitalizations 该季度 capitalization_report approved 数
 *  - openExceptions     该季度仍 open 的 ExceptionNote 数
 */
export async function gatherChecklist(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 3;
  const start = new Date(year, startMonth - 1, 1);
  const end = new Date(year, endMonth - 1, 1);

  // 1. 人员认定: 该季度新增的 researcher (按 user.createdAt 落在季度内 + 角色含 researcher)
  const researcherRole = await prisma.role.findUnique({
    where: { code: 'researcher' },
    select: { id: true },
  });
  const newResearchers = researcherRole
    ? await prisma.userRole.count({
        where: {
          roleId: researcherRole.id,
          user: { createdAt: { gte: start, lt: end } },
        },
      })
    : 0;

  // 2. 投入归集: 该季度 active 项目数 (activatedAt 在该季度内, 或现仍 active)
  const activeProjects = await prisma.project.count({
    where: { status: 'active' },
  });

  // 3. 工时真实性: 该季度填工时合计 < 240h 的人数
  const workhourPerUser = await prisma.workhourEntry.groupBy({
    by: ['userId'],
    where: {
      workDate: { gte: start, lt: end },
      status: 'approved',
    },
    _sum: { hours: true },
  });
  const lowWorkhourCount = workhourPerUser.filter(
    (u) => Number(u._sum.hours ?? 0) < 240,
  ).length;

  // 4. 样品销售
  const sampleSold = await prisma.sampleScrapLog.aggregate({
    where: {
      disposalMethod: 'sold',
      registeredAt: { gte: start, lt: end },
    },
    _count: { id: true },
    _sum: { disposalIncome: true },
  });

  // 5. 资本化时点
  const newCap = await prisma.capitalizationReport.count({
    where: {
      createdAt: { gte: start, lt: end },
      status: 'approved',
    },
  });

  // 6. 异常单 (该季度仍 open)
  const openExceptions = await prisma.exceptionNote.count({
    where: { status: 'open', createdAt: { gte: start, lt: end } },
  });

  return {
    period: `${year} Q${quarter}`,
    newResearchers,
    activeProjects,
    lowWorkhourCount,
    sampleSoldCount: sampleSold._count.id,
    sampleSoldIncome: Number(sampleSold._sum.disposalIncome ?? 0),
    newCapitalizations: newCap,
    openExceptions,
  };
}
