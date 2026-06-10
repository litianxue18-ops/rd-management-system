'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound } from 'lucide-react';
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
import { toast } from 'sonner';

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json();
      if (j.error) toast.error(j.error.message);
      else router.push(sp.get('redirect') || '/workbench');
    } finally { setLoading(false); }
  }

  return (
    <div className="w-full max-w-md">
      <div className="h-20 w-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-t-2xl flex flex-col items-center justify-center px-6">
        <div className="text-white text-lg font-semibold tracking-tight">
          研发管理系统
        </div>
        <div className="text-white/80 text-xs mt-0.5">
          Internal R&amp;D platform
        </div>
      </div>
      <Card className="w-full rounded-t-none rounded-b-2xl border-t-0 shadow-xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-50 text-center">
            登录
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground text-center">
            请使用工号或用户名登录
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          <Button className="w-full" onClick={submit} disabled={loading}>
            <KeyRound size={16} className="mr-2" />
            {loading ? '登录中...' : '登录'}
          </Button>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground text-center mt-6">
        研发管理系统 · M1
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardContent className="py-6 text-sm text-muted-foreground">加载中...</CardContent>
          </Card>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
