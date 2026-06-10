import type { Prisma } from '@prisma/client';

/**
 * 生成项目编号. 按编号规则 'default' 的 pattern 'RD-{TYPE}-{YYYY}-{NNN}' 渲染.
 * 序号 NNN 按 (type, year) 累加, 跨年重置.
 *
 * 必须在事务里调用 (避免并发同序号).
 */
export async function generateProjectCode(
  tx: Prisma.TransactionClient,
  typeCode: string,
  today: Date = new Date(),
) {
  const rule = await tx.projectNumberRule.findUnique({ where: { code: 'default' } });
  if (!rule) throw new Error('default number rule not found, did you seed?');
  const year = today.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  // 查同 type + 同年已激活项目数 (按 activatedAt 落在当年内统计)
  const count = await tx.project.count({
    where: {
      projectType: { code: typeCode },
      activatedAt: { gte: yearStart, lt: yearEnd },
    },
  });
  const nnn = String(count + 1).padStart(3, '0');
  return rule.pattern
    .replace('{TYPE}', typeCode)
    .replace('{YYYY}', String(year))
    .replace('{NNN}', nnn);
}
