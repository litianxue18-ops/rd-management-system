'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';

type ChangeType =
  | 'init'
  | 'inbound'
  | 'outbound'
  | 'return'
  | 'scrap'
  | 'adjust';

interface LedgerRow {
  id: number;
  materialId: number;
  warehouseId: number;
  changeType: ChangeType;
  changeQty: string;
  balanceAfter: string;
  sourceType: string;
  sourceId: number;
  operatorId: number;
  occurredAt: string;
  material: { id: number; code: string; name: string; unit: string };
  warehouse: { id: number; code: string; name: string };
}

interface Material {
  id: number;
  code: string;
  name: string;
}
interface Warehouse {
  id: number;
  code: string;
  name: string;
}

function typeBadge(t: ChangeType) {
  const map: Record<
    ChangeType,
    { label: string; className: string }
  > = {
    inbound: {
      label: '入库',
      className: 'text-emerald-800 border-emerald-300 bg-emerald-100',
    },
    outbound: {
      label: '出库',
      className: 'text-rose-800 border-rose-300 bg-rose-100',
    },
    return: {
      label: '退库',
      className: 'text-blue-800 border-blue-300 bg-blue-100',
    },
    init: {
      label: '期初',
      className: 'text-purple-800 border-purple-300 bg-purple-100',
    },
    scrap: { label: '报废', className: 'text-slate-700 bg-slate-100' },
    adjust: {
      label: '调整',
      className: 'text-amber-800 border-amber-300 bg-amber-100',
    },
  };
  const cfg = map[t];
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}

function fmtDateTime(s: string) {
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

export default function LedgerPage() {
  const [list, setList] = useState<LedgerRow[] | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [matFilter, setMatFilter] = useState<string>('all');
  const [whFilter, setWhFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  async function load() {
    const r = await fetch('/api/inventory/ledger');
    const j = await r.json();
    setList(j.data ?? []);
  }

  useEffect(() => {
    load();
    fetch('/api/materials')
      .then((r) => r.json())
      .then((j) => setMaterials(j.data ?? []));
    fetch('/api/warehouses')
      .then((r) => r.json())
      .then((j) => setWarehouses(j.data ?? []));
  }, []);

  const filtered = useMemo(() => {
    if (!list) return null;
    return list.filter((r) => {
      if (matFilter !== 'all' && String(r.materialId) !== matFilter) return false;
      if (whFilter !== 'all' && String(r.warehouseId) !== whFilter) return false;
      if (typeFilter !== 'all' && r.changeType !== typeFilter) return false;
      return true;
    });
  }, [list, matFilter, whFilter, typeFilter]);

  const count = list?.length ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
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
            库存账本
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            全部库存变动流水 (append-only, 不可修改)
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            共 <span className="font-medium text-slate-900 tabular-nums">{count}</span> 条流水
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={matFilter} onValueChange={setMatFilter}>
            <SelectTrigger className="h-8 w-44 text-sm">
              <SelectValue placeholder="物料" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部物料</SelectItem>
              {materials.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={whFilter} onValueChange={setWhFilter}>
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue placeholder="仓库" />
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
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-28 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="inbound">入库</SelectItem>
              <SelectItem value="outbound">出库</SelectItem>
              <SelectItem value="return">退库</SelectItem>
              <SelectItem value="init">期初</SelectItem>
              <SelectItem value="scrap">报废</SelectItem>
              <SelectItem value="adjust">调整</SelectItem>
            </SelectContent>
          </Select>
          <Select value="all" disabled>
            <SelectTrigger className="h-8 w-32 text-sm">
              <SelectValue placeholder="日期范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">日期范围</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardContent className="pt-6">
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
                  <TableHead>时间</TableHead>
                  <TableHead>物料</TableHead>
                  <TableHead>仓库</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead className="text-right">变动量</TableHead>
                  <TableHead className="text-right">余额</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead className="text-right">操作员</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <BookOpen size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无流水记录
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          入库 / 出库 / 退库后会在此显示
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const qty = Number(r.changeQty);
                    const positive = qty > 0;
                    return (
                      <TableRow key={r.id} className="h-10 hover:bg-blue-50/50">
                        <TableCell className="py-2 text-xs font-mono tabular-nums text-muted-foreground">
                          {fmtDateTime(r.occurredAt)}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="font-medium text-slate-900">
                            {r.material.name}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {r.material.code}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-slate-700">
                          {r.warehouse.name}
                        </TableCell>
                        <TableCell className="py-2">
                          {typeBadge(r.changeType)}
                        </TableCell>
                        <TableCell
                          className={
                            'py-2 text-right font-mono tabular-nums font-semibold ' +
                            (positive ? 'text-emerald-700' : 'text-rose-700')
                          }
                        >
                          {positive ? '+' : ''}
                          {qty.toLocaleString()}
                          <span className="text-xs text-muted-foreground font-normal ml-1">
                            {r.material.unit}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono tabular-nums text-slate-700">
                          {Number(r.balanceAfter).toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground font-mono">
                          {r.sourceType}#{r.sourceId}
                        </TableCell>
                        <TableCell className="py-2 text-right text-xs text-muted-foreground tabular-nums">
                          #{r.operatorId}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
              {filtered.length > 0 && (
                <TableCaption>
                  显示 {filtered.length} 条 (最多展示 200 条最近流水)
                </TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
