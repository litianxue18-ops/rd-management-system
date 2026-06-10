'use client';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
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

interface Role { id: number; code: string; name: string; isSystem: boolean; description?: string; }

export default function RolesPage() {
  const [list, setList] = useState<Role[] | null>(null);
  useEffect(() => { fetch('/api/roles').then((r) => r.json()).then((j) => setList(j.data ?? [])); }, []);

  const count = list?.length ?? 0;
  const systemCount = list?.filter((r) => r.isSystem).length ?? 0;
  const businessCount = count - systemCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          角色 (只读)
        </h1>
        <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
          内置 13 个角色,业务流程权限通过权限矩阵配置
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            共 <span className="font-medium text-slate-900 tabular-nums">{count}</span> 个角色
          </span>
          <span>·</span>
          <span className="tabular-nums">{systemCount} 系统</span>
          <span>·</span>
          <span className="tabular-nums">{businessCount} 业务</span>
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
                  <TableHead className="w-48">编码</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead className="w-24">类型</TableHead>
                  <TableHead>说明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r) => (
                  <TableRow key={r.id} className="h-10 hover:bg-blue-50/50">
                    <TableCell className="py-2">
                      <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                        {r.code}
                      </code>
                    </TableCell>
                    <TableCell className="font-medium py-2">{r.name}</TableCell>
                    <TableCell className="py-2">
                      {r.isSystem ? (
                        <Badge
                          variant="outline"
                          className="text-blue-600 border-blue-200 bg-blue-50"
                        >
                          系统
                        </Badge>
                      ) : (
                        <Badge variant="secondary">业务</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground py-2">
                      {r.description ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableCaption>共 {count} 个角色</TableCaption>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
