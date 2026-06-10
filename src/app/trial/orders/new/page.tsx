'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
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
}

export default function NewTrialOrderPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState({
    projectId: 0,
    title: '',
    description: '',
    plannedQty: '' as string,
    plannedUnit: '',
    scheduledStart: '',
    scheduledEnd: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/projects?status=active')
      .then((r) => r.json())
      .then((j) => setProjects(j.data ?? []));
  }, []);

  function validate(): string | null {
    if (!form.projectId) return '项目必选';
    if (!form.title.trim()) return '标题必填';
    if (!form.description.trim()) return '工艺要求必填';
    const q = Number(form.plannedQty);
    if (!(q > 0)) return '计划数量必须 > 0';
    if (!form.plannedUnit.trim()) return '计划单位必填';
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
      const body: Record<string, unknown> = {
        projectId: form.projectId,
        title: form.title,
        description: form.description,
        plannedQty: Number(form.plannedQty),
        plannedUnit: form.plannedUnit,
      };
      if (form.scheduledStart) body.scheduledStart = form.scheduledStart;
      if (form.scheduledEnd) body.scheduledEnd = form.scheduledEnd;
      const r = await fetch('/api/trial/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
        return;
      }
      toast.success(`已保存草稿 ${j.data.docNo}`);
      router.push(`/trial/orders/${j.data.id}`);
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
              href="/trial/orders"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              试制任务台账
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            新建试制生产任务
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            保存草稿后, 在详情页点击 &quot;提交审批&quot; 进入 2 步审批
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
                <SelectValue placeholder="请选择 active 项目" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="例: 试制 A 样 (第一批)"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">工艺要求</Label>
            <Textarea
              id="desc"
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="工艺路线 / 关键参数 / 设备要求 等"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="qty">计划数量</Label>
              <Input
                id="qty"
                type="number"
                step="0.01"
                min="0"
                value={form.plannedQty}
                onChange={(e) => setForm({ ...form, plannedQty: e.target.value })}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">单位</Label>
              <Input
                id="unit"
                value={form.plannedUnit}
                onChange={(e) =>
                  setForm({ ...form, plannedUnit: e.target.value })
                }
                placeholder="件 / kg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ss">计划开始</Label>
              <Input
                id="ss"
                type="date"
                value={form.scheduledStart}
                onChange={(e) =>
                  setForm({ ...form, scheduledStart: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="se">计划结束</Label>
              <Input
                id="se"
                type="date"
                value={form.scheduledEnd}
                onChange={(e) =>
                  setForm({ ...form, scheduledEnd: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
