'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  isEmailSignInLink,
  completeSignInWithEmailLink,
  getStoredEmail,
} from '@/lib/auth/actions';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Status = 'checking' | 'need-email' | 'signing-in' | 'error';

export function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = React.useState<Status>('checking');
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  // 인증 완료 시 리다이렉트
  React.useEffect(() => {
    if (isAuthenticated) {
      const redirect = searchParams.get('redirect') || '/';
      router.replace(redirect);
    }
  }, [isAuthenticated, router, searchParams]);

  // 마운트 시: URL이 sign-in 링크인지 확인 후 처리
  React.useEffect(() => {
    const url = window.location.href;

    if (!isEmailSignInLink(url)) {
      setStatus('error');
      setError('유효하지 않은 로그인 링크입니다. 새 링크를 요청해주세요.');
      return;
    }

    const storedEmail = getStoredEmail();

    if (storedEmail) {
      // 같은 브라우저: 자동 sign-in
      setStatus('signing-in');
      completeSignInWithEmailLink(storedEmail, url).catch((err) => {
        setStatus('error');
        setError(err instanceof Error ? err.message : '로그인에 실패했습니다');
      });
    } else {
      // 다른 브라우저: 이메일 입력 필요
      setStatus('need-email');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('signing-in');
    setError(null);

    try {
      await completeSignInWithEmailLink(email, window.location.href);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다');
    }
  };

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

  if (status === 'need-email') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>이메일 확인</CardTitle>
          <CardDescription>
            다른 브라우저에서 링크를 열었습니다. 로그인 링크를 요청할 때 사용한
            이메일을 입력해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={!email}>
              확인 후 로그인
            </Button>
          </form>
        </CardContent>
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
