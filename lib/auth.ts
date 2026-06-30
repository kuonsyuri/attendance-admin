// ─────────────────────────────────────────────────────────────
// サーバ検証境界（層2 権限）
//
// 「見せかけ認証（localStorage固定値＋NEXT_PUBLIC平文PW）」を、
// httpOnly Cookie のHMAC署名セッションに置き換える。
// Edge(middleware)とNode(API Route)の両方で動くよう Web Crypto を使用。
//
// 移行期は APP_PASSWORD（サーバ専用）を優先し、未設定なら
// NEXT_PUBLIC_APP_PASSWORD にフォールバック（lockout防止）。
// Vercel に APP_PASSWORD / AUTH_SECRET を設定後、NEXT_PUBLIC_APP_PASSWORD を削除する。
// ─────────────────────────────────────────────────────────────

export const SESSION_COOKIE = 'em_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8時間
export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;

function appPassword(): string {
  return process.env.APP_PASSWORD || process.env.NEXT_PUBLIC_APP_PASSWORD || '';
}

function authSecret(): string {
  // 署名鍵。専用シークレットが無ければPWを鍵として流用（この規模では許容）。
  return process.env.AUTH_SECRET || process.env.APP_PASSWORD || process.env.NEXT_PUBLIC_APP_PASSWORD || 'insecure-dev-secret';
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** ログインPWの検証（サーバ専用値と照合） */
export function verifyPassword(input: string): boolean {
  const pw = appPassword();
  return pw.length > 0 && timingSafeEqual(input, pw);
}

/** 署名付きセッショントークンを発行（`{exp}.{hmac}`） */
export async function createSessionToken(): Promise<string> {
  const exp = Date.now() + SESSION_TTL_MS;
  const sig = await hmacHex(String(exp), authSecret());
  return `${exp}.${sig}`;
}

/** セッショントークンの検証（署名一致＋未失効） */
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = await hmacHex(expStr, authSecret());
  return timingSafeEqual(sig, expected);
}
