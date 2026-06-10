import { Prisma } from '@prisma/client';
import { BusinessError } from './errors';

/**
 * 捕获 Prisma P2002 unique 约束冲突, 翻译成用户友好的 BusinessError.
 *
 * 用法:
 *   const u = await tryCreateUnique(
 *     () => prisma.user.create({ data: {...} }),
 *     '用户名或工号已存在',
 *   );
 *
 * 业务层应继续保留前置 dup-check 来给更精准的错误文案 (例如分别提示用户名/工号),
 * 这里是兜底: 防止 dup-check 和 create 之间的竞态条件.
 */
export async function tryCreateUnique<T>(fn: () => Promise<T>, friendlyMessage: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new BusinessError(friendlyMessage, 'DUPLICATE');
    }
    throw e;
  }
}
