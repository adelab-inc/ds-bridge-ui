import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCallbackHandler } from '@/components/features/auth/auth-callback-handler';

export const metadata: Metadata = {
  title: '로그인 중... | DS-Runtime Hub',
};

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense
        fallback={<p className="text-muted-foreground text-sm">로딩 중...</p>}
      >
        <AuthCallbackHandler />
      </Suspense>
    </div>
  );
}
