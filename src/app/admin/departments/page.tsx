'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Building2, Search } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Department { id: number; code: string; name: string; enabled: boolean; }

export default function DepartmentsPage() {
  const [list, setList] = useState<Department[] | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);

  async function load() {
    const r = await fetch('/api/departments?includeDisabled=1');
    const j = await r.json();
    setList(j.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    const r = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, name }),
    });
    const j = await r.json();
    if (j.error) toast.error(j.error.message);
    else { toast.success('已创建'); setCode(''); setName(''); setOpen(false); load(); }
  }

  async function disable(id: number) {
    await fetch(`/api/departments/${id}`, { method: 'DELETE' });
    load();
  }

  const count = list?.length ?? 0;
  const activeCount = list?.filter((d) => d.enabled).length ?? 0;
  const disabledCount = count - activeCount;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            部门管理
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            管理公司一级部门,停用后用户不可再分配到该部门
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0">
              <Plus size={16} className="mr-2" />
              新建部门
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建部门</DialogTitle>
              <DialogDescription>编码用于花名册导入匹配,创建后不可改</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="dept-code">编码</Label>
                <Input
                  id="dept-code"
                  placeholder="如 rd_center"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dept-name">名称</Label>
                <Input
                  id="dept-name"
                  placeholder="如 研发中心"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
              <Button onClick={create}>提交</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            共 <span className="font-medium text-slate-900 tabular-nums">{count}</span> 个
          </span>
          <span>·</span>
          <span className="tabular-nums">{activeCount} 启用</span>
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
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>编码</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Building2 size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无部门
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          点击右上 "新建部门" 创建第一条
                        </div>
                        <Button
                          className="mt-4"
                          variant="outline"
                          onClick={() => setOpen(true)}
                        >
                          <Plus size={14} className="mr-1.5" />
                          新建部门
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((d) => (
                    <TableRow key={d.id} className="h-10 hover:bg-blue-50/50">
                      <TableCell className="text-muted-foreground py-2 font-mono tabular-nums text-xs">
                        {d.id}
                      </TableCell>
                      <TableCell className="py-2">
                        <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                          {d.code}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium py-2">{d.name}</TableCell>
                      <TableCell className="py-2">
                        {d.enabled ? (
                          <Badge
                            variant="outline"
                            className="text-emerald-600 border-emerald-200 bg-emerald-50"
                          >
                            启用
                          </Badge>
                        ) : (
                          <Badge variant="secondary">已停用</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-2">
                        {d.enabled && (
                          <Button variant="ghost" size="sm" onClick={() => disable(d.id)}>
                            <Trash2 size={14} className="mr-1.5" />
                            停用
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {list.length > 0 && (
                <TableCaption>共 {count} 个部门</TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
