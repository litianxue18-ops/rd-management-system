import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { tryCreateUnique } from '@/shared/prisma-helpers';

/**
 * 季度内审 (5 大重点检查):
 *  schema 字段     UI 标签 (per plan 5 大重点)
 *  checkProject    人员认定
 *  checkBudget     投入归集
 *  checkMaterial   工时记录
 *  checkOutsource  样品销售
 *  checkArchive    资本化时点
 *
 * 每项 = textarea 检查内容 + boolean 合规.
 * 总体: overallOpinion + 任一项不合规则必须提供整改意见 (整改意见写入 overallOpinion 末尾).
 *
 * 单号约定: AUD-{year}-Q{quarter}-001 (year+quarter 已是 @@unique, 每季度仅一份).
 */
export interface AuditInput {
  year: number;
  quarter: number;
  checkProject: string;
  checkBudget: string;
  checkMaterial: string;
  checkOutsource: string;
  checkArchive: string;
  compliantProject: boolean;
  compliantBudget: boolean;
  compliantMaterial: boolean;
  compliantOutsource: boolean;
  compliantArchive: boolean;
  overallOpinion: string;
  /** 任一不合规时, 必填; 拼到 overallOpinion 末尾 */
  rectifyRequired?: string;
}

export async function createAudit(auditorId: number, input: AuditInput) {
  if (input.quarter < 1 || input.quarter > 4)
    throw new BusinessError('季度必须 1-4');
  if (input.year < 2020 || input.year > 2100)
    throw new BusinessError('年份不合法');
  if (!input.overallOpinion?.trim())
    throw new BusinessError('总体意见必填');

  const anyNonCompliant =
    !input.compliantProject ||
    !input.compliantBudget ||
    !input.compliantMaterial ||
    !input.compliantOutsource ||
    !input.compliantArchive;
  if (anyNonCompliant && !input.rectifyRequired?.trim()) {
    throw new BusinessError('存在不合规项时, 整改要求必填');
  }

  const overallOpinion = anyNonCompliant
    ? `${input.overallOpinion.trim()}\n\n[整改要求]\n${(input.rectifyRequired ?? '').trim()}`
    : input.overallOpinion.trim();

  return tryCreateUnique(
    () =>
      prisma.quarterlyAudit.create({
        data: {
          year: input.year,
          quarter: input.quarter,
          checkProject: input.checkProject ?? '',
          checkBudget: input.checkBudget ?? '',
          checkMaterial: input.checkMaterial ?? '',
          checkOutsource: input.checkOutsource ?? '',
          checkArchive: input.checkArchive ?? '',
          compliantProject: input.compliantProject,
          compliantBudget: input.compliantBudget,
          compliantMaterial: input.compliantMaterial,
          compliantOutsource: input.compliantOutsource,
          compliantArchive: input.compliantArchive,
          overallOpinion,
          auditorId,
        },
      }),
    `${input.year} Q${input.quarter} 内审已存在`,
  );
}

export async function listAudits(opts: { year?: number; quarter?: number } = {}) {
  return prisma.quarterlyAudit.findMany({
    where: {
      ...(opts.year ? { year: opts.year } : {}),
      ...(opts.quarter ? { quarter: opts.quarter } : {}),
    },
    orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
  });
}

export async function getAudit(id: number) {
  return prisma.quarterlyAudit.findUnique({ where: { id } });
}

/** 季度内审 "doc_no" 显示用 (schema 无字段, 推导): AUD-{year}-Q{quarter}-001. */
export function deriveDocNo(year: number, quarter: number) {
  return `AUD-${year}-Q${quarter}-001`;
}
