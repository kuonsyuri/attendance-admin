// 日付ピッカー用の年月日タプルと ISO 変換（複数ページ共通）

export type DatePick = { year: string; month: string; day: string };

/** DatePick を ISO 文字列に変換。end=true で期間終端（23:59:59・月末日補完）。 */
export function toISO(p: DatePick, end = false): string {
  const y = p.year || String(new Date().getFullYear());
  const m = p.month || (end ? '12' : '01');
  const d = p.day || (end ? String(new Date(Number(y), Number(m), 0).getDate()) : '01');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}${end ? 'T23:59:59' : 'T00:00:00'}`;
}

/** ISO 文字列（先頭10文字）から DatePick を生成。 */
export function fromDate(iso: string): DatePick {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return { year: y, month: m, day: d };
}
