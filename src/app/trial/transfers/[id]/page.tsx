'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Send, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApprovalHistory } from '@/components/approval-history';
import { toast } from 'sonner';

type Status =
  | 'draft'
  | 'reviewing'
  | 'approved'
  | 'settled'
  | 'rejected'
  | 'cancelled';

interface Detail {
  id: number;
  docNo: string;
  trialOrderId: number;
  projectId: number;
  laborCost: string;
  machineCost: string;
  materialCost: string;
  totalAmount: string;
  description: string;
  status: Status;
  requesterId: number;
  rejectedReason: string | null;
  settledAt: string | null;
  createdAt: string;
  project: { id: number; code: string; name: string };
  trialOrder: { id: number; docNo: string; title: string };
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
        已批准
      </Badge>
    );
  if (s === 'settled')
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100">
        已结转
      </Badge>
    );
  if (s === 'rejected')
    return (
      <Badge className="bg-rose-600 text-white border-rose-700 hover:bg-rose-600">已驳回</Badge>
    );
  return <Badge variant="secondary">已取消</Badge>;
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

export default function TrialTransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const transferId = Number(id);
  const [data, setData] = useState<Detail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    const [r, m, ins] = await Promise.all([
      fetch(`/api/trial/transfers/${transferId}`).then((x) => x.json()),
      fetch('/api/auth/me').then((x) => x.json()),
      fetch(
        `/api/workflow/instances?entityType=trial_cost_transfer&entityId=${transferId}`,
      ).then((x) => x.json()),
    ]);
    setData(r.data ?? null);
    setMe(m.data ?? null);
    setInstances(ins.data ?? []);
  }

  useEffect(() => {
    if (!Number.isFinite(transferId)) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferId]);

  async function submitForApproval() {
    setBusy(true);
    try {
      const r = await fetch('/api/workflow/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workflowCode: 'trial_transfer_v1',
          entityId: transferId,
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

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href="/trial/transfers"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              试制费用转嫁单
            </Link>
            <ChevronRight size={12} />
            <span>转嫁详情</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
              {data.project.name}
            </h1>
            <code className="font-mono text-sm tabular-nums text-slate-600">
              {data.docNo}
            </code>
            {statusBadge(data.status)}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
            <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">
              {data.project.code}
            </code>
            <span>·</span>
            <span>关联试制单</span>
            <Link
              href={`/trial/orders/${data.trialOrderId}`}
              className="font-mono text-blue-700 hover:underline"
            >
              {data.trialOrder.docNo}
            </Link>
            <span>·</span>
            <span>创建于 {fmtDateTime(data.createdAt)}</span>
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
        </div>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">费用明细</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">人工费</dt>
              <dd className="font-mono tabular-nums text-slate-900 mt-0.5">
                ¥{Number(data.laborCost).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">机台费</dt>
              <dd className="font-mono tabular-nums text-slate-900 mt-0.5">
                ¥{Number(data.machineCost).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">材料费</dt>
              <dd className="font-mono tabular-nums text-slate-900 mt-0.5">
                ¥{Number(data.materialCost).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">总额</dt>
              <dd className="font-mono tabular-nums text-lg font-semibold text-slate-900 mt-0.5">
                ¥{Number(data.totalAmount).toLocaleString()}
              </dd>
            </div>
            <div className="col-span-2 md:col-span-4">
              <dt className="text-xs text-muted-foreground">转嫁说明</dt>
              <dd className="text-sm text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded-md mt-1">
                {data.description}
              </dd>
            </div>
            {data.settledAt && (
              <div>
                <dt className="text-xs text-muted-foreground">结转时间</dt>
                <dd className="font-mono tabular-nums text-emerald-700 mt-0.5">
                  {fmtDateTime(data.settledAt)}
                </dd>
              </div>
            )}
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
          <CardTitle className="text-base font-semibold">
            审批历史 (4 步: 生产部 → 研发负责人 → 财务部 → 总经理)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalHistory
            entityType="trial_cost_transfer"
            entityId={transferId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
