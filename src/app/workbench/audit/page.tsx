'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckSquare,
  AlertTriangle,
  ShieldCheck,
  ClipboardList,
  LogOut,
  Bell,
  ChevronRight,
  Coins,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

interface Audit {
  id: number;
  year: number;
  quarter: number;
  compliantProject: boolean;
  compliantBudget: boolean;
  compliantMaterial: boolean;
  compliantOutsource: boolean;
  compliantArchive: boolean;
}

interface ExceptionRow {
  id: number;
  docNo: string;
  status: string;
  reason: string;
  createdAt: string;
  reconciliation: {
    year: number;
    month: number;
    checkType: string;
  };
}

interface ReconRow {
  id: number;
  year: number;
  month: number;
  checkType: string;
  diffRate: string;
  isException: boolean;
}

interface CapRow {
  id: number;
  status: string;
  createdAt: string;
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

function currentQuarterRange() {
  const d = new Date();
  return { year: d.getFullYear(), quarter: Math.floor(d.getMonth() / 3) + 1 };
}

function compliantCount(a: Audit) {
  return (
    Number(a.compliantProject) +
    Number(a.compliantBudget) +
    Number(a.compliantMaterial) +
    Number(a.compliantOutsource) +
    Number(a.compliantArchive)
  );
}

function checkTypeLabel(t: string) {
  if (t === 'workhour_project') return '工时-项目';
  if (t === 'material_output') return '领料-产出';
  return '财务-业务';
}

/**
 * 审计组长工作台 (CD-T5 真数据).
 * KPI: 本季内审 / 异常单 open / 本季新资本化 / 待办
 */
export default function AuditWorkbenchPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [audits, setAudits] = useState<Audit[] | null>(null);
  const [openExceptions, setOpenExceptions] = useState<ExceptionRow[] | null>(null);
  const [recentRecons, setRecentRecons] = useState<ReconRow[] | null>(null);
  const [newCaps, setNewCaps] = useState<CapRow[] | null>(null);

  useEffect(() => {
    const cq = currentQuarterRange();
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/workflow/todo').then((r) => r.json()),
      fetch(`/api/audits?year=${cq.year}&quarter=${cq.quarter}`).then((r) => r.json()),
      fetch('/api/reconciliation/exceptions?status=open').then((r) =>
        r.ok ? r.json() : { data: [] },
      ),
      // 近 3 月勾稽: 拉当月即可, 没有时显示空
      fetch(`/api/reconciliation?year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`).then((r) =>
        r.json(),
      ),
      fetch('/api/capitalization?status=approved').then((r) => r.json()),
    ])
      .then(([m, td, au, ex, rc, cap]) => {
        setMe(m.data ?? null);
        setTodos(td.data ?? []);
        setAudits(au.data ?? []);
        setOpenExceptions(ex.data ?? []);
        setRecentRecons(rc.data ?? []);
        setNewCaps(cap.data ?? []);
      })
      .catch(() => {
        // 部分接口可能未开放; 不阻断 UI
        setTodos((v) => v ?? []);
        setAudits((v) => v ?? []);
        setOpenExceptions((v) => v ?? []);
        setRecentRecons((v) => v ?? []);
        setNewCaps((v) => v ?? []);
      });
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const cq = currentQuarterRange();
  const quarterStart = new Date(cq.year, (cq.quarter - 1) * 3, 1);
  const quarterEnd = new Date(cq.year, cq.quarter * 3, 1);

  const currentQuarterAudits = (audits ?? []).filter(
    (a) => a.year === cq.year && a.quarter === cq.quarter,
  );
  const currentQuarterNewCaps = (newCaps ?? []).filter((c) => {
    const d = new Date(c.createdAt);
    return d >= quarterStart && d < quarterEnd;
  });

