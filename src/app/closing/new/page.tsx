'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
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
import { toast } from 'sonner';

interface Project {
  id: number;
  code: string;
  name: string;
  leadUserId: number;
}

interface Me {
  id: number;
}

export default function NewClosingPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  const [form, setForm] = useState({
    projectId: 0,
    basicSummary: '',
    goalReview: '',
    outputs: '',
    budgetReview: '',
    lessons: '',
    conversionPlan: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((j) => setMe(j.data ?? null));
    fetch('/api/projects?status=active')
      .then((r) => r.json())
      .then((j) => setProjects(j.data ?? []));
  }, []);

  // 仅本人是 leadUser 的 active 项目可发起结项
  const myProjects = me ? projects.filter((p) => p.leadUserId === me.id) : [];

  function validate(): string | null {
    if (!form.projectId) return '项目必选';
    if (!form.basicSummary.trim()) return '基本情况必填';
    if (!form.goalReview.trim()) return '目标完成情况必填';
    if (!form.outputs.trim()) return '主要成果必填';
    if (!form.budgetReview.trim()) return '经费使用情况必填';
    if (!form.lessons.trim()) return '经验总结必填';
    if (!form.conversionPlan.trim()) return '成果转化建议必填';
    return null;
  }

  async function submit() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/closing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
        return;
      }
      toast.success(`已保存草稿 ${j.data.docNo}`);
      router.push(`/closing/${j.data.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-6 space-y-6">
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
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            新建结项报告
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            保存草稿后, 在详情页提交 3 步审批 (项目负责人 → 研发中心 → 技委会)
          </p>
        </div>
        <Button onClick={submit} disabled={saving} className="shrink-0">
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
                <SelectValue placeholder="选择我负责的 active 项目" />
              </SelectTrigger>
              <SelectContent>
                {myProjects.length === 0 && (
                  <div className="text-xs text-muted-foreground px-3 py-2">
                    您当前没有可发起结项的 active 项目
                  </div>
                )}
                {myProjects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="basic">基本情况</Label>
            <Textarea
              id="basic"
              rows={3}
              value={form.basicSummary}
              onChange={(e) =>
                setForm({ ...form, basicSummary: e.target.value })
              }
              placeholder="项目立项背景、执行周期、参与团队等"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal">目标完成情况</Label>
            <Textarea
              id="goal"
              rows={3}
              value={form.goalReview}
              onChange={(e) => setForm({ ...form, goalReview: e.target.value })}
              placeholder="对照立项目标, 逐项说明完成情况, 含未完成项原因"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="out">主要成果</Label>
            <Textarea
              id="out"
              rows={3}
              value={form.outputs}
              onChange={(e) => setForm({ ...form, outputs: e.target.value })}
              placeholder="技术成果 / 专利 / 论文 / 样品 / 工艺等"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="budget">经费使用情况</Label>
            <Textarea
              id="budget"
              rows={3}
              value={form.budgetReview}
              onChange={(e) =>
                setForm({ ...form, budgetReview: e.target.value })
              }
              placeholder="预算执行情况 / 主要支出明细 / 节余说明"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lessons">经验总结</Label>
            <Textarea
              id="lessons"
              rows={3}
              value={form.lessons}
              onChange={(e) => setForm({ ...form, lessons: e.target.value })}
              placeholder="项目执行中的经验、教训、改进建议"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="conv">成果转化建议</Label>
            <Textarea
              id="conv"
              rows={3}
              value={form.conversionPlan}
              onChange={(e) =>
                setForm({ ...form, conversionPlan: e.target.value })
              }
              placeholder="后续产业化路径 / 知识产权处置 / 市场推广建议"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
