'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Inbox,
  Package,
  PackageOpen,
  AlertTriangle,
  BookOpen,
  Bell,
  LogOut,
  ChevronRight,
  FilePlus,
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

interface OutboundLite {
  id: number;
  docNo: string;
  status: string;
  requestedQty: string;
  project: { id: number; code: string; name: string };
  material: { id: number; code: string; name: string; unit: string };
}

interface InboundLite {
  id: number;
  docNo: string;
  receivedAt: string;
}

interface BalanceRow {
  materialId: number;
  warehouseId: number;
  status: 'normal' | 'low' | 'over' | 'stale';
}

interface LedgerRow {
  id: number;
  changeType: string;
  changeQty: string;
  occurredAt: string;
  material: { id: number; code: string; name: string; unit: string };
  warehouse: { id: number; code: string; name: string };
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

function typeLabel(t: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    inbound: { label: '入库', cls: 'text-emerald-800 border-emerald-300 bg-emerald-100' },
    outbound: { label: '出库', cls: 'text-rose-800 border-rose-300 bg-rose-100' },
    return: { label: '退库', cls: 'text-blue-800 border-blue-300 bg-blue-100' },
    init: { label: '期初', cls: 'text-purple-800 border-purple-300 bg-purple-100' },
    scrap: { label: '报废', cls: 'text-slate-700 bg-slate-100' },
    adjust: { label: '调整', cls: 'text-amber-800 border-amber-300 bg-amber-100' },
  };
  return map[t] ?? { label: t, cls: 'text-slate-700 bg-slate-100' };
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
function BigStat({
  label,
  value,
  hint,
  Icon,
  href,
  loading,
  empty,
}: BigStatProps) {
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

export default function WarehouseWorkbenchPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [pending, setPending] = useState<OutboundLite[] | null>(null);
  const [monthInbounds, setMonthInbounds] = useState<InboundLite[] | null>(null);
  const [balance, setBalance] = useState<BalanceRow[] | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null);
  const [notifs, setNotifs] = useState<Notification[] | null>(null);

  useEffect(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartISO = monthStart.toISOString().slice(0, 10);

    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/inventory/outbound?status=approved').then((r) => r.json()),
      fetch(`/api/inventory/inbound?from=${monthStartISO}`).then((r) => r.json()),
      fetch('/api/inventory/balance').then((r) => r.json()),
      fetch('/api/inventory/ledger').then((r) => r.json()),
      fetch('/api/notifications').then((r) => r.json()),
    ]).then(([m, p, ib, bal, lg, n]) => {
      setMe(m.data ?? null);
      setPending(p.data ?? []);
      setMonthInbounds(ib.data ?? []);
      setBalance(bal.data ?? []);
      setLedger(lg.data ?? []);
      setNotifs(n.data ?? []);
    });
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  // KPI 计算
  const pendingCount = pending?.length ?? 0;
  const pendingHint =
    pending === null
      ? ''
      : pendingCount === 0
        ? '暂无待出库'
        : `${pendingCount} 单待执行`;

  const inboundCount = monthInbounds?.length ?? 0;
  const inboundHint =
    monthInbounds === null
      ? ''
      : inboundCount === 0
        ? '本月暂无入库'
        : `本月已入库 ${inboundCount} 笔`;

  const alertRows = (balance ?? []).filter((r) => r.status !== 'normal');
  const alertCount = alertRows.length;
  const alertHint =
    balance === null
      ? ''
      : alertCount === 0
        ? '全部库存正常'
        : `低/超/呆滞合计 ${alertCount}`;

  const unreadNotifs = (notifs ?? []).filter((n) => !n.readAt);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            {me ? `${me.name} · 仓管员工作台` : '仓管员工作台'}
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            待出库 / 本月入库 / 库存预警 / 最近流水
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
          label="待出库"
          value={pendingCount}
          hint={pendingHint}
          Icon={PackageOpen}
          href="/inventory/issue"
          loading={pending === null}
          empty={pendingCount === 0}
        />
        <BigStat
          label="本月入库笔数"
          value={inboundCount}
          hint={inboundHint}
          Icon={Inbox}
          href="/inventory/inbound"
          loading={monthInbounds === null}
          empty={inboundCount === 0}
        />
        <BigStat
          label="库存预警数"
          value={alertCount}
          hint={alertHint}
          Icon={AlertTriangle}
          href="/inventory/balance"
          loading={balance === null}
          empty={alertCount === 0}
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
        {/* 待出库 */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PackageOpen size={16} className="text-blue-600" />
              待出库领料单
              <span className="text-xs font-normal text-muted-foreground">
                · {pendingCount} 单
              </span>
              <Button variant="ghost" size="sm" asChild className="ml-auto -my-1">
                <Link href="/inventory/issue">
                  查看全部
                  <ChevronRight size={14} className="ml-0.5" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pending === null ? (
              <Skeleton className="h-12 w-full" />
            ) : pendingCount === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无待出库单
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pending.slice(0, 5).map((o) => (
                  <li key={o.id} className="py-2">
                    <Link
                      href="/inventory/issue"
                      className="flex items-center gap-2 hover:bg-blue-50/50 -mx-2 px-2 py-1 rounded"
                    >
                      <code className="text-xs font-mono tabular-nums text-muted-foreground shrink-0">
                        {o.docNo}
                      </code>
                      <span className="font-medium text-sm truncate flex-1">
                        {o.material.name}
                      </span>
                      <span className="text-xs tabular-nums text-slate-700">
                        {Number(o.requestedQty)} {o.material.unit}
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

        {/* 最近流水 */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen size={16} className="text-blue-600" />
              最近流水
              <span className="text-xs font-normal text-muted-foreground">
                · {ledger?.length ?? 0} 条
              </span>
              <Button variant="ghost" size="sm" asChild className="ml-auto -my-1">
                <Link href="/inventory/ledger">
                  查看全部
                  <ChevronRight size={14} className="ml-0.5" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ledger === null ? (
              <Skeleton className="h-12 w-full" />
            ) : ledger.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无流水
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {ledger.slice(0, 5).map((l) => {
                  const t = typeLabel(l.changeType);
                  const qty = Number(l.changeQty);
                  const pos = qty > 0;
                  return (
                    <li key={l.id} className="py-2">
                      <Link
                        href="/inventory/ledger"
                        className="flex items-center gap-2 hover:bg-blue-50/50 -mx-2 px-2 py-1 rounded"
                      >
                        <Badge variant="outline" className={t.cls + ' text-[10px]'}>
                          {t.label}
                        </Badge>
                        <span className="font-medium text-sm truncate flex-1">
                          {l.material.name}
                        </span>
                        <span
                          className={
                            'text-xs tabular-nums font-semibold ' +
                            (pos ? 'text-emerald-700' : 'text-rose-700')
                          }
                        >
                          {pos ? '+' : ''}
                          {qty} {l.material.unit}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {fmtTime(l.occurredAt)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
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
              <Link href="/inventory/inbound/new" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <FilePlus size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">入库</span>
                </div>
              </Link>
              <Link href="/inventory/inbound/import" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Inbox size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">期初导入</span>
                </div>
              </Link>
              <Link href="/inventory/issue" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <PackageOpen size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">出库执行</span>
                </div>
              </Link>
              <Link href="/inventory/balance" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Package size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">库存分析</span>
                </div>
              </Link>
              <Link href="/inventory/ledger" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <BookOpen size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">流水账本</span>
                </div>
              </Link>
              <Link href="/material/outbound/stats" className="block">
                <div className="bg-blue-50 hover:bg-blue-100 rounded-2xl p-3 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Package size={20} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">领料统计</span>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
