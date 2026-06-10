import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/modules/auth/jwt';
import { prisma } from '@/shared/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * 项目执行档案 — 概要页 / 详情子页共享的格式化函数、Badge、鉴权与基础原子组件。
 *
 * 抽出来避免 overview/page.tsx 和 detail/[section]/page.tsx 重复 ~250 行 helper。
 */

// ---------- formatters ----------

export function fmtMoney(n: number): string {
  if (!isFinite(n)) return '¥0.00';
  return n.toLocaleString('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  });
}

export function fmtNum(n: number, frac = 2): string {
  if (!isFinite(n)) return '0';
  return n.toLocaleString('zh-CN', { maximumFractionDigits: frac });
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const x = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(x.getTime())) return '—';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const x = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(x.getTime())) return '—';
  return `${fmtDate(x)} ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
}

// ---------- badges ----------

export function projectStatusBadge(s: string) {
  if (s === 'active')
    return (
      <Badge variant="outline" className="text-white border-emerald-700 bg-emerald-600">
        进行中
      </Badge>
    );
  if (s === 'reviewing')
    return (
      <Badge variant="outline" className="text-white border-blue-700 bg-blue-600">
        审批中
      </Badge>
    );
  if (s === 'rejected')
    return (
      <Badge variant="outline" className="text-white border-rose-700 bg-rose-600">
        已驳回
      </Badge>
    );
  if (s === 'draft') return <Badge variant="secondary">草稿</Badge>;
  if (s === 'closed') return <Badge variant="secondary">已结项</Badge>;
  return <Badge variant="secondary">已取消</Badge>;
}

export function genericStatusBadge(s: string) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: '草稿', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
    reviewing: { label: '审批中', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
    approved: { label: '已通过', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    rejected: { label: '已驳回', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
    issued: { label: '已出库', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    returned: { label: '已退库', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
    cancelled: { label: '已取消', cls: 'bg-slate-100 text-slate-600 border-slate-300' },
    supervised: { label: '已监销', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    settled: { label: '已结转', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    active: { label: '执行中', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    completed: { label: '已完成', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
    open: { label: '处理中', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  };
  const m = map[s] ?? { label: s, cls: 'bg-slate-100 text-slate-700 border-slate-300' };
  return (
    <Badge variant="outline" className={`${m.cls} font-normal text-[10px]`}>
      {m.label}
    </Badge>
  );
}

export const LEDGER_TYPE_LABEL: Record<string, string> = {
  init: '初始化',
  inbound: '入库',
  outbound: '领料出库',
  return: '退库',
  scrap: '报废',
  adjust: '盘点调整',
};

export const DISPOSAL_LABEL: Record<string, string> = {
  retained: '留样',
  destroyed: '销毁',
  sold: '出售',
  internal_use: '内部使用',
};

// ---------- server-side guard ----------

export async function requirePageAuth() {
  const token = (await cookies()).get('token')?.value;
  if (!token) redirect('/login?redirect=/projects');
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    redirect('/login?redirect=/projects');
  }
  const user = await prisma.user.findUnique({
    where: { id: payload!.userId },
    select: { tokenVersion: true, isActive: true, id: true },
  });
  if (!user || !user.isActive || user.tokenVersion !== payload!.tokenVersion) {
    redirect('/login?redirect=/projects');
  }
  return payload!;
}

// ---------- small atoms ----------

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold mb-4 pt-4 pb-2 border-b border-slate-200 text-slate-900">
      {children}
    </h2>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm text-slate-900">{children}</div>
    </div>
  );
}

export function LongField({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
        {text || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

export function MiniKpi({
  label,
  value,
  note,
  tone = 'default',
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'default' | 'blue';
}) {
  return (
    <Card className="border-slate-300 shadow-sm">
      <CardContent className="py-3">
        <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
        <div
          className={`font-mono tabular-nums text-base font-semibold ${tone === 'blue' ? 'text-blue-700' : 'text-slate-900'}`}
        >
          {value}
        </div>
        {note && <div className="text-[10px] text-muted-foreground mt-0.5">{note}</div>}
      </CardContent>
    </Card>
  );
}

/** 概要卡里的单个统计格子: 标签 + 数字 (font-mono tabular-nums)。 */
export function StatCell({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'blue' | 'amber' | 'emerald';
}) {
  const toneCls =
    tone === 'blue'
      ? 'text-blue-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : tone === 'emerald'
          ? 'text-emerald-700'
          : 'text-slate-900';
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className={`font-mono tabular-nums text-base font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}
