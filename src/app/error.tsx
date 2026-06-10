'use client';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <AlertTriangle size={48} className="text-rose-400 mb-4" />
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">出错了</h1>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">
        {error?.message ?? '未知错误'}
      </p>
      <Button onClick={reset}>重试</Button>
    </div>
  );
}