  const auditCount = currentQuarterAudits.length;
  const exceptionCount = openExceptions?.length ?? 0;
  const newCapCount = currentQuarterNewCaps.length;
  const todoCount = todos?.length ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            {me ? `${me.name} · 审计组工作台` : '审计组工作台'}
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            本季内审 / 异常单 / 资本化 / 待办
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <BigStat
          label={`本季内审 (${cq.year} Q${cq.quarter})`}
          value={auditCount}
          hint={auditCount === 0 ? '本季尚未内审' : '已完成'}
          Icon={ClipboardList}
          href="/audits"
          loading={audits === null}
          empty={auditCount === 0}
        />
        <BigStat
          label="异常单 open"
          value={exceptionCount}
          hint={exceptionCount === 0 ? '无未处理异常' : '待整改'}
          Icon={AlertTriangle}
          href="/reconciliation"
          loading={openExceptions === null}
          empty={exceptionCount === 0}
        />
        <BigStat
          label="本季新资本化"
          value={newCapCount}
          hint={newCapCount === 0 ? '本季无新资本化' : '已 approved'}
          Icon={Coins}
          href="/capitalization"
          loading={newCaps === null}
          empty={newCapCount === 0}
        />
        <BigStat
          label="待办"
          value={todoCount}
          hint={todoCount === 0 ? '暂无待办' : '审批待处理'}
          Icon={Bell}
          href="/todo"
          loading={todos === null}
          empty={todoCount === 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 本季内审概览 */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck size={16} className="text-blue-600" />
              本季内审
              <Button variant="ghost" size="sm" asChild className="ml-auto -my-1">
                <Link href="/audits">
                  全部
                  <ChevronRight size={14} className="ml-0.5" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {audits === null ? (
              <Skeleton className="h-16 w-full" />
            ) : currentQuarterAudits.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                本季尚未发起内审
                <div className="mt-2">
                  <Button size="sm" asChild>
                    <Link href="/audits/new">新建内审</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {currentQuarterAudits.map((a) => {
                  const cnt = compliantCount(a);
                  return (
                    <li key={a.id} className="py-2">
                      <Link
                        href={`/audits/${a.id}`}
                        className="flex items-center justify-between gap-2 hover:bg-blue-50/50 -mx-2 px-2 py-1 rounded"
                      >
                        <span className="text-sm font-medium tabular-nums">
                          {a.year} Q{a.quarter}
                        </span>
                        {cnt === 5 ? (
                          <Badge className="bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-600 tabular-nums">
                            全合规
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-600 text-white border-amber-700 hover:bg-amber-600 tabular-nums">
                            整改 {cnt}/5
                          </Badge>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 近月勾稽异常 */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              异常单 open
              <Button variant="ghost" size="sm" asChild className="ml-auto -my-1">
                <Link href="/reconciliation">
                  全部
                  <ChevronRight size={14} className="ml-0.5" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {openExceptions === null ? (
              <Skeleton className="h-16 w-full" />
            ) : openExceptions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无未处理异常单
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {openExceptions.slice(0, 5).map((e) => (
                  <li key={e.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">
                          {e.docNo}
                        </code>
                        <div className="text-xs text-muted-foreground tabular-nums mt-1">
                          {e.reconciliation.year}-
                          {String(e.reconciliation.month).padStart(2, '0')} ·{' '}
                          {checkTypeLabel(e.reconciliation.checkType)}
                        </div>
                      </div>
                      <Badge className="bg-amber-600 text-white border-amber-700 hover:bg-amber-600 shrink-0">
                        待整改
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3 大红线状态 */}
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CheckSquare size={16} className="text-blue-600" />
            红线状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentRecons === null ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-md bg-slate-50 px-3 py-3">
                <div className="text-xs text-muted-foreground">本月勾稽差异 &gt; 3%</div>
                <div
                  className={
                    recentRecons.filter((r) => r.isException).length > 0
                      ? 'text-2xl font-bold tabular-nums text-rose-700 mt-1'
                      : 'text-2xl font-bold tabular-nums text-emerald-700 mt-1'
                  }
                >
                  {recentRecons.filter((r) => r.isException).length}
                </div>
                <div className="text-xs text-muted-foreground mt-1">类别 / 3</div>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-3">
                <div className="text-xs text-muted-foreground">异常单 open</div>
                <div
                  className={
                    exceptionCount > 0
                      ? 'text-2xl font-bold tabular-nums text-rose-700 mt-1'
                      : 'text-2xl font-bold tabular-nums text-emerald-700 mt-1'
                  }
                >
                  {exceptionCount}
                </div>
                <div className="text-xs text-muted-foreground mt-1">条</div>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-3">
                <div className="text-xs text-muted-foreground">本季内审完成</div>
                <div
                  className={
                    auditCount > 0
                      ? 'text-2xl font-bold tabular-nums text-emerald-700 mt-1'
                      : 'text-2xl font-bold tabular-nums text-amber-700 mt-1'
                  }
                >
                  {auditCount}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {cq.year} Q{cq.quarter}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
