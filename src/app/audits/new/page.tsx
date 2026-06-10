'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Check,
  X,
  Users,
  Wallet,
  Clock,
  FlaskConical,
  Coins,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Checklist {
  period: string;
  newResearchers: number;
  activeProjects: number;
  lowWorkhourCount: number;
  sampleSoldCount: number;
  sampleSoldIncome: number;
  newCapitalizations: number;
  openExceptions: number;
}

type CheckKey =
  | 'project'
  | 'budget'
  | 'material'
  | 'outsource'
  | 'archive';

interface CheckDef {
  key: CheckKey;
  title: string;
  helper: string;
  Icon: typeof Users;
}

const CHECKS: CheckDef[] = [
  {
    key: 'project',
    title: '人员认定',
    helper: '研发人员清单 / 跨部门挂靠 / 资质材料',
    Icon: Users,
  },
  {
    key: 'budget',
    title: '投入归集',
    helper: '工时 / 物料 / 委外 各项目归集口径与凭证',
    Icon: Wallet,
  },
  {
    key: 'material',
    title: '工时记录',
    helper: '抽样工时, 检查真实性与与月报一致',
    Icon: Clock,
  },
  {
    key: 'outsource',
    title: '样品销售',
    helper: '样品 / 废料处置 监销留痕 + 收入入账',
    Icon: FlaskConical,
  },
  {
    key: 'archive',
    title: '资本化时点',
    helper: '5 条件证据齐全, 起算点准确, 与凭证对账',
    Icon: Coins,
  },
];

type Form = {
  year: number;
  quarter: number;
  checkProject: string;
  checkBudget: string;
  checkMaterial: string;
  checkOutsource: string;
  checkArchive: string;
  compliantProject: boolean;
  compliantBudget: boolean;
  compliantMaterial: boolean;
  compliantOutsource: boolean;
  compliantArchive: boolean;
  overallOpinion: string;
  rectifyRequired: string;
};

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function currentQuarter(): { year: number; quarter: number } {
  const d = new Date();
  return { year: d.getFullYear(), quarter: Math.floor(d.getMonth() / 3) + 1 };
}

