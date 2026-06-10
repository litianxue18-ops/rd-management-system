import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { generateDocNo } from '@/modules/inventory/doc-no-generator';
import type { Prisma } from '@prisma/client';

/**
 * 资本化评估输入.
 *
 * 5 项条件 (per IAS 38, 全部为 true 方可资本化):
 *   - condTechnical : 技术可行
 *   - condIntent    : 完成意图与使用/出售
 *   - condUsability : 能为企业产生未来经济利益 (可用性)
 *   - condMarket    : 市场价值
 *   - condResource  : 有足够资源完成开发
 *
 * 4 项必备支撑材料 (textarea, 至少填 3 项):
 *   - evidenceTechnical : 技术可行性证明 (评审意见 / 试制结果 / 第三方测试)
 *   - evidenceMarket    : 市场价值证明 (市场调研 / 客户意向)
 *   - evidenceResource  : 资源保障证明 (预算批复 / 人员配置)
 *   - evidenceCost      : 成本可计量证明 (工时台账 / 物料归集)
 */
export interface CapitalizationInput {
  projectId: number;
  condTechnical: boolean;
  condIntent: boolean;
  condUsability: boolean;
  condMarket: boolean;
  condResource: boolean;
  evidenceTechnical: string;
  evidenceMarket: string;
  evidenceResource: string;
  evidenceCost: string;
  capitalizationAmount: number;
}

function assertGate(input: {
  condTechnical: boolean;
  condIntent: boolean;
  condUsability: boolean;
  condMarket: boolean;
  condResource: boolean;
  evidenceTechnical: string;
  evidenceMarket: string;
  evidenceResource: string;
  evidenceCost: string;
}) {
  const allTrue =
    input.condTechnical &&
    input.condIntent &&
    input.condUsability &&
    input.condMarket &&
    input.condResource;
  if (!allTrue) throw new BusinessError('5 个资本化条件必须全部满足');

  const noteCount = [
    input.evidenceTechnical,
    input.evidenceMarket,
    input.evidenceResource,
    input.evidenceCost,
  ].filter((n) => n && n.trim().length > 0).length;
  if (noteCount < 3) throw new BusinessError('必备支撑材料至少填写 3 项');
}

export async function createCapitalization(
  creatorId: number,
  input: CapitalizationInput,
) {
  if (input.capitalizationAmount <= 0)
    throw new BusinessError('资本化金额必须 > 0');

  assertGate(input);

  const proj = await prisma.project.findUnique({
    where: { id: input.projectId },
  });
  if (!proj) throw new BusinessError('项目不存在');
  if (proj.status !== 'active')
    throw new BusinessError('仅 active 项目可申请资本化');

  return prisma.$transaction(async (tx) => {
    const docNo = await generateDocNo(tx, 'cap');
    return tx.capitalizationReport.create({
      data: {
        docNo,
        projectId: input.projectId,
        condTechnical: input.condTechnical,
        condIntent: input.condIntent,
        condUsability: input.condUsability,
        condMarket: input.condMarket,
        condResource: input.condResource,
        evidenceTechnical: input.evidenceTechnical ?? '',
        evidenceMarket: input.evidenceMarket ?? '',
        evidenceResource: input.evidenceResource ?? '',
        evidenceCost: input.evidenceCost ?? '',
        capitalizationAmount: input.capitalizationAmount,
        createdById: creatorId,
        status: 'draft',
      },
      include: {
        project: { select: { id: true, code: true, name: true } },
      },
    });
  });
}

export async function listCapitalizations(
  opts: { projectId?: number; status?: string } = {},
) {
  return prisma.capitalizationReport.findMany({
    where: {
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(opts.status ? { status: opts.status as any } : {}),
    },
    include: {
      project: { select: { id: true, code: true, name: true } },
    },
    orderBy: { id: 'desc' },
  });
}

export async function getCapitalization(id: number) {
  return prisma.capitalizationReport.findUnique({
    where: { id },
    include: { project: true },
  });
}

export async function updateDraft(
  id: number,
  userId: number,
  patch: Partial<Omit<CapitalizationInput, 'projectId'>>,
) {
  const c = await prisma.capitalizationReport.findUnique({ where: { id } });
  if (!c) throw new BusinessError('资本化报告不存在');
  if (c.status !== 'draft') throw new BusinessError('仅 draft 可编辑');
  if (c.createdById !== userId) throw new BusinessError('仅创建人可编辑');

  // 校验金额 (若 patch 含)
  if (patch.capitalizationAmount !== undefined && patch.capitalizationAmount <= 0)
    throw new BusinessError('资本化金额必须 > 0');

  // 用 merged 重新跑 5 条件 + 3/4 材料门控
  const merged = {
    condTechnical:
      patch.condTechnical !== undefined ? patch.condTechnical : c.condTechnical,
    condIntent: patch.condIntent !== undefined ? patch.condIntent : c.condIntent,
    condUsability:
      patch.condUsability !== undefined ? patch.condUsability : c.condUsability,
    condMarket: patch.condMarket !== undefined ? patch.condMarket : c.condMarket,
    condResource:
      patch.condResource !== undefined ? patch.condResource : c.condResource,
    evidenceTechnical:
      patch.evidenceTechnical !== undefined
        ? patch.evidenceTechnical
        : c.evidenceTechnical,
    evidenceMarket:
      patch.evidenceMarket !== undefined ? patch.evidenceMarket : c.evidenceMarket,
    evidenceResource:
      patch.evidenceResource !== undefined
        ? patch.evidenceResource
        : c.evidenceResource,
    evidenceCost:
      patch.evidenceCost !== undefined ? patch.evidenceCost : c.evidenceCost,
  };
  assertGate(merged);

  const data: Prisma.CapitalizationReportUpdateInput = {};
  if (patch.condTechnical !== undefined) data.condTechnical = patch.condTechnical;
  if (patch.condIntent !== undefined) data.condIntent = patch.condIntent;
  if (patch.condUsability !== undefined) data.condUsability = patch.condUsability;
  if (patch.condMarket !== undefined) data.condMarket = patch.condMarket;
  if (patch.condResource !== undefined) data.condResource = patch.condResource;
  if (patch.evidenceTechnical !== undefined)
    data.evidenceTechnical = patch.evidenceTechnical;
  if (patch.evidenceMarket !== undefined)
    data.evidenceMarket = patch.evidenceMarket;
  if (patch.evidenceResource !== undefined)
    data.evidenceResource = patch.evidenceResource;
  if (patch.evidenceCost !== undefined) data.evidenceCost = patch.evidenceCost;
  if (patch.capitalizationAmount !== undefined)
    data.capitalizationAmount = patch.capitalizationAmount;

  return prisma.capitalizationReport.update({ where: { id }, data });
}

// ===== workflow hooks =====

export async function setReviewing(id: number, tx: Prisma.TransactionClient) {
  await tx.capitalizationReport.update({
    where: { id },
    data: { status: 'reviewing' },
  });
}

export async function setApproved(id: number, tx: Prisma.TransactionClient) {
  await tx.capitalizationReport.update({
    where: { id },
    data: { status: 'approved', approvedAt: new Date() },
  });
}

export async function setRejected(
  id: number,
  reason: string,
  tx: Prisma.TransactionClient,
) {
  await tx.capitalizationReport.update({
    where: { id },
    data: { status: 'rejected', rejectedReason: reason },
  });
}
