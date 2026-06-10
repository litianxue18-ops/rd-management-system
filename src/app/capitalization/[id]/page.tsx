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

type Status = 'draft' | 'reviewing' | 'approved' | 'rejected' | 'cancelled';

interface Detail {
  id: number;
  docNo: string;
  projectId: number;
  condTechnical: boolean;
  condIntent: boolean;
  condUsability: boolean;
  condMarket: boolean;
  condResource: boolean;
  evidenceTechnical: string;
  evidenceMarket: string;
  evidenceResource: string;
  evidenceCost: string;
  capitalizationAmount: string;
  status: Status;
  createdById: number;
  createdAt: string;
  approvedAt: string | null;
  rejectedReason: string | null;
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
      <Badge className="bg-blue-600 text-white border-blue-700 hover:bg-blue-600">审批中</Badge>
    );
  if (s === 'approved')
    return (
      <Badge className="bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-600">
        已通过
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

function fmtAmount(s: string | number) {
  const n = typeof s === 'string' ? Number(s) : s;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const COND_LABELS: { key: keyof Detail; title: string }[] = [
  { key: 'condTechnical', title: '技术可行' },
  { key: 'condIntent', title: '完成意图明确' },
  { key: 'condUsability', title: '可用性 / 经济利益' },
  { key: 'condMarket', title: '市场价值' },
  { key: 'condResource', title: '资源保障充分' },
];

const EVI_LABELS: { key: keyof Detail; title: string }[] = [
  { key: 'evidenceTechnical', title: '技术可行性证明' },
  { key: 'evidenceMarket', title: '市场价值证明' },
  { key: 'evidenceResource', title: '资源保障证明' },
  { key: 'evidenceCost', title: '成本可计量证明' },
];

export default function CapitalizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const capId = Number(id);
  const [data, setData] = useState<Detail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    const [r, m, ins] = await Promise.all([
      fetch(`/api/capitalization/${capId}`).then((x) => x.json()),
      fetch('/api/auth/me').then((x) => x.json()),
      fetch(
        `/api/workflow/instances?entityType=capitalization_report&entityId=${capId}`,
      ).then((x) => x.json()),
    ]);
    setData(r.data ?? null);
    setMe(m.data ?? null);
    setInstances(ins.data ?? []);
  }

  useEffect(() => {
    if (!Number.isFinite(capId)) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capId]);

  async function submitForApproval() {
    setBusy(true);
    try {
      const r = await fetch('/api/workflow/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workflowCode: 'capitalization_v1',
          entityId: capId,
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
  const runningInst = instances.find((i) => i.status === 'running');
  const currentStep = runningInst?.steps.find(
    (s) => s.id === runningInst.currentStepId,
  );
  const canSubmit = data.status === 'draft' && isCreator;
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
              href="/capitalization"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              资本化评估
            </Link>
            <ChevronRight size={12} />
            <span>评估详情</span>
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
            <Link
              href={`/projects/${data.projectId}`}
              className="hover:text-slate-900"
            >
              {data.project.code}
            </Link>
            <span>·</span>
            <span>创建于 {fmtDateTime(data.createdAt)}</span>
            {data.approvedAt && (
              <>
                <span>·</span>
                <span>通过于 {fmtDateTime(data.approvedAt)}</span>
              </>
            )}
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

      {data.rejectedReason && (
        <Card className="border-rose-300 shadow-md rounded-xl">
          <CardContent className="pt-4">
            <div className="text-xs text-rose-700 font-medium mb-1">驳回原因</div>
            <div className="text-sm text-rose-700 whitespace-pre-wrap">
              {data.rejectedReason}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">资本化金额</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl md:text-4xl font-bold tabular-nums text-slate-900">
            ¥{fmtAmount(data.capitalizationAmount)}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">5 项条件门控</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {COND_LABELS.map((c) => {
              const v = data[c.key] as boolean;
              return (
                <div
                  key={String(c.key)}
                  className={
                    v
                      ? 'rounded-lg border-2 border-emerald-500 bg-emerald-50 p-3'
                      : 'rounded-lg border-2 border-rose-300 bg-rose-50 p-3'
                  }
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={
                        v
                          ? 'shrink-0 size-5 rounded bg-emerald-600 text-white flex items-center justify-center'
                          : 'shrink-0 size-5 rounded bg-rose-600 text-white flex items-center justify-center'
                      }
                    >
                      {v ? <Check size={12} /> : <X size={12} />}
                    </div>
                    <div className="font-medium text-slate-900 text-sm">
                      {c.title}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">必备支撑材料</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4 text-sm">
            {EVI_LABELS.map((e) => {
              const v = (data[e.key] as string) || '';
              return (
                <div key={String(e.key)}>
                  <dt className="text-xs text-muted-foreground mb-1">{e.title}</dt>
                  <dd className="text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded-md">
                    {v.trim() ? v : <span className="text-slate-400">未填写</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            审批历史 (4 步: 研发中心 → 技委会 → 财务部 → 总经理)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalHistory entityType="capitalization_report" entityId={capId} />
        </CardContent>
      </Card>
    </div>
  );
}
