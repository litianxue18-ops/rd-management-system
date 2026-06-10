'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, AlertTriangle, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

type CheckType = 'workhour_project' | 'material_output' | 'finance_business';

interface ExceptionNote {
  id: number;
  docNo: string;
  status: 'open' | 'resolved';
  reason: string;
  resolution: string | null;
  raisedById: number;
  resolvedById: number | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface Detail {
  id: number;
  year: number;
  month: number;
  checkType: CheckType;
  expectedValue: string;
  actualValue: string;
  diffRate: string;
  isException: boolean;
  note: string | null;
  createdAt: string;
  exceptionNotes: ExceptionNote[];
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

function checkTypeLabel(t: CheckType) {
  if (t === 'workhour_project') return '工时-项目';
  if (t === 'material_output') return '领料-产出';
  return '财务-业务';
}

export default function ReconciliationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const recId = Number(id);
  const [data, setData] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);

  // create exception dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [reason, setReason] = useState('');

  // resolve exception dialog
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<number | null>(null);
  const [resolution, setResolution] = useState('');

  async function load() {
    const r = await fetch(`/api/reconciliation/${recId}`);
    const j = await r.json();
    setData(j.data ?? null);
  }

  useEffect(() => {
    if (!Number.isFinite(recId)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recId]);

  async function submitException() {
    if (!reason.trim()) {
      toast.error('异常原因必填');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/reconciliation/${recId}/exception`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const j = await r.json();
      if (j.error) toast.error(j.error.message);
      else {
        toast.success(`异常单 ${j.data.docNo} 已创建`);
        setReason('');
        setCreateOpen(false);
        load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitResolve() {
    if (!resolveTarget) return;
    if (!resolution.trim()) {
      toast.error('解决方案必填');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/reconciliation/exceptions/${resolveTarget}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resolution: resolution.trim() }),
      });
      const j = await r.json();
      if (j.error) toast.error(j.error.message);
      else {
        toast.success('异常单已解决');
        setResolution('');
        setResolveOpen(false);
        setResolveTarget(null);
        load();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const diffRate = Number(data.diffRate);
  const monthLabel = `${data.year}-${String(data.month).padStart(2, '0')}`;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href="/reconciliation"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              月度勾稽
            </Link>
            <ChevronRight size={12} />
            <span>{monthLabel}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
              {checkTypeLabel(data.checkType)} 勾稽
            </h1>
            <code className="font-mono text-sm tabular-nums text-slate-600">{monthLabel}</code>
            {data.isException ? (
              <Badge className="bg-rose-600 text-white border-rose-700 hover:bg-rose-600">
                异常
              </Badge>
            ) : (
              <Badge className="bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-600">
                正常
              </Badge>
            )}
          </div>
          {data.note && (
            <div className="mt-2 text-xs text-muted-foreground">{data.note}</div>
          )}
        </div>
      </div>

      {/* 勾稽数据 */}
      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">勾稽数据</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">期望值</div>
              <div className="text-2xl md:text-3xl font-bold tabular-nums text-slate-900 mt-1">
                {fmtNum(data.expectedValue)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">实际值</div>
              <div className="text-2xl md:text-3xl font-bold tabular-nums text-slate-900 mt-1">
                {fmtNum(data.actualValue)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">差异率</div>
              <div
                className={
                  data.isException
                    ? 'text-2xl md:text-3xl font-bold tabular-nums text-rose-700 mt-1'
                    : 'text-2xl md:text-3xl font-bold tabular-nums text-emerald-700 mt-1'
                }
              >
                {fmtPct(diffRate)}
              </div>
            </div>
          </div>
          {/* progress bar */}
          <div className="mt-4">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={
                  data.isException
                    ? 'h-full bg-rose-500 rounded-full'
                    : 'h-full bg-emerald-500 rounded-full'
                }
                style={{ width: `${Math.min(diffRate * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>阈值 3%</span>
              <span className="tabular-nums">{fmtPct(diffRate)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 异常核对单 */}
      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            异常核对单 ({data.exceptionNotes.length})
          </CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus size={12} className="mr-1.5" />
                创建异常单
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建异常核对单</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reason">异常原因</Label>
                  <Textarea
                    id="reason"
                    rows={4}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="详细描述差异成因 / 涉及项目 / 暂停范围 (如有)"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  取消
                </Button>
                <Button onClick={submitException} disabled={busy}>
                  提交
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {data.exceptionNotes.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              暂无异常单
            </div>
          ) : (
            <div className="space-y-3">
              {data.exceptionNotes.map((n) => (
                <div
                  key={n.id}
                  className={
                    n.status === 'open'
                      ? 'rounded-lg border-2 border-amber-300 bg-amber-50/40 p-4'
                      : 'rounded-lg border border-emerald-200 bg-emerald-50/40 p-4'
                  }
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="font-mono text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded tabular-nums">
                          {n.docNo}
                        </code>
                        {n.status === 'open' ? (
                          <Badge className="bg-amber-600 text-white border-amber-700 hover:bg-amber-600">
                            待整改
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-600">
                            已解决
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          提出于 {fmtDateTime(n.createdAt)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                        <span className="text-xs text-muted-foreground">原因: </span>
                        {n.reason}
                      </div>
                      {n.resolution && (
                        <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                          <span className="text-xs text-muted-foreground">
                            解决方案 ({fmtDateTime(n.resolvedAt)}):{' '}
                          </span>
                          {n.resolution}
                        </div>
                      )}
                    </div>
                    {n.status === 'open' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setResolveTarget(n.id);
                          setResolution('');
                          setResolveOpen(true);
                        }}
                      >
                        <Check size={12} className="mr-1.5" />
                        标记解决
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* resolve dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>填写解决方案</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="resolution">解决方案</Label>
              <Textarea
                id="resolution"
                rows={4}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="说明整改措施 / 责任人 / 完成时间"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>
              取消
            </Button>
            <Button onClick={submitResolve} disabled={busy}>
              提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
