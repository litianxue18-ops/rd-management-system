'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckSquare,
  FlaskConical,
  AlertTriangle,
  Bell,
  LogOut,
  Receipt,
  FileSignature,
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

interface SampleRow {
  id: number;
  docNo: string;
  type: 'sample' | 'scrap';
  status: 'draft' | 'supervised';
  consumedQty: string;
  project: { code: string; name: string };
  material: { name: string; unit: string };
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
  Icon: typeof CheckSquare;
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

export default function FinanceWorkbenchPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [samples, setSamples] = useState<SampleRow[] | null>(null);
  const [notifs, setNotifs] = useState<Notification[] | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/workflow/todo').then((r) => r.json()),
      fetch('/api/samples').then((r) => r.json()),
      fetch('/api/notifications').then((r) => r.json()),
    ]).then(([m, td, sp, nt]) => {
      setMe(m.data ?? null);
      setTodos(td.data ?? []);
      setSamples(sp.data ?? []);
      setNotifs(nt.data ?? []);
    });
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const todoCount = (todos ?? []).length;
  const todoHint = todoCount === 0 ? '暂无待处理审批' : '审批待处理';

  const pendingSamples = (samples ?? []).filter((s) => s.status === 'draft');
  const sampleHint =
    pendingSamples.length === 0
      ? '所有样品/废料已监销'
      : `${pendingSamples.length} 条等待监销`;

  const unreadNotifs = (notifs ?? []).filter((n) => !n.readAt);

  return (
    <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            {me ? `${me.name} · 财务部工作台` : '财务部工作台'}
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            待审批 / 待监销样品 / 月度勾稽 / 通知
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
          label="待审批"
          value={todoCount}
          hint={todoHint}
          Icon={CheckSquare}
          href="/todo"
          loading={todos === null}
          empty={todoCount === 0}
        />
        <BigStat
          label="待监销样品/废料"
          value={pendingSamples.length}
          hint={sampleHint}
          Icon={FlaskConical}
          href="/samples?status=draft"
          loading={samples === null}
          empty={pendingSamples.length === 0}
        />
        <BigStat
          label="月度勾稽预警"
          value="—"
          hint="M6 上线"
          Icon={AlertTriangle}
          href="/workbench/finance"
          loading={false}
          empty={true}
        />
        <BigStat
          label="未读通知"
          value={unreadNotifs.length}
          hint={notifs === null ? '' : `共 ${notifs.length} 条`}
          Icon={Bell}
          href="/notifications"
          loading={notifs === null}
          empty={unreadNotifs.length === 0}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 待监销样品 */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FlaskConical size={16} className="text-blue-600" />
              待监销样品/废料
              <span className="text-xs font-normal text-muted-foreground">
                · {pendingSamples.length} 条
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {samples === null ? (
              <Skeleton className="h-12 w-full" />
            ) : pendingSamples.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无待监销
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingSamples.slice(0, 5).map((s) => (
                  <li key={s.id} className="py-2">
                    <Link
                      href={`/samples/${s.id}`}
                      className="flex items-center gap-2 hover:bg-blue-50/50 -mx-2 px-2 py-1 rounded"
                    >
                      <code className="text-xs font-mono tabular-nums text-muted-foreground shrink-0">
                        {s.docNo}
                      </code>
                      {s.type === 'sample' ? (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px] font-normal hover:bg-blue-100">
                          样品
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] font-normal hover:bg-rose-100">
                          废料
                        </Badge>
                      )}
                      <span className="font-medium text-sm truncate flex-1">
                        {s.material.name}
                      </span>
                      <span className="text-xs tabular-nums text-slate-700">
                        {Number(s.consumedQty)} {s.material.unit}
                      </span>
                      <Badge variant="secondary" className="font-normal text-[10px]">
                        {s.project.code}
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
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <Link href="/todo" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <CheckSquare size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">待办</span>
                </div>
              </Link>
              <Link href="/samples" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <FlaskConical size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">样品监销</span>
                </div>
              </Link>
              <Link href="/outsource/contracts" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <FileSignature size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">委外合同</span>
                </div>
              </Link>
              <Link href="/trial/transfers" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Receipt size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">试制费转嫁</span>
                </div>
              </Link>
              <Link href="/monthly" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Receipt size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">月报</span>
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
