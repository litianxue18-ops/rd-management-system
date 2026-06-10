'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit,
  Send,
  X,
  Check,
  FileEdit,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApprovalHistory } from '@/components/approval-history';
import { TestBadge } from '@/shared/components/test-badge';
import { toast } from 'sonner';

interface ProjectDetail {
  id: number;
  code: string;
  name: string;
  status: 'draft' | 'reviewing' | 'rejected' | 'active' | 'closed' | 'cancelled';
  projectType: { code: string; name: string };
  departmentId: number;
  leadUserId: number;
  startDate: string;
  endDate: string;
  budget: string;
  isTest?: boolean;
  background: string;
  goals: string;
  techPlan: string;
  schedule: string;
  budgetDetail: string;
  expectedOutput: string;
  attachmentsNote: string | null;
  createdById: number;
  createdAt: string;
  activatedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  members: { userId: number; role: string; isLead: boolean }[];
}

interface Dept {
  id: number;
  name: string;
}
interface User {
  id: number;
  name: string;
  username: string;
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

function statusBadge(s: ProjectDetail['status']) {
  if (s === 'active')
    return (
      <Badge variant="outline" className="text-white border-emerald-700 bg-emerald-600">进行中</Badge>
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
  if (s === 'closed') return <Badge variant="secondary">已结项</Badge>;
  return <Badge variant="secondary">已取消</Badge>;
}

function fmtDate(s: string) {
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtBudget(b: string) {
  const n = Number(b);
  if (!isFinite(n)) return b;
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm text-slate-900">{children}</div>
    </div>
  );
}

function LongText({ text }: { text: string }) {
  return (
    <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
      {text || <span className="text-muted-foreground">—</span>}
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const [proj, setProj] = useState<ProjectDetail | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    const [p, d, u, m, ins] = await Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch('/api/departments').then((r) => r.json()),
      fetch('/api/users').then((r) => r.json()),
      fetch('/api/auth/me').then((r) => r.json()),
      fetch(`/api/workflow/instances?entityType=project&entityId=${id}`).then((r) =>
        r.json(),
      ),
    ]);
    setProj(p.data ?? null);
    setDepts(d.data ?? []);
    setUsers(u.data ?? []);
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
        body: JSON.stringify({ workflowCode: 'project_approval_v1', entityId: id }),
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

  if (!proj) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const deptName = depts.find((d) => d.id === proj.departmentId)?.name;
  const leadName = users.find((u) => u.id === proj.leadUserId)?.name;
  const createdName = users.find((u) => u.id === proj.createdById)?.name;
  const isCreator = me?.id === proj.createdById;
  const isLead = me?.id === proj.leadUserId;
  const canEdit = proj.status === 'draft' && (isCreator || isLead);

  // 找出"运行中"实例 + 当前步
  const runningInst = instances.find((i) => i.status === 'running');
  const currentStep = runningInst?.steps.find((s) => s.id === runningInst.currentStepId);
  const canApprove =
    !!currentStep && currentStep.assignedUserId === me?.id && currentStep.status === 'pending';
  const canWithdraw =
    !!runningInst &&
    runningInst.submittedBy === me?.id &&
    runningInst.steps.find((s) => s.stepIndex === 1)?.status === 'pending';

  return (
    <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href="/projects" className="hover:text-slate-900 inline-flex items-center gap-1">
              <ArrowLeft size={12} />
              项目台账
            </Link>
            <ChevronRight size={12} />
            <span>项目详情</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
              {proj.name}
            </h1>
            <TestBadge show={proj.isTest} />
            {statusBadge(proj.status)}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {proj.code.startsWith('DRAFT-') ? (
              <span>编号待生成 (草稿)</span>
            ) : (
              <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">
                {proj.code}
              </code>
            )}
            <span>·</span>
            <span>创建于 {fmtDate(proj.createdAt)} by {createdName ?? `#${proj.createdById}`}</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {!proj.code.startsWith('DRAFT-') && (
            <Button variant="outline" asChild>
              <Link href={`/projects/${proj.id}/overview`}>
                <BookOpen size={14} className="mr-1.5" />
                执行档案
              </Link>
            </Button>
          )}
          {canEdit && (
            <>
              <Button variant="outline" asChild>
                <Link href={`/projects/${proj.id}/edit`}>
                  <Edit size={14} className="mr-1.5" />
                  编辑
                </Link>
              </Button>
              <Button onClick={submitForApproval} disabled={busy}>
                <Send size={14} className="mr-1.5" />
                提交审批
              </Button>
            </>
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
          {proj.status === 'active' && (
            <Button variant="outline" asChild>
              <Link href={`/projects/${proj.id}/changes`}>
                <FileEdit size={14} className="mr-1.5" />
                变更申请
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* 基本信息 */}
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="项目类型">
            <Badge variant="secondary" className="font-normal">
              {proj.projectType.name} ({proj.projectType.code})
            </Badge>
          </Field>
          <Field label="主导部门">{deptName ?? `#${proj.departmentId}`}</Field>
          <Field label="负责人">{leadName ?? `#${proj.leadUserId}`}</Field>
          <Field label="起止日期">
            <span className="font-mono tabular-nums text-xs">
              {fmtDate(proj.startDate)} — {fmtDate(proj.endDate)}
            </span>
          </Field>
          <Field label="预算 (元)">
            <span className="font-mono tabular-nums">{fmtBudget(proj.budget)}</span>
          </Field>
          <Field label="状态">{statusBadge(proj.status)}</Field>
        </CardContent>
      </Card>

      {/* 背景与目标 */}
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">背景与目标</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">背景与必要性</div>
            <LongText text={proj.background} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">研发目标</div>
            <LongText text={proj.goals} />
          </div>
        </CardContent>
      </Card>

      {/* 技术与进度 */}
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">技术与进度</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">技术路线</div>
            <LongText text={proj.techPlan} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">进度安排</div>
            <LongText text={proj.schedule} />
          </div>
        </CardContent>
      </Card>

      {/* 经费与成果 */}
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">经费与成果</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">经费明细</div>
            <LongText text={proj.budgetDetail} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">预期成果</div>
            <LongText text={proj.expectedOutput} />
          </div>
          {proj.attachmentsNote && (
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">附件说明</div>
              <LongText text={proj.attachmentsNote} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 成员 */}
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            项目成员
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              · {proj.members.length} 人
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {proj.members.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无成员</div>
          ) : (
            <ul className="space-y-2">
              {proj.members.map((m) => {
                const u = users.find((x) => x.id === m.userId);
                const name = u?.name ?? `#${m.userId}`;
                const initial = name.charAt(0);
                return (
                  <li key={m.userId} className="flex items-center gap-3 text-sm">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-medium shrink-0">
                      {initial}
                    </span>
                    <span className="font-medium">{name}</span>
                    <span className="text-muted-foreground">{m.role}</span>
                    {m.isLead && (
                      <Badge variant="outline" className="text-blue-800 border-blue-300 bg-blue-100 font-normal">
                        负责人
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 费用归集 */}
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center justify-between gap-2">
            <span>费用归集</span>
            <Link
              href={`/projects/${proj.id}/cost-summary`}
              className="text-xs font-normal text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
            >
              查看明细
              <ChevronRight size={12} />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            点击右上角"查看明细"查看人工费汇总与按人拆分 (直接投入 / 试制 / 委外
            M4+ 上线)
          </div>
        </CardContent>
      </Card>

      {/* 审批历史 */}
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">审批历史</CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalHistory entityType="project" entityId={id} />
        </CardContent>
      </Card>

      {proj.status === 'rejected' && proj.rejectedReason && (
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-rose-700">
              驳回原因
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LongText text={proj.rejectedReason} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
