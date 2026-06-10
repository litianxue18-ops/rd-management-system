'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FilePlus, Package } from 'lucide-react';
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
  | 'issued'
  | 'rejected'
  | 'cancelled'
  | 'returned';

interface OutboundRow {
  id: number;
  docNo: string;
  projectId: number;
  requestedQty: string;
  issuedQty: string;
  returnedQty: string;
  status: Status;
  requesterId: number;
  createdAt: string;
  project: { id: number; code: string; name: string };
  material: { id: number; code: string; name: string; unit: string };
  warehouse: { id: number; code: string; name: string };
}

interface Project {
  id: number;
  code: string;
  name: string;
}

function statusBadge(s: Status) {
  if (s === 'draft') return <Badge variant="secondary">草稿</Badge>;
  if (s === 'reviewing')
    return (
      <Badge variant="outline" className="text-white border-blue-700 bg-blue-600">审批中</Badge>
    );
  if (s === 'approved')
    return (
      <Badge variant="outline" className="text-emerald-800 border-emerald-300 bg-emerald-100">
        待出库
      </Badge>
    );
  if (s === 'issued')
    return (
      <Badge variant="outline" className="text-white border-emerald-700 bg-emerald-600">已出库</Badge>
    );
  if (s === 'rejected')
    return (
      <Badge variant="outline" className="text-white border-rose-700 bg-rose-600">已驳回</Badge>
    );
  if (s === 'cancelled') return <Badge variant="secondary">已撤回</Badge>;
  if (s === 'returned') return <Badge variant="secondary">已退库</Badge>;
  return <Badge variant="secondary">{s}</Badge>;
}

function fmtDate(s: string) {
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function OutboundListPage() {
  const [list, setList] = useState<OutboundRow[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  async function load() {
    const r = await fetch('/api/inventory/outbound');
    const j = await r.json();
    setList(j.data ?? []);
  }

  useEffect(() => {
    load();
    fetch('/api/projects')
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
  const draftCount = list?.filter((r) => r.status === 'draft').length ?? 0;
  const reviewingCount =
    list?.filter((r) => r.status === 'reviewing').length ?? 0;
  const approvedCount =
    list?.filter((r) => r.status === 'approved').length ?? 0;
  const issuedCount = list?.filter((r) => r.status === 'issued').length ?? 0;

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
            领料申请
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            项目从仓库申领物料, 2 步审批 (项目负责人 → 研发中心)
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/material/outbound/new">
            <FilePlus size={14} className="mr-1.5" />
            新建申请
          </Link>
        </Button>
      </div>

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
          <span className="tabular-nums">{approvedCount} 待出库</span>
          <span>·</span>
          <span className="tabular-nums">{issuedCount} 已出库</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-8 w-44 text-sm">
              <SelectValue placeholder="项目" />
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-28 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="reviewing">审批中</SelectItem>
              <SelectItem value="approved">待出库</SelectItem>
              <SelectItem value="issued">已出库</SelectItem>
              <SelectItem value="rejected">已驳回</SelectItem>
              <SelectItem value="cancelled">已撤回</SelectItem>
              <SelectItem value="returned">已退库</SelectItem>
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
                  <TableHead>物料</TableHead>
                  <TableHead className="text-right">申请</TableHead>
                  <TableHead className="text-right">已出库</TableHead>
                  <TableHead className="text-right">已退库</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>申请时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Package size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无领料申请
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          点击右上 &quot;新建申请&quot; 创建第一条
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
                        <div className="font-medium text-slate-900">
                          {r.project.name}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono tabular-nums">
                          {r.project.code}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="text-slate-900">
                          {r.material.name}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({r.material.unit})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums">
                        {Number(r.requestedQty).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums text-muted-foreground">
                        {Number(r.issuedQty).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums text-muted-foreground">
                        {Number(r.returnedQty).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2">{statusBadge(r.status)}</TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground tabular-nums">
                        {fmtDate(r.createdAt)}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/material/outbound/${r.id}`}>查看</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {filtered.length > 0 && (
                <TableCaption>共 {filtered.length} 条领料申请</TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
