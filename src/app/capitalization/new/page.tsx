'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Project {
  id: number;
  code: string;
  name: string;
}

interface CondDef {
  key:
    | 'condTechnical'
    | 'condIntent'
    | 'condUsability'
    | 'condMarket'
    | 'condResource';
  title: string;
  helper: string;
}

const CONDS: CondDef[] = [
  {
    key: 'condTechnical',
    title: '技术可行',
    helper: '已通过技术评审, 关键工艺/算法/原型验证通过',
  },
  {
    key: 'condIntent',
    title: '完成意图明确',
    helper: '有书面立项决议, 明确完成后将自用或出售',
  },
  {
    key: 'condUsability',
    title: '可用性 / 经济利益',
    helper: '完成后能可靠为企业产生未来现金流, 例如产品化路径已锁定',
  },
  {
    key: 'condMarket',
    title: '市场价值',
    helper: '存在客户意向 / 市场调研 / 同类产品对标证据',
  },
  {
    key: 'condResource',
    title: '资源保障充分',
    helper: '预算批复, 人员配置, 设备到位, 能完成开发',
  },
];

interface EvidenceDef {
  key:
    | 'evidenceTechnical'
    | 'evidenceMarket'
    | 'evidenceResource'
    | 'evidenceCost';
  title: string;
  placeholder: string;
}

const EVIDENCES: EvidenceDef[] = [
  {
    key: 'evidenceTechnical',
    title: '技术可行性证明',
    placeholder: '技术评审纪要 / 试制结果 / 第三方测试报告 (附件请上传 OA 后填编号)',
  },
  {
    key: 'evidenceMarket',
    title: '市场价值证明',
    placeholder: '市场调研报告 / 客户意向函 / 行业对标分析',
  },
  {
    key: 'evidenceResource',
    title: '资源保障证明',
    placeholder: '预算批复文号 / 团队配置表 / 关键设备清单',
  },
  {
    key: 'evidenceCost',
    title: '成本可计量证明',
    placeholder: '工时台账归集口径 / 物料领用归集口径 / 委外费用归集口径',
  },
];

type Form = {
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
};

export default function NewCapitalizationPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<Form>({
    projectId: 0,
    condTechnical: false,
    condIntent: false,
    condUsability: false,
    condMarket: false,
    condResource: false,
    evidenceTechnical: '',
    evidenceMarket: '',
    evidenceResource: '',
    evidenceCost: '',
    capitalizationAmount: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/projects?status=active')
      .then((r) => r.json())
      .then((j) => setProjects(j.data ?? []));
  }, []);

  const condSatisfied = CONDS.filter((c) => form[c.key]).length;
  const allCondOk = condSatisfied === 5;
  const evidenceFilled = EVIDENCES.filter(
    (e) => (form[e.key] || '').trim().length > 0,
  ).length;
  const evidenceOk = evidenceFilled >= 3;
  const amountNum = Number(form.capitalizationAmount);
  const amountOk = !!form.capitalizationAmount && amountNum > 0;
  const canSubmit = !!form.projectId && allCondOk && evidenceOk && amountOk;

  async function submit() {
    if (!canSubmit) {
      toast.error('请检查 5 条件 / 必备材料 / 金额');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/capitalization', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: form.projectId,
          condTechnical: form.condTechnical,
          condIntent: form.condIntent,
          condUsability: form.condUsability,
          condMarket: form.condMarket,
          condResource: form.condResource,
          evidenceTechnical: form.evidenceTechnical,
          evidenceMarket: form.evidenceMarket,
          evidenceResource: form.evidenceResource,
          evidenceCost: form.evidenceCost,
          capitalizationAmount: amountNum,
        }),
      });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
        return;
      }
      toast.success(`已保存草稿 ${j.data.docNo}`);
      router.push(`/capitalization/${j.data.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href="/capitalization"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              资本化评估
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            新建资本化评估
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            5 条件全部满足 + 4 项材料至少 3 项, 方可提交; 提交后走 4 步审批
          </p>
        </div>
        <Button onClick={submit} disabled={!canSubmit || saving} className="shrink-0">
          <Save size={14} className="mr-1.5" />
          保存草稿
        </Button>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-1.5">
            <Label>项目</Label>
            <Select
              value={form.projectId ? String(form.projectId) : ''}
              onValueChange={(v) => setForm({ ...form, projectId: Number(v) })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择需评估的 active 项目" />
              </SelectTrigger>
              <SelectContent>
                {projects.length === 0 && (
                  <div className="text-xs text-muted-foreground px-3 py-2">
                    暂无 active 项目
                  </div>
                )}
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amt">拟资本化金额 (元)</Label>
            <Input
              id="amt"
              type="number"
              min="0"
              step="0.01"
              value={form.capitalizationAmount}
              onChange={(e) =>
                setForm({ ...form, capitalizationAmount: e.target.value })
              }
              placeholder="例如 150000"
              className="tabular-nums"
            />
          </div>
        </CardContent>
      </Card>

      {/* 5 条件门控 */}
      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-base font-semibold text-slate-900">
                资本化 5 项条件
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                IAS 38 / 企业会计准则第 6 号 - 无形资产, 5 项需同时满足
              </div>
            </div>
            <span
              className={
                allCondOk
                  ? 'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-600 text-white tabular-nums'
                  : 'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-rose-600 text-white tabular-nums'
              }
            >
              {condSatisfied}/5 已满足
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CONDS.map((c) => {
              const v = form[c.key];
              return (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => setForm({ ...form, [c.key]: !v } as Form)}
                  className={
                    v
                      ? 'text-left rounded-lg border-2 border-emerald-500 bg-emerald-50 p-3 transition'
                      : 'text-left rounded-lg border-2 border-slate-200 bg-white p-3 hover:border-blue-400 transition'
                  }
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={
                        v
                          ? 'shrink-0 size-5 rounded bg-emerald-600 text-white flex items-center justify-center mt-0.5'
                          : 'shrink-0 size-5 rounded border-2 border-slate-300 mt-0.5'
                      }
                    >
                      {v && <Check size={12} />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 text-sm">
                        {c.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {c.helper}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 4 项必备材料 */}
      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-base font-semibold text-slate-900">
                必备支撑材料 (至少 3/4 项)
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                只填关键证明; 详细附件可上传 OA, 此处写编号或要点
              </div>
            </div>
            <span
              className={
                evidenceOk
                  ? 'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-600 text-white tabular-nums'
                  : 'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-rose-600 text-white tabular-nums'
              }
            >
              已填 {evidenceFilled}/4
            </span>
          </div>
          {EVIDENCES.map((e) => (
            <div key={e.key} className="space-y-1.5">
              <Label htmlFor={e.key}>{e.title}</Label>
              <Textarea
                id={e.key}
                rows={3}
                value={form[e.key]}
                onChange={(ev) =>
                  setForm({ ...form, [e.key]: ev.target.value } as Form)
                }
                placeholder={e.placeholder}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {!canSubmit && (
        <div className="text-xs text-rose-700 px-2">
          {!form.projectId && '· 项目必选 '}
          {!allCondOk && '· 5 条件未全部满足 '}
          {!evidenceOk && '· 材料 < 3 项 '}
          {!amountOk && '· 金额必填且 > 0 '}
        </div>
      )}
    </div>
  );
}
