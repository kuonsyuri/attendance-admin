import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE, SessionPayload } from '@/lib/auth';

/**
 * API Route から「今の操作者」を取り出す唯一の入口。
 * middleware が未認証を弾いた後の呼び出しを前提とするが、各Routeでも必ず主体を確認する
 * （深層防御。middlewareの設定漏れが権限バイパスに直結しないようにする）。
 */
export async function currentSession(): Promise<SessionPayload | null> {
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
}
