'use client';
import { useEffect, useState } from 'react';
import { Hash } from 'lucide-react';
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

interface NumberRule {
  id: number;
  code: string;
  pattern: string;
  description: string | null;
  createdAt: string;
}

export default function NumberRulesPage() {
  const [list, setList] = useState<NumberRule[] | null>(null);

  useEffect(() => {
    // M2 阶段编号规则只有 1 条默认值, 暂不开 API, 这里硬编码展示
    // 后续 (M3+) 可以补 /api/number-rules
    setList([
      {
        id: 1,
        code: 'default',
        pattern: 'RD-{TYPE}-{YYYY}-{NNN}',
        description: '默认规则: RD-类型代码-年-3位序号',
        createdAt: '',
      },
    ]);
  }, []);

  const count = list?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            项目编号规则
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            立项通过后,系统按下方规则自动生成项目编号(M2 阶段只读,后续可扩展多规则)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          共 <span className="font-medium text-slate-900 tabular-nums">{count}</span> 条规则
        </span>
      </div>

      <Card>
        <CardContent className="pt-6">
          {list === null ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>编码</TableHead>
                  <TableHead>模板</TableHead>
                  <TableHead>说明</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Hash size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无编号规则
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          请运行 pnpm seed 初始化默认规则
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((r) => (
                    <TableRow key={r.id} className="h-10 hover:bg-blue-50/50">
                      <TableCell className="text-muted-foreground py-2 font-mono tabular-nums text-xs">
                        {r.id}
                      </TableCell>
                      <TableCell className="py-2">
                        <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                          {r.code}
                        </code>
                      </TableCell>
                      <TableCell className="py-2">
                        <code className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          {r.pattern}
                        </code>
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {r.description ?? '—'}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className="text-emerald-600 border-emerald-200 bg-emerald-50"
                        >
                          生效中
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {list.length > 0 && (
                <TableCaption>
                  占位符:{'{TYPE}'} 项目类型编码、{'{YYYY}'} 4 位年份、{'{NNN}'} 3 位顺序号(按 type + year 累加,跨年重置)
                </TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
