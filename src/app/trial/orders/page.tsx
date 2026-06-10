'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, FlaskConical } from 'lucide-react';
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
  | 'completed'
  | 'rejected'
  | 'cancelled';

interface Row {
  id: number;
  docNo: string;
  projectId: number;
  title: string;
  plannedQty: string;
  plannedUnit: string;
  actualQty: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  status: Status;
  project: { id: number; code: string; name: string };
  createdAt: string;
}

interface Project {
  id: number;
  code: string;
  name: string;
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
        已接单待生产
      </Badge>
    );
  if (s === 'completed')
    return (
      <Badge className="bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-600">已完成</Badge>
    );
  if (s === 'rejected')
    return (
      <Badge className="bg-rose-600 text-white border-rose-700 hover:bg-rose-600">已驳回</Badge>
    );
  return <Badge variant="secondary">已取消</Badge>;
}

export default function TrialOrdersListPage() {
  const [list, setList] = useState<Row[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  async function load() {
    const r = await fetch('/api/trial/orders');
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
  const reviewing = list?.filter((r) => r.status === 'reviewing').length ?? 0;
  const approved = list?.filter((r) => r.status === 'approved').length ?? 0;
  const completed = list?.filter((r) => r.status === 'completed').length ?? 0;

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
            试制生产任务单
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            研发员发起 → 项目负责人审核 → 生产部接单; 生产完成后可发起费用转嫁单
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/trial/orders/new">
            <Plus size={14} className="mr-1.5" />
            新建试制任务
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            共 <span className="font-medium text-slate-900 tabular-nums">{count}</span> 单
          </span>
          <span>·</span>
          <span className="tabular-nums text-blue-700">{reviewing} 审批中</span>
          <span>·</span>
          <span className="tabular-nums text-blue-700">{approved} 待生产</span>
          <span>·</span>
          <span className="tabular-nums text-emerald-700">{completed} 已完成</span>
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
              <SelectItem value="approved">已接单</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="rejected">已驳回</SelectItem>
              <SelectItem value="cancelled">已取消</SelectItem>
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
                  <TableHead>标题</TableHead>
                  <TableHead className="text-right">计划数</TableHead>
                  <TableHead className="text-right">实际数</TableHead>
                  <TableHead>计划起止</TableHead>
                  <TableHead>实际起止</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <FlaskConical size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无试制任务
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          点击右上 &quot;新建试制任务&quot;
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
                      <TableCell className="py-2 max-w-[200px] truncate">
                        {r.title}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums">
                        {Number(r.plannedQty).toLocaleString()}
                        <span className="text-xs text-muted-foreground ml-1">
                          {r.plannedUnit}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums">
                        {r.actualQty != null ? (
                          <>
                            {Number(r.actualQty).toLocaleString()}
                            <span className="text-xs text-muted-foreground ml-1">
                              {r.plannedUnit}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-xs tabular-nums text-muted-foreground">
                        {fmtDate(r.scheduledStart)} ~ {fmtDate(r.scheduledEnd)}
                      </TableCell>
                      <TableCell className="py-2 text-xs tabular-nums text-muted-foreground">
                        {fmtDate(r.actualStart)} ~ {fmtDate(r.actualEnd)}
                      </TableCell>
                      <TableCell className="py-2">{statusBadge(r.status)}</TableCell>
                      <TableCell className="py-2 text-right">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/trial/orders/${r.id}`}>详情</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {filtered.length > 0 && (
                <TableCaption>共 {filtered.length} 单试制任务</TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
