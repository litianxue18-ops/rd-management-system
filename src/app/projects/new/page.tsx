'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save, Send } from 'lucide-react';
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

interface MemberRow {
  userId: number;
  role: string;
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
  members: MemberRow[];
}

const INITIAL: FormState = {
  name: '',
  projectTypeId: 0,
  departmentId: 0,
  leadUserId: 0,
  startDate: '',
  endDate: '',
  budget: '',
  background: '',
  goals: '',
  techPlan: '',
  schedule: '',
  budgetDetail: '',
  expectedOutput: '',
  attachmentsNote: '',
  members: [],
};

export default function NewProjectPage() {
  const router = useRouter();
  const [types, setTypes] = useState<ProjectType[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [tab, setTab] = useState('basic');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/project-types').then((r) => r.json()).then((j) => setTypes(j.data ?? []));
    fetch('/api/departments').then((r) => r.json()).then((j) => setDepts(j.data ?? []));
    fetch('/api/users').then((r) => r.json()).then((j) => setUsers(j.data ?? []));
  }, []);

  function validate(): string | null {
    if (!form.name.trim()) return '项目名称必填';
    if (!form.projectTypeId) return '项目类型必选';
    if (!form.departmentId) return '主导部门必选';
    if (!form.leadUserId) return '负责人必选';
    if (!form.startDate) return '起始日期必填';
    if (!form.endDate) return '结束日期必填';
    const b = Number(form.budget);
    if (!isFinite(b) || b <= 0) return '预算需为正数';
    if (!form.background.trim()) return '背景与必要性必填';
    if (!form.goals.trim()) return '研发目标必填';
    if (!form.techPlan.trim()) return '技术路线必填';
    if (!form.schedule.trim()) return '进度安排必填';
    if (!form.budgetDetail.trim()) return '经费明细必填';
    if (!form.expectedOutput.trim()) return '预期成果必填';
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
      const body = {
        ...form,
        projectTypeId: Number(form.projectTypeId),
        departmentId: Number(form.departmentId),
        leadUserId: Number(form.leadUserId),
        budget: Number(form.budget),
        attachmentsNote: form.attachmentsNote || undefined,
        members: form.members.filter((m) => m.userId && m.role).map((m) => ({
          userId: Number(m.userId),
          role: m.role,
        })),
      };
      const r = await fetch('/api/projects', {
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
    const id = await saveDraft();
    if (id) {
      toast.success('已保存草稿');
      router.push(`/projects/${id}`);
    }
  }

  async function onSubmit() {
    const id = await saveDraft();
    if (!id) return;
    const r = await fetch('/api/workflow/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workflowCode: 'project_approval_v1', entityId: id }),
    });
    const j = await r.json();
    if (j.error) {
      toast.error(`提交审批失败: ${j.error.message}`);
      router.push(`/projects/${id}`);
      return;
    }
    toast.success('已提交审批');
    router.push(`/projects/${id}`);
  }

  function setMember(i: number, patch: Partial<MemberRow>) {
    setForm({
      ...form,
      members: form.members.map((m, idx) => (idx === i ? { ...m, ...patch } : m)),
    });
  }
  function addMember() {
    setForm({ ...form, members: [...form.members, { userId: 0, role: '' }] });
  }
  function removeMember(i: number) {
    setForm({ ...form, members: form.members.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href="/projects" className="hover:text-slate-900 inline-flex items-center gap-1">
              <ArrowLeft size={12} />
              项目台账
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            立项申请
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
        <CardContent className="pt-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="basic">1/6 基本信息</TabsTrigger>
              <TabsTrigger value="background">2/6 背景与必要性</TabsTrigger>
              <TabsTrigger value="goals">3/6 研发目标</TabsTrigger>
              <TabsTrigger value="tech">4/6 技术路线 &amp; 进度</TabsTrigger>
              <TabsTrigger value="budget">5/6 经费与成果</TabsTrigger>
              <TabsTrigger value="members">6/6 成员 &amp; 附件</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="mt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="p-name">项目名称</Label>
                  <Input
                    id="p-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="如 新型钢化玻璃配方研发"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>项目类型</Label>
                  <Select
                    value={form.projectTypeId ? String(form.projectTypeId) : ''}
                    onValueChange={(v) => setForm({ ...form, projectTypeId: Number(v) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="请选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {types
                        .filter((t) => t.enabled)
                        .map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.name} ({t.code})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>主导部门</Label>
                  <Select
                    value={form.departmentId ? String(form.departmentId) : ''}
                    onValueChange={(v) => setForm({ ...form, departmentId: Number(v) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="请选择部门" />
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
                    value={form.leadUserId ? String(form.leadUserId) : ''}
                    onValueChange={(v) => setForm({ ...form, leadUserId: Number(v) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="请选择负责人" />
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
                  <Label htmlFor="p-start">起始日期</Label>
                  <Input
                    id="p-start"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-end">结束日期</Label>
                  <Input
                    id="p-end"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="p-budget">预算 (元)</Label>
                  <Input
                    id="p-budget"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    placeholder="如 100000"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="background" className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="p-bg">背景与必要性</Label>
                <Textarea
                  id="p-bg"
                  rows={10}
                  value={form.background}
                  onChange={(e) => setForm({ ...form, background: e.target.value })}
                  placeholder="说明立项背景、行业现状、本项目必要性 (建议 100 字以上)"
                />
                <div className="text-xs text-muted-foreground">
                  {form.background.length} 字
                </div>
              </div>
            </TabsContent>

            <TabsContent value="goals" className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="p-goals">研发目标</Label>
                <Textarea
                  id="p-goals"
                  rows={10}
                  value={form.goals}
                  onChange={(e) => setForm({ ...form, goals: e.target.value })}
                  placeholder="技术目标 / 产品目标 / 应用目标"
                />
              </div>
            </TabsContent>

            <TabsContent value="tech" className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="p-tech">技术路线</Label>
                <Textarea
                  id="p-tech"
                  rows={8}
                  value={form.techPlan}
                  onChange={(e) => setForm({ ...form, techPlan: e.target.value })}
                  placeholder="技术方案 / 创新点 / 关键技术"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-schedule">进度安排</Label>
                <Textarea
                  id="p-schedule"
                  rows={6}
                  value={form.schedule}
                  onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                  placeholder="分阶段里程碑 / 节点交付物"
                />
              </div>
            </TabsContent>

            <TabsContent value="budget" className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="p-bdetail">经费明细</Label>
                <Textarea
                  id="p-bdetail"
                  rows={8}
                  value={form.budgetDetail}
                  onChange={(e) => setForm({ ...form, budgetDetail: e.target.value })}
                  placeholder="人工 / 材料 / 设备 / 测试 / 其他 分项预算"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-output">预期成果</Label>
                <Textarea
                  id="p-output"
                  rows={6}
                  value={form.expectedOutput}
                  onChange={(e) => setForm({ ...form, expectedOutput: e.target.value })}
                  placeholder="专利 / 论文 / 工艺规程 / 样品 / 经济效益"
                />
              </div>
            </TabsContent>

            <TabsContent value="members" className="mt-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>项目成员</Label>
                  <Button variant="outline" size="sm" onClick={addMember}>
                    <Plus size={14} className="mr-1.5" />
                    新增成员
                  </Button>
                </div>
                {form.members.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-3 border border-dashed border-slate-200 rounded-md text-center">
                    尚未添加成员 (负责人会自动加入)
                  </div>
                ) : (
                  <div className="space-y-2">
                    {form.members.map((m, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Select
                          value={m.userId ? String(m.userId) : ''}
                          onValueChange={(v) => setMember(i, { userId: Number(v) })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="选择成员" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                {u.name} ({u.username})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          className="flex-1"
                          placeholder="角色 (如 主研 / 试验员)"
                          value={m.role}
                          onChange={(e) => setMember(i, { role: e.target.value })}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember(i)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-att">附件说明 (可选)</Label>
                <Textarea
                  id="p-att"
                  rows={4}
                  value={form.attachmentsNote}
                  onChange={(e) =>
                    setForm({ ...form, attachmentsNote: e.target.value })
                  }
                  placeholder="文字说明附件清单, M3+ 支持上传文件"
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
