'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronRight,
  Send,
  X,
  Check,
  CheckCircle2,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ApprovalHistory } from '@/components/approval-history';
import { toast } from 'sonner';

type Status =
  | 'draft'
  | 'reviewing'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'cancelled';

interface Transfer {
  id: number;
  docNo: string;
  totalAmount: string;
  status: string;
  createdAt: string;
}

interface Detail {
  id: number;
  docNo: string;
  projectId: number;
  title: string;
  description: string;
  plannedQty: string;
  plannedUnit: string;
  actualQty: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  status: Status;
  requesterId: number;
  productionLeadId: number | null;
  rejectedReason: string | null;
  createdAt: string;
  project: { id: number; code: string; name: string };
  transfers: Transfer[];
}

interface Me {
  id: number;
  name: string;
}

interface Instance {
  id: number;
  status: 'draft' | 'running' | 'approved' | 'rejected' | 'cancelled';
  submittedBy: number;
  currentStepId: number | null;
  steps: Array<{
    id: number;
    stepIndex: number;
    status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'transferred';
    assignedUserId: number | null;
  }>;
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

function fmtDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function transferStatusLabel(s: string) {
  const m: Record<string, string> = {
    draft: '草稿',
    reviewing: '审批中',
    approved: '已批准',
    settled: '已结转',
    rejected: '已驳回',
    cancelled: '已取消',
  };
  return m[s] ?? s;
}

export default function TrialOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const orderId = Number(id);
  const [data, setData] = useState<Detail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [busy, setBusy] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [actualQty, setActualQty] = useState('');
  const [actualEnd, setActualEnd] = useState(
    new Date().toISOString().slice(0, 10),
  );

  async function loadAll() {
    const [r, m, ins] = await Promise.all([
      fetch(`/api/trial/orders/${orderId}`).then((x) => x.json()),
      fetch('/api/auth/me').then((x) => x.json()),
      fetch(
        `/api/workflow/instances?entityType=trial_production_order&entityId=${orderId}`,
      ).then((x) => x.json()),
    ]);
    setData(r.data ?? null);
    setMe(m.data ?? null);
    setInstances(ins.data ?? []);
  }

