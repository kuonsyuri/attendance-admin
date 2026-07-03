// ─────────────────────────────────────────────────────────────
// デザイントークン（単一定義）
//
// 各ページに散在していたスタイル定数（card/th/td/sel/input/label…名前揺れ含む）を
// ここに集約する。ページ側での再定義を禁止し、見た目の変更はこのファイルだけで行う。
// 値は既存実装の多数派に統一（標準化を優先し、数px差は吸収）。
// ─────────────────────────────────────────────────────────────

export const colors = {
  brand: '#3B6D11',        // ブランド緑（主ボタン・アクティブ）
  brandDark: '#27500A',    // hover
  brandBg: '#EAF3DE',      // 淡緑（バッジ・選択背景）
  brandBorder: '#b8d89a',
  danger: '#c0392b',       // 削除・退勤
  text: '#1a1a1a',
  textSub: '#555',
  textMuted: '#888',
  border: '#e8e8e4',
  borderLight: '#f0f0ec',
  inputBorder: '#ddd',
  bgPage: '#f5f5f3',
  bgSubtle: '#fafaf8',
};

/** 一覧カード（白背景・角丸） */
export const card: React.CSSProperties = { background: '#fff', border: `1px solid ${colors.border}`, borderRadius: '12px', overflow: 'hidden' };

/** テーブルヘッダセル */
export const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: colors.textMuted, fontWeight: 500, letterSpacing: '0.04em', borderBottom: `1px solid ${colors.border}`, background: colors.bgSubtle, whiteSpace: 'nowrap' };

/** テーブルデータセル */
export const td: React.CSSProperties = { padding: '10px 12px', fontSize: '13px', color: colors.text, borderBottom: `1px solid ${colors.borderLight}`, verticalAlign: 'middle' };

/** 検索バー等のセレクト */
export const sel: React.CSSProperties = { padding: '6px 10px', border: `1px solid ${colors.inputBorder}`, borderRadius: '7px', fontSize: '13px', background: '#fff', outline: 'none' };

/** フォーム入力 */
export const input: React.CSSProperties = { width: '100%', padding: '9px 12px', border: `1px solid ${colors.inputBorder}`, borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };

/** フォームラベル */
export const label: React.CSSProperties = { display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 500 };

/** 主ボタン（ブランド緑） */
export const btnPrimary: React.CSSProperties = { padding: '8px 18px', background: colors.brand, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' };
