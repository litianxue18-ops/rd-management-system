'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Send, X, Check, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApprovalHistory } from '@/components/approval-history';
import { toast } from 'sonner';

type Status = 'draft' | 'reviewing' | 'approved';

interface Detail {
  id: number;
  docNo: string;
  projectId: number;
  year: number;
  month: number;
  laborCost: string;
  materialCost: string;
  trialCost: string;
  outsourceCost: string;
  sharedCost: string;
  equityCost: string;
  totalCost: string;
  note: string | null;
  status: Status;
  createdById: number;
  createdAt: string;
  project: { id: number; code: string; name: string };
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
      <Badge className="bg-blue-600 text-white border-blue-700 hover:bg-blue-600">
        审批中
      </Badge>
    );
  return (
    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100">
      已批准
    </Badge>
  );
}

function fmt(s: string | number) {
  return Number(s).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function CostItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`font-mono tabular-nums mt-0.5 ${accent ? 'text-lg font-semibold text-slate-900' : 'text-slate-900'}`}
      >
        ¥{fmt(value)}
      </dd>
    </div>
  );
}

export default function AllocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const allocId = Number(id);
  const [data, setData] = useState<Detail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [busy, setBusy] = useState(false);
  const [equityInput, setEquityInput] = useState('');

  async function loadAll() {
    const [r, m, ins] = await Promise.all([
      fetch(`/api/cost-allocations/${allocId}`).then((x) => x.json()),
      fetch('/api/auth/me').then((x) => x.json()),
      fetch(
        `/api/workflow/instances?entityType=cost_allocation&entityId=${allocId}`,
      ).then((x) => x.json()),
    ]);
    setData(r.data ?? null);
    setMe(m.data ?? null);
    setInstances(ins.data ?? []);
    if (r.data) setEquityInput(String(Number(r.data.equityCost)));
  }

  useEffect(() => {
    if (!Number.isFinite(allocId)) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocId]);

  async function saveEquity() {
    const v = Number(equityInput);
    if (!(v >= 0)) {
      toast.error('股份支付摊销需 ≥ 0');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/cost-allocations/${allocId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ equityCost: v }),
      });
      const j = await r.json();
      if (j.error) toast.error(j.error.message);
      else {
        toast.success('已保存并重算总额');
        loadAll();
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitForApproval() {
    setBusy(true);
    try {
      const r = await fetch('/api/workflow/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workflowCode: 'cost_allocation_v1',
          entityId: allocId,
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

  const isCreator = me?.id === data.createdById;
  const canEditEquity = data.status === 'draft' && isCreator;
  const canSubmit = data.status === 'draft' && isCreator;
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
              href="/monthly/allocations"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              研发支出分摊计算表
            </Link>
            <ChevronRight size={12} />
            <span>分摊详情</span>
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
            <span className="tabular-nums">
              归集月度 {data.year}-{String(data.month).padStart(2, '0')}
            </span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {canSubmit && (
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
          <CardTitle className="text-base font-semibold">费用明细 (6 项)</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <CostItem label="人工费 (当月工时×单价)" value={data.laborCost} />
            <CostItem label="材料费 (当月领料净消耗)" value={data.materialCost} />
            <CostItem label="试制费 (当月结转转嫁)" value={data.trialCost} />
            <CostItem label="委外费 (当月付款)" value={data.outsourceCost} />
            <CostItem label="共用资源分摊" value={data.sharedCost} />
            <div>
              <dt className="text-xs text-muted-foreground">股份支付摊销 (手填)</dt>
              {canEditEquity ? (
                <dd className="mt-1 flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={equityInput}
                    onChange={(e) => setEquityInput(e.target.value)}
                    className="h-8 w-32 font-mono tabular-nums"
                  />
                  <Button size="sm" variant="outline" onClick={saveEquity} disabled={busy}>
                    <Save size={14} className="mr-1" />
                    保存
                  </Button>
                </dd>
              ) : (
                <dd className="font-mono tabular-nums text-slate-900 mt-0.5">
                  ¥{fmt(data.equityCost)}
                </dd>
              )}
            </div>
          </dl>
          <div className="mt-5 pt-4 border-t border-slate-200 flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">本月归集总额</span>
            <span className="font-mono tabular-nums text-2xl font-bold text-slate-900">
              ¥{fmt(data.totalCost)}
            </span>
          </div>
          {data.note && (
            <div className="mt-4">
              <dt className="text-xs text-muted-foreground">备注 / 驳回原因</dt>
              <dd className="text-sm text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded-md mt-1">
                {data.note}
              </dd>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            审批历史 (3 步: 财务负责人 → 研发负责人 → 总经理)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalHistory entityType="cost_allocation" entityId={allocId} />
        </CardContent>
      </Card>
    </div>
  );
}
