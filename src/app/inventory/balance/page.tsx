'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  PackageSearch,
  AlertTriangle,
  CheckCircle2,
  Wallet,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';

type Status = 'normal' | 'low' | 'over' | 'stale';

interface BalanceRow {
  materialId: number;
  materialCode: string;
  materialName: string;
  unit: string;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  balance: number;
  safetyStock: number | null;
  maxStock: number | null;
  status: Status;
  lastMovementAt: string | null;
  daysSinceMovement: number;
  inbound30d: number;
  outbound30d: number;
  scrap30d: number;
  turnoverDays: number | null;
  unitPrice: number | null;
  stockValue: number;
}

interface Material {
  id: number;
  code: string;
  name: string;
  spec: string | null;
}

interface Warehouse {
  id: number;
  code: string;
  name: string;
}

function statusBadge(s: Status) {
  const map: Record<Status, { label: string; className: string }> = {
    normal: {
      label: '正常',
      className: 'text-slate-700 bg-slate-100 border-slate-200',
    },
    low: {
      label: '低于安全',
      className: 'text-rose-800 border-rose-300 bg-rose-100',
    },
    over: {
      label: '超上限',
      className: 'text-amber-800 border-amber-300 bg-amber-100',
    },
    stale: {
      label: '呆滞 >180d',
      className: 'text-slate-700 border-slate-300 bg-slate-100',
    },
  };
  const cfg = map[s];
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}

