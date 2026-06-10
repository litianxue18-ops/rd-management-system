'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileEdit, FilePlus } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';

interface Change {
  id: number;
  projectId: number;
  reason: string;
  scope: string;
  newBudget: string | null;
  newEndDate: string | null;
  status: 'draft' | 'reviewing' | 'rejected' | 'active' | 'closed' | 'cancelled';
  createdAt: string;
  appliedAt: string | null;
}

function statusBadge(s: Change['status']) {
  if (s === 'active')
    return (
      <Badge variant="outline" className="text-emerald-800 border-emerald-300 bg-emerald-100">
        已套用
      </Badge>
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
  return <Badge variant="secondary">{s}</Badge>;
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ChangesListPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [list, setList] = useState<Change[] | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${id}/changes`)
      .then((r) => r.json())
      .then((j) => setList(j.data ?? []));
  }, [id]);

  return (
    <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href={`/projects/${id}`} className="hover:text-slate-900 inline-flex items-center gap-1">
              <ArrowLeft size={12} />
              项目详情
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            重大变更申请
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            项目预算 / 进度 / 范围调整需走 4 步审批
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href={`/projects/${id}/changes/new`}>
            <FilePlus size={16} className="mr-2" />
            发起变更
          </Link>
        </Button>
      </div>

      {list && list.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            共 <span className="font-medium text-slate-900 tabular-nums">{list.length}</span> 项
          </span>
          <span>·</span>
          <span className="tabular-nums">
            {list.filter((c) => c.status === 'reviewing').length} 审批中
          </span>
          <span>·</span>
          <span className="tabular-nums">
            {list.filter((c) => c.status === 'active').length} 已套用
          </span>
        </div>
      )}

      <Card className="border-slate-300 shadow-md">
        <CardContent className="pt-6">
          {list === null ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>事由</TableHead>
                  <TableHead>范围</TableHead>
                  <TableHead className="text-right">新预算</TableHead>
                  <TableHead>新结束日期</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <FileEdit size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无变更申请
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          预算/工期/范围变化需走变更审批
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((c) => (
                    <TableRow key={c.id} className="h-10 hover:bg-blue-50/50">
                      <TableCell className="py-2 font-mono tabular-nums text-xs text-muted-foreground">
                        #{c.id}
                      </TableCell>
                      <TableCell className="py-2 font-medium">
                        <Link
                          href={`/projects/${id}/changes/${c.id}`}
                          className="hover:text-blue-700 hover:underline"
                        >
                          {c.reason}
                        </Link>
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground max-w-xs truncate">
                        {c.scope}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums text-sm">
                        {c.newBudget ?? '—'}
                      </TableCell>
                      <TableCell className="py-2 text-xs tabular-nums">
                        {fmtDate(c.newEndDate)}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground tabular-nums">
                        {fmtDate(c.createdAt)}
                      </TableCell>
                      <TableCell className="py-2">{statusBadge(c.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {list.length > 0 && <TableCaption>共 {list.length} 条变更申请</TableCaption>}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
