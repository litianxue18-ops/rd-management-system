'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Folder,
  Inbox,
  Bell,
  LogOut,
  FilePlus,
  ChevronRight,
  Clock,
  CalendarDays,
  PackageMinus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TestBadge } from '@/shared/components/test-badge';

interface Me {
  id: number;
  name: string;
  roles: { code: string; isPrimary: boolean }[];
}
interface Project {
  id: number;
  code: string;
  name: string;
  status: string;
  projectType?: { name: string };
  isTest?: boolean;
}
interface WorkhourEntry {
  id: number;
  projectId: number;
  workDate: string;
  hours: string;
  status: string;
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

function fmtTime(s: string) {
  const d = new Date(s);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}-${day} ${hh}:${mm}`;
}

function statusBadge(s: string) {
  if (s === 'active')
    return (
      <Badge variant="outline" className="text-white border-emerald-700 bg-emerald-600 font-normal text-[10px]">进行中</Badge>
    );
  if (s === 'reviewing')
    return (
      <Badge variant="outline" className="text-white border-blue-700 bg-blue-600 font-normal text-[10px]">审批中</Badge>
    );
  if (s === 'draft')
    return <Badge variant="secondary" className="font-normal text-[10px]">草稿</Badge>;
  return <Badge variant="secondary" className="font-normal text-[10px]">{s}</Badge>;
}

/** 取本周一 (周日时返回上周一) ISO yyyy-mm-dd. */
function getMondayISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun..6=Sat
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
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
            <div className="text-xs text-muted-foreground mt-1 truncate max-w-[12rem]">
              {hint}
            </div>
          </div>
          <Icon size={16} className="text-slate-300 shrink-0 self-start mt-1" />
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ResearcherWorkbenchPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [weekEntries, setWeekEntries] = useState<WorkhourEntry[] | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [notifs, setNotifs] = useState<Notification[] | null>(null);
  const [pendingUsage, setPendingUsage] = useState<number | null>(null);

  useEffect(() => {
    const monday = getMondayISO();
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch(`/api/workhours?weekStart=${monday}`).then((r) => r.json()),
      fetch('/api/projects?status=active').then((r) => r.json()),
      fetch('/api/workflow/todo').then((r) => r.json()),
      fetch('/api/notifications').then((r) => r.json()),
    ]).then(([m, wh, pr, td, nt]) => {
      setMe(m.data ?? null);
      setWeekEntries(wh.data ?? []);
      setProjects(pr.data ?? []);
      setTodos(td.data ?? []);
      setNotifs(nt.data ?? []);
      // 待登记消耗: 我领的 issued/returned 领料单里在手量 > 0 的单数
      const meId = m.data?.id;
      if (meId) {
        loadPendingUsage(meId);
      } else {
        setPendingUsage(0);
      }
    });
  }, []);

  async function loadPendingUsage(meId: number) {
    try {
      const [issued, returned] = await Promise.all([
        fetch(`/api/inventory/outbound?requesterId=${meId}&status=issued`).then(
          (r) => r.json(),
        ),
        fetch(`/api/inventory/outbound?requesterId=${meId}&status=returned`).then(
          (r) => r.json(),
        ),
      ]);
      const outbounds: Array<{
        id: number;
        issuedQty: string;
        returnedQty: string;
      }> = [...(issued.data ?? []), ...(returned.data ?? [])];
      const usageByOutbound = await Promise.all(
        outbounds.map((o) =>
          fetch(`/api/inventory/usage?outboundId=${o.id}`)
            .then((r) => r.json())
            .then((j) => ({ o, logs: j.data ?? [] })),
        ),
      );
      const count = usageByOutbound.filter(({ o, logs }) => {
        const consumed = logs.reduce(
          (s: number, l: { quantity: string }) => s + Number(l.quantity),
          0,
        );
        const inHand = Number(o.issuedQty) - Number(o.returnedQty) - consumed;
        return inHand > 0;
      }).length;
      setPendingUsage(count);
    } catch {
      setPendingUsage(0);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  // --- 卡 1: 本周工时
  const totalHours = (weekEntries ?? []).reduce(
    (sum, e) => sum + Number(e.hours),
    0,
  );
  const projectIdsInWeek = new Set((weekEntries ?? []).map((e) => e.projectId));
  const dayCountInWeek = new Set(
    (weekEntries ?? []).map((e) => e.workDate.slice(0, 10)),
  ).size;
  const weekHint =
    !weekEntries || weekEntries.length === 0
      ? '本周还没填'
      : `${projectIdsInWeek.size} 个项目 · ${dayCountInWeek} 天`;

  // --- 卡 2: 我的项目
  const activeProjects = projects ?? [];
  const topProjectNames = activeProjects.slice(0, 3).map((p) => p.name).join('、');
  const projHint =
    activeProjects.length === 0
      ? '暂无 active 项目'
      : activeProjects.length <= 3
        ? topProjectNames
        : `${topProjectNames}...`;

  // --- 卡 3: 待办
  const todoCount = (todos ?? []).length;
  const todoHint = todoCount === 0 ? '暂无待办' : '审批待处理';

  // --- 卡 4: 通知
  const unreadNotifs = (notifs ?? []).filter((n) => !n.readAt);
  const totalNotifs = (notifs ?? []).length;
  const readCount = totalNotifs - unreadNotifs.length;
  const notifHint =
    totalNotifs === 0 ? '暂无通知' : `${readCount} 条已读 / ${totalNotifs} 条总计`;

  const meLoading = !me;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            {me ? `${me.name} · 研发员工作台` : '研发员工作台'}
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            本周工时 / 我的项目 / 待办 / 通知
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

      {/* KPI 概览 - 真实数据 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <BigStat
          label="本周已填工时"
          value={totalHours.toFixed(1) + ' h'}
          hint={weekHint}
          Icon={CalendarDays}
          href="/workhour"
          loading={weekEntries === null}
          empty={(weekEntries?.length ?? 0) === 0}
        />
        <BigStat
          label="我的项目"
          value={activeProjects.length}
          hint={projHint}
          Icon={Folder}
          href="/projects"
          loading={projects === null}
          empty={activeProjects.length === 0}
        />
        <BigStat
          label="待办"
          value={todoCount}
          hint={todoHint}
          Icon={Inbox}
          href="/todo"
          loading={todos === null}
          empty={todoCount === 0}
        />
        <BigStat
          label="未读通知"
          value={unreadNotifs.length}
          hint={notifHint}
          Icon={Bell}
          href="/notifications"
          loading={notifs === null}
          empty={unreadNotifs.length === 0}
        />
        <BigStat
          label="待登记消耗"
          value={pendingUsage ?? 0}
          hint={
            (pendingUsage ?? 0) === 0
              ? '暂无待登记'
              : `${pendingUsage} 笔领料待登记日常消耗`
          }
          Icon={PackageMinus}
          href="/material/outbound?mine=1"
          loading={pendingUsage === null}
          empty={(pendingUsage ?? 0) === 0}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 我的项目 */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Folder size={16} className="text-blue-600" />
              我的项目
              <span className="text-xs font-normal text-muted-foreground">
                · {activeProjects.length} 项
              </span>
              <Button variant="ghost" size="sm" asChild className="ml-auto -my-1">
                <Link href="/projects">
                  查看全部
                  <ChevronRight size={14} className="ml-0.5" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projects === null ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : activeProjects.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无 active 项目
                <div className="mt-3">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/projects/new">
                      <FilePlus size={14} className="mr-1.5" />
                      新建立项
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activeProjects.slice(0, 5).map((p) => (
                  <li key={p.id} className="py-2">
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center gap-2 hover:bg-blue-50/50 -mx-2 px-2 py-1 rounded"
                    >
                      <span className="font-medium text-sm truncate flex-1">{p.name}</span>
                      <TestBadge show={p.isTest} />
                      {statusBadge(p.status)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 待办 */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Inbox size={16} className="text-blue-600" />
              待办
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
              <Skeleton className="h-12 w-full" />
            ) : todoCount === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无待办
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {todos!.slice(0, 5).map((t) => (
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
              未读通知
              <span className="text-xs font-normal text-muted-foreground">
                · {unreadNotifs.length} 条
              </span>
              <Button variant="ghost" size="sm" asChild className="ml-auto -my-1">
                <Link href="/notifications">
                  查看全部
                  <ChevronRight size={14} className="ml-0.5" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notifs === null ? (
              <Skeleton className="h-12 w-full" />
            ) : unreadNotifs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无未读通知
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {unreadNotifs.slice(0, 5).map((n) => (
                  <li key={n.id} className="py-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="truncate flex-1">{n.message}</span>
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

        {/* 应用 */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">常用应用</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <Link href="/workhour" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <CalendarDays size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">工时填报</span>
                </div>
              </Link>
              <Link href="/projects/new" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <FilePlus size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">立项申请</span>
                </div>
              </Link>
              <Link href="/projects" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Folder size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">项目台账</span>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
