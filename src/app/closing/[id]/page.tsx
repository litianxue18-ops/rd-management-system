'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Send, X, Check, Download } from 'lucide-react';
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
  basicSummary: string;
  goalReview: string;
  outputs: string;
  budgetReview: string;
  lessons: string;
  conversionPlan: string;
  status: Status;
  createdById: number;
  createdAt: string;
  approvedAt: string | null;
  archivedAt: string | null;
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

export default function ClosingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const closingId = Number(id);
  const [data, setData] = useState<Detail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    const [r, m, ins] = await Promise.all([
      fetch(`/api/closing/${closingId}`).then((x) => x.json()),
      fetch('/api/auth/me').then((x) => x.json()),
      fetch(
        `/api/workflow/instances?entityType=closing_report&entityId=${closingId}`,
      ).then((x) => x.json()),
    ]);
    setData(r.data ?? null);
    setMe(m.data ?? null);
    setInstances(ins.data ?? []);
  }

  useEffect(() => {
    if (!Number.isFinite(closingId)) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closingId]);

  async function submitForApproval() {
    setBusy(true);
    try {
      const r = await fetch('/api/workflow/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workflowCode: 'closing_report_v1',
          entityId: closingId,
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

  async function downloadArchive() {
    if (!data) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/closing/${closingId}/archive`);
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error?.message ?? '下载失败');
      }
      const blob = await res.blob();
      // 优先从 Content-Disposition 拿文件名
      const cd = res.headers.get('Content-Disposition') || '';
      let filename = `${data.project.code}-档案-${new Date().toISOString().slice(0, 10)}.json`;
      const m = cd.match(/filename\*=UTF-8''([^;]+)/) || cd.match(/filename="([^"]+)"/);
      if (m) {
        try {
          filename = decodeURIComponent(m[1]);
        } catch {
          // keep default
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('档案已下载');
      loadAll();
    } catch (e: any) {
      toast.error(e?.message ?? '下载失败');
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto px-8 py-6 space-y-6">
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
  const canDownloadArchive = data.status === 'approved';

  return (
    <div className="max-w-5xl mx-auto px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href="/closing"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              结项报告
            </Link>
            <ChevronRight size={12} />
            <span>报告详情</span>
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
            {data.archivedAt && (
              <>
                <span>·</span>
                <span>归档于 {fmtDateTime(data.archivedAt)}</span>
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
          {canDownloadArchive && (
            <Button variant="outline" onClick={downloadArchive} disabled={busy}>
              <Download size={14} className="mr-1.5" />
              下载档案
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
          <CardTitle className="text-base font-semibold">报告内容</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground mb-1">基本情况</dt>
              <dd className="text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded-md">
                {data.basicSummary}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-1">目标完成情况</dt>
              <dd className="text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded-md">
                {data.goalReview}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-1">主要成果</dt>
              <dd className="text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded-md">
                {data.outputs}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-1">经费使用情况</dt>
              <dd className="text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded-md">
                {data.budgetReview}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-1">经验总结</dt>
              <dd className="text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded-md">
                {data.lessons}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-1">成果转化建议</dt>
              <dd className="text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded-md">
                {data.conversionPlan}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            审批历史 (3 步: 项目负责人 → 研发中心 → 技委会)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalHistory entityType="closing_report" entityId={closingId} />
        </CardContent>
      </Card>
    </div>
  );
}
