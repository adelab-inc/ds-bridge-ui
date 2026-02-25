'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { sendSignInLink } from '@/lib/auth/actions';
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

export function LoginForm() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [isSent, setIsSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 이미 인증된 경우 메인으로 리다이렉트
  React.useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSending(true);

    try {
      await sendSignInLink(email);
      setIsSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '로그인 링크 전송에 실패했습니다'
      );
    } finally {
      setIsSending(false);
    }
  };

  if (isSent) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>이메일을 확인해주세요</CardTitle>
          <CardDescription>
            <strong>{email}</strong>로 로그인 링크를 보냈습니다. 이메일의 링크를
            클릭하여 로그인하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setIsSent(false);
              setEmail('');
            }}
          >
            다른 이메일로 시도
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>DS-Runtime Hub</CardTitle>
        <CardDescription>
          이메일을 입력하면 로그인 링크를 보내드립니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSending}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={isSending || !email}
          >
            {isSending ? '전송 중...' : '로그인 링크 보내기'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
