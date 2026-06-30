// ─────────────────────────────────────────────────────────────
// 日報構成定義（single source of truth）
//
// 日報の「構成」をコード上の唯一の定義として集約する。
// 管理画面の表示 / スタッフ入力フォーム / Supabaseカラム の三者が
// 本来この定義から導出されるべき、という構造の起点。
//
// 第一段階: 内部設定での「現状構成の表示」に使用（読み取り専用）。
// 次段階  : この定義を編集・永続化することで日報構成の変更を可能にする。
// ─────────────────────────────────────────────────────────────

export type FieldType = 'number' | 'select' | 'currency' | 'textarea' | 'computed';

export type ReportField = {
  /** 内部識別子 */
  key: string;
  /** Supabase attendance_logs のカラム名（computed は null） */
  column: string | null;
  /** 表示ラベル */
  label: string;
  /** 入力形式 */
  type: FieldType;
  /** 単位（件 / 円 など） */
  unit?: string;
  /** number の下限 */
  min?: number;
  /** number の上限 */
  max?: number;
  /** computed の算出元 key 群（合計など） */
  computedFrom?: string[];
  /** 補足説明 */
  note?: string;
};

export type ReportSection = {
  key: string;
  label: string;
  /** セクション補足（表示条件や注記。例：※新規に入った場合のみ記載） */
  note?: string;
  fields: ReportField[];
};

/** 組み込み既定種別のキー（参考。構成は動的に拡張可能） */
export type ReportTypeKey = 'daily' | 'review' | 'goal';

export type ReportTypeDef = {
  /** 種別識別子。既定は daily/review/goal だが、ユーザー追加の任意キーも許容 */
  key: string;
  label: string;
  /** バッジ配色（reports/page.tsx の REPORT_TYPE_CONFIG と一致） */
  color: { bg: string; color: string };
  /** 表示トリガー（退勤①時にどの条件で出るか） */
  trigger: string;
  sections: ReportSection[];
  /** テキスト入力合計の最低文字数（送信ボタン有効化条件） */
  minChars?: number;
  /** 一度送信したら変更不可か */
  immutable?: boolean;
};

