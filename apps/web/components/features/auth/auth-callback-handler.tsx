'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Status = 'checking' | 'signing-in' | 'error';

export function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = React.useState<Status>('checking');
  const [error, setError] = React.useState<string | null>(null);

  // 인증 완료 시 리다이렉트
  React.useEffect(() => {
    if (isAuthenticated) {
      const redirect = searchParams.get('redirect') || '/';
      router.replace(redirect);
    }
  }, [isAuthenticated, router, searchParams]);

  // 마운트 시: Supabase PKCE 코드 교환
  React.useEffect(() => {
    const code = new URL(window.location.href).searchParams.get('code');

    if (!code) {
      setStatus('error');
      setError('유효하지 않은 로그인 링크입니다. 새 링크를 요청해주세요.');
      return;
    }

    setStatus('signing-in');
    const supabase = createClient();

    supabase.auth.exchangeCodeForSession(code).then(({ error: err }) => {
      if (err) {
        setStatus('error');
        setError(err.message || '로그인에 실패했습니다');
      }
      // 성공 시 onAuthStateChange가 자동으로 처리 → isAuthenticated → 리다이렉트
    });
  }, []);

  if (status === 'checking' || status === 'signing-in') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>로그인 중...</CardTitle>
          <CardDescription>링크를 확인하고 있습니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // 에러 상태
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>로그인 실패</CardTitle>
        <CardDescription>{error}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => router.push('/login')} className="w-full">
          로그인 페이지로 돌아가기
        </Button>
      </CardContent>
    </Card>
  );
}
