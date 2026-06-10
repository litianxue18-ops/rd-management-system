'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Folder,
  Inbox,
  Bell,
  LogOut,
  ChevronRight,
  Clock,
  Stamp,
  Building2,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Me {
  id: number;
  name: string;
  roles: { code: string; isPrimary: boolean }[];
}
interface Todo {
  stepId: number;
  instanceId: number;
  stepName: string;
  entityType: string;
  entityId: number;
}
interface Notification {
  id: number;
  message: string;
  createdAt: string;
  readAt: string | null;
}
interface ProjectStats {
  total: number;
  active: number;
  reviewing: number;
  draft: number;
  rejected: number;
  closed: number;
  cancelled: number;
  byType: Record<string, number>;
}

function fmtTime(s: string) {
  const d = new Date(s);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}-${day} ${hh}:${mm}`;
}

interface BigStatProps {
  label: string;
  value: number | string;
  hint: string;
  Icon: typeof Folder;
  href: string;
  loading: boolean;
  empty?: boolean;
}

function BigStat({ label, value, hint, Icon, href, loading, empty }: BigStatProps) {
  return (
    <Link href={href} className="block">
      <Card className="border-slate-300 shadow-md h-28 hover:border-blue-400 hover:shadow-md">
        <CardContent className="h-full flex items-center justify-between px-5 py-0">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{label}</div>
            {loading ? (
              <Skeleton className="h-9 w-16 mt-1" />
            ) : (
              <div className="text-3xl md:text-4xl xl:text-5xl font-bold tabular-nums text-slate-900 mt-1">
                {empty ? '—' : value}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1 truncate max-w-[14rem]">
              {hint}
            </div>
          </div>
          <Icon size={16} className="text-slate-300 shrink-0 self-start mt-1" />
        </CardContent>
      </Card>
    </Link>
  );
}

const STATUS_LABEL: Record<string, string> = {
  active: '进行中',
  reviewing: '审批中',
  draft: '草稿',
  rejected: '已驳回',
  closed: '已结项',
  cancelled: '已取消',
};

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-emerald-500',
  reviewing: 'bg-blue-500',
  draft: 'bg-slate-400',
  rejected: 'bg-rose-500',
  closed: 'bg-violet-500',
  cancelled: 'bg-amber-500',
};

export default function CeoWorkbenchPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [notifs, setNotifs] = useState<Notification[] | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/workflow/todo').then((r) => r.json()),
      fetch('/api/projects/stats').then((r) => r.json()),
      fetch('/api/notifications').then((r) => r.json()),
    ]).then(([m, td, st, nt]) => {
      setMe(m.data ?? null);
      setTodos(td.data ?? []);
      setStats(st.data ?? null);
      setNotifs(nt.data ?? []);
    });
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const todoList = todos ?? [];
  // 立项流的总经理批准
  const projectApprovalTodos = todoList.filter(
    (t) => t.entityType === 'project' && t.stepName.includes('总经理'),
  );
  // 转嫁 / 委外 / 月报 的总经理批准 (entityType 非 project)
  const otherApprovalTodos = todoList.filter(
    (t) => t.entityType !== 'project' && t.stepName.includes('总经理'),
  );
  const todoCount = todoList.length;
  const unreadNotifs = (notifs ?? []).filter((n) => !n.readAt);

  // 状态分布条形
  const statusOrder: (keyof ProjectStats)[] = ['active', 'reviewing', 'draft', 'rejected', 'closed', 'cancelled'];
  const statusRows = stats
    ? statusOrder.map((k) => ({
        key: k as string,
        label: STATUS_LABEL[k as string] ?? (k as string),
        count: (stats[k] as number) ?? 0,
        color: STATUS_COLOR[k as string] ?? 'bg-slate-400',
      }))
    : [];
  const statusMax = statusRows.length ? Math.max(...statusRows.map((r) => r.count), 1) : 1;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            {me ? `${me.name} · 总经理工作台` : '总经理工作台'}
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            待批准立项 / 待批准转嫁委外月报 / 全公司项目数 / 待办
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/workbench">通用工作台</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut size={14} className="mr-1.5" />
            退出
          </Button>
        </div>
      </div>

      {/* KPI 4 卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <BigStat
          label="待我批准立项"
          value={projectApprovalTodos.length}
          hint={projectApprovalTodos.length === 0 ? '暂无' : '立项最终批准'}
          Icon={Stamp}
          href="/todo"
          loading={todos === null}
          empty={projectApprovalTodos.length === 0}
        />
        <BigStat
          label="待我批准转嫁/委外/月报"
          value={otherApprovalTodos.length}
          hint={otherApprovalTodos.length === 0 ? '暂无' : '业务批准环节'}
          Icon={Stamp}
          href="/todo"
          loading={todos === null}
          empty={otherApprovalTodos.length === 0}
        />
        <BigStat
          label="全公司项目"
          value={stats?.active ?? 0}
          hint={
            stats
              ? `进行中 / 共 ${stats.total} 个`
              : ''
          }
          Icon={Building2}
          href="/projects"
          loading={stats === null}
          empty={!stats || stats.active === 0}
        />
        <BigStat
          label="待办"
          value={todoCount}
          hint={todoCount === 0 ? '暂无待办' : '审批待处理'}
          Icon={Inbox}
          href="/todo"
          loading={todos === null}
          empty={todoCount === 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 全公司项目状态分布 */}
        <Card className="border-slate-300 shadow-md lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 size={16} className="text-blue-600" />
              全公司项目状态分布
              <span className="text-xs font-normal text-muted-foreground">
                · 共 {stats?.total ?? 0} 个
              </span>
              <Button variant="ghost" size="sm" asChild className="ml-auto -my-1">
                <Link href="/projects">
                  项目台账
                  <ChevronRight size={14} className="ml-0.5" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats === null ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : (stats.total ?? 0) === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无项目数据
              </div>
            ) : (
              <div className="space-y-3">
                {statusRows.map((row) => (
                  <div key={row.key} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">
                      {row.label}
                    </span>
                    <div className="flex-1 h-5 bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className={`${row.color} h-full rounded-sm transition-all`}
                        style={{ width: `${(row.count / statusMax) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono tabular-nums text-slate-700 w-10 text-right">
                      {row.count}
                    </span>
                  </div>
                ))}
                {Object.keys(stats.byType ?? {}).length > 0 && (
                  <div className="pt-3 mt-3 border-t border-slate-100">
                    <div className="text-xs text-muted-foreground mb-2">按项目类型</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(stats.byType).map(([name, count]) => (
                        <Badge
                          key={name}
                          variant="outline"
                          className="font-normal text-xs border-slate-200"
                        >
                          {name} · <span className="tabular-nums ml-1">{count}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 通知 */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bell size={16} className="text-blue-600" />
              最近通知
              <span className="text-xs font-normal text-muted-foreground">
                · {unreadNotifs.length} 未读
              </span>
              <Button variant="ghost" size="sm" asChild className="ml-auto -my-1">
                <Link href="/notifications">
                  全部
                  <ChevronRight size={14} className="ml-0.5" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notifs === null ? (
              <Skeleton className="h-12 w-full" />
            ) : (notifs ?? []).length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无通知
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(notifs ?? []).slice(0, 5).map((n) => (
                  <li key={n.id} className="py-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span
                        className={`truncate flex-1 ${n.readAt ? 'text-muted-foreground' : 'font-medium'}`}
                      >
                        {n.message}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {fmtTime(n.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 待办列表 */}
      {todoCount > 0 && (
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Inbox size={16} className="text-blue-600" />
              我的待办
              <span className="text-xs font-normal text-muted-foreground">
                · {todoCount} 条
              </span>
              <Button variant="ghost" size="sm" asChild className="ml-auto -my-1">
                <Link href="/todo">
                  全部
                  <ChevronRight size={14} className="ml-0.5" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {todoList.slice(0, 5).map((t) => (
                <li key={t.stepId} className="py-2">
                  <Link
                    href={`/approval/${t.instanceId}`}
                    className="flex items-center gap-2 hover:bg-blue-50/50 -mx-2 px-2 py-1 rounded"
                  >
                    <Clock size={14} className="text-blue-600 shrink-0" />
                    <span className="font-medium text-sm truncate flex-1">{t.stepName}</span>
                    <Badge variant="secondary" className="font-normal text-[10px]">
                      {t.entityType}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
