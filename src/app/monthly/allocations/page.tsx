'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calculator, ClipboardList, Sparkles } from 'lucide-react';
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
import { toast } from 'sonner';

type Status = 'draft' | 'reviewing' | 'approved';

interface Row {
  id: number;
  docNo: string;
  year: number;
  month: number;
  laborCost: string;
  materialCost: string;
  trialCost: string;
  outsourceCost: string;
  sharedCost: string;
  equityCost: string;
  totalCost: string;
  status: Status;
  project: { id: number; code: string; name: string };
}

interface Me {
  roles: { code: string; isPrimary: boolean }[];
}

function fmtNum(s: string | number) {
  const n = typeof s === 'string' ? Number(s) : s;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusBadge(s: Status) {
  if (s === 'draft') return <Badge variant="secondary">草稿</Badge>;
  if (s === 'reviewing')
    return (
      <Badge className="bg-blue-600 text-white border-blue-700 hover:bg-blue-600">
        审批中
      </Badge>
    );
  return (
    <Badge className="bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-600">
      已批准
    </Badge>
  );
}

function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function AllocationListPage() {
  const initial = currentYearMonth();
  const [year, setYear] = useState<number>(initial.year);
  const [month, setMonth] = useState<number>(initial.month);
  const [list, setList] = useState<Row[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [generating, setGenerating] = useState(false);

  async function load() {
    const r = await fetch(`/api/cost-allocations?year=${year}&month=${month}`);
    const j = await r.json();
    setList(j.data ?? []);
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((j) => setMe(j.data ?? null));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function generateMonth() {
    setGenerating(true);
    try {
      const r = await fetch('/api/cost-allocations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'month', year, month }),
      });
      const j = await r.json();
      if (j.error) toast.error(j.error.message);
      else {
        toast.success(
          `已生成/更新 ${j.data.generated} 条 ${year}-${String(month).padStart(2, '0')} 分摊单`,
        );
        load();
      }
    } finally {
      setGenerating(false);
    }
  }

  const canGenerate = useMemo(() => {
    const codes = (me?.roles ?? []).map((r) => r.code);
    return codes.includes('finance_lead') || codes.includes('super_admin');
  }, [me]);

  const totalSum =
    list?.reduce((s, r) => s + Number(r.totalCost), 0) ?? 0;
  const approvedCount = list?.filter((r) => r.status === 'approved').length ?? 0;

  const years = [initial.year - 1, initial.year, initial.year + 1];

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
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <Calculator size={22} className="text-blue-600" />
            研发支出分摊计算表
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            月度按项目归集辅助账 (人工 / 材料 / 试制 / 委外 / 共用资源 / 股份支付) · 3 步签批
          </p>
        </div>
        {canGenerate && (
          <Button onClick={generateMonth} disabled={generating} className="shrink-0">
            <Sparkles size={14} className="mr-1.5" />
            生成本月分摊
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            共 <span className="font-medium text-slate-900 tabular-nums">{list?.length ?? 0}</span> 条
          </span>
          <span>·</span>
          <span className="tabular-nums text-emerald-700">{approvedCount} 已批准</span>
          <span>·</span>
          <span>
            合计{' '}
            <span className="font-medium text-slate-900 tabular-nums">
              ¥{fmtNum(totalSum)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-8 w-24 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y} 年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="h-8 w-24 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m} 月
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardContent className="pt-6">
          {list === null ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <ClipboardList size={40} className="text-slate-200" />
              <div className="mt-3 text-base font-medium text-slate-500">
                {year}-{String(month).padStart(2, '0')} 暂无分摊单
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {canGenerate
                  ? '点击右上 "生成本月分摊" 按当月各项目归集 6 项费用'
                  : '请联系财务部生成本月分摊'}
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead>单号</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>年月</TableHead>
                  <TableHead className="text-right">人工</TableHead>
                  <TableHead className="text-right">材料</TableHead>
                  <TableHead className="text-right">试制</TableHead>
                  <TableHead className="text-right">委外</TableHead>
                  <TableHead className="text-right">共用</TableHead>
                  <TableHead className="text-right">股份</TableHead>
                  <TableHead className="text-right">总额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r) => (
                  <TableRow key={r.id} className="h-10 hover:bg-blue-50/50">
                    <TableCell className="py-2 font-mono tabular-nums text-xs">
                      {r.docNo}
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="font-medium text-slate-900">
                        {r.project.name}
                      </span>
                      <code className="ml-1.5 text-xs text-muted-foreground">
                        {r.project.code}
                      </code>
                    </TableCell>
                    <TableCell className="py-2 font-mono tabular-nums text-xs">
                      {r.year}-{String(r.month).padStart(2, '0')}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums text-xs">
                      {fmtNum(r.laborCost)}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums text-xs">
                      {fmtNum(r.materialCost)}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums text-xs">
                      {fmtNum(r.trialCost)}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums text-xs">
                      {fmtNum(r.outsourceCost)}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums text-xs">
                      {fmtNum(r.sharedCost)}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums text-xs">
                      {fmtNum(r.equityCost)}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums font-semibold text-slate-900">
                      {fmtNum(r.totalCost)}
                    </TableCell>
                    <TableCell className="py-2">{statusBadge(r.status)}</TableCell>
                    <TableCell className="py-2 text-right">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/monthly/allocations/${r.id}`}>详情</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableCaption>
                {year}-{String(month).padStart(2, '0')} 共 {list.length} 条分摊单 · 合计 ¥{fmtNum(totalSum)}
              </TableCaption>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
