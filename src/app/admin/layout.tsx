import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/shared/components/admin-sidebar';
import { verifyToken } from '@/modules/auth/jwt';
import { can } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import { prisma } from '@/shared/prisma';

/**
 * 服务端守卫: /admin/* 必须有 admin_view 权限.
 * 不仅校验 token 签名, 也校验 tokenVersion 一致 + isActive.
 * 失败一律跳 /workbench, 防止 token 过期回 /login 死循环和信息泄漏.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get('token')?.value;
  if (!token) redirect('/login?redirect=/admin');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    redirect('/login?redirect=/admin');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { tokenVersion: true, isActive: true },
  });
  if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
    redirect('/login?redirect=/admin');
  }

  if (!(await can(payload, PERMISSION_NODES.ADMIN_VIEW))) {
    redirect('/workbench');
  }

  // AppTopBar 占 h-14 (3.5rem), 这里减掉以避免页面整体超出 viewport.
  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-3.5rem)] bg-white">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
