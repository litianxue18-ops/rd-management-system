'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
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
} from '@/components/ui/table';
import { toast } from 'sonner';

const COLUMNS: { name: string; required: boolean; note?: string }[] = [
  { name: '物料编码', required: true, note: '需在物料字典已存在' },
  { name: '仓库编码', required: true, note: '需在仓库字典已存在' },
  { name: '数量', required: true, note: '必须 > 0' },
  { name: '单价', required: false },
  { name: '批次号', required: false },
  { name: '备注', required: false },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export default function InboundImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function submit() {
    if (!file) return toast.error('请选文件');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/inventory/inbound/import', {
        method: 'POST',
        body: fd,
      });
      const j = await r.json();
      if (j.error) toast.error(j.error.message);
      else setResult(j.data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Link
            href="/inventory/inbound"
            className="hover:text-slate-900 inline-flex items-center gap-1"
          >
            <ArrowLeft size={12} />
            入库单
          </Link>
        </div>
        <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
          期初库存导入
        </h1>
        <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
          上传 Excel 批量录入每个 (物料, 仓库) 的期初余量
        </p>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Excel 模板说明</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            表头必须严格匹配以下列名, 顺序不限. 同 (物料, 仓库) 仅允许期初一次, 已存在的会被跳过
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {COLUMNS.map((c) => (
              <div key={c.name} className="flex items-center justify-between">
                <dt className="text-slate-900">
                  {c.name}
                  {c.note && (
                    <span className="text-xs text-muted-foreground ml-2">{c.note}</span>
                  )}
                </dt>
                <dd>
                  {c.required ? (
                    <Badge
                      variant="outline"
                      className="text-emerald-600 border-emerald-200 bg-emerald-50"
                    >
                      必填
                    </Badge>
                  ) : (
                    <Badge variant="secondary">可选</Badge>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">上传文件</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            支持 .xlsx / .xls, 单文件 ≤ 10MB
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full border-dashed border-2 border-slate-200 rounded-lg py-8 px-6 text-center hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="flex flex-col items-center">
              <Upload size={28} className="text-slate-300" />
              <div className="mt-3 text-sm font-medium text-slate-900">
                点击选择 Excel 文件
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                支持 .xlsx / .xls, 单文件 ≤ 10MB
              </div>
            </div>
          </button>
          {file && (
            <div className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet size={16} className="text-slate-400" />
                <span className="font-medium text-slate-900">{file.name}</span>
                <span className="text-xs text-muted-foreground font-mono tabular-nums">
                  {formatSize(file.size)}
                </span>
              </div>
              <Button onClick={submit} disabled={busy}>
                {busy ? '导入中...' : '开始导入'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="border-slate-300 shadow-md rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">导入结果</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              已处理完成, 可下方查看错误明细
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="text-xs text-emerald-700">新建</div>
                <div className="text-3xl md:text-4xl font-bold tabular-nums text-emerald-600 mt-1">
                  {result.created}
                </div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">跳过</div>
                <div className="text-3xl md:text-4xl font-bold tabular-nums text-slate-600 mt-1">
                  {result.skipped}
                </div>
              </div>
              <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
                <div className="text-xs text-rose-700">错误</div>
                <div className="text-3xl md:text-4xl font-bold tabular-nums text-rose-600 mt-1">
                  {result.errors.length}
                </div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div>
                <div className="text-sm font-medium text-slate-900 mb-2">错误明细</div>
                <Table>
                  <TableHeader>
                    <TableRow className="h-10">
                      <TableHead className="w-24">Excel 行</TableHead>
                      <TableHead>原因</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.errors.map((e, i) => (
                      <TableRow key={i} className="h-10">
                        <TableCell className="text-muted-foreground py-2 font-mono tabular-nums text-xs">
                          {e.row}
                        </TableCell>
                        <TableCell className="text-rose-600 py-2">{e.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
