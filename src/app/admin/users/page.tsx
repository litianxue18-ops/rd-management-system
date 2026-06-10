'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Upload, Users as UsersIcon, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface User { id: number; username: string; employeeId: string; name: string; isActive: boolean; department?: { name: string }; roles: { code: string; name: string; isPrimary: boolean }[]; }
interface Dept { id: number; name: string; }
interface Role { id: number; code: string; name: string; }

export default function UsersPage() {
  const [list, setList] = useState<User[] | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: '', employeeId: '', name: '', password: '', departmentId: 0, roleIds: [] as number[], primaryRoleId: 0 });

  async function load() {
    const [u, d, r] = await Promise.all([
      fetch('/api/users').then((x) => x.json()),
      fetch('/api/departments').then((x) => x.json()),
      fetch('/api/roles').then((x) => x.json()),
    ]);
    setList(u.data ?? []); setDepts(d.data ?? []); setRoles(r.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    const r = await fetch('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, primaryRoleId: form.primaryRoleId || form.roleIds[0] }),
    });
    const j = await r.json();
    if (j.error) toast.error(j.error.message);
    else { toast.success('已创建'); setOpen(false); setForm({ username: '', employeeId: '', name: '', password: '', departmentId: 0, roleIds: [], primaryRoleId: 0 }); load(); }
  }

  const count = list?.length ?? 0;
  const activeCount = list?.filter((u) => u.isActive).length ?? 0;
  const disabledCount = count - activeCount;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            用户管理
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            查看与管理全公司账号,可分配角色与部门
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" asChild>
            <Link href="/admin/users/import">
              <Upload size={16} className="mr-2" />
              花名册导入
            </Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus size={16} className="mr-2" />
                新建用户
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>新建用户</DialogTitle>
                <DialogDescription>建账号后会向其分配角色,可多选</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="user-username">用户名</Label>
                  <Input
                    id="user-username"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="user-employee">工号</Label>
                  <Input
                    id="user-employee"
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="user-name">姓名</Label>
                  <Input
                    id="user-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="user-password">初始密码</Label>
                  <Input
                    id="user-password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>部门</Label>
                  <Select
                    value={form.departmentId ? String(form.departmentId) : ''}
                    onValueChange={(v) => setForm({ ...form, departmentId: Number(v) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="请选择部门" />
                    </SelectTrigger>
                    <SelectContent>
                      {depts.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>角色 (多选)</Label>
                  <div className="rounded-md border border-input divide-y divide-slate-100 max-h-48 overflow-auto">
                    {roles.map((r) => {
                      const checked = form.roleIds.includes(r.id);
                      return (
                        <label
                          key={r.id}
                          className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                roleIds: e.target.checked
                                  ? [...form.roleIds, r.id]
                                  : form.roleIds.filter((x) => x !== r.id),
                              })
                            }
                          />
                          <span>{r.name}</span>
                          <code className="ml-auto font-mono text-xs text-muted-foreground">{r.code}</code>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
                <Button onClick={submit}>提交</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            共 <span className="font-medium text-slate-900 tabular-nums">{count}</span> 个用户
          </span>
          <span>·</span>
          <span className="tabular-nums">{activeCount} 正常</span>
          <span>·</span>
          <span className="tabular-nums">{disabledCount} 停用</span>
        </div>
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="搜索..." className="pl-8 h-8 text-sm" />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {list === null ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead>工号</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead>部门</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <UsersIcon size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无用户
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          点击右上 "新建用户" 或 "花名册导入"
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((u) => (
                    <TableRow key={u.id} className="h-10 hover:bg-blue-50/50">
                      <TableCell className="py-2">
                        <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                          {u.employeeId}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium py-2">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground py-2 font-mono tabular-nums text-xs">
                        {u.username}
                      </TableCell>
                      <TableCell className="py-2">{u.department?.name ?? '—'}</TableCell>
                      <TableCell className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <Badge
                              key={r.code}
                              variant={r.isPrimary ? 'default' : 'secondary'}
                            >
                              {r.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        {u.isActive ? (
                          <Badge
                            variant="outline"
                            className="text-emerald-600 border-emerald-200 bg-emerald-50"
                          >
                            正常
                          </Badge>
                        ) : (
                          <Badge variant="secondary">停用</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <Button variant="ghost" size="sm" disabled className="opacity-50">
                          详情
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {list.length > 0 && (
                <TableCaption>共 {count} 个账号</TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
