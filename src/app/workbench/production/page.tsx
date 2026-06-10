'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ClipboardList,
  Factory,
  Receipt,
  Bell,
  LogOut,
  CheckSquare,
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

interface TrialOrder {
  id: number;
  docNo: string;
  title: string;
  status: string;
  plannedQty: string;
  plannedUnit: string;
  productionLeadId: number | null;
  project: { id: number; code: string; name: string };
}

interface Notification {
  id: number;
  message: string;
  createdAt: string;
  readAt: string | null;
}

interface BigStatProps {
  label: string;
  value: number | string;
  hint: string;
  Icon: typeof ClipboardList;
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

export default function ProductionWorkbenchPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [reviewingOrders, setReviewingOrders] = useState<TrialOrder[] | null>(
    null,
  );
  const [approvedOrders, setApprovedOrders] = useState<TrialOrder[] | null>(
    null,
  );
  const [notifs, setNotifs] = useState<Notification[] | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/workflow/todo').then((r) => r.json()),
      fetch('/api/trial/orders?status=reviewing').then((r) => r.json()),
      fetch('/api/trial/orders?status=approved').then((r) => r.json()),
      fetch('/api/notifications').then((r) => r.json()),
    ]).then(([m, td, rv, ap, nt]) => {
      setMe(m.data ?? null);
      setTodos(td.data ?? []);
      setReviewingOrders(rv.data ?? []);
      setApprovedOrders(ap.data ?? []);
      setNotifs(nt.data ?? []);
    });
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  // 卡 1: 待接单 = step name 含 "生产部接单" + assigned to me
  const pendingReceive = (todos ?? []).filter(
    (t) =>
      t.entityType === 'trial_production_order' && t.stepName.includes('接单'),
  );
  const pendingReceiveHint =
    pendingReceive.length === 0
      ? '暂无待接单试制任务'
      : `${pendingReceive.length} 单待接单`;

  // 卡 2: 进行中试制 = approved + productionLeadId = me
  const myInProgress = (approvedOrders ?? []).filter(
    (o) => o.productionLeadId === me?.id,
  );
  const inProgressHint =
    myInProgress.length === 0
      ? '当前没有进行中试制'
      : `${myInProgress.length} 个进行中`;

  // 卡 3: 待审批转嫁单 = step name 含 "生产部" + entityType=trial_cost_transfer
  const pendingTransfer = (todos ?? []).filter(
    (t) =>
      t.entityType === 'trial_cost_transfer' &&
      t.stepName.includes('生产部'),
  );
  const transferHint =
    pendingTransfer.length === 0
      ? '暂无待审批转嫁单'
      : `${pendingTransfer.length} 单转嫁待确认`;

  // 卡 4: 全部待办
  const todoCount = (todos ?? []).length;

  const unreadNotifs = (notifs ?? []).filter((n) => !n.readAt);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            {me ? `${me.name} · 生产部工作台` : '生产部工作台'}
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            待接单试制 / 进行中试制 / 待审批转嫁单 / 待办
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
          label="待接单试制"
          value={pendingReceive.length}
          hint={pendingReceiveHint}
          Icon={ClipboardList}
          href="/todo"
          loading={todos === null}
          empty={pendingReceive.length === 0}
        />
        <BigStat
          label="进行中试制"
          value={myInProgress.length}
          hint={inProgressHint}
          Icon={Factory}
          href="/trial/orders"
          loading={approvedOrders === null}
          empty={myInProgress.length === 0}
        />
        <BigStat
          label="待审批转嫁单"
          value={pendingTransfer.length}
          hint={transferHint}
          Icon={Receipt}
          href="/todo"
          loading={todos === null}
          empty={pendingTransfer.length === 0}
        />
        <BigStat
          label="全部待办"
          value={todoCount}
          hint={todoCount === 0 ? '暂无待办' : '审批待处理'}
          Icon={CheckSquare}
          href="/todo"
          loading={todos === null}
          empty={todoCount === 0}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 进行中试制 */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Factory size={16} className="text-blue-600" />
              我的进行中试制
              <span className="text-xs font-normal text-muted-foreground">
                · {myInProgress.length} 单
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {approvedOrders === null ? (
              <Skeleton className="h-12 w-full" />
            ) : myInProgress.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                当前没有 approved 状态的试制任务
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {myInProgress.slice(0, 6).map((o) => (
                  <li key={o.id} className="py-2">
                    <Link
                      href={`/trial/orders/${o.id}`}
                      className="flex items-center gap-2 hover:bg-blue-50/50 -mx-2 px-2 py-1 rounded"
                    >
                      <code className="text-xs font-mono tabular-nums text-muted-foreground shrink-0">
                        {o.docNo}
                      </code>
                      <span className="font-medium text-sm truncate flex-1">
                        {o.title}
                      </span>
                      <span className="text-xs tabular-nums text-slate-700">
                        {Number(o.plannedQty)} {o.plannedUnit}
                      </span>
                      <Badge variant="secondary" className="font-normal text-[10px]">
                        {o.project.code}
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
              通知
              <span className="text-xs font-normal text-muted-foreground">
                · {unreadNotifs.length} 未读 / {notifs?.length ?? 0} 总
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notifs === null ? (
              <Skeleton className="h-12 w-full" />
            ) : notifs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无通知
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifs.slice(0, 5).map((n) => (
                  <li
                    key={n.id}
                    className={`py-2 text-sm ${n.readAt ? 'text-muted-foreground' : 'text-slate-900 font-medium'}`}
                  >
                    {n.message}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 常用应用 */}
        <Card className="border-slate-300 shadow-md md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">常用应用</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <Link href="/trial/orders" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Factory size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">试制任务</span>
                </div>
              </Link>
              <Link href="/trial/transfers" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Receipt size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">费用转嫁</span>
                </div>
              </Link>
              <Link href="/trial/transfers/new" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Receipt size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">新建转嫁</span>
                </div>
              </Link>
              <Link href="/todo" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <CheckSquare size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">待办</span>
                </div>
              </Link>
              <Link href="/notifications" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Bell size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">通知</span>
                </div>
              </Link>
              <Link href="/samples" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <ClipboardList size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">样品/废料</span>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
