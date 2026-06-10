import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';

/**
 * 聚合一个项目的全部档案数据, 返回结构化 JSON.
 * 包含: 项目基本信息 / 成员 / 工时 / 月报 / 出入库 / 样品废料 /
 *      试制单 / 转嫁单 / 委外合同+付款 / 立项变更 / 结项报告
 *
 * 使用 Prisma include 一次查全, 避免 N+1.
 */
export async function generateArchiveMetadata(projectId: number) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      projectType: true,
      members: true,
      changes: { orderBy: { id: 'asc' } },
      workhours: { orderBy: { id: 'asc' } },
      reports: { orderBy: [{ reportYear: 'asc' }, { reportMonth: 'asc' }] },
      outbounds: {
        include: {
          material: { select: { code: true, name: true, unit: true } },
          warehouse: { select: { code: true, name: true } },
          returns: true,
        },
        orderBy: { id: 'asc' },
      },
      sampleLogs: {
        include: {
          material: { select: { code: true, name: true, unit: true } },
        },
        orderBy: { id: 'asc' },
      },
      trialOrders: { orderBy: { id: 'asc' } },
      trialTransfers: { orderBy: { id: 'asc' } },
      outsourceContracts: {
        include: {
          supplier: { select: { code: true, name: true } },
          payments: { orderBy: { id: 'asc' } },
        },
        orderBy: { id: 'asc' },
      },
      closingReport: true,
    },
  });

  if (!project) throw new BusinessError('项目不存在');

  return {
    generatedAt: new Date().toISOString(),
    project: {
      id: project.id,
      code: project.code,
      name: project.name,
      type: project.projectType.name,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      budget: project.budget,
      background: project.background,
      goals: project.goals,
      techPlan: project.techPlan,
      schedule: project.schedule,
      budgetDetail: project.budgetDetail,
      expectedOutput: project.expectedOutput,
      activatedAt: project.activatedAt,
    },
    members: project.members,
    changeRequests: project.changes,
    workhours: project.workhours,
    monthlyReports: project.reports,
    inventoryOutbounds: project.outbounds,
    sampleScrapLogs: project.sampleLogs,
    trialOrders: project.trialOrders,
    trialTransfers: project.trialTransfers,
    outsourceContracts: project.outsourceContracts,
    closingReport: project.closingReport,
  };
}
