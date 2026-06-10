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
  CheckCircle2,
  FileText,
  CalendarClock,
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
  leadUserId: number;
  projectType?: { name: string };
  isTest?: boolean;
}
interface ReviewItem {
  id: number;
  userId: number;
  projectId: number;
  hours: string;
  workDate: string;
  user: { id: number; name: string; employeeId: string };
  project: { id: number; code: string; name: string };
}
interface MonthlyReport {
  id: number;
  projectId: number;
  reportYear: number;
  reportMonth: number;
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

export default function ProjectLeadWorkbenchPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[] | null>(null);
  const [myReports, setMyReports] = useState<MonthlyReport[] | null>(null);
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [notifs, setNotifs] = useState<Notification[] | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/projects?status=active').then((r) => r.json()),
      fetch('/api/workhours/review').then((r) => r.json()),
      // 取本月所有月报, 用于判断"我负责项目"哪些没交
      (() => {
        const now = new Date();
        return fetch(
          `/api/monthly?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
        ).then((r) => r.json());
      })(),
      fetch('/api/workflow/todo').then((r) => r.json()),
      fetch('/api/notifications').then((r) => r.json()),
    ]).then(([m, pr, rv, mr, td, nt]) => {
      setMe(m.data ?? null);
      setProjects(pr.data ?? []);
      setReviewItems(rv.data ?? []);
      setMyReports(mr.data ?? []);
      setTodos(td.data ?? []);
      setNotifs(nt.data ?? []);
    });
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  // --- 卡 1: 我负责的项目 (active + leadUserId=me)
  const myLeadProjects = me
    ? (projects ?? []).filter((p) => p.leadUserId === me.id && p.status === 'active')
    : [];

  // --- 卡 2: 待审批工时
  const reviewCount = (reviewItems ?? []).length;
  const distinctResearchers = new Set((reviewItems ?? []).map((r) => r.userId)).size;
  const distinctProjects = new Set((reviewItems ?? []).map((r) => r.projectId)).size;
  const reviewHint =
    reviewCount === 0
      ? '暂无待审批工时'
      : `${distinctResearchers} 个研发员 · ${distinctProjects} 个项目`;

  // --- 卡 3: 待提交月报 (本月)
  const submittedThisMonthProjIds = new Set(
    (myReports ?? []).map((r) => r.projectId),
  );
  const pendingReportProjects = myLeadProjects.filter(
    (p) => !submittedThisMonthProjIds.has(p.id),
  );
  const monthlyHint =
    myLeadProjects.length === 0
      ? '没有 active 项目'
      : pendingReportProjects.length === 0
        ? '本月月报已全部提交'
        : `本月 ${pendingReportProjects.length} 个项目还没交`;

  // --- 卡 4: 待办
  const todoCount = (todos ?? []).length;
  const todoHint = todoCount === 0 ? '暂无待办' : '审批待处理';

  const unreadNotifs = (notifs ?? []).filter((n) => !n.readAt);

  return (
    <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            {me ? `${me.name} · 项目负责人工作台` : '项目负责人工作台'}
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            我负责的项目 / 待审工时 / 待提交月报 / 待办
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <BigStat
          label="我负责的项目"
          value={myLeadProjects.length}
          hint={
            myLeadProjects.length === 0
              ? '暂无 active 项目'
              : `${myLeadProjects.length} 个进行中`
          }
          Icon={Folder}
          href="/projects"
          loading={projects === null || me === null}
          empty={myLeadProjects.length === 0}
        />
        <BigStat
          label="待审批工时"
          value={reviewCount}
          hint={reviewHint}
          Icon={CheckCircle2}
          href="/workhour/review"
          loading={reviewItems === null}
          empty={reviewCount === 0}
        />
        <BigStat
          label="待提交月报"
          value={pendingReportProjects.length}
          hint={monthlyHint}
          Icon={CalendarClock}
          href="/monthly/new"
          loading={projects === null || myReports === null || me === null}
          empty={pendingReportProjects.length === 0}
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 我负责的项目 (active) */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Folder size={16} className="text-blue-600" />
              我负责的项目 (进行中)
              <span className="text-xs font-normal text-muted-foreground">
                · {myLeadProjects.length} 项
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
            {projects === null || me === null ? (
              <Skeleton className="h-12 w-full" />
            ) : myLeadProjects.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无进行中项目
                <div className="mt-3">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/projects/new">
                      <FilePlus size={14} className="mr-1.5" />
                      发起立项
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {myLeadProjects.slice(0, 5).map((p) => (
                  <li key={p.id} className="py-2">
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center gap-2 hover:bg-blue-50/50 -mx-2 px-2 py-1 rounded"
                    >
                      <span className="font-medium text-sm truncate flex-1">{p.name}</span>
                      <TestBadge show={p.isTest} />
                      <code className="font-mono text-xs text-muted-foreground tabular-nums">
                        {p.code.startsWith('DRAFT-') ? '草稿' : p.code}
                      </code>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 待审批工时 */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-blue-600" />
              待审批工时
              <span className="text-xs font-normal text-muted-foreground">
                · {reviewCount} 条
              </span>
              <Button variant="ghost" size="sm" asChild className="ml-auto -my-1">
                <Link href="/workhour/review">
                  去周审
                  <ChevronRight size={14} className="ml-0.5" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reviewItems === null ? (
              <Skeleton className="h-12 w-full" />
            ) : reviewCount === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无待审批工时
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {reviewItems!.slice(0, 5).map((r) => (
                  <li key={r.id} className="py-2 text-sm flex items-center gap-2">
                    <Clock size={14} className="text-blue-600 shrink-0" />
                    <span className="font-medium truncate">
                      {r.user.name}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      · {r.project.name}
                    </span>
                    <span className="ml-auto text-xs font-mono tabular-nums shrink-0">
                      {Number(r.hours).toFixed(1)} h
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 待提交月报 (本月) */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText size={16} className="text-blue-600" />
              待提交月报 (本月)
              <span className="text-xs font-normal text-muted-foreground">
                · {pendingReportProjects.length} 项
              </span>
              <Button variant="ghost" size="sm" asChild className="ml-auto -my-1">
                <Link href="/monthly/new">
                  去新建
                  <ChevronRight size={14} className="ml-0.5" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myReports === null || projects === null || me === null ? (
              <Skeleton className="h-12 w-full" />
            ) : pendingReportProjects.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {myLeadProjects.length === 0 ? '没有 active 项目' : '本月月报已全部提交'}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingReportProjects.slice(0, 5).map((p) => (
                  <li key={p.id} className="py-2 text-sm flex items-center gap-2">
                    <span className="font-medium truncate flex-1">{p.name}</span>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/monthly/new">填报</Link>
                    </Button>
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
                暂无未读
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
      </div>
    </div>
  );
}