  useEffect(() => {
    if (!Number.isFinite(orderId)) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function submitForApproval() {
    setBusy(true);
    try {
      const r = await fetch('/api/workflow/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workflowCode: 'trial_production_v1',
          entityId: orderId,
        }),
      });
      const j = await r.json();
      if (j.error) toast.error(j.error.message);
      else {
        toast.success('已提交审批');
        loadAll();
      }
    } finally {
      setBusy(false);
    }
  }

  async function withdrawInstance(instanceId: number) {
    setBusy(true);
    try {
      const r = await fetch('/api/workflow/withdraw', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ instanceId }),
      });
      const j = await r.json();
      if (j.error) toast.error(j.error.message);
      else {
        toast.success('已撤回');
        loadAll();
      }
    } finally {
      setBusy(false);
    }
  }

  async function doComplete() {
    const q = Number(actualQty);
    if (!(q > 0)) {
      toast.error('实际产出必须 > 0');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/trial/orders/${orderId}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actualQty: q, actualEnd }),
      });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
        return;
      }
      toast.success('已完成');
      setCompleteOpen(false);
      loadAll();
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

  const isRequester = me?.id === data.requesterId;
  const canEdit = data.status === 'draft' && isRequester;
  const runningInst = instances.find((i) => i.status === 'running');
  const currentStep = runningInst?.steps.find(
    (s) => s.id === runningInst.currentStepId,
  );
  const canApprove =
    !!currentStep &&
    currentStep.assignedUserId === me?.id &&
    currentStep.status === 'pending';
  const canWithdraw =
    !!runningInst &&
    runningInst.submittedBy === me?.id &&
    runningInst.steps.find((s) => s.stepIndex === 1)?.status === 'pending';
  const canComplete =
    data.status === 'approved' && data.productionLeadId === me?.id;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href="/trial/orders"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              试制任务台账
            </Link>
            <ChevronRight size={12} />
            <span>试制详情</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
              {data.title}
            </h1>
            <code className="font-mono text-sm tabular-nums text-slate-600">
              {data.docNo}
            </code>
            {statusBadge(data.status)}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
            <span>{data.project.name}</span>
            <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">
              {data.project.code}
            </code>
            <span>·</span>
            <span>创建于 {fmtDate(data.createdAt)}</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {canEdit && (
            <Button onClick={submitForApproval} disabled={busy}>
              <Send size={14} className="mr-1.5" />
              提交审批
            </Button>
          )}
          {canWithdraw && runningInst && (
            <Button
              variant="outline"
              onClick={() => withdrawInstance(runningInst.id)}
              disabled={busy}
            >
              <X size={14} className="mr-1.5" />
              撤回审批
            </Button>
          )}
          {canApprove && runningInst && (
            <Button asChild>
              <Link href={`/approval/${runningInst.id}`}>
                <Check size={14} className="mr-1.5" />
                处理审批
              </Link>
            </Button>
          )}
          {canComplete && (
            <Button onClick={() => setCompleteOpen(true)} disabled={busy}>
              <CheckCircle2 size={14} className="mr-1.5" />
              填实际产出 / 完成
            </Button>
          )}
        </div>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">计划数量</dt>
              <dd className="font-mono tabular-nums text-slate-900 mt-0.5">
                {Number(data.plannedQty).toLocaleString()}{' '}
                <span className="text-xs text-muted-foreground">
                  {data.plannedUnit}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">实际数量</dt>
              <dd className="font-mono tabular-nums text-slate-900 mt-0.5">
                {data.actualQty != null
                  ? `${Number(data.actualQty).toLocaleString()} ${data.plannedUnit}`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">计划起止</dt>
              <dd className="font-mono tabular-nums text-slate-900 mt-0.5 text-xs">
                {fmtDate(data.scheduledStart)} ~ {fmtDate(data.scheduledEnd)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">实际起止</dt>
              <dd className="font-mono tabular-nums text-slate-900 mt-0.5 text-xs">
                {fmtDate(data.actualStart)} ~ {fmtDate(data.actualEnd)}
              </dd>
            </div>
            <div className="col-span-2 md:col-span-4">
              <dt className="text-xs text-muted-foreground">工艺要求</dt>
              <dd className="text-sm text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded-md mt-1">
                {data.description}
              </dd>
            </div>
            {data.rejectedReason && (
              <div className="col-span-2 md:col-span-4">
                <dt className="text-xs text-muted-foreground">驳回原因</dt>
                <dd className="text-sm text-rose-700 whitespace-pre-wrap p-3 bg-rose-50 rounded-md mt-1">
                  {data.rejectedReason}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">审批历史</CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalHistory
            entityType="trial_production_order"
            entityId={orderId}
          />
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Receipt size={16} className="text-slate-500" />
            试制费用转嫁单
          </CardTitle>
          {data.status === 'completed' && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/trial/transfers/new?orderId=${orderId}`}>
                新建转嫁单
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {data.transfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {data.status === 'completed'
                ? '暂无转嫁单, 点击右上 "新建转嫁单"'
                : '试制完成后可发起费用转嫁'}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.transfers.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-md hover:bg-blue-50/50"
                >
                  <Link
                    href={`/trial/transfers/${t.id}`}
                    className="flex-1 flex items-center gap-3"
                  >
                    <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded tabular-nums border border-slate-200">
                      {t.docNo}
                    </code>
                    <span className="font-mono tabular-nums text-slate-900 font-medium">
                      ¥{Number(t.totalAmount).toLocaleString()}
                    </span>
                  </Link>
                  <Badge variant="outline" className="text-xs">
                    {transferStatusLabel(t.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>填实际产出</DialogTitle>
            <DialogDescription>
              {data.docNo} · {data.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="aqty">实际数量 ({data.plannedUnit})</Label>
              <Input
                id="aqty"
                type="number"
                step="0.01"
                min="0"
                value={actualQty}
                onChange={(e) => setActualQty(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aend">实际结束日期</Label>
              <Input
                id="aend"
                type="date"
                value={actualEnd}
                onChange={(e) => setActualEnd(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCompleteOpen(false)}
              disabled={busy}
            >
              取消
            </Button>
            <Button onClick={doComplete} disabled={busy}>
              确认完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