function fmtDateTime(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

interface KpiProps {
  label: string;
  value: string | number;
  hint?: string;
  Icon: typeof PackageSearch;
  accent?: 'blue' | 'emerald' | 'rose' | 'muted';
}
function Kpi({ label, value, hint, Icon, accent = 'blue' }: KpiProps) {
  const colorMap = {
    blue: 'text-blue-700',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    muted: 'text-slate-400',
  } as const;
  return (
    <Card className="border-slate-300 shadow-md">
      <CardContent className="py-4 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div
            className={`text-2xl md:text-3xl font-bold tabular-nums mt-1 ${colorMap[accent]}`}
          >
            {value}
          </div>
          {hint && (
            <div className="text-xs text-muted-foreground mt-1">{hint}</div>
          )}
        </div>
        <Icon size={20} className="text-slate-300 shrink-0" />
      </CardContent>
    </Card>
  );
}

export default function InventoryBalancePage() {
  const [rows, setRows] = useState<BalanceRow[] | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState('');
  const [whFilter, setWhFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetch('/api/inventory/balance')
      .then((r) => r.json())
      .then((j) => setRows(j.data ?? []))
      .catch(() => setRows([]));
    fetch('/api/materials')
      .then((r) => r.json())
      .then((j) => setMaterials(j.data ?? []));
    fetch('/api/warehouses')
      .then((r) => r.json())
      .then((j) => setWarehouses(j.data ?? []));
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (whFilter !== 'all' && String(r.warehouseId) !== whFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (s) {
        const hit =
          r.materialCode.toLowerCase().includes(s) ||
          r.materialName.toLowerCase().includes(s);
        if (!hit) return false;
      }
      return true;
    });
  }, [rows, search, whFilter, statusFilter]);

  // KPI 计算 (基于全量 rows, 不受 filter 影响)
  const total = rows?.length ?? 0;
  const distinctMaterials = new Set((rows ?? []).map((r) => r.materialId)).size;
  const normalCount = (rows ?? []).filter((r) => r.status === 'normal').length;
  const alertCount = (rows ?? []).filter((r) => r.status !== 'normal').length;
  const totalStockValue = (rows ?? []).reduce((acc, r) => acc + r.stockValue, 0);

  // 物料 lookup 用于显示 spec
  const matMap = useMemo(() => {
    const m = new Map<number, Material>();
    materials.forEach((mat) => m.set(mat.id, mat));
    return m;
  }, [materials]);

  async function exportExcel() {
    try {
      const filters: Record<string, any> = {};
      if (whFilter !== 'all') filters.warehouseId = Number(whFilter);
      if (statusFilter !== 'all') filters.status = statusFilter;
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'inventory_balance', filters }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error?.message ?? '导出失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `库存余量-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message ?? '导出失败');
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href="/workbench"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              工作台
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            库存分析
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            实时库存与异常预警 (报表 1.8)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel} className="shrink-0">
          <Download size={14} className="mr-2" />
          导出 Excel
        </Button>
      </div>

      {/* KPI 4 卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi
          label="物料品类数"
          value={rows === null ? '—' : distinctMaterials}
          hint={`共 ${total} 个仓位记录`}
          Icon={PackageSearch}
          accent="blue"
        />
        <Kpi
          label="正常"
          value={rows === null ? '—' : normalCount}
          hint="库存水位健康"
          Icon={CheckCircle2}
          accent="emerald"
        />
        <Kpi
          label="预警"
          value={rows === null ? '—' : alertCount}
          hint="低/超上限/呆滞"
          Icon={AlertTriangle}
          accent="rose"
        />
        <Kpi
          label="库存总价值"
          value={
            rows === null
              ? '—'
              : `¥${totalStockValue.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
          }
          hint="余量 × 最近入库单价"
          Icon={Wallet}
          accent="blue"
        />
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-muted-foreground">
              共{' '}
              <span className="font-medium text-slate-900 tabular-nums">
                {filtered?.length ?? 0}
              </span>{' '}
              / {total} 条记录
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                placeholder="搜索物料编码 / 名称"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-56 text-sm"
              />
              <Select value={whFilter} onValueChange={setWhFilter}>
                <SelectTrigger className="h-8 w-40 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部仓库</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-36 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="normal">正常</SelectItem>
                  <SelectItem value="low">低于安全</SelectItem>
                  <SelectItem value="over">超上限</SelectItem>
                  <SelectItem value="stale">呆滞</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtered === null ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead>编码</TableHead>
                  <TableHead>物料</TableHead>
                  <TableHead>规格</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead>仓库</TableHead>
                  <TableHead className="text-right">当前余量</TableHead>
                  <TableHead className="text-right">安全库存</TableHead>
                  <TableHead className="text-right">上限</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">30 天入</TableHead>
                  <TableHead className="text-right">30 天出</TableHead>
                  <TableHead className="text-right">周转天数</TableHead>
                  <TableHead>最近变动</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <PackageSearch size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无库存记录
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          入库后该仓位才会出现
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const mat = matMap.get(r.materialId);
                    return (
                      <TableRow
                        key={`${r.materialId}-${r.warehouseId}`}
                        className="h-10 hover:bg-blue-50/50"
                      >
                        <TableCell className="font-mono tabular-nums text-xs">
                          {r.materialCode}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {r.materialName}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {mat?.spec ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.unit}
                        </TableCell>
                        <TableCell className="text-slate-700">
                          {r.warehouseName}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums font-semibold text-slate-900">
                          {r.balance.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-xs text-muted-foreground">
                          {r.safetyStock !== null
                            ? r.safetyStock.toLocaleString()
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-xs text-muted-foreground">
                          {r.maxStock !== null
                            ? r.maxStock.toLocaleString()
                            : '—'}
                        </TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-xs text-emerald-700">
                          {r.inbound30d > 0
                            ? `+${r.inbound30d.toLocaleString()}`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-xs text-rose-700">
                          {r.outbound30d > 0
                            ? `-${r.outbound30d.toLocaleString()}`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-xs text-muted-foreground">
                          {r.turnoverDays === null
                            ? '∞'
                            : `${Math.round(r.turnoverDays).toLocaleString()} 天`}
                        </TableCell>
                        <TableCell className="text-xs font-mono tabular-nums text-muted-foreground">
                          {fmtDateTime(r.lastMovementAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
              {filtered.length > 0 && (
                <TableCaption>
                  周转天数 = 余量 / 近 90 天日均出库; 无出库显 ∞
                </TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
