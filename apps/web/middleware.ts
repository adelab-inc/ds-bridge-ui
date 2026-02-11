import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/auth/callback'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 공개 라우트 허용
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // API 라우트 허용 (자체 인증 처리)
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // 세션 쿠키 확인 (UX 최적화용 — 보안 경계는 API 레이어에서)
  const sessionCookie = request.cookies.get('__session');
  if (!sessionCookie?.value) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
