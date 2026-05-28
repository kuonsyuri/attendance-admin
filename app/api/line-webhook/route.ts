import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// サーバーサイド専用Supabaseクライアント
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// LINE署名検証（HMAC-SHA256 Base64 — プレフィックスなし）
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  return hash === signature;
}

// LINEプロフィール取得
async function fetchLineProfile(
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
      pictureUrl: (data.pictureUrl as string) || null,
    };
  } catch {
    return { displayName: 'LINEユーザー', pictureUrl: null };
  }
}

export async function POST(req: NextRequest) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    console.error('LINE_CHANNEL_SECRET が設定されていません');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // rawBodyを取得して署名検証
  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature') || '';

  if (!verifySignature(rawBody, signature, channelSecret)) {
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
      const { displayName, pictureUrl } = accessToken
        ? await fetchLineProfile(lineUserId, accessToken)
        : { displayName: 'LINEユーザー', pictureUrl: null };

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
