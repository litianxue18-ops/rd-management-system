'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Inbox,
  Send,
  Mail,
  CheckCircle2,
  Clock,
  Bell,
  User,
  LogOut,
  FilePlus,
  Folder,
  Package,
  FlaskConical,
  FileBarChart,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  researcher: '研发员',
  project_lead: '项目负责人',
  rd_director: '研发中心',
  warehouse_keeper: '仓管员',
  production_lead: '生产部',
  finance_lead: '财务部',
  ceo: '总经理',
  super_admin: '系统管理员',
  tech_committee: '技委会',
  purchase_lead: '采购部',
  equipment_lead: '设备部',
  hr_lead: '人资',
  audit_lead: '审计部',
};

interface AppEntry {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  disabledModule?: string;
}

const APPS: AppEntry[] = [
  { key: 'project_create', label: '立项申请', icon: FilePlus, href: '/projects/new' },
  { key: 'workhour', label: '工时填报', icon: Clock, href: '/workhour' },
  { key: 'project_list', label: '项目台账', icon: Folder, href: '/projects' },
  { key: 'material', label: '领料申请', icon: Package, href: '/material/outbound/new' },
  { key: 'trial', label: '试制管理', icon: FlaskConical, href: '/trial/orders' },
  { key: 'monthly_report', label: '月度报告', icon: FileBarChart, href: '/monthly' },
  { key: 'notifications', label: '通知中心', icon: Bell, href: '/notifications' },
  { key: 'me', label: '个人信息', icon: User, href: '/me' },
];

function greetingForHour(h: number) {
  if (h <= 5) return '凌晨好';
  if (h <= 11) return '上午好';
  if (h <= 13) return '中午好';
  if (h <= 17) return '下午好';
  return '晚上好';
}

