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
  FileSignature,
  PackageOpen,
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
interface Project {
  id: number;
  code: string;
  name: string;
  status: string;
  projectType?: { name: string };
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

export default function RdDirectorWorkbenchPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [deptProjects, setDeptProjects] = useState<Project[] | null>(null);
  const [notifs, setNotifs] = useState<Notification[] | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/workflow/todo').then((r) => r.json()),
      // scope=department 由后端 scopeWhere 处理, 这里不传 scope 也走默认 (rd_director 默认按部门)
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/notifications').then((r) => r.json()),
    ]).then(([m, td, pr, nt]) => {
      setMe(m.data ?? null);
      setTodos(td.data ?? []);
      setDeptProjects(pr.data ?? []);
      setNotifs(nt.data ?? []);
    });
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const todoList = todos ?? [];
  // 前端 filter by stepName contains, 不再后端加 query
  const initReviewTodos = todoList.filter((t) => t.stepName.includes('研发中心初审'));
  const outboundReviewTodos = todoList.filter(
    (t) => t.stepName.includes('研发中心审批') || t.stepName.includes('研发中心审领料'),
  );

  const activeDeptProjects = (deptProjects ?? []).filter((p) => p.status === 'active');
  const todoCount = todoList.length;
  const unreadNotifs = (notifs ?? []).filter((n) => !n.readAt);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            {me ? `${me.name} · 研发中心负责人工作台` : '研发中心负责人工作台'}
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            待初审立项 / 待审批领料 / 部门项目 / 待办
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
          label="待我初审立项"
          value={initReviewTodos.length}
          hint={initReviewTodos.length === 0 ? '暂无' : '研发中心初审环节'}
          Icon={FileSignature}
          href="/todo"
          loading={todos === null}
          empty={initReviewTodos.length === 0}
        />
        <BigStat
          label="待我审批领料"
          value={outboundReviewTodos.length}
          hint={outboundReviewTodos.length === 0 ? '暂无' : '领料审批环节'}
          Icon={PackageOpen}
          href="/todo"
          loading={todos === null}
          empty={outboundReviewTodos.length === 0}
        />
        <BigStat
          label="部门项目数"
          value={activeDeptProjects.length}
          hint={
            activeDeptProjects.length === 0
              ? '暂无 active 项目'
              : `${activeDeptProjects.length} 个进行中`
          }
          Icon={Folder}
          href="/projects"
          loading={deptProjects === null}
          empty={activeDeptProjects.length === 0}
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

      {/* 下方 2 列: 部门 active 项目 + 最近通知 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-slate-300 shadow-md lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Folder size={16} className="text-blue-600" />
              部门进行中项目
              <span className="text-xs font-normal text-muted-foreground">
                · {activeDeptProjects.length} 项
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
            {deptProjects === null ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : activeDeptProjects.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                部门暂无进行中项目
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activeDeptProjects.slice(0, 5).map((p) => (
                  <li key={p.id} className="py-2">
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center gap-2 hover:bg-blue-50/50 -mx-2 px-2 py-1 rounded"
                    >
                      <code className="text-xs font-mono tabular-nums text-muted-foreground shrink-0">
                        {p.code.startsWith('DRAFT-') ? '草稿' : p.code}
                      </code>
                      <span className="font-medium text-sm truncate flex-1">{p.name}</span>
                      {p.projectType && (
                        <Badge variant="secondary" className="font-normal text-[10px]">
                          {p.projectType.name}
                        </Badge>
                      )}
                      {statusBadge(p.status)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

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
                {(notifs ?? []).slice(0, 3).map((n) => (
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
