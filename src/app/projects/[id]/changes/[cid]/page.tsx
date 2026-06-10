'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApprovalHistory } from '@/components/approval-history';
import { toast } from 'sonner';

interface Change {
  id: number;
  projectId: number;
  reason: string;
  scope: string;
  newBudget: string | null;
  newEndDate: string | null;
  details: string;
  status: 'draft' | 'reviewing' | 'rejected' | 'active' | 'closed' | 'cancelled';
  createdById: number;
  createdAt: string;
  appliedAt: string | null;
}

interface Me {
  id: number;
}

interface Step {
  id: number;
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'transferred';
  assignedUserId: number | null;
  stepIndex: number;
}

interface Instance {
  id: number;
  status: 'draft' | 'running' | 'approved' | 'rejected' | 'cancelled';
  submittedBy: number;
  currentStepId: number | null;
  steps: Step[];
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm text-slate-900">{children}</div>
    </div>
  );
}

export default function ChangeDetailPage() {
  const params = useParams<{ id: string; cid: string }>();
  const projectId = Number(params.id);
  const cid = Number(params.cid);
  const [ch, setCh] = useState<Change | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    const [c, m, ins] = await Promise.all([
      fetch(`/api/projects/${projectId}/changes/${cid}`).then((r) => r.json()),
      fetch('/api/auth/me').then((r) => r.json()),
      fetch(`/api/workflow/instances?entityType=project_change&entityId=${cid}`).then((r) =>
        r.json(),
      ),
    ]);
    setCh(c.data ?? null);
    setMe(m.data ?? null);
    setInstances(ins.data ?? []);
  }

  useEffect(() => {
    if (!isFinite(cid)) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);

  async function submitForApproval() {
    setBusy(true);
    try {
      const r = await fetch('/api/workflow/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workflowCode: 'project_change_v1', entityId: cid }),
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

  if (!ch) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isCreator = me?.id === ch.createdById;
  const canSubmit = ch.status === 'draft' && isCreator;
  const runningInst = instances.find((i) => i.status === 'running');
  const currentStep = runningInst?.steps.find((s) => s.id === runningInst.currentStepId);
  const canApprove =
    !!currentStep && currentStep.assignedUserId === me?.id && currentStep.status === 'pending';
  const canWithdraw =
    !!runningInst &&
    runningInst.submittedBy === me?.id &&
    runningInst.steps.find((s) => s.stepIndex === 1)?.status === 'pending';

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href={`/projects/${projectId}/changes`}
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              变更列表
            </Link>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
              {ch.reason}
            </h1>
            {statusBadge(ch.status)}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="font-mono">#{ch.id}</span>
            <span>·</span>
            <span>创建于 {fmtDate(ch.createdAt)}</span>
            {ch.appliedAt && (
              <>
                <span>·</span>
                <span>套用于 {fmtDate(ch.appliedAt)}</span>
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

      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">变更概要</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="变更范围">{ch.scope}</Field>
          <Field label="新预算 (元)">
            {ch.newBudget !== null && ch.newBudget !== undefined ? (
              <span className="font-mono tabular-nums">{ch.newBudget}</span>
            ) : (
              <span className="text-muted-foreground">未变</span>
            )}
          </Field>
          <Field label="新结束日期">
            {ch.newEndDate ? (
              <span className="font-mono tabular-nums">{fmtDate(ch.newEndDate)}</span>
            ) : (
              <span className="text-muted-foreground">未变</span>
            )}
          </Field>
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">变更详情</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {ch.details}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">审批历史</CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalHistory entityType="project_change" entityId={cid} />
        </CardContent>
      </Card>
    </div>
  );
}
