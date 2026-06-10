'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  FileSpreadsheet,
  Shield,
  KeyRound,
  FolderTree,
  Hash,
  Package,
  Warehouse,
  Truck,
  Share2,
  Calculator,
  BarChart3,
  ChevronRight,
  ChevronDown,
  LogOut,
  User,
  type LucideIcon,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const items: NavItem[] = [
  { href: '/admin/departments', label: '部门管理', icon: Building2 },
  { href: '/admin/users', label: '用户管理', icon: Users },
  { href: '/admin/users/import', label: '花名册导入', icon: FileSpreadsheet },
  { href: '/admin/roles', label: '角色 (只读)', icon: Shield },
  { href: '/admin/permission-matrix', label: '权限矩阵', icon: KeyRound },
  { href: '/admin/project-types', label: '项目类型字典', icon: FolderTree },
  { href: '/admin/number-rules', label: '项目编号规则', icon: Hash },
  { href: '/admin/materials', label: '物料目录', icon: Package },
  { href: '/admin/warehouses', label: '仓库', icon: Warehouse },
  { href: '/admin/suppliers', label: '供应商', icon: Truck },
  { href: '/admin/shared-resources', label: '共用资源分摊', icon: Share2 },
  { href: '/monthly/allocations', label: '费用分摊表', icon: Calculator },
  { href: '/inventory/balance', label: '库存分析', icon: BarChart3 },
];

const ROLE_LABELS: Record<string, string> = {
  researcher: '研发员',
  project_lead: '项目负责人',
  rd_director: '研发中心',
  warehouse_keeper: '仓管员',
  production_lead: '生产部',
  finance_lead: '财务部',
  ceo: '总经理',
  super_admin: '系统管理员',
  tech_committee: '技委会',
  purchase_lead: '采购部',
  equipment_lead: '设备部',
  hr_lead: '人资',
  audit_lead: '审计部',
};

export function AdminSidebar() {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((j) => setMe(j.data)).catch(() => {});
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const primary = me?.roles?.find((r: any) => r.isPrimary)?.code ?? me?.primaryRole;
  const primaryLabel = primary ? (ROLE_LABELS[primary] ?? primary) : '';
  const initial = me?.name ? me.name.charAt(0) : '?';

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-slate-50/50 flex flex-col h-full">
      <div className="px-4 py-5 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
          研
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
            研发管理系统
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">系统配置</div>
        </div>
      </div>
      <Separator />
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {items.map((i) => {
          const Icon = i.icon;
          const active = path === i.href;
          return (
            <Link
              key={i.href}
              href={i.href}
              className={cn(
                'flex items-center px-3 py-2.5 rounded-md text-sm transition-colors',
                active
                  ? 'bg-blue-100 text-blue-800 font-semibold border-l-4 border-blue-600 -ml-px pl-[9px]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon size={16} className="mr-2 shrink-0" />
              <span>{i.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-3">
        <Link
          href="/workbench"
          className="flex items-center justify-between px-3 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <span>返回工作台</span>
          <ChevronRight size={14} />
        </Link>
      </div>

      <div className="mt-auto border-t border-slate-200">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center gap-2.5 p-3 hover:bg-slate-100 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 text-sm font-semibold shrink-0">
                {initial}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {me?.name ?? '加载中...'}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {primaryLabel || '\u00A0'}
                </div>
              </div>
              <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="w-52">
            <DropdownMenuItem asChild>
              <Link href="/me" className="flex items-center gap-2">
                <User size={14} />
                <span>个人信息</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} variant="destructive">
              <LogOut size={14} />
              <span>退出登录</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