export default function NewAuditPage() {
  const router = useRouter();
  const init = currentQuarter();
  const [form, setForm] = useState<Form>({
    year: init.year,
    quarter: init.quarter,
    checkProject: '',
    checkBudget: '',
    checkMaterial: '',
    checkOutsource: '',
    checkArchive: '',
    compliantProject: true,
    compliantBudget: true,
    compliantMaterial: true,
    compliantOutsource: true,
    compliantArchive: true,
    overallOpinion: '',
    rectifyRequired: '',
  });
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setChecklist(null);
    fetch(`/api/audits/checklist?year=${form.year}&quarter=${form.quarter}`)
      .then((r) => r.json())
      .then((j) => setChecklist(j.data ?? null));
  }, [form.year, form.quarter]);

  const compliantCount = useMemo(
    () =>
      Number(form.compliantProject) +
      Number(form.compliantBudget) +
      Number(form.compliantMaterial) +
      Number(form.compliantOutsource) +
      Number(form.compliantArchive),
    [form],
  );
  const anyNonCompliant = compliantCount < 5;
  const opinionOk = !!form.overallOpinion.trim();
  const rectifyOk = !anyNonCompliant || !!form.rectifyRequired.trim();
  const canSubmit = opinionOk && rectifyOk;

  async function submit() {
    if (!canSubmit) {
      toast.error('请填总体意见; 有不合规项时整改要求必填');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
        return;
      }
      toast.success(`${form.year} Q${form.quarter} 内审已保存`);
      router.push(`/audits/${j.data.id}`);
    } finally {
      setSaving(false);
    }
  }

  const years = [init.year - 1, init.year, init.year + 1];

  return (
    <div className="max-w-4xl mx-auto px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href="/audits"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              季度内审
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            新建季度内审
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            5 大重点, 每项填检查内容 + 合规结论; 任一不合规 → 整改要求必填
          </p>
        </div>
        <Button onClick={submit} disabled={!canSubmit || saving} className="shrink-0">
          <Save size={14} className="mr-1.5" />
          保存内审
        </Button>
      </div>

      {/* 期间 */}
      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>年度</Label>
              <Select
                value={String(form.year)}
                onValueChange={(v) => setForm({ ...form, year: Number(v) })}
              >
                <SelectTrigger>
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
            </div>
            <div className="space-y-1.5">
              <Label>季度</Label>
              <Select
                value={String(form.quarter)}
                onValueChange={(v) => setForm({ ...form, quarter: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((q) => (
                    <SelectItem key={q} value={String(q)}>
                      Q{q}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 参考数据 */}
      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-blue-600" />
            <div className="text-base font-semibold text-slate-900">
              参考数据
            </div>
            <span className="text-xs text-muted-foreground">
              · {form.year} Q{form.quarter}
            </span>
          </div>
          {checklist === null ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <div className="text-xs text-muted-foreground">本季新增研发员</div>
                <div className="text-xl font-bold tabular-nums text-slate-900 mt-0.5">
                  {checklist.newResearchers}
                </div>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <div className="text-xs text-muted-foreground">active 项目</div>
                <div className="text-xl font-bold tabular-nums text-slate-900 mt-0.5">
                  {checklist.activeProjects}
                </div>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <div className="text-xs text-muted-foreground">
                  工时 &lt;240h 人数
                </div>
                <div
                  className={
                    checklist.lowWorkhourCount > 0
                      ? 'text-xl font-bold tabular-nums text-rose-700 mt-0.5'
                      : 'text-xl font-bold tabular-nums text-slate-900 mt-0.5'
                  }
                >
                  {checklist.lowWorkhourCount}
                </div>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <div className="text-xs text-muted-foreground">样品销售单</div>
                <div className="text-xl font-bold tabular-nums text-slate-900 mt-0.5">
                  {checklist.sampleSoldCount}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums mt-0.5">
                  收入 {fmtMoney(checklist.sampleSoldIncome)} 元
                </div>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <div className="text-xs text-muted-foreground">新资本化</div>
                <div className="text-xl font-bold tabular-nums text-slate-900 mt-0.5">
                  {checklist.newCapitalizations}
                </div>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <div className="text-xs text-muted-foreground">异常单 open</div>
                <div
                  className={
                    checklist.openExceptions > 0
                      ? 'text-xl font-bold tabular-nums text-rose-700 mt-0.5'
                      : 'text-xl font-bold tabular-nums text-slate-900 mt-0.5'
                  }
                >
                  {checklist.openExceptions}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5 大重点 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">5 大重点检查</div>
          <div className="text-xs text-muted-foreground mt-1">
            每项独立判定合规性; 不合规建议在末尾整改要求中给出整改计划
          </div>
        </div>
        <span
          className={
            compliantCount === 5
              ? 'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-600 text-white tabular-nums'
              : 'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-600 text-white tabular-nums'
          }
        >
          {compliantCount}/5 合规
        </span>
      </div>

      {CHECKS.map((c) => {
        const checkKey = `check${c.key[0].toUpperCase() + c.key.slice(1)}` as
          | 'checkProject'
          | 'checkBudget'
          | 'checkMaterial'
          | 'checkOutsource'
          | 'checkArchive';
        const compKey = `compliant${c.key[0].toUpperCase() + c.key.slice(1)}` as
          | 'compliantProject'
          | 'compliantBudget'
          | 'compliantMaterial'
          | 'compliantOutsource'
          | 'compliantArchive';
        const isOk = form[compKey];
        return (
          <Card
            key={c.key}
            className={
              isOk
                ? 'border-emerald-300 shadow-md rounded-xl'
                : 'border-rose-300 shadow-md rounded-xl'
            }
          >
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-start gap-3">
                <c.Icon
                  size={18}
                  className={isOk ? 'text-emerald-600 shrink-0 mt-0.5' : 'text-rose-600 shrink-0 mt-0.5'}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900">{c.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {c.helper}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, [compKey]: true } as Form)}
                    className={
                      isOk
                        ? 'inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-emerald-600 text-white'
                        : 'inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-white text-slate-600 border border-slate-300 hover:border-emerald-400'
                    }
                  >
                    <Check size={12} />
                    合规
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, [compKey]: false } as Form)}
                    className={
                      !isOk
                        ? 'inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-rose-600 text-white'
                        : 'inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-white text-slate-600 border border-slate-300 hover:border-rose-400'
                    }
                  >
                    <X size={12} />
                    不合规
                  </button>
                </div>
              </div>
              <Textarea
                rows={3}
                value={form[checkKey] as string}
                onChange={(e) =>
                  setForm({ ...form, [checkKey]: e.target.value } as Form)
                }
                placeholder="检查方法 / 样本量 / 发现 / 结论"
              />
            </CardContent>
          </Card>
        );
      })}

      {/* 总体意见 + 整改 */}
      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="opinion">总体意见</Label>
            <Textarea
              id="opinion"
              rows={3}
              value={form.overallOpinion}
              onChange={(e) =>
                setForm({ ...form, overallOpinion: e.target.value })
              }
              placeholder="本季度研发内部审计结论"
            />
          </div>
          {anyNonCompliant && (
            <div className="space-y-1.5">
              <Label htmlFor="rectify" className="flex items-center gap-2">
                整改要求
                <span className="text-rose-700 text-xs">必填</span>
              </Label>
              <Textarea
                id="rectify"
                rows={3}
                value={form.rectifyRequired}
                onChange={(e) =>
                  setForm({ ...form, rectifyRequired: e.target.value })
                }
                placeholder="整改责任部门 / 期限 / 验收口径"
                className="border-rose-300 focus-visible:ring-rose-400"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {!canSubmit && (
        <div className="text-xs text-rose-700 px-2">
          {!opinionOk && '· 总体意见必填 '}
          {!rectifyOk && '· 整改要求必填 '}
        </div>
      )}
    </div>
  );
}
