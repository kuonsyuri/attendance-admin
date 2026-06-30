import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';

// 認証不要の公開エンドポイント
// - login/logout: セッション発行・破棄
// - line-webhook: 外部(LINE)からのPOST。独自のHMAC署名検証を持つ
const PUBLIC_API = ['/api/login', '/api/logout', '/api/line-webhook'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_API.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) {
    return NextResponse.next();
  }

  // 未認証
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // /dashboard と /api を保護（上記 PUBLIC_API は内部で除外）
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
