'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase, AttendanceLog, Store } from '@/lib/supabase';

// ── 定数 ────────────────────────────────────────────────
const STATUS_CONFIG = {
  unread:  { label: '未確認',  bg: '#f0f0f0', color: '#888',    border: '#e0e0e0' },
  checked: { label: '確認済み', bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
  adopted: { label: '採用済み', bg: '#EAF3DE', color: '#3B6D11', border: '#c3e0a0' },
} as const;
type StatusKey = keyof typeof STATUS_CONFIG;
type TabFilter = 'all' | StatusKey;

// ── スタイル ─────────────────────────────────────────────
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e8e8e4', borderRadius: '12px', overflow: 'hidden' };
const thS: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: '#888', fontWeight: 500, letterSpacing: '0.04em', borderBottom: '1px solid #e8e8e4', background: '#fafaf8' };
const tdS: React.CSSProperties = { padding: '11px 14px', fontSize: '13px', color: '#1a1a1a', borderBottom: '1px solid #f0f0ec', verticalAlign: 'middle' };
const sel: React.CSSProperties = { padding: '6px 10px', border: '1px solid #ddd', borderRadius: '7px', fontSize: '13px', background: '#fff', outline: 'none' };

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
  if (log.report_status === 'adopted') return 'adopted';
  if (log.report_status === 'checked') return 'checked';
  return 'unread';
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

// ── メインページ ──────────────────────────────────────────
export default function ReportsPage() {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState<DatePick>(fromDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString()));
  const [dateTo, setDateTo] = useState<DatePick>(fromDate(now.toISOString()));
  const [filterStore, setFilterStore] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
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
        .or('report_fact.not.is.null,report_think.not.is.null,report_action.not.is.null,report_request.not.is.null')
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

  // 店舗・スタッフフィルター適用後（タブ適用前）
  const filteredLogs = useMemo(() => logs.filter(l => {
    if (filterStore && String(l.store?.id ?? l.staff?.stores?.id) !== filterStore) return false;
    if (filterStaff && String(l.staff_id) !== filterStaff) return false;
    return true;
  }), [logs, filterStore, filterStaff]);

  // タブ件数（店舗・スタッフフィルター後）
  const counts = useMemo(() => ({
    all: filteredLogs.length,
    unread: filteredLogs.filter(l => getStatus(l) === 'unread').length,
    checked: filteredLogs.filter(l => getStatus(l) === 'checked').length,
    adopted: filteredLogs.filter(l => getStatus(l) === 'adopted').length,
  }), [filteredLogs]);

  // タブフィルター適用
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

  const handleAdopt = async (log: AttendanceLog) => {
    if (log.report_status === 'adopted') return;
    if (!confirm('本当に採用しますか？')) return;
    setUpdatingId(log.id);
    const adoptedAt = new Date().toISOString();
    await supabase.from('attendance_logs')
      .update({ report_status: 'adopted', is_adopted: true, adopted_at: adoptedAt })
      .eq('id', log.id);
    setLogs(prev => prev.map(l => l.id === log.id ? { ...l, report_status: 'adopted', is_adopted: true, adopted_at: adoptedAt } : l));
    setUpdatingId(null);
  };

  const handleStoreChange = (v: string) => { setFilterStore(v); setFilterStaff(''); };

  const tabLabels: Record<TabFilter, string> = {
    all: `全件 (${counts.all})`,
    unread: `未確認 (${counts.unread})`,
    checked: `確認済み (${counts.checked})`,
    adopted: `採用済み (${counts.adopted})`,
  };

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* ヘッダー */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 500 }}>日報</h1>
          <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>FTA-R形式の日報確認・採用管理</p>
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
          <button onClick={fetchData} style={{ marginLeft: 'auto', padding: '7px 20px', background: '#3B6D11', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
            検索
          </button>
        </div>
      </div>

      {/* ステータスタブ */}
      <div className="no-print" style={{ display: 'flex', gap: '2px', marginBottom: '16px', borderBottom: '1px solid #e8e8e4' }}>
        {(['all', 'unread', 'checked', 'adopted'] as TabFilter[]).map(t => (
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

      {/* メインテーブル（画面表示） */}
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
                        <td colSpan={5} style={{ padding: '0 16px 16px', background: '#fafaf8', borderBottom: '1px solid #e8e8e4' }}>
                          {/* FTA-R 4セクション */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', paddingTop: '12px' }}>
                            {[
                              { label: 'Fact', value: log.report_fact },
                              { label: 'Think', value: log.report_think },
                              { label: 'Action', value: log.report_action },
                              { label: 'Request / Share', value: log.report_request },
                            ].map(({ label, value }) => (
                              <div key={label} style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px', padding: '10px 12px' }}>
                                <div style={{ fontSize: '10px', color: '#3B6D11', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
                                <div style={{ fontSize: '13px', color: value ? '#1a1a1a' : '#ccc', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{value || '（未記入）'}</div>
                              </div>
                            ))}
                          </div>

                          {/* 操作ボタン */}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                            {status === 'unread' && (
                              <button
                                onClick={() => handleConfirm(log)}
                                disabled={isUpdating}
                                style={{ padding: '6px 16px', border: '1px solid #bfdbfe', borderRadius: '7px', background: '#dbeafe', color: '#1d4ed8', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                              >
                                {isUpdating ? '...' : '確認'}
                              </button>
                            )}
                            {status !== 'adopted' && (
                              <button
                                onClick={() => handleAdopt(log)}
                                disabled={isUpdating}
                                style={{ padding: '6px 16px', border: '1px solid #c3e0a0', borderRadius: '7px', background: '#EAF3DE', color: '#3B6D11', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                              >
                                {isUpdating ? '...' : '採用'}
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

      {/* 印刷用テンプレート（PDF出力時のみ表示） */}
      <div className="print-only" style={{ display: 'none' }}>
        <div className="print-container">
          <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>ELAN MARIRE</p>
          <h1 className="print-title">日報レポート</h1>
          <p className="print-subtitle">出力日時：{now.toLocaleString('ja-JP')}</p>
          {filteredLogs.map(log => {
            const storeName = log.store?.name || log.staff?.stores?.name || '—';
            return (
              <div key={log.id} style={{ marginBottom: '28px', pageBreakInside: 'avoid' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid #ccc', fontSize: '13px', fontWeight: 600 }}>
                  <span>{fmtDate(log.punched_at)}</span>
                  <span>{log.staff?.name}</span>
                  <span>{storeName}</span>
                </div>
                {[
                  { label: 'Fact', value: log.report_fact },
                  { label: 'Think', value: log.report_think },
                  { label: 'Action', value: log.report_action },
                  { label: 'Request / Share', value: log.report_request },
                ].map(({ label, value }) => value ? (
                  <div key={label} style={{ marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#555' }}>{label}</span>
                    <div className="print-report" style={{ marginTop: '4px' }}>{value}</div>
                  </div>
                ) : null)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
