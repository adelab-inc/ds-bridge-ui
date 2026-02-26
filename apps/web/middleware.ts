import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PUBLIC_ROUTES = ['/login', '/auth/callback'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 공개 라우트 허용
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    // Supabase 쿠키 갱신은 여전히 수행
    const { supabaseResponse } = await updateSession(request);
    return supabaseResponse;
  }

  // API 라우트 허용 (자체 인증 처리)
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // 인증 확인
  const { user, supabaseResponse } = await updateSession(request);

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
