'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { FilePlus, FolderOpen, Search, ArrowLeft, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { TestBadge } from '@/shared/components/test-badge';

interface Project {
  id: number;
  code: string;
  name: string;
  status: 'draft' | 'reviewing' | 'rejected' | 'active' | 'closed' | 'cancelled';
  projectType: { code: string; name: string };
  departmentId: number;
  leadUserId: number;
  startDate: string;
  endDate: string;
  budget: string;
  isTest?: boolean;
}

interface Dept {
  id: number;
  name: string;
}
interface User {
  id: number;
  name: string;
}

function statusBadge(s: Project['status']) {
  if (s === 'active')
    return (
      <Badge variant="outline" className="text-white border-emerald-700 bg-emerald-600">进行中</Badge>
    );
  if (s === 'reviewing')
    return (
      <Badge variant="outline" className="text-white border-blue-700 bg-blue-600">审批中</Badge>
    );
  if (s === 'rejected')
    return (
      <Badge variant="outline" className="text-white border-rose-700 bg-rose-600">已驳回</Badge>
    );
  if (s === 'draft') return <Badge variant="secondary">草稿</Badge>;
  if (s === 'closed') return <Badge variant="secondary">已结项</Badge>;
  return <Badge variant="secondary">已取消</Badge>;
}

function fmtDate(s: string) {
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtBudget(b: string) {
  const n = Number(b);
  if (!isFinite(n)) return b;
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

export default function ProjectsListPage() {
  const [list, setList] = useState<Project[] | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [q, setQ] = useState('');

  async function load() {
    const r = await fetch('/api/projects');
    const j = await r.json();
    setList(j.data ?? []);
  }

  useEffect(() => {
    load();
    fetch('/api/departments').then((r) => r.json()).then((j) => setDepts(j.data ?? []));
    fetch('/api/users').then((r) => r.json()).then((j) => setUsers(j.data ?? []));
  }, []);

  const deptName = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of depts) m.set(d.id, d.name);
    return m;
  }, [depts]);
  const userName = useMemo(() => {
    const m = new Map<number, string>();
    for (const u of users) m.set(u.id, u.name);
    return m;
  }, [users]);

  const filtered = useMemo(() => {
    if (!list) return null;
    return list.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (q) {
        const text = `${p.name} ${p.code}`.toLowerCase();
        if (!text.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [list, statusFilter, q]);

  const count = list?.length ?? 0;
  const activeCount = list?.filter((p) => p.status === 'active').length ?? 0;
  const reviewingCount = list?.filter((p) => p.status === 'reviewing').length ?? 0;
  const draftCount = list?.filter((p) => p.status === 'draft').length ?? 0;

  async function exportExcel() {
    try {
      const filters: Record<string, any> = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'project_ledger', filters }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error?.message ?? '导出失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `项目台账-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
            <Link href="/workbench" className="hover:text-slate-900 inline-flex items-center gap-1">
              <ArrowLeft size={12} />
              工作台
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            项目台账
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            查看所有立项,按权限范围显示
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download size={14} className="mr-2" />
            导出 Excel
          </Button>
          <Button asChild>
            <Link href="/projects/new">
              <FilePlus size={16} className="mr-2" />
              新建立项
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            共 <span className="font-medium text-slate-900 tabular-nums">{count}</span> 项目
          </span>
          <span>·</span>
          <span className="tabular-nums">{activeCount} 进行中</span>
          <span>·</span>
          <span className="tabular-nums">{reviewingCount} 审批中</span>
          <span>·</span>
          <span className="tabular-nums">{draftCount} 草稿</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-28 sm:w-32 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="reviewing">审批中</SelectItem>
              <SelectItem value="rejected">已驳回</SelectItem>
              <SelectItem value="active">进行中</SelectItem>
              <SelectItem value="closed">已结项</SelectItem>
              <SelectItem value="cancelled">已取消</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 sm:flex-none sm:max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="搜索名称/编号..."
              className="pl-8 h-8 text-sm w-full sm:w-56"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
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
                  <TableHead>编号</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>主导部门</TableHead>
                  <TableHead>负责人</TableHead>
                  <TableHead>起止</TableHead>
                  <TableHead className="text-right">预算 (元)</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <FolderOpen size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无项目
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          点击右上 "新建立项" 创建第一条
                        </div>
                        <Button className="mt-4" variant="outline" asChild>
                          <Link href="/projects/new">
                            <FilePlus size={14} className="mr-1.5" />
                            新建立项
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow
                      key={p.id}
                      className="h-10 hover:bg-blue-50/50 cursor-pointer"
                    >
                      <TableCell className="py-2">
                        {p.code.startsWith('DRAFT-') ? (
                          <span className="text-xs text-muted-foreground">草稿</span>
                        ) : (
                          <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">
                            {p.code}
                          </code>
                        )}
                      </TableCell>
                      <TableCell className="font-medium py-2">
                        <span className="inline-flex items-center gap-2">
                          <Link
                            href={`/projects/${p.id}`}
                            className="hover:text-blue-700 hover:underline"
                          >
                            {p.name}
                          </Link>
                          <TestBadge show={p.isTest} />
                        </span>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="secondary" className="font-normal">
                          {p.projectType.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-sm">
                        {deptName.get(p.departmentId) ?? `#${p.departmentId}`}
                      </TableCell>
                      <TableCell className="py-2 text-sm">
                        {userName.get(p.leadUserId) ?? `#${p.leadUserId}`}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground tabular-nums">
                        {fmtDate(p.startDate)} — {fmtDate(p.endDate)}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums text-sm">
                        {fmtBudget(p.budget)}
                      </TableCell>
                      <TableCell className="py-2">{statusBadge(p.status)}</TableCell>
                      <TableCell className="py-2 text-right">
                        {!p.code.startsWith('DRAFT-') && (
                          <Button variant="outline" size="sm" asChild className="h-7 px-2 text-xs">
                            <Link href={`/projects/${p.id}/overview`}>档案</Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {filtered.length > 0 && (
                <TableCaption>共 {filtered.length} 个项目</TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
