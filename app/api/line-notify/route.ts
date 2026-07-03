import { NextRequest, NextResponse } from 'next/server';
import { verifyLiffIdToken, pushLineMessage } from '@/lib/line';

// スタッフアプリ（LIFF）からの打刻・日報通知を受け、
// 公式アカウントから本人へPush返信するエンドポイント。
// 認証: LIFF IDトークン検証（middlewareのセッション認証は適用外・PUBLIC_API）。
// 送信先はトークンから確定した本人のみ＝他人宛てには送れない。

const CORS_HEADERS = {
  // スタッフアプリは別オリジンの静的ホスティング。IDトークン検証が認証のため
  // 既定は * とし、絞る場合は STAFF_APP_ORIGIN を設定する。
  'Access-Control-Allow-Origin': process.env.STAFF_APP_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

type NotifyEvent = 'clock_in' | 'clock_out' | 'meeting_start' | 'meeting_end';

type ReportPayload = {
  /** @deprecated 日報v2で fact_ticket_29800 に置換（移行期の旧アプリ互換用） */
  fact_new_course?: number | null;
  fact_new_customers?: number | null;
  fact_ticket_29800?: number | null;
  fact_sub_15?: number | null;
  fact_sub_13?: number | null;
  fact_sub_11?: number | null;
  fact_existing_customers?: number | null;
  fact_shop_sales?: number | null;
  fact_total_revenue?: number | null;
  dr_deal_factor?: string | null;
  dr_counseling_improve?: string | null;
  dr_progress?: string | null;
  dr_issue?: string | null;
  dr_improve_idea?: string | null;
  review_good_1?: string | null;
  review_good_2?: string | null;
  review_good_3?: string | null;
  review_obstacle?: string | null;
  review_question?: string | null;
  review_action_plan?: string | null;
  monthly_goal?: string | null;
};

// ISO日時 → JSTの HH:MM（端末TZ非依存）
function jstHM(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

const n = (v: number | null | undefined) => v ?? 0;

function buildReportBlock(r: ReportPayload): string {
  const subTotal = n(r.fact_sub_15) + n(r.fact_sub_13) + n(r.fact_sub_11);
  const lines: string[] = [
    '',
    '📊 本日の実績',
    `・新規顧客接客：${n(r.fact_new_customers)}件`,
    `・新規チケット契約（29,800円）：${n(r.fact_ticket_29800)}件`,
    // 旧アプリからの送信（移行期）のみ表示
    ...(r.fact_new_course != null ? [`・新規コース契約（旧）：${r.fact_new_course}件`] : []),
    `・新規サブスク契約：${subTotal}件（15,000:${n(r.fact_sub_15)}／13,000:${n(r.fact_sub_13)}／11,000:${n(r.fact_sub_11)}）`,
    `・既存顧客接客：${n(r.fact_existing_customers)}件`,
    `・店販販売：${n(r.fact_shop_sales)}件`,
    `・個人総売上：¥${n(r.fact_total_revenue).toLocaleString('ja-JP')}`,
  ];

  const drNotes: Array<[string, string | null | undefined]> = [
    ['成約・未成約の要因', r.dr_deal_factor],
    ['カウンセリング改善点', r.dr_counseling_improve],
    ['本日の前進', r.dr_progress],
  ];
  if (drNotes.some(([, v]) => v && v.trim())) {
    lines.push('', '💬 新規の振り返り');
    for (const [label, v] of drNotes) {
      if (v && v.trim()) lines.push(`・${label}：${v.trim()}`);
    }
  }

  const ideas: Array<[string, string | null | undefined]> = [
    ['課題・気づき', r.dr_issue],
    ['改善アイデア', r.dr_improve_idea],
  ];
  if (ideas.some(([, v]) => v && v.trim())) {
    lines.push('', '💡 改善アイデア（給与UP対象）');
    for (const [label, v] of ideas) {
      if (v && v.trim()) lines.push(`・${label}：${v.trim()}`);
    }
  }

  const reviews: Array<[string, string | null | undefined]> = [
    ['上手くできたこと①', r.review_good_1],
    ['上手くできたこと②', r.review_good_2],
    ['上手くできたこと③', r.review_good_3],
    ['障害・懸念', r.review_obstacle],
    ['問いの転換', r.review_question],
    ['アクションプラン', r.review_action_plan],
  ];
  if (reviews.some(([, v]) => v && v.trim())) {
    lines.push('', '🔄 振り返り');
    for (const [label, v] of reviews) {
      if (v && v.trim()) lines.push(`・${label}：${v.trim()}`);
    }
  }

  if (r.monthly_goal && r.monthly_goal.trim()) {
    lines.push('', '🎯 今月の目標', r.monthly_goal.trim());
  }

  return lines.join('\n');
}

function buildMessage(
  event: NotifyEvent,
  hm: string,
  storeName: string,
  overtime: boolean,
  report: ReportPayload | null,
): string {
  const store = storeName ? `（${storeName}）` : '';
  switch (event) {
    case 'clock_in':
      return `🕒 ${hm}に出勤しました。${store}`;
    case 'clock_out': {
      const head = overtime
        ? `🕒 ${hm}に退勤しました。${store}※残業分の打刻`
        : `🕒 ${hm}に退勤しました。${store}`;
      return report ? head + '\n' + buildReportBlock(report) : head;
    }
    case 'meeting_start':
      return `📝 ${hm}にミーティングを開始しました。${store}`;
    case 'meeting_end':
      return `📝 ${hm}にミーティングを終了しました。${store}`;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.idToken !== 'string' || !body.idToken) {
    return NextResponse.json({ error: 'idToken is required' }, { status: 400, headers: CORS_HEADERS });
  }

  const events: NotifyEvent[] = ['clock_in', 'clock_out', 'meeting_start', 'meeting_end'];
  if (!events.includes(body.event)) {
    return NextResponse.json({ error: 'invalid event' }, { status: 400, headers: CORS_HEADERS });
  }
  if (typeof body.punchedAt !== 'string' || isNaN(new Date(body.punchedAt).getTime())) {
    return NextResponse.json({ error: 'invalid punchedAt' }, { status: 400, headers: CORS_HEADERS });
  }

  // 本人検証（トークンの持ち主にしか送らない）
  const verified = await verifyLiffIdToken(body.idToken);
  if (!verified.ok) {
    return NextResponse.json({ error: `unauthorized: ${verified.error}` }, { status: 401, headers: CORS_HEADERS });
  }

  const text = buildMessage(
    body.event as NotifyEvent,
    jstHM(body.punchedAt),
    typeof body.storeName === 'string' ? body.storeName : '',
    body.overtime === true,
    body.report && typeof body.report === 'object' ? (body.report as ReportPayload) : null,
  );

  const pushed = await pushLineMessage(verified.userId, text);
  if (!pushed.ok) {
    return NextResponse.json({ error: pushed.error }, { status: 502, headers: CORS_HEADERS });
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