function formatToday(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${y}-${m}-${day} ${weekdays[d.getDay()]}`;
}

interface TodoItem {
  stepId: number;
  instanceId: number;
  entityType: string;
  entityId: number;
  stepName: string;
  submittedAt: string;
}

interface Notification {
  id: number;
  message: string;
  eventType: string;
  entityType: string | null;
  entityId: number | null;
  readAt: string | null;
  createdAt: string;
}

const ENTITY_HREF: Record<string, (id: number) => string> = {
  project: (id) => `/projects/${id}`,
  project_change: (id) => `/projects`,
  monthly_report: (id) => `/monthly/${id}`,
};

export default function GenericWorkbench() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [todoCount, setTodoCount] = useState<number | null>(null);
  const [todoList, setTodoList] = useState<TodoItem[]>([]);
  const [mineRunning, setMineRunning] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [notifList, setNotifList] = useState<Notification[]>([]);
  const [actedThisWeek, setActedThisWeek] = useState<number | null>(null);

  useEffect(() => {
    setNow(new Date());
    fetch('/api/auth/me').then((r) => r.json()).then((j) => setMe(j.data));

    fetch('/api/workflow/todo').then((r) => r.json()).then((j) => {
      const list: TodoItem[] = j.data ?? [];
      setTodoCount(list.length);
      setTodoList(list.slice(0, 5));
    }).catch(() => { setTodoCount(0); setTodoList([]); });

    fetch('/api/workflow/mine').then((r) => r.json()).then((j) => {
      setMineRunning(j.data?.submittedRunning ?? 0);
      setActedThisWeek(j.data?.actedThisWeek ?? 0);
    }).catch(() => { setMineRunning(0); setActedThisWeek(0); });

    fetch('/api/notifications').then((r) => r.json()).then((j) => {
      const list: Notification[] = j.data ?? [];
      const unread = list.filter((n) => n.readAt === null);
      setUnreadCount(unread.length);
      setNotifList(list.slice(0, 3));
    }).catch(() => { setUnreadCount(0); setNotifList([]); });
  }, []);

  const primary = me?.roles?.find((r: any) => r.isPrimary)?.code ?? me?.primaryRole;
  const primaryLabel = primary ? (ROLE_LABELS[primary] ?? primary) : null;
  const greeting = now ? greetingForHour(now.getHours()) : '';
  const dateLine = now ? formatToday(now) : '';

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const KPI_CARDS = [
    { key: 'todo',  title: '待办',     icon: Inbox,         value: todoCount,    href: '/todo' },
    { key: 'mine',  title: '我发起的', icon: Send,          value: mineRunning,  href: '/projects?status=reviewing' },
    { key: 'cc',    title: '未读通知', icon: Mail,          value: unreadCount,  href: '/notifications' },
    { key: 'done',  title: '本周已办', icon: CheckCircle2,  value: actedThisWeek, href: null as string | null },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {greeting && me ? `${greeting}, ${me.name}` : me ? me.name : '工作台'}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            {primaryLabel && (
              <Badge variant="outline" className="font-normal">
                {primaryLabel}
              </Badge>
            )}
            {dateLine && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {dateLine}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {primary === 'super_admin' && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/departments">系统配置</Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut size={14} className="mr-1.5" />
            退出登录
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPI_CARDS.map((c) => {
          const Icon = c.icon;
          const value = c.value;
          const display = value === null ? '—' : value === 0 ? '0' : String(value);
          const hasValue = value !== null && value > 0;
          const card = (
            <Card className={cn(
              'h-24 border-slate-300 shadow-md transition-colors',
              c.href ? 'cursor-pointer hover:border-blue-400 hover:bg-blue-50/60 hover:shadow-md' : '',
            )}>
              <CardContent className="h-full flex items-center justify-between px-5 py-0">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{c.title}</div>
                  <div className={cn(
                    'text-3xl md:text-4xl font-bold tabular-nums mt-1',
                    hasValue ? 'text-slate-900' : 'text-slate-400',
                  )}>
                    {display}
                  </div>
                </div>
                <Icon size={20} className={cn('shrink-0', hasValue ? 'text-blue-400' : 'text-slate-300')} aria-hidden />
              </CardContent>
            </Card>
          );
          return c.href ? (
            <Link key={c.key} href={c.href} className="block">{card}</Link>
          ) : (
            <div key={c.key}>{card}</div>
          );
        })}
      </div>

      {/* 常用应用 */}
      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">常用应用</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {APPS.map((app) => {
              const Icon = app.icon;
              const disabled = !!app.disabledModule;
              const body = (
                <div
                  className={cn(
                    'relative rounded-2xl p-4 flex flex-col items-center gap-2 transition-colors',
                    disabled
                      ? 'bg-slate-100 opacity-60 cursor-not-allowed'
                      : 'bg-blue-50 hover:bg-blue-100',
                  )}
                >
                  <div
                    className={cn(
                      'w-11 h-11 rounded-xl flex items-center justify-center',
                      disabled ? 'bg-slate-300 text-slate-50' : 'bg-blue-600 text-white',
                    )}
                  >
                    <Icon size={24} aria-hidden />
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium text-center',
                      disabled ? 'text-slate-400' : 'text-slate-700',
                    )}
                  >
                    {app.label}
                  </span>
                  {disabled && (
                    <span className="absolute bottom-1.5 right-1.5 text-[10px] font-medium text-slate-500 bg-white/80 px-1 rounded">
                      {app.disabledModule}
                    </span>
                  )}
                </div>
              );
              if (disabled) {
                return (
                  <div key={app.key} role="button" aria-disabled tabIndex={-1}>
                    {body}
                  </div>
                );
              }
              return (
                <Link key={app.key} href={app.href} className="block">
                  {body}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 我的待办 */}
      <Card className="border-slate-300 shadow-md rounded-xl bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              我的待办
              <span className="text-xs font-normal text-muted-foreground">
                · {todoCount === null ? '...' : `${todoCount} 项`}
              </span>
            </span>
            {todoCount !== null && todoCount > 0 && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/todo">查看全部 <ChevronRight size={14} /></Link>
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todoCount === null ? (
            <div className="py-6 text-center text-sm text-muted-foreground">加载中...</div>
          ) : todoList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Inbox size={40} className="text-slate-200" aria-hidden />
              <div className="mt-3 text-base font-medium text-slate-500">暂无待办</div>
              <div className="mt-1 text-sm text-muted-foreground">
                立项 / 月报审批分配给你时会出现在这里
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {todoList.map((t) => (
                <li key={t.stepId}>
                  <Link
                    href={`/approval/${t.instanceId}`}
                    className="flex items-center justify-between py-3 px-1 hover:bg-blue-50/30 rounded transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">{t.stepName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {entityTypeLabel(t.entityType)} · 提交于 {new Date(t.submittedAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 shrink-0" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 最近通知 */}
      <Card className="border-slate-300 shadow-md rounded-xl bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              最近通知
              <span className="text-xs font-normal text-muted-foreground">
                · {unreadCount === null ? '...' : `${unreadCount} 未读`}
              </span>
            </span>
            {notifList.length > 0 && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/notifications">查看全部 <ChevronRight size={14} /></Link>
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unreadCount === null ? (
            <div className="py-6 text-center text-sm text-muted-foreground">加载中...</div>
          ) : notifList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Bell size={40} className="text-slate-200" aria-hidden />
              <div className="mt-3 text-base font-medium text-slate-500">暂无通知</div>
              <div className="mt-1 text-sm text-muted-foreground">
                立项通过等事件会推送到这里
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifList.map((n) => {
                const unread = n.readAt === null;
                const href = n.entityType && n.entityId && ENTITY_HREF[n.entityType]
                  ? ENTITY_HREF[n.entityType](n.entityId)
                  : '/notifications';
                return (
                  <li key={n.id}>
                    <Link
                      href={href}
                      className={cn(
                        'flex items-center justify-between py-3 px-3 rounded transition-colors',
                        unread
                          ? 'bg-blue-50/30 border-l-2 border-blue-500 -ml-3 pl-3 hover:bg-blue-50/50'
                          : 'hover:bg-slate-50',
                      )}
                    >
                      <div className="min-w-0">
                        <div className={cn(
                          'text-sm truncate',
                          unread ? 'font-medium text-slate-900' : 'text-slate-700',
                        )}>
                          {n.message}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                          {new Date(n.createdAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 shrink-0" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function entityTypeLabel(t: string): string {
  switch (t) {
    case 'project': return '立项';
    case 'project_change': return '项目变更';
    case 'monthly_report': return '月度报告';
    default: return t;
  }
}
