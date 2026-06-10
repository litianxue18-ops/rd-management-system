'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  ChevronDown,
  Search,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

interface Me {
  id: number;
  name: string;
  username: string;
}

interface Notification {
  id: number;
  message: string;
  readAt: string | null;
  createdAt: string;
  entityType: string | null;
  entityId: number | null;
}

/**
 * 全局顶栏: logo / 全局搜索 (占位) / 通知小红点 / 头像下拉.
 *
 * 行为:
 * - /login 路径不渲染
 * - me 还没拉到也不渲染, 避免闪烁
 * - fetch 失败静默, 不影响下方页面
 */
export function AppTopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (pathname === '/login') return;
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMe(j?.data ?? null))
      .catch(() => {
        /* 静默 */
      });
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setNotifications(j?.data ?? []))
      .catch(() => {
        /* 静默 */
      });
  }, [pathname]);

  // /login 不渲染
  if (pathname === '/login') return null;
  // me 没 load 出来也不渲染, 避免 (logo + 空头像) 闪一下
  if (!me) return null;

  const unreadCount = notifications.filter((n) => n.readAt === null).length;
  const firstChar = (me.name ?? '?').charAt(0);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="sticky top-0 z-30">
      <div className="h-14 border-b-2 border-slate-200 bg-white shadow-sm">
        <div className="h-full max-w-[100rem] mx-auto px-6 flex items-center gap-4">
        <Link href="/workbench" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white text-base font-bold flex items-center justify-center">
            研
          </div>
          <span className="text-base font-semibold text-slate-900 hidden sm:inline">
            研发管理系统
          </span>
        </Link>

        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <Input
              placeholder="全局搜索 (M7+ 启用)"
              disabled
              aria-disabled
              className="pl-8 h-9 text-sm bg-slate-50 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="flex-1 md:hidden" />

        {/* 通知下拉 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative h-9 w-9 rounded-md hover:bg-slate-100 flex items-center justify-center"
              aria-label="通知"
            >
              <Bell size={18} className="text-slate-600" />
              {unreadCount > 0 && (
                <span
                  className="absolute top-0.5 right-0.5 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-medium leading-none flex items-center justify-center"
                  aria-label={`${unreadCount} 条未读`}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">
                通知 ({unreadCount} 未读)
              </span>
              <Link
                href="/notifications"
                className="text-xs text-blue-600 hover:underline"
              >
                查看全部
              </Link>
            </div>
            {notifications.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                暂无通知
              </div>
            ) : (
              notifications.slice(0, 5).map((n) => (
                <Link
                  key={n.id}
                  href={
                    n.entityType && n.entityId
                      ? `/projects/${n.entityId}`
                      : '/notifications'
                  }
                  className={`block px-3 py-2 text-sm hover:bg-slate-50 ${
                    n.readAt === null ? 'bg-blue-50/40 font-medium' : ''
                  }`}
                >
                  <div className="truncate">{n.message}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                    {new Date(n.createdAt).toLocaleString('zh-CN')}
                  </div>
                </Link>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 头像下拉 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 hover:bg-slate-100 rounded-md pl-2 pr-2 h-9"
            >
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center">
                {firstChar}
              </div>
              <span className="text-sm font-medium text-slate-700 hidden sm:inline">
                {me.name}
              </span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/me" className="cursor-pointer">
                <UserIcon size={14} className="mr-2" />
                个人信息
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="text-rose-600 focus:text-rose-600 cursor-pointer"
            >
              <LogOut size={14} className="mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
