'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Upload, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface InboundRow {
  id: number;
  docNo: string;
  materialId: number;
  warehouseId: number;
  quantity: string;
  unitPrice: string | null;
  changeType: 'init' | 'inbound' | 'adjust' | 'outbound' | 'return' | 'scrap';
  supplier: string | null;
  batchNo: string | null;
  receivedAt: string;
  operatorId: number;
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

function typeBadge(t: InboundRow['changeType']) {
  if (t === 'init')
    return (
      <Badge variant="secondary" className="text-purple-800 bg-purple-100 border-purple-300">
        期初
      </Badge>
    );
  if (t === 'adjust')
    return (
      <Badge variant="outline" className="text-amber-800 border-amber-300 bg-amber-100">
        调整
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-emerald-800 border-emerald-300 bg-emerald-100">
      普通
    </Badge>
  );
}

function fmtDate(s: string) {
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function InboundListPage() {
  const [list, setList] = useState<InboundRow[] | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [matFilter, setMatFilter] = useState<string>('all');
  const [whFilter, setWhFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  async function load() {
    const r = await fetch('/api/inventory/inbound');
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
  const initCount = list?.filter((r) => r.changeType === 'init').length ?? 0;
  const normalCount = list?.filter((r) => r.changeType === 'inbound').length ?? 0;
  const adjustCount = list?.filter((r) => r.changeType === 'adjust').length ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
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
            入库单
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            登记物料入库, 同步写入库存账本
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" asChild>
            <Link href="/inventory/inbound/import">
              <Upload size={14} className="mr-1.5" />
              期初导入
            </Link>
          </Button>
          <Button asChild>
            <Link href="/inventory/inbound/new">
              <Plus size={14} className="mr-1.5" />
              新建入库
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            共 <span className="font-medium text-slate-900 tabular-nums">{count}</span> 条
          </span>
          <span>·</span>
          <span className="tabular-nums">{initCount} 期初</span>
          <span>·</span>
          <span className="tabular-nums">{normalCount} 普通</span>
          <span>·</span>
          <span className="tabular-nums">{adjustCount} 调整</span>
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
              <SelectItem value="inbound">普通</SelectItem>
              <SelectItem value="init">期初</SelectItem>
              <SelectItem value="adjust">调整</SelectItem>
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
                  <TableHead>单号</TableHead>
                  <TableHead>物料</TableHead>
                  <TableHead>仓库</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">单价</TableHead>
                  <TableHead>供应商</TableHead>
                  <TableHead>入库日期</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Package size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无入库记录
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          点击右上 &quot;新建入库&quot; 或 &quot;期初导入&quot;
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id} className="h-10 hover:bg-blue-50/50">
                      <TableCell className="py-2">
                        <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">
                          {r.docNo}
                        </code>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="font-medium text-slate-900">{r.material.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {r.material.code}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-slate-700">{r.warehouse.name}</TableCell>
                      <TableCell className="py-2">{typeBadge(r.changeType)}</TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums">
                        {Number(r.quantity).toLocaleString()}
                        <span className="text-xs text-muted-foreground ml-1">
                          {r.material.unit}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums text-muted-foreground">
                        {r.unitPrice ? Number(r.unitPrice).toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="py-2 text-slate-700">
                        {r.supplier ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground tabular-nums">
                        {fmtDate(r.receivedAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {filtered.length > 0 && (
                <TableCaption>共 {filtered.length} 条入库记录</TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
