import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyLegacyPassword, createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS, AppRole } from '@/lib/auth';

// スタッフID＋パスワードで Supabase Auth が本人確認 → 自前セッションに主体(staff.id)＋roleを載せる。
// email は <staffId>@elan.local に変換。権限は staff.app_role（admin/manager のみコンソール可）。
// 移行期は共有PWフォールバックを許容（A2-5で撤去）。
const EMAIL_DOMAIN = '@elan.local';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({ staffId: '', password: '' }));
  const staffId = String(body.staffId ?? '').trim();
  const password = String(body.password ?? '');

  let session: { sub: number | null; role: AppRole } | null = null;

  // ① 個人ログイン（スタッフID＋PW → Supabase Auth）
  if (staffId) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase.auth.signInWithPassword({
      email: `${staffId}${EMAIL_DOMAIN}`,
      password,
    });
    if (!error && data.user) {
      const { data: staff } = await supabase
        .from('staff')
        .select('id, app_role')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();
      await supabase.auth.signOut().catch(() => {}); // 自前Cookieを使うのでSupabaseセッションは破棄
      if (staff && (staff.app_role === 'admin' || staff.app_role === 'manager')) {
        session = { sub: staff.id as number, role: staff.app_role as AppRole };
      } else {
        return NextResponse.json({ error: 'このアカウントには管理画面の権限がありません' }, { status: 403 });
      }
    }
  }

  // ② フォールバック：移行期の共有PW（A2-5で撤去）→ legacy admin
  if (!session && verifyLegacyPassword(password)) {
    session = { sub: null, role: 'admin' };
  }

  if (!session) {
    return NextResponse.json({ error: 'スタッフIDまたはパスワードが違います' }, { status: 401 });
  }

  const token = await createSessionToken(session);
  const res = NextResponse.json({ ok: true, role: session.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
