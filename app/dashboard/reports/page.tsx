'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase, AttendanceLog, Store } from '@/lib/supabase';

// ── 定数 ────────────────────────────────────────────────
const STATUS_CONFIG = {
  unread:  { label: '未確認',   bg: '#f0f0f0', color: '#888',    border: '#e0e0e0' },
  checked: { label: '確認済み', bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
} as const;
type StatusKey = keyof typeof STATUS_CONFIG;
type TabFilter = 'all' | StatusKey;

const REPORT_TYPE_CONFIG = {
  daily:  { label: '毎日実績', bg: '#EAF3DE', color: '#3B6D11' },
  review: { label: '振り返り', bg: '#dbeafe', color: '#1d4ed8' },
  goal:   { label: '月初目標', bg: '#f3e8ff', color: '#7c3aed' },
} as const;

// ── スタイル ─────────────────────────────────────────────
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e8e8e4', borderRadius: '12px', overflow: 'hidden' };
const thS: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: '#888', fontWeight: 500, letterSpacing: '0.04em', borderBottom: '1px solid #e8e8e4', background: '#fafaf8' };
const tdS: React.CSSProperties = { padding: '11px 14px', fontSize: '13px', color: '#1a1a1a', borderBottom: '1px solid #f0f0ec', verticalAlign: 'middle' };
const sel: React.CSSProperties = { padding: '6px 10px', border: '1px solid #ddd', borderRadius: '7px', fontSize: '13px', background: '#fff', outline: 'none' };
const detailCell: React.CSSProperties = { padding: '6px 12px', fontSize: '12px', color: '#555', borderBottom: '1px solid #f0f0ec', whiteSpace: 'nowrap' };

// ── 型 ──────────────────────────────────────────────────
type DatePick = { year: string; month: string; day: string };

