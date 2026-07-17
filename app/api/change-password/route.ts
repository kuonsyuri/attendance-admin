import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { currentSession } from '@/lib/session';

// 自分のパスワードだけを変更する。
// 現パスワードで Supabase Auth に本人確認させ、その本人セッションで更新する。
// service_role を使わないので「他人のパスワードを変えられる鍵」をアプリ内に持たない。
const EMAIL_DOMAIN = '@elan.local';
const MIN_LENGTH = 8;

export async function POST(req: NextRequest) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.sub === null) {
    return NextResponse.json(
      { error: '共有パスワードでのログイン中は変更できません。スタッフIDでログインし直してください。' },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword ?? '');
  const newPassword = String(body.newPassword ?? '');

  if (newPassword.length < MIN_LENGTH) {
    return NextResponse.json({ error: `新しいパスワードは${MIN_LENGTH}文字以上にしてください` }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: '現在のパスワードと同じです' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // ① 現パスワードで本人確認（他人が乗っ取ったCookieだけでは変更させない）
  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: `${session.sub}${EMAIL_DOMAIN}`,
    password: currentPassword,
  });
  if (signInError || !signIn.user) {
    return NextResponse.json({ error: '現在のパスワードが違います' }, { status: 401 });
  }

  // ② 本人セッションで自分のパスワードを更新
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  await supabase.auth.signOut().catch(() => {});
  if (updateError) {
    return NextResponse.json({ error: 'パスワードの更新に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
