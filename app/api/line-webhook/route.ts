import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyWebhookSignature, getLineProfile } from '@/lib/line';

// サーバーサイド専用Supabaseクライアント
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    console.error('LINE_CHANNEL_SECRET が設定されていません');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // rawBodyを取得して署名検証
  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature') || '';

  if (!verifyWebhookSignature(rawBody, signature, channelSecret)) {
    console.warn('LINE webhook: 署名検証失敗');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: { events: Array<{ type: string; source?: { userId?: string } }> };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

  for (const event of body.events || []) {
    const lineUserId = event.source?.userId;
    if (!lineUserId) continue;

    if (event.type === 'follow') {
      // 友達追加 → pending_staffにupsert
      const { displayName, pictureUrl } = await getLineProfile(lineUserId, accessToken);

      const { error } = await supabase.from('pending_staff').upsert(
        {
          line_user_id: lineUserId,
          display_name: displayName,
          picture_url: pictureUrl,
          status: 'pending',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'line_user_id' }
      );

      if (error) {
        console.error('pending_staff upsert error:', error);
      } else {
        console.log(`新規申請: ${displayName} (${lineUserId})`);
      }
    }

    if (event.type === 'unfollow') {
      // ブロック・友達削除 → pending状態ならunfollowedに更新
      await supabase
        .from('pending_staff')
        .update({ status: 'unfollowed', updated_at: new Date().toISOString() })
        .eq('line_user_id', lineUserId)
        .eq('status', 'pending');
    }
  }

  return NextResponse.json({ ok: true });
}
