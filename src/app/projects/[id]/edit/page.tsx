'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface ProjectType {
  id: number;
  code: string;
  name: string;
  enabled: boolean;
}
interface Dept {
  id: number;
  name: string;
  enabled: boolean;
}
interface User {
  id: number;
  name: string;
  username: string;
}

interface FormState {
  name: string;
  projectTypeId: number;
  departmentId: number;
  leadUserId: number;
  startDate: string;
  endDate: string;
  budget: string;
  background: string;
  goals: string;
  techPlan: string;
  schedule: string;
  budgetDetail: string;
  expectedOutput: string;
  attachmentsNote: string;
}

function toDateInput(s: string) {
  // ISO → YYYY-MM-DD
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function EditProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const [form, setForm] = useState<FormState | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [types, setTypes] = useState<ProjectType[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tab, setTab] = useState('basic');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isFinite(id)) return;
    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch('/api/project-types').then((r) => r.json()),
      fetch('/api/departments').then((r) => r.json()),
      fetch('/api/users').then((r) => r.json()),
    ]).then(([p, t, d, u]) => {
      if (p.data) {
        setStatus(p.data.status);
        setForm({
          name: p.data.name,
          projectTypeId: p.data.projectTypeId,
          departmentId: p.data.departmentId,
          leadUserId: p.data.leadUserId,
          startDate: toDateInput(p.data.startDate),
          endDate: toDateInput(p.data.endDate),
          budget: String(p.data.budget),
          background: p.data.background,
          goals: p.data.goals,
          techPlan: p.data.techPlan,
          schedule: p.data.schedule,
          budgetDetail: p.data.budgetDetail,
          expectedOutput: p.data.expectedOutput,
          attachmentsNote: p.data.attachmentsNote ?? '',
        });
      }
      setTypes(t.data ?? []);
      setDepts(d.data ?? []);
      setUsers(u.data ?? []);
    });
  }, [id]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const body = {
        name: form.name,
        projectTypeId: Number(form.projectTypeId),
        departmentId: Number(form.departmentId),
        leadUserId: Number(form.leadUserId),
        startDate: form.startDate,
        endDate: form.endDate,
        budget: Number(form.budget),
        background: form.background,
        goals: form.goals,
        techPlan: form.techPlan,
        schedule: form.schedule,
        budgetDetail: form.budgetDetail,
        expectedOutput: form.expectedOutput,
        attachmentsNote: form.attachmentsNote || undefined,
      };
      const r = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.error) toast.error(j.error.message);
      else {
        toast.success('已保存');
        router.push(`/projects/${id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (status && status !== 'draft') {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <div className="text-sm text-rose-700">仅草稿状态可编辑,当前状态: {status}</div>
        <Button variant="outline" asChild>
          <Link href={`/projects/${id}`}>
            <ArrowLeft size={14} className="mr-1.5" />
            返回详情
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href={`/projects/${id}`} className="hover:text-slate-900 inline-flex items-center gap-1">
              <ArrowLeft size={12} />
              项目详情
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            编辑立项 (草稿)
          </h1>
        </div>
        <Button onClick={save} disabled={saving} className="shrink-0">
          <Save size={14} className="mr-1.5" />
          保存
        </Button>
      </div>

      <Card className="border-slate-300 shadow-md">
        <CardContent className="pt-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="basic">1/6 基本信息</TabsTrigger>
              <TabsTrigger value="background">2/6 背景与必要性</TabsTrigger>
              <TabsTrigger value="goals">3/6 研发目标</TabsTrigger>
              <TabsTrigger value="tech">4/6 技术路线 &amp; 进度</TabsTrigger>
              <TabsTrigger value="budget">5/6 经费与成果</TabsTrigger>
              <TabsTrigger value="att">6/6 附件</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="mt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>项目名称</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>项目类型</Label>
                  <Select
                    value={String(form.projectTypeId)}
                    onValueChange={(v) => setForm({ ...form, projectTypeId: Number(v) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {types
                        .filter((t) => t.enabled)
                        .map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>主导部门</Label>
                  <Select
                    value={String(form.departmentId)}
                    onValueChange={(v) => setForm({ ...form, departmentId: Number(v) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {depts
                        .filter((d) => d.enabled)
                        .map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>负责人</Label>
                  <Select
                    value={String(form.leadUserId)}
                    onValueChange={(v) => setForm({ ...form, leadUserId: Number(v) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name} ({u.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>起始日期</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>结束日期</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>预算 (元)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="background" className="mt-6">
              <div className="space-y-1.5">
                <Label>背景与必要性</Label>
                <Textarea
                  rows={10}
                  value={form.background}
                  onChange={(e) => setForm({ ...form, background: e.target.value })}
                />
              </div>
            </TabsContent>

            <TabsContent value="goals" className="mt-6">
              <div className="space-y-1.5">
                <Label>研发目标</Label>
                <Textarea
                  rows={10}
                  value={form.goals}
                  onChange={(e) => setForm({ ...form, goals: e.target.value })}
                />
              </div>
            </TabsContent>

            <TabsContent value="tech" className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label>技术路线</Label>
                <Textarea
                  rows={8}
                  value={form.techPlan}
                  onChange={(e) => setForm({ ...form, techPlan: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>进度安排</Label>
                <Textarea
                  rows={6}
                  value={form.schedule}
                  onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                />
              </div>
            </TabsContent>

            <TabsContent value="budget" className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label>经费明细</Label>
                <Textarea
                  rows={8}
                  value={form.budgetDetail}
                  onChange={(e) => setForm({ ...form, budgetDetail: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>预期成果</Label>
                <Textarea
                  rows={6}
                  value={form.expectedOutput}
                  onChange={(e) => setForm({ ...form, expectedOutput: e.target.value })}
                />
              </div>
            </TabsContent>

            <TabsContent value="att" className="mt-6">
              <div className="space-y-1.5">
                <Label>附件说明</Label>
                <Textarea
                  rows={6}
                  value={form.attachmentsNote}
                  onChange={(e) =>
                    setForm({ ...form, attachmentsNote: e.target.value })
                  }
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
