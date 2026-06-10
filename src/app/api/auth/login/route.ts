import { NextRequest } from 'next/server';
import { withErrorHandler, readJson } from '@/shared/api-helpers';
import { login } from '@/modules/auth/service';

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { username, password } = await readJson<{ username: string; password: string }>(req);
  if (!username || !password) {
    return Response.json({ error: { code: 'BAD_INPUT', message: '请填用户名和密码' } }, { status: 400 });
  }
  const result = await login(username, password);
  const res = Response.json({ data: result });
  const secure = process.env.COOKIE_SECURE === 'true' ? ' Secure;' : '';
  res.headers.append(
    'set-cookie',
    `token=${result.token}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=43200`,
  );
  return res;
});
