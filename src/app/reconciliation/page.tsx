'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, AlertTriangle, ClipboardList, BookText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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

interface Row {
  id: number;
  year: number;
  month: number;
  checkType: 'workhour_project' | 'material_output' | 'finance_business';
  expectedValue: string;
  actualValue: string;
  diffRate: string;
  isException: boolean;
  note: string | null;
  createdAt: string;
  _count?: { exceptionNotes: number };
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

function fmtPct(s: string | number) {
  const n = typeof s === 'string' ? Number(s) : s;
  if (!Number.isFinite(n)) return '—';
  return (n * 100).toFixed(2) + '%';
}

function checkTypeBadge(t: Row['checkType']) {
  if (t === 'workhour_project')
    return (
      <Badge className="bg-blue-600 text-white border-blue-700 hover:bg-blue-600">
        工时-项目
      </Badge>
    );
  if (t === 'material_output')
    return (
      <Badge className="bg-amber-600 text-white border-amber-700 hover:bg-amber-600">
        领料-产出
      </Badge>
    );
  return (
    <Badge className="bg-slate-600 text-white border-slate-700 hover:bg-slate-600">
      财务-业务
    </Badge>
  );
}

function diffBadge(diffRate: number, isException: boolean) {
  if (!isException)
    return (
      <Badge className="bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-600 tabular-nums">
        正常 {fmtPct(diffRate)}
      </Badge>
    );
  return (
    <Badge className="bg-rose-600 text-white border-rose-700 hover:bg-rose-600 tabular-nums">
      异常 {fmtPct(diffRate)}
    </Badge>
  );
}

function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function ReconciliationListPage() {
  const initial = currentYearMonth();
  const [year, setYear] = useState<number>(initial.year);
  const [month, setMonth] = useState<number>(initial.month);
  const [list, setList] = useState<Row[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [running, setRunning] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookAmount, setBookAmount] = useState('');
  const [bookNote, setBookNote] = useState('');
  const [bookSaving, setBookSaving] = useState(false);

  async function load() {
    const r = await fetch(`/api/reconciliation?year=${year}&month=${month}`);
    const j = await r.json();
    setList(j.data ?? []);
  }

  async function openBookDialog() {
    setBookOpen(true);
    const r = await fetch(
      `/api/reconciliation/finance-book?year=${year}&month=${month}`,
    );
    const j = await r.json();
    if (j.data) {
      setBookAmount(String(Number(j.data.bookAmount)));
      setBookNote(j.data.note ?? '');
    } else {
      setBookAmount('');
      setBookNote('');
    }
  }

  async function saveBook() {
    const v = Number(bookAmount);
    if (!(v >= 0)) {
      toast.error('账面金额需 ≥ 0');
      return;
    }
    setBookSaving(true);
    try {
      const r = await fetch('/api/reconciliation/finance-book', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ year, month, bookAmount: v, note: bookNote || undefined }),
      });
      const j = await r.json();
      if (j.error) toast.error(j.error.message);
      else {
        toast.success(
          `已录入 ${year}-${String(month).padStart(2, '0')} 财务账面; 重跑勾稽以更新差异`,
        );
        setBookOpen(false);
      }
    } finally {
      setBookSaving(false);
    }
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

  async function run() {
    setRunning(true);
    try {
      const r = await fetch('/api/reconciliation/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ year, month }),
      });
      const j = await r.json();
      if (j.error) toast.error(j.error.message);
      else {
        toast.success(`已执行 ${year}-${String(month).padStart(2, '0')} 勾稽 (3 类)`);
        load();
      }
    } finally {
      setRunning(false);
    }
  }

  const canRun = useMemo(() => {
    const codes = (me?.roles ?? []).map((r) => r.code);
    return (
      codes.includes('finance_lead') ||
      codes.includes('audit_lead') ||
      codes.includes('super_admin')
    );
  }, [me]);

  const exceptionCount = list?.filter((r) => r.isException).length ?? 0;
  const totalExceptionNotes =
    list?.reduce((s, r) => s + (r._count?.exceptionNotes ?? 0), 0) ?? 0;

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
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            月度勾稽
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            财务-业务对账, 差异率 &gt; 3% 触发异常; 工时-项目 / 领料-产出 / 财务-业务 3 类
          </p>
        </div>
        {canRun && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={openBookDialog}>
              <BookText size={14} className="mr-1.5" />
              录入财务账面
            </Button>
            <Button onClick={run} disabled={running}>
              <Play size={14} className="mr-1.5" />
              执行本月勾稽
            </Button>
          </div>
        )}
      </div>

      <Dialog open={bookOpen} onOpenChange={setBookOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              录入财务账面 · {year}-{String(month).padStart(2, '0')}
            </DialogTitle>
            <DialogDescription>
              财务账面研发支出总额, 与系统归集 (已批准分摊总额) 比对, 差异率 &gt; 3% 触发异常
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="bookAmount">账面金额 (元)</Label>
              <Input
                id="bookAmount"
                type="number"
                min={0}
                step="0.01"
                value={bookAmount}
                onChange={(e) => setBookAmount(e.target.value)}
                className="font-mono tabular-nums"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bookNote">备注 (可选)</Label>
              <Input
                id="bookNote"
                value={bookNote}
                onChange={(e) => setBookNote(e.target.value)}
                placeholder="如: 账面口径说明"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookOpen(false)}>
              取消
            </Button>
            <Button onClick={saveBook} disabled={bookSaving}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            共 <span className="font-medium text-slate-900 tabular-nums">{list?.length ?? 0}</span> 条
          </span>
          <span>·</span>
          <span className="tabular-nums text-rose-700">{exceptionCount} 异常</span>
          <span>·</span>
          <span className="tabular-nums text-amber-700">{totalExceptionNotes} 异常单</span>
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
                {year}-{String(month).padStart(2, '0')} 暂未勾稽
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {canRun
                  ? '点击右上 "执行本月勾稽" 生成 3 类对账记录'
                  : '请联系财务部 / 审计组执行勾稽'}
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead>月份</TableHead>
                  <TableHead>勾稽类型</TableHead>
                  <TableHead className="text-right">期望值</TableHead>
                  <TableHead className="text-right">实际值</TableHead>
                  <TableHead>差异</TableHead>
                  <TableHead className="text-right">异常单数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r) => (
                  <TableRow key={r.id} className="h-10 hover:bg-blue-50/50">
                    <TableCell className="py-2 font-mono tabular-nums text-xs">
                      {r.year}-{String(r.month).padStart(2, '0')}
                    </TableCell>
                    <TableCell className="py-2">{checkTypeBadge(r.checkType)}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums">
                      {fmtNum(r.expectedValue)}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums">
                      {fmtNum(r.actualValue)}
                    </TableCell>
                    <TableCell className="py-2">
                      {diffBadge(Number(r.diffRate), r.isException)}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums">
                      {r._count?.exceptionNotes ? (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <AlertTriangle size={12} />
                          {r._count.exceptionNotes}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/reconciliation/${r.id}`}>查看</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableCaption>
                {year}-{String(month).padStart(2, '0')} 共 {list.length} 条勾稽记录
              </TableCaption>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
