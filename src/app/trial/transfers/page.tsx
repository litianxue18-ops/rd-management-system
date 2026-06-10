'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Receipt, Download } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';

type Status =
  | 'draft'
  | 'reviewing'
  | 'approved'
  | 'settled'
  | 'rejected'
  | 'cancelled';

interface Row {
  id: number;
  docNo: string;
  projectId: number;
  trialOrderId: number;
  laborCost: string;
  machineCost: string;
  materialCost: string;
  totalAmount: string;
  status: Status;
  requesterId: number;
  createdAt: string;
  project: { id: number; code: string; name: string };
  trialOrder: { id: number; docNo: string; title: string };
}

interface Project {
  id: number;
  code: string;
  name: string;
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

function statusBadge(s: Status) {
  if (s === 'draft') return <Badge variant="secondary">草稿</Badge>;
  if (s === 'reviewing')
    return (
      <Badge className="bg-blue-600 text-white border-blue-700 hover:bg-blue-600">审批中</Badge>
    );
  if (s === 'approved')
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100">
        已批准
      </Badge>
    );
  if (s === 'settled')
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100">
        已结转
      </Badge>
    );
  if (s === 'rejected')
    return (
      <Badge className="bg-rose-600 text-white border-rose-700 hover:bg-rose-600">已驳回</Badge>
    );
  return <Badge variant="secondary">已取消</Badge>;
}

export default function TrialTransfersListPage() {
  const [list, setList] = useState<Row[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  async function load() {
    const r = await fetch('/api/trial/transfers');
    const j = await r.json();
    setList(j.data ?? []);
  }

  useEffect(() => {
    load();
    fetch('/api/projects?status=active')
      .then((r) => r.json())
      .then((j) => setProjects(j.data ?? []));
  }, []);

  const filtered = useMemo(() => {
    if (!list) return null;
    return list.filter((r) => {
      if (projectFilter !== 'all' && String(r.projectId) !== projectFilter)
        return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [list, projectFilter, statusFilter]);

  const count = list?.length ?? 0;
  const draft = list?.filter((r) => r.status === 'draft').length ?? 0;
  const reviewing = list?.filter((r) => r.status === 'reviewing').length ?? 0;
  const settled = list?.filter((r) => r.status === 'settled').length ?? 0;
  const totalSettled = list
    ?.filter((r) => r.status === 'settled')
    .reduce((acc, r) => acc + Number(r.totalAmount), 0) ?? 0;

  async function exportExcel() {
    try {
      const filters: Record<string, any> = {};
      if (projectFilter !== 'all') filters.projectId = Number(projectFilter);
      if (statusFilter !== 'all') filters.status = statusFilter;
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'trial_transfer', filters }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error?.message ?? '导出失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `试制转嫁单-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
            试制费用转嫁单
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            报表 1.5 · 试制阶段费用清单 (人工 + 机台 + 材料), 4 步审批; 总经理批准 = 已结转
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download size={14} className="mr-2" />
            导出 Excel
          </Button>
          <Button asChild>
            <Link href="/trial/transfers/new">
              <Plus size={14} className="mr-1.5" />
              新建转嫁单
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            共 <span className="font-medium text-slate-900 tabular-nums">{count}</span> 单
          </span>
          <span>·</span>
          <span className="tabular-nums">{draft} 草稿</span>
          <span>·</span>
          <span className="tabular-nums text-blue-700">{reviewing} 审批中</span>
          <span>·</span>
          <span className="tabular-nums text-emerald-700">{settled} 已结转</span>
          <span>·</span>
          <span className="tabular-nums">
            结转总额{' '}
            <span className="text-slate-900 font-medium">
              ¥{totalSettled.toLocaleString()}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-8 w-44 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部项目</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name} ({p.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-32 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="reviewing">审批中</SelectItem>
              <SelectItem value="settled">已结转</SelectItem>
              <SelectItem value="rejected">已驳回</SelectItem>
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
                  <TableHead>试制任务</TableHead>
                  <TableHead className="text-right">人工费</TableHead>
                  <TableHead className="text-right">机台费</TableHead>
                  <TableHead className="text-right">材料费</TableHead>
                  <TableHead className="text-right">总额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Receipt size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无转嫁单
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          点击右上 &quot;新建转嫁单&quot;
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
                        <div className="font-medium text-slate-900 truncate max-w-[160px]">
                          {r.project.name}
                        </div>
                        <code className="text-xs text-muted-foreground font-mono">
                          {r.project.code}
                        </code>
                      </TableCell>
                      <TableCell className="py-2">
                        <code className="text-xs text-slate-700 font-mono tabular-nums">
                          {r.trialOrder.docNo}
                        </code>
                        <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {r.trialOrder.title}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums text-sm">
                        {Number(r.laborCost).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums text-sm">
                        {Number(r.machineCost).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums text-sm">
                        {Number(r.materialCost).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums font-semibold text-slate-900">
                        ¥{Number(r.totalAmount).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2">{statusBadge(r.status)}</TableCell>
                      <TableCell className="py-2 text-xs tabular-nums text-muted-foreground">
                        {fmtDateTime(r.createdAt)}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/trial/transfers/${r.id}`}>详情</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {filtered.length > 0 && (
                <TableCaption>共 {filtered.length} 单转嫁记录</TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
