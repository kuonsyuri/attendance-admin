import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// LINEの全フォロワーIDを取得（ページネーション対応）
async function fetchAllFollowerIds(accessToken: string): Promise<string[]> {
  const ids: string[] = [];
  let start: string | undefined;

  do {
    const url = new URL('https://api.line.me/v2/bot/followers/ids');
    url.searchParams.set('count', '300');
    if (start) url.searchParams.set('start', start);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      console.error('LINE followers API error:', res.status, await res.text());
      break;
    }

    const data = await res.json();
    ids.push(...((data.userIds as string[]) || []));
    start = data.next as string | undefined;
  } while (start);

  return ids;
}

// LINEプロフィールを取得
async function fetchProfile(
  userId: string,
  accessToken: string
): Promise<{ displayName: string; pictureUrl: string | null }> {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { displayName: 'LINEユーザー', pictureUrl: null };
    const data = await res.json();
    return {
      displayName: (data.displayName as string) || 'LINEユーザー',
      pictureUrl:  (data.pictureUrl  as string) || null,
    };
  } catch {
    return { displayName: 'LINEユーザー', pictureUrl: null };
  }
}

export async function POST(req: NextRequest) {
  // パスワード認証
  const { password } = await req.json().catch(() => ({ password: '' }));
  if (password !== process.env.NEXT_PUBLIC_APP_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: 'LINE_CHANNEL_ACCESS_TOKEN が設定されていません' }, { status: 500 });
  }

  // 既登録のline_user_idを収集（staff + pending_staff）
  const [{ data: staffRows }, { data: pendingRows }] = await Promise.all([
    supabase.from('staff').select('line_user_id'),
    supabase.from('pending_staff').select('line_user_id'),
  ]);

  const existingIds = new Set<string>([
    ...((staffRows  || []) as { line_user_id: string }[]).map(r => r.line_user_id).filter(Boolean),
    ...((pendingRows || []) as { line_user_id: string }[]).map(r => r.line_user_id).filter(Boolean),
  ]);

  // LINEからフォロワー一覧取得
  const followerIds = await fetchAllFollowerIds(accessToken);

  // 未登録のフォロワーをpending_staffに追加
  let added = 0;
  for (const userId of followerIds) {
    if (existingIds.has(userId)) continue;

    const { displayName, pictureUrl } = await fetchProfile(userId, accessToken);

    const { error } = await supabase.from('pending_staff').upsert(
      {
        line_user_id: userId,
        display_name: displayName,
        picture_url:  pictureUrl,
        status:       'pending',
        updated_at:   new Date().toISOString(),
      },
      { onConflict: 'line_user_id' }
    );

    if (!error) added++;
  }

  return NextResponse.json({
    ok: true,
    followers: followerIds.length,
    added,
    skipped: followerIds.length - added,
  });
}
