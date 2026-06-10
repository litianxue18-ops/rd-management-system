'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, FlaskConical, Download } from 'lucide-react';
import { toast } from 'sonner';
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';

type SampleType = 'sample' | 'scrap';
type Disposal = 'retained' | 'destroyed' | 'sold' | 'internal_use';
type Status = 'draft' | 'supervised';

interface Row {
  id: number;
  docNo: string;
  projectId: number;
  type: SampleType;
  consumedQty: string;
  productName: string | null;
  productQty: string | null;
  productUnit: string | null;
  disposalMethod: Disposal;
  disposalIncome: string | null;
  status: Status;
  supervisedById: number | null;
  supervisedAt: string | null;
  registeredAt: string;
  project: { id: number; code: string; name: string };
  material: { id: number; code: string; name: string; unit: string };
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

function typeBadge(t: SampleType) {
  if (t === 'sample')
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100">
        样品
      </Badge>
    );
  return (
    <Badge className="bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-100">
      废料
    </Badge>
  );
}

function disposalBadge(d: Disposal, income: string | null) {
  if (d === 'retained')
    return <Badge variant="secondary">留样</Badge>;
  if (d === 'destroyed')
    return <Badge variant="secondary">销毁</Badge>;
  if (d === 'internal_use')
    return <Badge variant="secondary">内部使用</Badge>;
  return (
    <Badge className="bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100">
      出售 +¥{Number(income ?? 0).toLocaleString()}
    </Badge>
  );
}

function statusBadge(s: Status) {
  if (s === 'supervised')
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100">
        已监销
      </Badge>
    );
  return <Badge variant="secondary">待监销</Badge>;
}

export default function SamplesListPage() {
  const [list, setList] = useState<Row[] | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  async function load() {
    const r = await fetch('/api/samples');
    const j = await r.json();
    setList(j.data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!list) return null;
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (q) {
        const hit =
          r.docNo.toLowerCase().includes(q) ||
          r.project.name.toLowerCase().includes(q) ||
          r.project.code.toLowerCase().includes(q) ||
          r.material.name.toLowerCase().includes(q) ||
          r.material.code.toLowerCase().includes(q) ||
          (r.productName ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, typeFilter, statusFilter, search]);

  const count = list?.length ?? 0;
  const samples = list?.filter((r) => r.type === 'sample').length ?? 0;
  const scraps = list?.filter((r) => r.type === 'scrap').length ?? 0;
  const pending = list?.filter((r) => r.status === 'draft').length ?? 0;
  const supervised = list?.filter((r) => r.status === 'supervised').length ?? 0;

  async function exportExcel() {
    try {
      const filters: Record<string, any> = {};
      if (typeFilter !== 'all') filters.type = typeFilter;
      if (statusFilter !== 'all') filters.status = statusFilter;
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'sample_scrap', filters }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error?.message ?? '导出失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `样品废料台账-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message ?? '导出失败');
    }
  }

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
            样品 / 废料台账
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            研发员登记 → 财务监销; 废料自动写入库存账本 (scrap)
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download size={14} className="mr-2" />
            导出 Excel
          </Button>
          <Button asChild>
            <Link href="/samples/new">
              <Plus size={14} className="mr-1.5" />
              新建样品/废料登记
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
          <span className="tabular-nums">{samples} 样品</span>
          <span>·</span>
          <span className="tabular-nums">{scraps} 废料</span>
          <span>·</span>
          <span className="tabular-nums text-amber-700">{pending} 待监销</span>
          <span>·</span>
          <span className="tabular-nums text-emerald-700">{supervised} 已监销</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索单号/项目/物料/产出"
              className="h-8 w-56 pl-8 text-sm"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-28 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="sample">样品</SelectItem>
              <SelectItem value="scrap">废料</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-28 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="draft">待监销</SelectItem>
              <SelectItem value="supervised">已监销</SelectItem>
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
                  <TableHead>项目</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>物料</TableHead>
                  <TableHead className="text-right">消耗量</TableHead>
                  <TableHead>产出</TableHead>
                  <TableHead>处置方式</TableHead>
                  <TableHead>监销时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <FlaskConical size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无样品/废料记录
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          点击右上 &quot;新建样品/废料登记&quot;
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
                        <div className="font-medium text-slate-900 truncate max-w-[180px]">
                          {r.project.name}
                        </div>
                        <code className="text-xs text-muted-foreground font-mono">
                          {r.project.code}
                        </code>
                      </TableCell>
                      <TableCell className="py-2">{typeBadge(r.type)}</TableCell>
                      <TableCell className="py-2">
                        <div className="font-medium text-slate-900">
                          {r.material.name}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {r.material.code}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums">
                        {Number(r.consumedQty).toLocaleString()}
                        <span className="text-xs text-muted-foreground ml-1">
                          {r.material.unit}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-sm">
                        {r.productName ? (
                          <>
                            <div className="text-slate-900">{r.productName}</div>
                            {r.productQty && (
                              <div className="text-xs text-muted-foreground font-mono tabular-nums">
                                {Number(r.productQty).toLocaleString()}{' '}
                                {r.productUnit ?? ''}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        {disposalBadge(r.disposalMethod, r.disposalIncome)}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground tabular-nums">
                        {fmtDateTime(r.supervisedAt)}
                      </TableCell>
                      <TableCell className="py-2">{statusBadge(r.status)}</TableCell>
                      <TableCell className="py-2 text-right">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/samples/${r.id}`}>详情</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {filtered.length > 0 && (
                <TableCaption>共 {filtered.length} 条样品/废料登记</TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
