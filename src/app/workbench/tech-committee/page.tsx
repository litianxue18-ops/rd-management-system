'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Inbox,
  Bell,
  LogOut,
  ChevronRight,
  Clock,
  ClipboardCheck,
  FileSignature,
  Award,
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
interface MineStats {
  submittedRunning: number;
  actedThisWeek: number;
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
  Icon: typeof Inbox;
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

export default function TechCommitteeWorkbenchPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [mine, setMine] = useState<MineStats | null>(null);
  const [notifs, setNotifs] = useState<Notification[] | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/workflow/todo').then((r) => r.json()),
      fetch('/api/workflow/mine').then((r) => r.json()),
      fetch('/api/notifications').then((r) => r.json()),
    ]).then(([m, td, mi, nt]) => {
      setMe(m.data ?? null);
      setTodos(td.data ?? []);
      setMine(mi.data ?? null);
      setNotifs(nt.data ?? []);
    });
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const todoList = todos ?? [];
  // 立项流的技委会评审
  const projectReviewTodos = todoList.filter(
    (t) => t.entityType === 'project' && t.stepName.includes('技委会'),
  );
  // 委外流的技委会评审 (entityType outsource_contract)
  const outsourceReviewTodos = todoList.filter(
    (t) => t.entityType !== 'project' && t.stepName.includes('技委会'),
  );
  const todoCount = todoList.length;
  const unreadNotifs = (notifs ?? []).filter((n) => !n.readAt);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            {me ? `${me.name} · 技委会工作台` : '技委会工作台'}
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            待评审立项 / 待评审委外 / 本月已评审 / 待办
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
          label="待我评审立项"
          value={projectReviewTodos.length}
          hint={projectReviewTodos.length === 0 ? '暂无' : '技委会评审环节'}
          Icon={ClipboardCheck}
          href="/todo"
          loading={todos === null}
          empty={projectReviewTodos.length === 0}
        />
        <BigStat
          label="待我评审委外"
          value={outsourceReviewTodos.length}
          hint={outsourceReviewTodos.length === 0 ? '暂无' : '委外合同技委会环节'}
          Icon={FileSignature}
          href="/todo"
          loading={todos === null}
          empty={outsourceReviewTodos.length === 0}
        />
        <BigStat
          label="本周已评审"
          value={mine?.actedThisWeek ?? 0}
          hint={
            mine === null
              ? ''
              : (mine.actedThisWeek ?? 0) === 0
                ? '本周还没评审'
                : `${mine.actedThisWeek} 次审批动作`
          }
          Icon={Award}
          href="/approval"
          loading={mine === null}
          empty={(mine?.actedThisWeek ?? 0) === 0}
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
        {/* 我的待办 (技委会评审) */}
        <Card className="border-slate-300 shadow-md lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardCheck size={16} className="text-blue-600" />
              我的评审待办
              <span className="text-xs font-normal text-muted-foreground">
                · {todoCount} 条
              </span>
              <Button variant="ghost" size="sm" asChild className="ml-auto -my-1">
                <Link href="/todo">
                  查看全部
                  <ChevronRight size={14} className="ml-0.5" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todos === null ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : todoCount === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无评审待办
              </div>
            ) : (
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
    </div>
  );
}
