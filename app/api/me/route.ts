import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { currentSession } from '@/lib/session';

// 「今、誰が管理画面を見ているか」を返す。画面のヘッダ表示とアカウント画面が使う。
export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 移行期の共有PWセッションは主体を持たない（sub=null）
  if (session.sub === null) {
    return NextResponse.json({ sub: null, role: session.role, name: '共有アカウント', legacy: true });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.from('staff').select('id, name').eq('id', session.sub).maybeSingle();
  if (error) return NextResponse.json({ error: 'スタッフ情報の取得に失敗しました' }, { status: 500 });

  return NextResponse.json({
    sub: session.sub,
    role: session.role,
    name: data?.name ?? `ID:${session.sub}`,
    legacy: false,
  });
}