// ── ヘルパー ─────────────────────────────────────────────
function toISO(p: DatePick, end = false): string {
  const y = p.year || String(new Date().getFullYear());
  const m = p.month || (end ? '12' : '01');
  const d = p.day || (end ? String(new Date(Number(y), Number(m), 0).getDate()) : '01');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}${end ? 'T23:59:59' : 'T00:00:00'}`;
}

function fromDate(iso: string): DatePick {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return { year: y, month: m, day: d };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
}

function getStatus(log: AttendanceLog): StatusKey {
  if (log.report_status === 'checked') return 'checked';
  return 'unread';
}

function ReportTypeBadge({ type }: { type: string | null | undefined }) {
  const cfg = REPORT_TYPE_CONFIG[type as keyof typeof REPORT_TYPE_CONFIG]
    || { label: '毎日実績', bg: '#EAF3DE', color: '#3B6D11' };
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 500, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

// ── 日付ピッカー ──────────────────────────────────────────
function DatePicker({ value, onChange, label }: { value: DatePick; onChange: (v: DatePick) => void; label?: string }) {
  const curYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(curYear - i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const days = useMemo(() => {
    if (!value.year || !value.month) return Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
    const n = new Date(Number(value.year), Number(value.month), 0).getDate();
    return Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, '0'));
  }, [value.year, value.month]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      {label && <span style={{ fontSize: '12px', color: '#888', marginRight: '2px' }}>{label}</span>}
      <select value={value.year} onChange={e => onChange({ year: e.target.value, month: value.month, day: value.day })} style={{ ...sel, width: '80px' }}>
        {years.map(y => <option key={y} value={y}>{y}年</option>)}
      </select>
      <select value={value.month} onChange={e => onChange({ ...value, month: e.target.value, day: '' })} style={{ ...sel, width: '62px' }} disabled={!value.year}>
        <option value="">月</option>
        {months.map(m => <option key={m} value={m}>{Number(m)}月</option>)}
      </select>
      <select value={value.day} onChange={e => onChange({ ...value, day: e.target.value })} style={{ ...sel, width: '62px' }} disabled={!value.month}>
        <option value="">日</option>
        {days.map(d => <option key={d} value={d}>{Number(d)}日</option>)}
      </select>
    </div>
  );
}

// ── 毎日実績テーブル ──────────────────────────────────────
function DailyFactTable({ log }: { log: AttendanceLog }) {
  const subTotal = (log.fact_sub_15 ?? 0) + (log.fact_sub_13 ?? 0) + (log.fact_sub_11 ?? 0);
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#3B6D11', marginBottom: '6px', letterSpacing: '0.05em' }}>TODAY&apos;S FACT</div>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
        <tbody>
          <tr><td style={detailCell}>新規コース契約</td><td style={{ ...detailCell, fontWeight: 600 }}>{log.fact_new_course ?? 0} 件</td></tr>
          <tr>
            <td style={detailCell}>新規サブスク（合計）</td>
            <td style={{ ...detailCell, fontWeight: 600 }}>{subTotal} 件
              <span style={{ fontWeight: 400, color: '#888', marginLeft: '6px' }}>
                （15,000円: {log.fact_sub_15 ?? 0} / 13,000円: {log.fact_sub_13 ?? 0} / 11,000円: {log.fact_sub_11 ?? 0}）
              </span>
            </td>
          </tr>
          <tr><td style={detailCell}>既存顧客来店</td><td style={{ ...detailCell, fontWeight: 600 }}>{log.fact_existing_customers ?? 0} 件</td></tr>
          <tr><td style={detailCell}>店販購入</td><td style={{ ...detailCell, fontWeight: 600 }}>{log.fact_shop_sales ?? 0} 件</td></tr>
          <tr><td style={detailCell}>個人総売上</td><td style={{ ...detailCell, fontWeight: 600 }}>{(log.fact_total_revenue ?? 0).toLocaleString('ja-JP')} 円</td></tr>
        </tbody>
      </table>
    </div>
  );
}

// ── メインページ ──────────────────────────────────────────
export default function ReportsPage() {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState<DatePick>(fromDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString()));
  const [dateTo, setDateTo] = useState<DatePick>(fromDate(now.toISOString()));
  const [filterStore, setFilterStore] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [filterType, setFilterType] = useState('');
  const [tabFilter, setTabFilter] = useState<TabFilter>('all');
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [storeList, setStoreList] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: storeData }, { data: logData }] = await Promise.all([
      supabase.from('stores').select('*').order('name'),
      supabase
        .from('attendance_logs')
        .select('*, staff(*), store:stores(*)')
        .gte('punched_at', toISO(dateFrom))
        .lte('punched_at', toISO(dateTo, true))
        .not('report_type', 'is', null)
        .order('punched_at', { ascending: false }),
    ]);
    setStoreList((storeData as Store[]) || []);
    setLogs((logData as AttendanceLog[]) || []);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const staffOptions = useMemo(() => {
    const map = new Map<number, string>();
    const src = filterStore
      ? logs.filter(l => String(l.store?.id ?? l.staff?.stores?.id) === filterStore)
      : logs;
    src.forEach(l => { if (!map.has(l.staff_id)) map.set(l.staff_id, l.staff?.name || `#${l.staff_id}`); });
    return Array.from(map.entries());
  }, [logs, filterStore]);

  const filteredLogs = useMemo(() => logs.filter(l => {
    if (filterStore && String(l.store?.id ?? l.staff?.stores?.id) !== filterStore) return false;
    if (filterStaff && String(l.staff_id) !== filterStaff) return false;
    if (filterType && l.report_type !== filterType) return false;
    return true;
  }), [logs, filterStore, filterStaff, filterType]);

  const counts = useMemo(() => ({
    all:     filteredLogs.length,
    unread:  filteredLogs.filter(l => getStatus(l) === 'unread').length,
    checked: filteredLogs.filter(l => getStatus(l) === 'checked').length,
  }), [filteredLogs]);

  const reportLogs = useMemo(() =>
    tabFilter === 'all' ? filteredLogs : filteredLogs.filter(l => getStatus(l) === tabFilter),
    [filteredLogs, tabFilter]);

  const handleConfirm = async (log: AttendanceLog) => {
    if (getStatus(log) !== 'unread') return;
    setUpdatingId(log.id);
    await supabase.from('attendance_logs').update({ report_status: 'checked' }).eq('id', log.id);
    setLogs(prev => prev.map(l => l.id === log.id ? { ...l, report_status: 'checked' } : l));
    setUpdatingId(null);
  };

  const handleStoreChange = (v: string) => { setFilterStore(v); setFilterStaff(''); };

  const tabLabels: Record<TabFilter, string> = {
    all:     `全件 (${counts.all})`,
    unread:  `未確認 (${counts.unread})`,
    checked: `確認済み (${counts.checked})`,
  };

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* ヘッダー */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 500 }}>日報</h1>
          <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>毎日実績・振り返り・月初目標の確認ができます</p>
        </div>
        <button
          onClick={() => window.print()}
          style={{ padding: '7px 16px', border: '1px solid #ddd', borderRadius: '7px', background: '#fff', fontSize: '13px', color: '#555', cursor: 'pointer' }}
        >
          PDF出力
        </button>
      </div>

      {/* 検索バー */}
      <div className="no-print" style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <DatePicker value={dateFrom} onChange={setDateFrom} label="期間" />
          <span style={{ fontSize: '12px', color: '#888' }}>〜</span>
          <DatePicker value={dateTo} onChange={setDateTo} />
          <select value={filterStore} onChange={e => handleStoreChange(e.target.value)} style={{ ...sel, width: '130px' }}>
            <option value="">店舗</option>
            {storeList.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
          <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} style={{ ...sel, width: '130px' }}>
            <option value="">スタッフ</option>
            {staffOptions.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...sel, width: '130px' }}>
            <option value="">日報種別</option>
            <option value="daily">毎日実績</option>
            <option value="review">振り返り</option>
            <option value="goal">月初目標</option>
          </select>
          <button onClick={fetchData} style={{ marginLeft: 'auto', padding: '7px 20px', background: '#3B6D11', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
            検索
          </button>
        </div>
      </div>

      {/* ステータスタブ */}
      <div className="no-print" style={{ display: 'flex', gap: '2px', marginBottom: '16px', borderBottom: '1px solid #e8e8e4' }}>
        {(['all', 'unread', 'checked'] as TabFilter[]).map(t => (
          <button
            key={t}
            onClick={() => setTabFilter(t)}
            style={{
              padding: '8px 18px', border: 'none', background: 'transparent', fontSize: '13px', cursor: 'pointer',
              color: tabFilter === t ? '#3B6D11' : '#888',
              fontWeight: tabFilter === t ? 600 : 400,
              borderBottom: tabFilter === t ? '2px solid #3B6D11' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {/* メインテーブル */}
      <div className="no-print" style={card}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>読み込み中...</div>
        ) : reportLogs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>該当する日報がありません</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thS}>日付</th>
                <th style={thS}>店舗</th>
                <th style={thS}>スタッフ</th>
                <th style={{ ...thS, textAlign: 'center' }}>種別</th>
                <th style={{ ...thS, textAlign: 'center' }}>ステータス</th>
                <th style={{ ...thS, textAlign: 'center', width: '56px' }}>▼</th>
              </tr>
            </thead>
            <tbody>
              {reportLogs.map(log => {
                const status = getStatus(log);
                const cfg = STATUS_CONFIG[status];
                const expanded = expandedId === log.id;
                const storeName = log.store?.name || log.staff?.stores?.name || '—';
                const staffName = log.staff?.name || `#${log.staff_id}`;
                const isUpdating = updatingId === log.id;

                return (
                  <>
                    <tr key={log.id} style={{ background: expanded ? '#fafaf8' : 'transparent' }}>
                      <td style={tdS}><span style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{fmtDate(log.punched_at)}</span></td>
                      <td style={{ ...tdS, color: '#666', fontSize: '12px' }}>{storeName}</td>
                      <td style={{ ...tdS, fontWeight: 500 }}>{staffName}</td>
                      <td style={{ ...tdS, textAlign: 'center' }}>
                        <ReportTypeBadge type={log.report_type} />
                      </td>
                      <td style={{ ...tdS, textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 500, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ ...tdS, textAlign: 'center' }}>
                        <button
                          onClick={() => setExpandedId(prev => prev === log.id ? null : log.id)}
                          style={{ padding: '3px 10px', border: '1px solid #ddd', borderRadius: '5px', background: '#fff', color: '#555', fontSize: '11px', cursor: 'pointer' }}
                        >
                          {expanded ? '▲' : '▼'}
                        </button>
                      </td>
                    </tr>

                    {expanded && (
                      <tr key={log.id + '_detail'}>
                        <td colSpan={6} style={{ padding: '16px', background: '#fafaf8', borderBottom: '1px solid #e8e8e4' }}>

                          {/* 毎日実績（全種別共通） */}
                          <DailyFactTable log={log} />

                          {/* 振り返り（review種別 or 振り返りデータが存在する場合） */}
                          {(log.report_type === 'review' || log.review_good_1 || log.review_good_2 || log.review_good_3 || log.review_obstacle || log.review_question || log.review_action_plan) && (
                            <div style={{ marginBottom: '14px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: '#1d4ed8', marginBottom: '8px', letterSpacing: '0.05em' }}>REVIEW</div>
                              {[
                                { label: '上手くできたこと①', value: log.review_good_1 },
                                { label: '上手くできたこと②', value: log.review_good_2 },
                                { label: '上手くできたこと③', value: log.review_good_3 },
                                { label: '達成の障害・懸念', value: log.review_obstacle },
                                { label: '問いの転換', value: log.review_question },
                                { label: 'アクションプラン', value: log.review_action_plan },
                              ].map(({ label, value }) => (
                                <div key={label} style={{ marginBottom: '10px', background: '#fff', border: '1px solid #e8e8e4', borderRadius: '7px', padding: '10px 12px' }}>
                                  <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px', fontWeight: 600 }}>{label}</div>
                                  <div style={{ fontSize: '13px', color: value ? '#1a1a1a' : '#ccc', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{value || '（未記入）'}</div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 月初目標（goal種別 or 目標データが存在する場合） */}
                          {(log.report_type === 'goal' || log.monthly_goal) && (
                            <div style={{ marginBottom: '14px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: '#7c3aed', marginBottom: '8px', letterSpacing: '0.05em' }}>MONTHLY GOAL</div>
                              <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '7px', padding: '12px 14px', fontSize: '13px', color: '#1a1a1a', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                                {log.monthly_goal || '（未記入）'}
                              </div>
                            </div>
                          )}

                          {/* 操作ボタン */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                            {status === 'unread' && (
                              <button
                                onClick={() => handleConfirm(log)}
                                disabled={isUpdating}
                                style={{ padding: '6px 18px', border: '1px solid #bfdbfe', borderRadius: '7px', background: '#dbeafe', color: '#1d4ed8', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                              >
                                {isUpdating ? '...' : '✓ 確認済みにする'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 印刷用 */}
      <div className="print-only" style={{ display: 'none' }}>
        <div className="print-container">
          <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>ELAN MARIRE</p>
          <h1 className="print-title">日報レポート</h1>
          <p className="print-subtitle">出力日時：{now.toLocaleString('ja-JP')}</p>
          {filteredLogs.map(log => {
            const storeName = log.store?.name || log.staff?.stores?.name || '—';
            const subTotal = (log.fact_sub_15 ?? 0) + (log.fact_sub_13 ?? 0) + (log.fact_sub_11 ?? 0);
            return (
              <div key={log.id} style={{ marginBottom: '28px', pageBreakInside: 'avoid' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid #ccc', fontSize: '13px', fontWeight: 600 }}>
                  <span>{fmtDate(log.punched_at)}</span>
                  <span>{log.staff?.name}</span>
                  <span>{storeName}</span>
                  <span>{REPORT_TYPE_CONFIG[log.report_type as keyof typeof REPORT_TYPE_CONFIG]?.label ?? '毎日実績'}</span>
                </div>
                <div className="print-report" style={{ fontSize: '12px', lineHeight: 1.8 }}>
                  <strong>新規コース:{log.fact_new_course ?? 0}件 サブスク:{subTotal}件 既存:{log.fact_existing_customers ?? 0}件 店販:{log.fact_shop_sales ?? 0}件 売上:{(log.fact_total_revenue ?? 0).toLocaleString('ja-JP')}円</strong>
                </div>
                {log.report_type === 'review' && (
                  <div style={{ marginTop: '8px', fontSize: '12px', lineHeight: 1.8 }}>
                    <div><strong>【上手くできたこと①】</strong>{log.review_good_1}</div>
                    <div><strong>【上手くできたこと②】</strong>{log.review_good_2}</div>
                    <div><strong>【上手くできたこと③】</strong>{log.review_good_3}</div>
                    <div><strong>【障害・懸念】</strong>{log.review_obstacle}</div>
                    <div><strong>【問いの転換】</strong>{log.review_question}</div>
                    <div><strong>【アクションプラン】</strong>{log.review_action_plan}</div>
                  </div>
                )}
                {log.report_type === 'goal' && (
                  <div style={{ marginTop: '8px', fontSize: '12px', lineHeight: 1.8 }}>
                    <strong>【今月の目標】</strong>{log.monthly_goal}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
