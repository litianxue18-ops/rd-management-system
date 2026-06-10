'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { toast } from 'sonner';

interface Project {
  id: number;
  code: string;
  name: string;
  status: string;
  leadUserId: number;
  members?: { userId: number }[];
}

interface Me {
  id: number;
  name: string;
}

interface FormState {
  projectId: number;
  reportYear: number;
  reportMonth: number;
  monthPlan: string;
  actualCompletion: string;
  outputs: string;
  problems: string;
  resourceUsage: string;
  nextMonthPlan: string;
}

function defaultYearMonth(): { y: number; m: number } {
  // 默认上个月
  const now = new Date();
  const m = now.getMonth(); // 0-11; 上个月 = m
  if (m === 0) return { y: now.getFullYear() - 1, m: 12 };
  return { y: now.getFullYear(), m };
}

export default function NewMonthlyReportPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const init = defaultYearMonth();
  const [form, setForm] = useState<FormState>({
    projectId: 0,
    reportYear: init.y,
    reportMonth: init.m,
    monthPlan: '',
    actualCompletion: '',
    outputs: '',
    problems: '',
    resourceUsage: '',
    nextMonthPlan: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((j) => setMe(j.data));
    fetch('/api/projects?status=active')
      .then((r) => r.json())
      .then((j) => setProjects(j.data ?? []));
  }, []);

  // 仅当前用户参与/lead 的 active 项目
  const myProjects = useMemo(() => {
    if (!me) return [];
    return projects.filter(
      (p) =>
        p.status === 'active' &&
        (p.leadUserId === me.id || p.members?.some((m) => m.userId === me.id)),
    );
  }, [projects, me]);

  function validate(): string | null {
    if (!form.projectId) return '项目必选';
    if (!form.reportYear || !form.reportMonth) return '年月必填';
    if (!form.monthPlan.trim()) return '月度计划必填';
    if (!form.actualCompletion.trim()) return '实际完成情况必填';
    if (!form.outputs.trim()) return '产出物必填';
    if (!form.problems.trim()) return '问题与风险必填';
    if (!form.resourceUsage.trim()) return '资源使用情况必填';
    if (!form.nextMonthPlan.trim()) return '下月计划必填';
    return null;
  }

  async function saveDraft(): Promise<number | null> {
    const err = validate();
    if (err) {
      toast.error(err);
      return null;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/monthly', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
        return null;
      }
      return j.data.id as number;
    } finally {
      setSaving(false);
    }
  }

  async function onSaveDraft() {
    const id = await saveDraft();
    if (id) {
      toast.success('已保存草稿');
      router.push(`/monthly/${id}`);
    }
  }

  async function onSubmit() {
    const id = await saveDraft();
    if (!id) return;
    const r = await fetch('/api/workflow/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workflowCode: 'monthly_report_v1', entityId: id }),
    });
    const j = await r.json();
    if (j.error) {
      toast.error(`提交审批失败: ${j.error.message}`);
      router.push(`/monthly/${id}`);
      return;
    }
    toast.success('已提交审批');
    router.push(`/monthly/${id}`);
  }

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
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            新建月报
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            填写 6 项内容后保存草稿或直接提交审批
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={onSaveDraft} disabled={saving}>
            <Save size={14} className="mr-1.5" />
            保存草稿
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            <Send size={14} className="mr-1.5" />
            提交审批
          </Button>
        </div>
      </div>

      <Card className="border-slate-300 shadow-md">
        <CardContent className="pt-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5 md:col-span-1">
              <Label>项目</Label>
              <Select
                value={form.projectId ? String(form.projectId) : ''}
                onValueChange={(v) => setForm({ ...form, projectId: Number(v) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {myProjects.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      暂无可选项目 (需 active + 你是负责人或成员)
                    </div>
                  ) : (
                    myProjects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mr-year">年</Label>
              <Input
                id="mr-year"
                type="number"
                value={form.reportYear}
                onChange={(e) =>
                  setForm({ ...form, reportYear: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mr-month">月 (1-12)</Label>
              <Input
                id="mr-month"
                type="number"
                min="1"
                max="12"
                value={form.reportMonth}
                onChange={(e) =>
                  setForm({ ...form, reportMonth: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mr-plan">本月计划</Label>
            <Textarea
              id="mr-plan"
              rows={4}
              value={form.monthPlan}
              onChange={(e) => setForm({ ...form, monthPlan: e.target.value })}
              placeholder="列出本月主要工作计划与目标"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mr-actual">实际完成情况</Label>
            <Textarea
              id="mr-actual"
              rows={4}
              value={form.actualCompletion}
              onChange={(e) =>
                setForm({ ...form, actualCompletion: e.target.value })
              }
              placeholder="对照计划, 描述实际进度"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mr-outputs">产出物</Label>
            <Textarea
              id="mr-outputs"
              rows={4}
              value={form.outputs}
              onChange={(e) => setForm({ ...form, outputs: e.target.value })}
              placeholder="样品 / 配方 / 测试数据 / 文档"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mr-problems">问题与风险</Label>
            <Textarea
              id="mr-problems"
              rows={4}
              value={form.problems}
              onChange={(e) => setForm({ ...form, problems: e.target.value })}
              placeholder="遇到的关键问题, 阻塞项, 风险点"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mr-resource">资源使用情况</Label>
            <Textarea
              id="mr-resource"
              rows={4}
              value={form.resourceUsage}
              onChange={(e) =>
                setForm({ ...form, resourceUsage: e.target.value })
              }
              placeholder="人力工时 / 材料 / 设备 / 经费占用情况"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mr-next">下月计划</Label>
            <Textarea
              id="mr-next"
              rows={4}
              value={form.nextMonthPlan}
              onChange={(e) =>
                setForm({ ...form, nextMonthPlan: e.target.value })
              }
              placeholder="下个月的工作安排"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
