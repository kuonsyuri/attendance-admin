import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }));
  if (!verifyPassword(String(password ?? ''))) {
    return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 });
  }
  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
