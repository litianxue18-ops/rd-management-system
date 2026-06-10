'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FilePlus, FileText, Download } from 'lucide-react';
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

interface Report {
  id: number;
  projectId: number;
  reportYear: number;
  reportMonth: number;
  status: 'draft' | 'reviewing' | 'approved' | 'rejected';
  createdAt: string;
  project: { id: number; code: string; name: string };
}

interface Project {
  id: number;
  code: string;
  name: string;
}

function statusBadge(s: Report['status']) {
  if (s === 'approved')
    return (
      <Badge variant="outline" className="text-white border-emerald-700 bg-emerald-600">已通过</Badge>
    );
  if (s === 'reviewing')
    return (
      <Badge variant="outline" className="text-white border-blue-700 bg-blue-600">审批中</Badge>
    );
  if (s === 'rejected')
    return (
      <Badge variant="outline" className="text-white border-rose-700 bg-rose-600">已驳回</Badge>
    );
  return <Badge variant="secondary">草稿</Badge>;
}

function fmtDate(s: string) {
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtMonth(y: number, m: number) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

export default function MonthlyReportsListPage() {
  const [list, setList] = useState<Report[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  async function load() {
    const r = await fetch('/api/monthly');
    const j = await r.json();
    setList(j.data ?? []);
  }

  useEffect(() => {
    load();
    fetch('/api/projects').then((r) => r.json()).then((j) => setProjects(j.data ?? []));
  }, []);

  const filtered = useMemo(() => {
    if (!list) return null;
    return list.filter((r) => {
      if (projectFilter !== 'all' && String(r.projectId) !== projectFilter) return false;
      if (yearFilter !== 'all' && String(r.reportYear) !== yearFilter) return false;
      if (monthFilter !== 'all' && String(r.reportMonth) !== monthFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [list, projectFilter, yearFilter, monthFilter, statusFilter]);

  const count = list?.length ?? 0;
  const draftCount = list?.filter((r) => r.status === 'draft').length ?? 0;
  const reviewingCount = list?.filter((r) => r.status === 'reviewing').length ?? 0;
  const approvedCount = list?.filter((r) => r.status === 'approved').length ?? 0;

  async function exportExcel() {
    try {
      const filters: Record<string, any> = {};
      if (projectFilter !== 'all') filters.projectId = Number(projectFilter);
      if (yearFilter !== 'all') filters.year = Number(yearFilter);
      if (monthFilter !== 'all') filters.month = Number(monthFilter);
      if (statusFilter !== 'all') filters.status = statusFilter;
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'monthly_report', filters }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error?.message ?? '导出失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `月度报告-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message ?? '导出失败');
    }
  }

  const years = useMemo(() => {
    const ys = new Set<number>();
    list?.forEach((r) => ys.add(r.reportYear));
    return Array.from(ys).sort((a, b) => b - a);
  }, [list]);

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
            月度进展报告
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            项目月度执行情况汇总
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download size={14} className="mr-2" />
            导出 Excel
          </Button>
          <Button asChild>
            <Link href="/monthly/new">
              <FilePlus size={16} className="mr-2" />
              新建月报
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            共 <span className="font-medium text-slate-900 tabular-nums">{count}</span> 条
          </span>
          <span>·</span>
          <span className="tabular-nums">{draftCount} 草稿</span>
          <span>·</span>
          <span className="tabular-nums">{reviewingCount} 审批中</span>
          <span>·</span>
          <span className="tabular-nums">{approvedCount} 已通过</span>
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
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="h-8 w-24 text-sm">
              <SelectValue placeholder="年" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部年</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="h-8 w-24 text-sm">
              <SelectValue placeholder="月" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部月</SelectItem>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m} 月
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-28 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="reviewing">审批中</SelectItem>
              <SelectItem value="approved">已通过</SelectItem>
              <SelectItem value="rejected">已驳回</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-slate-300 shadow-md">
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
                  <TableHead>项目编号</TableHead>
                  <TableHead>项目名</TableHead>
                  <TableHead>月份</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建于</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <FileText size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无月报
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          点击右上 &quot;新建月报&quot; 创建第一条
                        </div>
                        <Button className="mt-4" variant="outline" asChild>
                          <Link href="/monthly/new">
                            <FilePlus size={14} className="mr-1.5" />
                            新建月报
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id} className="h-10 hover:bg-blue-50/50">
                      <TableCell className="py-2">
                        {r.project.code.startsWith('DRAFT-') ? (
                          <span className="text-xs text-muted-foreground">草稿项目</span>
                        ) : (
                          <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">
                            {r.project.code}
                          </code>
                        )}
                      </TableCell>
                      <TableCell className="font-medium py-2">
                        <Link
                          href={`/monthly/${r.id}`}
                          className="hover:text-blue-700 hover:underline"
                        >
                          {r.project.name}
                        </Link>
                      </TableCell>
                      <TableCell className="py-2 font-mono tabular-nums text-xs">
                        {fmtMonth(r.reportYear, r.reportMonth)}
                      </TableCell>
                      <TableCell className="py-2">{statusBadge(r.status)}</TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground tabular-nums">
                        {fmtDate(r.createdAt)}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/monthly/${r.id}`}>查看</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {filtered.length > 0 && (
                <TableCaption>共 {filtered.length} 条月报</TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
