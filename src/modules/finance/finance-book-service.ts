import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';

/**
 * 财务账面录入 (月度勾稽第 3 类 finance_business 的 actual 来源).
 *
 * 财务部按月录入"财务账面研发支出总额", 与系统归集 (approved 分摊总额) 比对,
 * 差异率 > 3% 触发异常.
 */

/** upsert 某月财务账面金额 (bookAmount >= 0). */
export async function upsertBookEntry(
  recorderId: number,
  year: number,
  month: number,
  bookAmount: number,
  note?: string,
) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new BusinessError('年月非法', 'INVALID_INPUT');
  }
  if (!(bookAmount >= 0)) {
    throw new BusinessError('账面金额不能为负', 'INVALID_INPUT');
  }
  return prisma.financeBookEntry.upsert({
    where: { year_month: { year, month } },
    create: {
      year,
      month,
      bookAmount,
      note: note ?? null,
      recordedById: recorderId,
    },
    update: {
      bookAmount,
      note: note ?? null,
      recordedById: recorderId,
    },
  });
}

/** 查某月财务账面录入 (无则 null). */
export async function getBookEntry(year: number, month: number) {
  return prisma.financeBookEntry.findUnique({
    where: { year_month: { year, month } },
  });
}
