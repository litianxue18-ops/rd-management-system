'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface FormState {
  reason: string;
  scope: string;
  details: string;
  newBudget: string;
  newEndDate: string;
}

export default function NewChangePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = Number(params.id);
  const [form, setForm] = useState<FormState>({
    reason: '',
    scope: '',
    details: '',
    newBudget: '',
    newEndDate: '',
  });
  const [saving, setSaving] = useState(false);

  function validate(): string | null {
    if (!form.reason.trim()) return '变更事由必填';
    if (!form.scope.trim()) return '变更范围必填';
    if (!form.details.trim()) return '变更详情必填';
    if (form.newBudget && !isFinite(Number(form.newBudget))) return '新预算需为数字';
    if (form.newBudget && Number(form.newBudget) <= 0) return '新预算需为正数';
    return null;
  }

  async function createDraft(): Promise<number | null> {
    const err = validate();
    if (err) {
      toast.error(err);
      return null;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        reason: form.reason,
        scope: form.scope,
        details: form.details,
      };
      if (form.newBudget) body.newBudget = Number(form.newBudget);
      if (form.newEndDate) body.newEndDate = form.newEndDate;
      const r = await fetch(`/api/projects/${projectId}/changes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
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
    const cid = await createDraft();
    if (cid) {
      toast.success('已保存草稿');
      router.push(`/projects/${projectId}/changes/${cid}`);
    }
  }

  async function onSubmit() {
    const cid = await createDraft();
    if (!cid) return;
    const r = await fetch('/api/workflow/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workflowCode: 'project_change_v1', entityId: cid }),
    });
    const j = await r.json();
    if (j.error) {
      toast.error(`提交审批失败: ${j.error.message}`);
      router.push(`/projects/${projectId}/changes/${cid}`);
      return;
    }
    toast.success('已提交审批');
    router.push(`/projects/${projectId}/changes/${cid}`);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href={`/projects/${projectId}/changes`}
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              变更申请列表
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            发起重大变更
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            预算 / 工期 / 范围调整,审批通过后自动套用到主项目
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
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-reason">变更事由</Label>
            <Input
              id="c-reason"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="如 原材料价格大幅波动"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-scope">变更范围</Label>
            <Input
              id="c-scope"
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              placeholder="如 预算 + 工期"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-budget">新预算 (元, 可选)</Label>
              <Input
                id="c-budget"
                type="number"
                min="0"
                step="0.01"
                value={form.newBudget}
                onChange={(e) => setForm({ ...form, newBudget: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-enddate">新结束日期 (可选)</Label>
              <Input
                id="c-enddate"
                type="date"
                value={form.newEndDate}
                onChange={(e) => setForm({ ...form, newEndDate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-details">变更详情</Label>
            <Textarea
              id="c-details"
              rows={10}
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              placeholder="详细说明变更内容、影响、应对措施"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
