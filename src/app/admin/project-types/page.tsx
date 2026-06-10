'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, FolderTree, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

interface ProjectType {
  id: number;
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
}

export default function ProjectTypesPage() {
  const [list, setList] = useState<ProjectType[] | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [open, setOpen] = useState(false);

  async function load() {
    const r = await fetch('/api/project-types?includeDisabled=1');
    const j = await r.json();
    setList(j.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    const r = await fetch('/api/project-types', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, name, description: description || undefined }),
    });
    const j = await r.json();
    if (j.error) toast.error(j.error.message);
    else {
      toast.success('已创建');
      setCode(''); setName(''); setDescription('');
      setOpen(false);
      load();
    }
  }

  async function disable(id: number) {
    const r = await fetch(`/api/project-types/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    const j = await r.json();
    if (j.error) toast.error(j.error.message);
    else { toast.success('已停用'); load(); }
  }

  async function enableType(id: number) {
    const r = await fetch(`/api/project-types/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    const j = await r.json();
    if (j.error) toast.error(j.error.message);
    else { toast.success('已启用'); load(); }
  }

  const count = list?.length ?? 0;
  const activeCount = list?.filter((d) => d.enabled).length ?? 0;
  const disabledCount = count - activeCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            项目类型字典
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            维护研发项目分类(如新材料/新工艺/新产品/设备改造),编码用于项目编号生成
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0">
              <Plus size={16} className="mr-2" />
              新建类型
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建项目类型</DialogTitle>
              <DialogDescription>编码用于项目编号生成(如 MAT/PRC),创建后不可改</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pt-code">编码</Label>
                <Input
                  id="pt-code"
                  placeholder="如 MAT"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pt-name">名称</Label>
                <Input
                  id="pt-name"
                  placeholder="如 新材料配方研发"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pt-desc">描述(可选)</Label>
                <Textarea
                  id="pt-desc"
                  placeholder="说明本分类涵盖的研发方向"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
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
                  <TableHead>描述</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <FolderTree size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无项目类型
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          点击右上 "新建类型" 创建第一条
                        </div>
                        <Button
                          className="mt-4"
                          variant="outline"
                          onClick={() => setOpen(true)}
                        >
                          <Plus size={14} className="mr-1.5" />
                          新建类型
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
                      <TableCell className="py-2 text-sm text-muted-foreground max-w-md truncate">
                        {d.description ?? '—'}
                      </TableCell>
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
                        {d.enabled ? (
                          <Button variant="ghost" size="sm" onClick={() => disable(d.id)}>
                            <Trash2 size={14} className="mr-1.5" />
                            停用
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => enableType(d.id)}>
                            启用
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {list.length > 0 && (
                <TableCaption>共 {count} 个类型</TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
