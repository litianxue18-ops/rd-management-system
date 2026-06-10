import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { verifyToken, type JwtPayload } from '@/modules/auth/jwt';
import { prisma } from './prisma';
import { AppError, AuthError } from './errors';
import { loadScopeContext } from './scope-where';

/** Zod 字段路径 → 中文名 (常见字段, 兜底用原 path). */
const FIELD_LABELS: Record<string, string> = {
  username: '用户名', employeeId: '工号', name: '姓名', password: '密码',
  email: '邮箱', phone: '手机', departmentId: '部门', roleIds: '角色',
  code: '编码', quantity: '数量', amount: '金额', totalAmount: '金额',
  budget: '预算', hours: '工时', projectId: '项目', materialId: '物料',
};

/** 把 ZodError 转成一条可读中文提示. */
function formatZodError(e: ZodError): string {
  const first = e.issues[0];
  if (!first) return '提交内容有误';
  const field = first.path.length ? (FIELD_LABELS[String(first.path[0])] ?? String(first.path[0])) : '';
  // too_small → 长度/数值不足; invalid_type → 必填/类型错; 其余用 zod 原文兜底
  if (first.code === 'too_small') {
    const min = (first as any).minimum;
    const origin = (first as any).origin ?? (first as any).type;
    if (origin === 'string' || origin === 'array') {
      return `${field}至少 ${min} ${origin === 'array' ? '项' : '个字符'}`;
    }
    return `${field}不能小于 ${min}`;
  }
  if (first.code === 'invalid_type') {
    return `${field}必填或格式不对`;
  }
  if (first.code === 'invalid_format') {
    return `${field}格式不正确`;
  }
  return `${field ? field + ': ' : ''}${first.message}`;
}

export function withErrorHandler(handler: (req: NextRequest, ctx: any) => Promise<Response>) {
  return async (req: NextRequest, ctx: any) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof AppError) {
        return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status });
      }
      if (e instanceof ZodError) {
        return Response.json(
          { error: { code: 'VALIDATION', message: formatZodError(e) } },
          { status: 400 },
        );
      }
      console.error(e);
      return Response.json({ error: { code: 'INTERNAL', message: '服务器错误' } }, { status: 500 });
    }
  };
}

/**
 * 校验登录态:
 * 1. 解析 Bearer / cookie token
 * 2. verifyToken (签名 + 过期)
 * 3. 查 user, 比对 tokenVersion → 服务端可一键撤销 (logout / 改密)
 */
export async function requireAuth(req: NextRequest): Promise<JwtPayload> {
  const authHeader = req.headers.get('authorization');
  const cookie = req.cookies.get('token')?.value;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookie;
  if (!token) throw new AuthError();
  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new AuthError();
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { tokenVersion: true, isActive: true },
  });
  if (!user || !user.isActive) throw new AuthError();
  if (user.tokenVersion !== payload.tokenVersion) throw new AuthError();
  return payload;
}

/** 集成 requireAuth + scope context loading. 业务 list/get API 推荐入口. */
export async function requireScoped(req: NextRequest) {
  const jwt = await requireAuth(req);
  return loadScopeContext(jwt);
}

export async function readJson<T = any>(req: NextRequest): Promise<T> {
  try { return await req.json(); } catch { throw new AppError('BAD_JSON', '请求体不是合法 JSON', 400); }
}
