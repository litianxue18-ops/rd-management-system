'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Send, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApprovalHistory } from '@/components/approval-history';
import { toast } from 'sonner';

interface ReportDetail {
  id: number;
  projectId: number;
  reportYear: number;
  reportMonth: number;
  status: 'draft' | 'reviewing' | 'approved' | 'rejected';
  monthPlan: string;
  actualCompletion: string;
  outputs: string;
  problems: string;
  resourceUsage: string;
  nextMonthPlan: string;
  createdById: number;
  createdAt: string;
  project: {
    id: number;
    code: string;
    name: string;
    projectType: { code: string; name: string };
  };
}

interface Me {
  id: number;
  roles: { code: string; isPrimary: boolean }[];
}

interface Step {
  id: number;
  stepIndex: number;
  stepName: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'transferred';
  assignedUserId: number | null;
}
interface Instance {
  id: number;
  status: 'draft' | 'running' | 'approved' | 'rejected' | 'cancelled';
  submittedBy: number;
  currentStepId: number | null;
  steps: Step[];
}

function statusBadge(s: ReportDetail['status']) {
  if (s === 'approved')
    return (
      <Badge variant="outline" className="text-white border-emerald-700 bg-emerald-600">已通过</Badge>
    );
  if (s === 'reviewing')
    return (
      <Badge variant="outline" className="text-white border-blue-700 bg-blue-600">审批中</Badge>
    );
  if (s === 'rejected')
    return (
      <Badge variant="outline" className="text-white border-rose-700 bg-rose-600">已驳回</Badge>
    );
  return <Badge variant="secondary">草稿</Badge>;
}

function fmtDate(s: string) {
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtMonth(y: number, m: number) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

function LongText({ text }: { text: string }) {
  return (
    <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
      {text || <span className="text-muted-foreground">—</span>}
    </div>
  );
}

export default function MonthlyReportDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    const [r, m, ins] = await Promise.all([
      fetch(`/api/monthly/${id}`).then((x) => x.json()),
      fetch('/api/auth/me').then((x) => x.json()),
      fetch(
        `/api/workflow/instances?entityType=monthly_report&entityId=${id}`,
      ).then((x) => x.json()),
    ]);
    setReport(r.data ?? null);
    setMe(m.data ?? null);
    setInstances(ins.data ?? []);
  }

  useEffect(() => {
    if (!isFinite(id)) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submitForApproval() {
    setBusy(true);
    try {
      const r = await fetch('/api/workflow/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workflowCode: 'monthly_report_v1', entityId: id }),
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

  if (!report) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isCreator = me?.id === report.createdById;
  const canEdit = report.status === 'draft' && isCreator;

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
              href="/monthly"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              月度进展报告
            </Link>
            <ChevronRight size={12} />
            <span>月报详情</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
              {report.project.name}
            </h1>
            <code className="font-mono text-sm tabular-nums text-slate-600">
              {fmtMonth(report.reportYear, report.reportMonth)}
            </code>
            {statusBadge(report.status)}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {report.project.code.startsWith('DRAFT-') ? (
              <span>项目草稿</span>
            ) : (
              <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">
                {report.project.code}
              </code>
            )}
            <span>·</span>
            <span>创建于 {fmtDate(report.createdAt)}</span>
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

      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">本月计划</CardTitle>
        </CardHeader>
        <CardContent>
          <LongText text={report.monthPlan} />
        </CardContent>
      </Card>
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">实际完成情况</CardTitle>
        </CardHeader>
        <CardContent>
          <LongText text={report.actualCompletion} />
        </CardContent>
      </Card>
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">产出物</CardTitle>
        </CardHeader>
        <CardContent>
          <LongText text={report.outputs} />
        </CardContent>
      </Card>
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">问题与风险</CardTitle>
        </CardHeader>
        <CardContent>
          <LongText text={report.problems} />
        </CardContent>
      </Card>
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">资源使用情况</CardTitle>
        </CardHeader>
        <CardContent>
          <LongText text={report.resourceUsage} />
        </CardContent>
      </Card>
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">下月计划</CardTitle>
        </CardHeader>
        <CardContent>
          <LongText text={report.nextMonthPlan} />
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">审批历史</CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalHistory entityType="monthly_report" entityId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
