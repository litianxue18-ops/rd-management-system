import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/health'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next();
  // 注意: middleware 跑在 Edge runtime, 不能用 Prisma 校验 tokenVersion;
  // 只检查 token 存在性, tokenVersion / 签名验证仍在 requireAuth (Node runtime).
  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const cookieToken = req.cookies.get('token')?.value;
  const token = bearer ?? cookieToken;
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录或登录已过期' } }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)'],
};
