import { resolveScope, type ModuleKey, type Scope } from '@/modules/permission/scope';
import type { JwtPayload } from '@/modules/auth/jwt';
import { prisma } from '@/shared/prisma';

export interface ScopeContext {
  user: JwtPayload;
  /** 当前用户的部门 id (来自 user 表), 用于 'department' 范围. */
  departmentId: number | null;
}

/**
 * 加载当前用户的 ScopeContext (查一次 DB 拿 departmentId).
 * 在 service 层入口调用, 然后传给所有需要 scope 的查询.
 */
export async function loadScopeContext(user: JwtPayload): Promise<ScopeContext> {
  const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { departmentId: true } });
  return { user, departmentId: u?.departmentId ?? null };
}

/**
 * 给 Prisma where 注入数据范围条件. 调用方提供针对各个 scope 档位的 WHERE 片段;
 * helper 选最合适的一个返回, super_admin / global 永远返回 {} (全开放).
 *
 * 例:
 *   const where = scopeWhere(ctx, 'project', {
 *     self:         () => ({ createdById: ctx.user.userId }),
 *     responsible:  () => ({ leadUserId:  ctx.user.userId }),
 *     department:   () => ({ departmentId: ctx.departmentId ?? -1 }),
 *   });
 */
export function scopeWhere<T extends Record<string, any>>(
  ctx: ScopeContext,
  module: ModuleKey,
  fragments: Partial<Record<Exclude<Scope, 'global'>, () => T>>,
): T | Record<string, never> {
  const scope = resolveScope(ctx.user.roles, module);
  if (scope === 'global') return {};
  const fn = fragments[scope];
  if (!fn) return {};
  return fn();
}