// ── 日報構成（現状） ──────────────────────────────────────────
export const REPORT_SCHEMA: ReportTypeDef[] = [
  {
    key: 'daily',
    label: '毎日実績',
    color: { bg: '#EAF3DE', color: '#3B6D11' },
    trigger: '全営業日（退勤①時）に必ず表示・記録',
    sections: [
      {
        key: 'acquisition',
        label: '新規・サブスク獲得',
        fields: [
          { key: 'fact_new_customers', column: 'fact_new_customers', label: '新規顧客接客件数', type: 'select', unit: '件', min: 0, max: 50 },
          { key: 'fact_ticket_29800', column: 'fact_ticket_29800', label: '新規チケット契約件数', type: 'select', unit: '件', min: 0, max: 50, note: '29,800円' },
          { key: 'fact_sub_total', column: null, label: '新規サブスク契約件数（合計）', type: 'computed', unit: '件', computedFrom: ['fact_sub_15', 'fact_sub_13', 'fact_sub_11'], note: '内訳3項目の自動合計（編集不可）' },
          { key: 'fact_sub_15', column: 'fact_sub_15', label: '└ 15,000円コース', type: 'select', unit: '件', min: 0, max: 50 },
          { key: 'fact_sub_13', column: 'fact_sub_13', label: '└ 13,000円コース', type: 'select', unit: '件', min: 0, max: 50 },
          { key: 'fact_sub_11', column: 'fact_sub_11', label: '└ 11,000円コース', type: 'select', unit: '件', min: 0, max: 50 },
        ],
      },
      {
        key: 'existing',
        label: '既存・店販',
        fields: [
          { key: 'fact_existing_customers', column: 'fact_existing_customers', label: '既存顧客接客件数', type: 'select', unit: '件', min: 0, max: 50 },
          { key: 'fact_shop_sales', column: 'fact_shop_sales', label: '店販（ホームケア商品）販売件数', type: 'select', unit: '件', min: 0, max: 50 },
          { key: 'fact_total_revenue', column: 'fact_total_revenue', label: '本日の個人総売上', type: 'currency', unit: '円', note: 'カンマ自動整形' },
        ],
      },
      {
        key: 'new_reflection',
        label: '新規の振り返り',
        note: '※新規に入った場合のみ記載',
        fields: [
          { key: 'dr_deal_factor', column: 'dr_deal_factor', label: '本日の成約・未成約の要因', type: 'textarea', note: '例：15,000円コースの価値が伝わった、予算面で迷われたなど' },
          { key: 'dr_counseling_improve', column: 'dr_counseling_improve', label: '次回へのカウンセリング改善点', type: 'textarea', note: '例：オープニングでもっとヒアリングをしようと思った' },
          { key: 'dr_progress', column: 'dr_progress', label: '本日上手くできたこと・できるようになったこと（1つ）', type: 'textarea', note: '結果の大小に関わらず、今日1ミリでも前進した事実を書き出す' },
        ],
      },
      {
        key: 'improvement_idea',
        label: 'お客様が喜びそうなアイデア・改善提案',
        note: '※サロンへの反映で一律50円の給与UP対象となります（新規に入った場合のみ記載）',
        fields: [
          { key: 'dr_issue', column: 'dr_issue', label: '現場の課題・アイデア・気づいたこと', type: 'textarea' },
          { key: 'dr_improve_idea', column: 'dr_improve_idea', label: 'それに対する「私なりの改善アイデア」', type: 'textarea', note: '例：〇〇の備品を配置変えすると施術効率が上がる、新規向けポップの作成など' },
        ],
      },
    ],
  },
  {
    key: 'review',
    label: '振り返り',
    color: { bg: '#dbeafe', color: '#1d4ed8' },
    trigger: '15日 または 月末最終営業日（毎日実績に追加して表示）',
    minChars: 100,
    sections: [
      {
        key: 'review',
        label: '振り返り設問',
        fields: [
          { key: 'review_good_1', column: 'review_good_1', label: '本日上手くできたこと ①', type: 'textarea' },
          { key: 'review_good_2', column: 'review_good_2', label: '本日上手くできたこと ②', type: 'textarea' },
          { key: 'review_good_3', column: 'review_good_3', label: '本日上手くできたこと ③', type: 'textarea' },
          { key: 'review_obstacle', column: 'review_obstacle', label: '達成の障害となっている問題・懸念', type: 'textarea' },
          { key: 'review_question', column: 'review_question', label: '問いの転換（どうすれば〜できるか）', type: 'textarea' },
          { key: 'review_action_plan', column: 'review_action_plan', label: '目標達成のための具体的な手段（アクションプラン）', type: 'textarea' },
        ],
      },
    ],
  },
  {
    key: 'goal',
    label: '月初目標',
    color: { bg: '#f3e8ff', color: '#7c3aed' },
    trigger: '当月の月初目標が未登録のとき（初営業日。一度送信で変更不可）',
    minChars: 100,
    immutable: true,
    sections: [
      {
        key: 'goal',
        label: '月初目標',
        fields: [
          { key: 'monthly_goal', column: 'monthly_goal', label: '今月の目標', type: 'textarea', note: 'フォーマット例：「（月日）までに【数字・状態】を達成することによって、【感情】となる」' },
        ],
      },
    ],
  },
];

// ── 入力形式の表示ラベル ──────────────────────────────────────
export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  number: '数値入力',
  select: 'プルダウン選択',
  currency: '金額入力',
  textarea: 'テキスト',
  computed: '自動計算',
};

export function getReportTypeDef(
  key: string | null | undefined,
  schema: ReportTypeDef[] = REPORT_SCHEMA,
): ReportTypeDef | undefined {
  return schema.find(t => t.key === key);
}

// ── 永続化（Supabase app_settings） ───────────────────────────
// テーブル: app_settings (key text PK, value jsonb, updated_at timestamptz)
// 既定値（REPORT_SCHEMA）をシードとし、保存があればそれを正とする。
import { supabase } from './supabase';

export const REPORT_SCHEMA_KEY = 'report_schema';

/** 既定構成のディープコピー（編集用の初期値） */
export function cloneDefaultSchema(): ReportTypeDef[] {
  return JSON.parse(JSON.stringify(REPORT_SCHEMA)) as ReportTypeDef[];
}

/** 保存済み構成を読み込む。未保存・失敗時は既定構成を返す。 */
export async function loadReportSchema(): Promise<ReportTypeDef[]> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', REPORT_SCHEMA_KEY)
      .maybeSingle();
    if (error || !data || !data.value) return cloneDefaultSchema();
    const v = data.value as ReportTypeDef[];
    return Array.isArray(v) && v.length ? v : cloneDefaultSchema();
  } catch {
    return cloneDefaultSchema();
  }
}

/** 構成を保存（upsert）。 */
export async function saveReportSchema(schema: ReportTypeDef[]): Promise<{ error?: string }> {
  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key: REPORT_SCHEMA_KEY, value: schema, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
    return error ? { error: error.message } : {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
