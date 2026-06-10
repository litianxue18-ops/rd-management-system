import { NextRequest } from 'next/server';
import { verifyToken } from '@/modules/auth/jwt';
import { prisma } from '@/shared/prisma';

/**
 * POST /api/auth/logout
 * 服务端注销: 解析当前 token, 若有效则把对应 user.tokenVersion+1,
 * 让该用户当前所有外发 token 立即失效 (含其他设备 / tab).
 * token 无效 / 已过期 → 静默清 cookie 即可.
 * NOTE: 未来 password reset / 改密同样应 bump tokenVersion. M1 暂无该 UI.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cookie = req.cookies.get('token')?.value;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookie;

  if (token) {
    try {
      const payload = verifyToken(token);
      await prisma.user.update({
        where: { id: payload.userId },
        data: { tokenVersion: { increment: 1 } },
      });
    } catch {
      // 静默: 无效 token 不需要 bump, 直接清 cookie
    }
  }

  const res = Response.json({ data: { ok: true } });
  const secure = process.env.COOKIE_SECURE === 'true' ? ' Secure;' : '';
  res.headers.append('set-cookie', `token=; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=0`);
  return res;
}
