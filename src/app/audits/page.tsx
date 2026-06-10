'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, ShieldCheck } from 'lucide-react';
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

interface Me {
  roles: { code: string; isPrimary: boolean }[];
}

interface Row {
  id: number;
  year: number;
  quarter: number;
  compliantProject: boolean;
  compliantBudget: boolean;
  compliantMaterial: boolean;
  compliantOutsource: boolean;
  compliantArchive: boolean;
  overallOpinion: string;
  auditorId: number;
  createdAt: string;
}

function fmtDateTime(s: string) {
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function compliantCount(r: Row) {
  return (
    Number(r.compliantProject) +
    Number(r.compliantBudget) +
    Number(r.compliantMaterial) +
    Number(r.compliantOutsource) +
    Number(r.compliantArchive)
  );
}

function ComplianceBadges({ r }: { r: Row }) {
  const items = [
    { ok: r.compliantProject, label: '人员' },
    { ok: r.compliantBudget, label: '投入' },
    { ok: r.compliantMaterial, label: '工时' },
    { ok: r.compliantOutsource, label: '样品' },
    { ok: r.compliantArchive, label: '资本化' },
  ];
  return (
    <div className="flex gap-1 flex-wrap">
      {items.map((it) => (
        <span
          key={it.label}
          className={
            it.ok
              ? 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-600 text-white'
              : 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-600 text-white'
          }
        >
          {it.label}
        </span>
      ))}
    </div>
  );
}

export default function AuditsListPage() {
  const [list, setList] = useState<Row[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  async function load() {
    const r = await fetch('/api/audits');
    const j = await r.json();
    setList(j.data ?? []);
  }

  useEffect(() => {
    load();
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((j) => setMe(j.data ?? null));
  }, []);

  const canCreate = useMemo(() => {
    const codes = (me?.roles ?? []).map((r) => r.code);
    return codes.includes('audit_lead') || codes.includes('super_admin');
  }, [me]);

  const count = list?.length ?? 0;
  const fullyCompliant =
    list?.filter((r) => compliantCount(r) === 5).length ?? 0;
  const needRectify =
    list?.filter((r) => compliantCount(r) < 5).length ?? 0;

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
            季度内审
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            5 大重点 (人员认定 / 投入归集 / 工时记录 / 样品销售 / 资本化时点); 每季度一份
          </p>
        </div>
        {canCreate && (
          <Button asChild className="shrink-0">
            <Link href="/audits/new">
              <Plus size={14} className="mr-1.5" />
              新建内审
            </Link>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
        <span>
          共 <span className="font-medium text-slate-900 tabular-nums">{count}</span> 份
        </span>
        <span>·</span>
        <span className="tabular-nums text-emerald-700">{fullyCompliant} 全合规</span>
        <span>·</span>
        <span className="tabular-nums text-rose-700">{needRectify} 有整改</span>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardContent className="pt-6">
          {list === null ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead>期间</TableHead>
                  <TableHead>合规检查</TableHead>
                  <TableHead>总体</TableHead>
                  <TableHead>总体意见</TableHead>
                  <TableHead>审计员</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <ShieldCheck size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无季度内审
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {canCreate ? '点击右上 "新建内审"' : '请联系审计组发起'}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((r) => {
                    const cnt = compliantCount(r);
                    return (
                      <TableRow key={r.id} className="h-10 hover:bg-blue-50/50">
                        <TableCell className="py-2 font-mono tabular-nums text-xs">
                          {r.year} Q{r.quarter}
                        </TableCell>
                        <TableCell className="py-2">
                          <ComplianceBadges r={r} />
                        </TableCell>
                        <TableCell className="py-2">
                          {cnt === 5 ? (
                            <Badge className="bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-600 tabular-nums">
                              全合规 {cnt}/5
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-600 text-white border-amber-700 hover:bg-amber-600 tabular-nums">
                              整改 {cnt}/5
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-sm text-slate-700 max-w-[300px] truncate">
                          {r.overallOpinion.split('\n')[0]}
                        </TableCell>
                        <TableCell className="py-2 text-sm text-muted-foreground">
                          #{r.auditorId}
                        </TableCell>
                        <TableCell className="py-2 text-xs tabular-nums text-muted-foreground">
                          {fmtDateTime(r.createdAt)}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/audits/${r.id}`}>查看</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
              {list.length > 0 && (
                <TableCaption>共 {list.length} 份季度内审</TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
