'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronRight,
  Check,
  X,
  Users,
  Wallet,
  Clock,
  FlaskConical,
  Coins,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Detail {
  id: number;
  year: number;
  quarter: number;
  checkProject: string;
  checkBudget: string;
  checkMaterial: string;
  checkOutsource: string;
  checkArchive: string;
  compliantProject: boolean;
  compliantBudget: boolean;
  compliantMaterial: boolean;
  compliantOutsource: boolean;
  compliantArchive: boolean;
  overallOpinion: string;
  auditorId: number;
  createdAt: string;
  updatedAt: string;
}

const CHECKS = [
  {
    key: 'project',
    title: '人员认定',
    Icon: Users,
  },
  {
    key: 'budget',
    title: '投入归集',
    Icon: Wallet,
  },
  {
    key: 'material',
    title: '工时记录',
    Icon: Clock,
  },
  {
    key: 'outsource',
    title: '样品销售',
    Icon: FlaskConical,
  },
  {
    key: 'archive',
    title: '资本化时点',
    Icon: Coins,
  },
] as const;

function fmtDateTime(s: string) {
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export default function AuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const auditId = Number(id);
  const [data, setData] = useState<Detail | null>(null);

  useEffect(() => {
    if (!Number.isFinite(auditId)) return;
    fetch(`/api/audits/${auditId}`)
      .then((r) => r.json())
      .then((j) => setData(j.data ?? null));
  }, [auditId]);

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto px-8 py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const compliantCount =
    Number(data.compliantProject) +
    Number(data.compliantBudget) +
    Number(data.compliantMaterial) +
    Number(data.compliantOutsource) +
    Number(data.compliantArchive);
  const allOk = compliantCount === 5;

  return (
    <div className="max-w-5xl mx-auto px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href="/audits"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              季度内审
            </Link>
            <ChevronRight size={12} />
            <span>内审详情</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
              {data.year} 年 Q{data.quarter} 季度内审
            </h1>
            {allOk ? (
              <Badge className="bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-600 tabular-nums">
                全合规 {compliantCount}/5
              </Badge>
            ) : (
              <Badge className="bg-amber-600 text-white border-amber-700 hover:bg-amber-600 tabular-nums">
                整改 {compliantCount}/5
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
            <span>审计员 #{data.auditorId}</span>
            <span>·</span>
            <span>创建于 {fmtDateTime(data.createdAt)}</span>
          </div>
        </div>
      </div>

      {CHECKS.map((c) => {
        const checkKey = `check${c.key[0].toUpperCase() + c.key.slice(1)}` as keyof Detail;
        const compKey = `compliant${c.key[0].toUpperCase() + c.key.slice(1)}` as keyof Detail;
        const text = (data[checkKey] as string) || '';
        const isOk = data[compKey] as boolean;
        return (
          <Card
            key={c.key}
            className={
              isOk
                ? 'border-emerald-300 shadow-md rounded-xl'
                : 'border-rose-300 shadow-md rounded-xl'
            }
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <c.Icon size={16} className={isOk ? 'text-emerald-600' : 'text-rose-600'} />
                {c.title}
                {isOk ? (
                  <Badge className="bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-600 ml-auto">
                    <Check size={12} className="mr-1" />
                    合规
                  </Badge>
                ) : (
                  <Badge className="bg-rose-600 text-white border-rose-700 hover:bg-rose-600 ml-auto">
                    <X size={12} className="mr-1" />
                    不合规
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded-md">
                {text.trim() ? text : <span className="text-slate-400">未填写</span>}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* 总体意见 (整改要求已拼到末尾) */}
      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">总体意见</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded-md">
            {data.overallOpinion}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
