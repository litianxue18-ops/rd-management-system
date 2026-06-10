'use client';
import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';

export default function MePage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');

  useEffect(() => { fetch('/api/auth/me').then((r) => r.json()).then((j) => setMe(j.data)); }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const primaryRoleCode = me?.roles?.find((r: any) => r.isPrimary)?.code;
  const primaryRoleName = me?.roles?.find((r: any) => r.isPrimary)?.name;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            个人信息
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            你的账号信息和当前角色
          </p>
        </div>
        <Button variant="outline" onClick={logout} className="shrink-0">
          <LogOut size={16} className="mr-2" />
          退出登录
        </Button>
      </div>

      {/* 用户头卡 */}
      <Card className="rounded-2xl border-slate-300 shadow-md">
        <CardContent className="p-6 flex items-center gap-4">
          {me ? (
            <>
              <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 text-2xl font-semibold flex items-center justify-center shrink-0">
                {me.name?.charAt(0) ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xl font-semibold text-slate-900 dark:text-slate-50 truncate">
                  {me.name}
                </div>
                <div className="text-sm text-muted-foreground font-mono tabular-nums mt-0.5">
                  工号 {me.employeeId ?? '—'}
                </div>
                <div className="text-sm text-slate-600 mt-0.5 truncate">
                  {me.department?.name ?? '—'}
                </div>
              </div>
              {primaryRoleName && (
                <Badge className="bg-blue-600 text-white hover:bg-blue-600 shrink-0">
                  {primaryRoleName}
                </Badge>
              )}
            </>
          ) : (
            <>
              <Skeleton className="w-16 h-16 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: 基本信息 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">基本信息</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              来自花名册导入,不可在此修改
            </CardDescription>
          </CardHeader>
          <CardContent>
            {me ? (
              <>
                <div className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                  {me.name}
                </div>
                <div className="text-sm text-muted-foreground font-mono tabular-nums mt-0.5">
                  工号 {me.employeeId ?? '—'}
                </div>
                <Separator className="my-4" />
                <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">用户名</dt>
                  <dd className="font-mono tabular-nums">{me.username}</dd>
                  <dt className="text-muted-foreground">部门</dt>
                  <dd>{me.department?.name ?? '—'}</dd>
                  <dt className="text-muted-foreground">邮箱</dt>
                  <dd className="font-mono break-all">{me.email ?? '—'}</dd>
                  <dt className="text-muted-foreground">手机</dt>
                  <dd className="font-mono tabular-nums">{me.phone ?? '—'}</dd>
                </dl>
              </>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: 角色 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">角色</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              主角色高亮,其余为附加角色
            </CardDescription>
          </CardHeader>
          <CardContent>
            {me ? (
              <div className="flex flex-wrap gap-2">
                {(me.roles ?? []).map((r: any) => (
                  <Badge
                    key={r.code}
                    variant={r.code === primaryRoleCode ? 'default' : 'secondary'}
                  >
                    {r.name}
                  </Badge>
                ))}
                {(!me.roles || me.roles.length === 0) && (
                  <span className="text-xs text-slate-400">未分配角色</span>
                )}
              </div>
            ) : (
              <Skeleton className="h-5 w-40" />
            )}
          </CardContent>
        </Card>

        {/* Card 3: 安全 / 修改密码 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">安全</CardTitle>
            <CardDescription className="text-xs text-amber-600">
              M2 启用
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="old-pwd" className="text-xs">旧密码</Label>
              <Input
                id="old-pwd"
                placeholder="旧密码"
                type="password"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                disabled
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pwd" className="text-xs">新密码</Label>
              <Input
                id="new-pwd"
                placeholder="新密码"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                disabled
              />
            </div>
            <Button disabled className="w-full">提交</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
