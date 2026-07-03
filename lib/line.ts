// ─────────────────────────────────────────────────────────────
// LINE Messaging API 連携の単一モジュール（LINE機能の格納先）
//
// Webhook署名検証 / プロフィール取得 / Push送信 / LIFF IDトークン検証を
// ここに集約する。個別ルートでの重複実装を禁止し、LINE仕様変更時は
// このファイルだけを更新すればよい構造にする。
//
// 必要な環境変数:
// - LINE_CHANNEL_SECRET        … Webhook署名検証（Messaging APIチャネル）
// - LINE_CHANNEL_ACCESS_TOKEN  … プロフィール取得・Push送信
// - LINE_LOGIN_CHANNEL_ID      … LIFF IDトークン検証（LIFFのチャネルID。
//                                LIFF ID「2010222182-xxxx」の先頭数値部）
// ─────────────────────────────────────────────────────────────

import crypto from 'crypto';

const LINE_API = 'https://api.line.me';

export type LineProfile = { displayName: string; pictureUrl: string | null };

/** Webhook署名検証（HMAC-SHA256 Base64・タイミングセーフ比較） */
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** ユーザープロフィール取得（失敗時はプレースホルダ） */
export async function getLineProfile(userId: string, accessToken?: string): Promise<LineProfile> {
  const token = accessToken ?? process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { displayName: 'LINEユーザー', pictureUrl: null };
  try {
    const res = await fetch(`${LINE_API}/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
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

/** 公式アカウントからのPush送信（1:1トーク） */
export async function pushLineMessage(
  userId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, error: 'LINE_CHANNEL_ACCESS_TOKEN が設定されていません' };
  try {
    const res = await fetch(`${LINE_API}/v2/bot/message/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `push failed ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * LIFF IDトークンの検証（LINEの検証エンドポイント）。
 * 成功時は本人の userId（sub）を返す。スタッフアプリからの通知要求の認証に使う。
 */
export async function verifyLiffIdToken(
  idToken: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const clientId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!clientId) return { ok: false, error: 'LINE_LOGIN_CHANNEL_ID が設定されていません' };
  try {
    const res = await fetch(`${LINE_API}/oauth2/v2.1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.sub) {
      return { ok: false, error: (data.error_description as string) || `verify failed ${res.status}` };
    }
    return { ok: true, userId: data.sub as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
