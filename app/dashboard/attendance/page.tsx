'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase, AttendanceLog, Store } from '@/lib/supabase';
import EditAttendanceModal from './EditAttendanceModal';

// ── 定数 ────────────────────────────────────────────────
const AREAS = ['北海道', '東北', '関東', '中部', '近畿', '中国', '四国', '九州', '沖縄'];

const PREFECTURE_TO_AREA: Record<string, string> = {
  北海道: '北海道',
  青森県: '東北', 岩手県: '東北', 宮城県: '東北', 秋田県: '東北', 山形県: '東北', 福島県: '東北',
  茨城県: '関東', 栃木県: '関東', 群馬県: '関東', 埼玉県: '関東', 千葉県: '関東', 東京都: '関東', 神奈川県: '関東',
  新潟県: '中部', 富山県: '中部', 石川県: '中部', 福井県: '中部', 山梨県: '中部', 長野県: '中部', 岐阜県: '中部', 静岡県: '中部', 愛知県: '中部',
  三重県: '近畿', 滋賀県: '近畿', 京都府: '近畿', 大阪府: '近畿', 兵庫県: '近畿', 奈良県: '近畿', 和歌山県: '近畿',
  鳥取県: '中国', 島根県: '中国', 岡山県: '中国', 広島県: '中国', 山口県: '中国',
  徳島県: '四国', 香川県: '四国', 愛媛県: '四国', 高知県: '四国',
  福岡県: '九州', 佐賀県: '九州', 長崎県: '九州', 熊本県: '九州', 大分県: '九州', 宮崎県: '九州', 鹿児島県: '九州',
  沖縄県: '沖縄',
};

// ── スタイル ─────────────────────────────────────────────
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e8e8e4', borderRadius: '12px', overflow: 'hidden' };
const thS: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: '#888', fontWeight: 500, letterSpacing: '0.04em', borderBottom: '1px solid #e8e8e4', background: '#fafaf8', whiteSpace: 'nowrap' };
const tdS: React.CSSProperties = { padding: '10px 12px', fontSize: '13px', color: '#1a1a1a', borderBottom: '1px solid #f0f0ec', verticalAlign: 'middle' };
const sel: React.CSSProperties = { padding: '6px 10px', border: '1px solid #ddd', borderRadius: '7px', fontSize: '13px', background: '#fff', outline: 'none' };

// ── 型 ──────────────────────────────────────────────────
type DatePick = { year: string; month: string; day: string };

type DayGroup = {
  key: string;
  date: string;
  staffId: number;
  staffName: string;
  storeName: string;
  storeId: number | null;
  storePref: string | null;
  storeArea: string | null;
  logs: AttendanceLog[];
  clockIn?: AttendanceLog;
  clockOuts: AttendanceLog[];
  mtgStarts: AttendanceLog[];
  mtgEnds: AttendanceLog[];
  mtgMinutes: number;
  workMinutes: number;
  reportLog?: AttendanceLog;
  reportStatus: string | null;
};

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

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
}

function fmtMtg(min: number) {
  return min > 0 ? `${(min / 60).toFixed(2)}時間` : '—';
}

function buildGroups(logs: AttendanceLog[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  const order: string[] = [];
  for (const log of [...logs].sort((a, b) => a.punched_at.localeCompare(b.punched_at))) {
    const date = log.punched_at.slice(0, 10);
    const key = `${date}_${log.staff_id}`;
    if (!map.has(key)) {
      order.push(key);
      map.set(key, {
        key, date,
        staffId: log.staff_id,
        staffName: log.staff?.name || `#${log.staff_id}`,
        storeName: log.store?.name || log.staff?.stores?.name || '—',
        storeId: log.store?.id ?? log.staff?.stores?.id ?? null,
        storePref: log.store?.prefecture ?? log.staff?.stores?.prefecture ?? null,
        storeArea: log.store?.area ?? log.staff?.stores?.area ?? null,
        logs: [], clockOuts: [], mtgStarts: [], mtgEnds: [],
        mtgMinutes: 0, workMinutes: 0, reportStatus: null,
      });
    }
    const g = map.get(key)!;
    g.logs.push(log);
    if (log.type === 'clock_in') g.clockIn = log;
    if (log.type === 'clock_out') g.clockOuts.push(log);
    if (log.type === 'meeting_start') g.mtgStarts.push(log);
    if (log.type === 'meeting_end') g.mtgEnds.push(log);
    if (log.report_type != null) {
      g.reportLog = log;
      g.reportStatus = log.report_status;
    }
  }
  for (const g of Array.from(map.values())) {
    const ends = [...g.mtgEnds].sort((a, b) => a.punched_at.localeCompare(b.punched_at));
    const starts = [...g.mtgStarts].sort((a, b) => a.punched_at.localeCompare(b.punched_at));
    g.mtgMinutes = starts.reduce((sum, s, i) => {
      const e = ends[i];
      if (!e) return sum;
      const diff = new Date(e.punched_at).getTime() - new Date(s.punched_at).getTime();
      return sum + (diff > 0 ? Math.round(diff / 60000) : 0);
    }, 0);
    if (g.clockIn && g.clockOuts.length > 0) {
      const last = g.clockOuts[g.clockOuts.length - 1];
      g.workMinutes = Math.max(0, Math.round((new Date(last.punched_at).getTime() - new Date(g.clockIn.punched_at).getTime()) / 60000));
    }
  }
  return order.map(k => map.get(k)!).reverse();
}

// ── 階層型日付ピッカー ────────────────────────────────────
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
export default function AttendancePage() {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState<DatePick>(fromDate(new Date(now.getTime() - 7 * 86400000).toISOString()));
  const [dateTo, setDateTo] = useState<DatePick>(fromDate(now.toISOString()));
  const [filterArea, setFilterArea] = useState('');
  const [filterPref, setFilterPref] = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [filterMtg, setFilterMtg] = useState('');
  const [filterHours, setFilterHours] = useState('');
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [storeList, setStoreList] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [editGroup, setEditGroup] = useState<DayGroup | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: storeData }, { data: logData }] = await Promise.all([
      supabase.from('stores').select('*').order('name'),
      supabase
        .from('attendance_logs')
        .select('*, staff(*), store:stores(*)')
        .gte('punched_at', toISO(dateFrom))
        .lte('punched_at', toISO(dateTo, true))
        .order('punched_at', { ascending: false }),
    ]);
    setStoreList((storeData as Store[]) || []);
    setLogs((logData as AttendanceLog[]) || []);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // カスケード選択肢
  const prefsByArea = useMemo(() =>
    filterArea ? Object.entries(PREFECTURE_TO_AREA).filter(([, a]) => a === filterArea).map(([p]) => p) : [],
    [filterArea]);

  const filteredStores = useMemo(() =>
    storeList.filter(s =>
      (!filterArea || s.area === filterArea) && (!filterPref || s.prefecture === filterPref)
    ), [storeList, filterArea, filterPref]);

  const allGroups = useMemo(() => buildGroups(logs), [logs]);

  const staffOptions = useMemo(() => {
    const map = new Map<number, string>();
    const src = filterStore ? allGroups.filter(g => String(g.storeId) === filterStore) : allGroups;
    src.forEach(g => { if (!map.has(g.staffId)) map.set(g.staffId, g.staffName); });
    return Array.from(map.entries());
  }, [allGroups, filterStore]);

  const groups = useMemo(() => allGroups.filter(g => {
    if (filterArea && g.storeArea !== filterArea) return false;
    if (filterPref && g.storePref !== filterPref) return false;
    if (filterStore && String(g.storeId) !== filterStore) return false;
    if (filterStaff && String(g.staffId) !== filterStaff) return false;
    if (filterMtg !== '') {
      const n = Number(filterMtg);
      if (n >= 5 ? g.mtgStarts.length < 5 : g.mtgStarts.length !== n) return false;
    }
    if (filterHours !== '' && g.workMinutes < Number(filterHours) * 60) return false;
    return true;
  }), [allGroups, filterArea, filterPref, filterStore, filterStaff, filterMtg, filterHours]);

  const summary = useMemo(() => ({
    logCount: groups.reduce((s, g) => s + g.logs.length, 0),
    storeCount: new Set(groups.map(g => g.storeId).filter(Boolean)).size,
    staffCount: new Set(groups.map(g => g.staffId)).size,
    reportCount: groups.filter(g => g.reportLog).length,
    mtgTotal: groups.reduce((s, g) => s + g.mtgStarts.length, 0),
  }), [groups]);

  const handleConfirm = async (g: DayGroup) => {
    if (!g.reportLog || g.reportStatus === 'checked') return;
    setUpdatingId(g.reportLog.id);
    await supabase.from('attendance_logs').update({ report_status: 'checked' }).eq('id', g.reportLog.id);
    setLogs(prev => prev.map(l => l.id === g.reportLog!.id ? { ...l, report_status: 'checked' } : l));
    setUpdatingId(null);
  };

  const handleAreaChange = (v: string) => { setFilterArea(v); setFilterPref(''); setFilterStore(''); setFilterStaff(''); };
  const handlePrefChange = (v: string) => { setFilterPref(v); setFilterStore(''); setFilterStaff(''); };
  const handleStoreChange = (v: string) => { setFilterStore(v); setFilterStaff(''); };

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 500 }}>出退勤ログ</h1>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>期間・店舗・スタッフで絞り込み、日報を確認できます</p>
      </div>

      {/* 検索バー */}
      <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <DatePicker value={dateFrom} onChange={setDateFrom} label="期間" />
          <span style={{ fontSize: '12px', color: '#888' }}>〜</span>
          <DatePicker value={dateTo} onChange={setDateTo} />
          <select value={filterArea} onChange={e => handleAreaChange(e.target.value)} style={{ ...sel, width: '100px' }}>
            <option value="">エリア</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filterPref} onChange={e => handlePrefChange(e.target.value)} style={{ ...sel, width: '120px' }} disabled={!filterArea}>
            <option value="">都道府県</option>
            {prefsByArea.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterStore} onChange={e => handleStoreChange(e.target.value)} style={{ ...sel, width: '130px' }}>
            <option value="">店舗</option>
            {filteredStores.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
          <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} style={{ ...sel, width: '130px' }}>
            <option value="">スタッフ</option>
            {staffOptions.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
          </select>
          <select value={filterMtg} onChange={e => setFilterMtg(e.target.value)} style={{ ...sel, width: '110px' }}>
            <option value="">MTG回数</option>
            {[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={String(n)}>{n === 5 ? '5回以上' : `${n}回`}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input type="number" min={0} placeholder="稼働" value={filterHours} onChange={e => setFilterHours(e.target.value)} style={{ ...sel, width: '64px' }} />
            <span style={{ fontSize: '12px', color: '#888' }}>時間以上</span>
          </div>
          <button onClick={fetchData} style={{ marginLeft: 'auto', padding: '7px 20px', background: '#3B6D11', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
            検索
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { label: 'ログ件数', value: `${summary.logCount}件` },
          { label: '店舗数', value: `${summary.storeCount}店舗` },
          { label: 'スタッフ数', value: `${summary.staffCount}名` },
          { label: '日報件数', value: `${summary.reportCount}件` },
          { label: 'MTG回数', value: `${summary.mtgTotal}回` },
        ].map(c => (
          <div key={c.label} style={{ background: '#fafaf8', border: '1px solid #e8e8e4', borderRadius: '8px', padding: '10px 16px', minWidth: '96px' }}>
            <div style={{ fontSize: '11px', color: '#888' }}>{c.label}</div>
            <div style={{ fontSize: '16px', fontWeight: 500 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* メインテーブル */}
      <div style={card}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>読み込み中...</div>
        ) : groups.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>該当するログがありません</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '960px' }}>
              <thead>
                <tr>
                  <th style={thS}>日付</th>
                  <th style={thS}>スタッフ</th>
                  <th style={thS}>店舗</th>
                  <th style={{ ...thS, textAlign: 'center', color: '#3B6D11' }}>出勤</th>
                  <th style={{ ...thS, textAlign: 'center', color: '#c0392b' }}>退勤</th>
                  <th style={{ ...thS, textAlign: 'center' }}>残業</th>
                  <th style={{ ...thS, textAlign: 'center' }}>MTG回</th>
                  <th style={{ ...thS, textAlign: 'center' }}>MTG時間</th>
                  <th style={{ ...thS, textAlign: 'center' }}>日報</th>
                  <th style={{ ...thS, textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => {
                  const expanded = expandedKey === g.key;
                  const clockOut1 = g.clockOuts[0];
                  const clockOut2 = g.clockOuts[1];
                  const hasRep = g.reportLog?.report_type != null;
                  const isChecked = g.reportStatus === 'checked';
                  return (
                    <>
                      <tr key={g.key}>
                        <td style={tdS}><span style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{fmtDate(g.date)}</span></td>
                        <td style={{ ...tdS, fontWeight: 500 }}>{g.staffName}</td>
                        <td style={{ ...tdS, color: '#666', fontSize: '12px' }}>{g.storeName}</td>
                        <td style={{ ...tdS, textAlign: 'center' }}>
                          {g.clockIn ? <span style={{ color: '#3B6D11', fontWeight: 500 }}>{fmtTime(g.clockIn.punched_at)}</span> : <span style={{ color: '#ccc' }}>—</span>}
                        </td>
                        <td style={{ ...tdS, textAlign: 'center' }}>
                          {clockOut1 ? <span style={{ color: '#c0392b', fontWeight: 500 }}>{fmtTime(clockOut1.punched_at)}</span> : <span style={{ color: '#ccc' }}>—</span>}
                        </td>
                        <td style={{ ...tdS, textAlign: 'center' }}>
                          {clockOut2 ? <span style={{ color: '#888', fontSize: '12px' }}>{fmtTime(clockOut2.punched_at)}</span> : <span style={{ color: '#ccc' }}>—</span>}
                        </td>
                        <td style={{ ...tdS, textAlign: 'center' }}>
                          {g.mtgStarts.length > 0
                            ? <span style={{ background: '#EAF3DE', color: '#3B6D11', padding: '2px 8px', borderRadius: '99px', fontSize: '12px', fontWeight: 500 }}>{g.mtgStarts.length}回</span>
                            : <span style={{ color: '#ccc' }}>—</span>}
                        </td>
                        <td style={{ ...tdS, textAlign: 'center', fontSize: '12px', color: '#555' }}>{fmtMtg(g.mtgMinutes)}</td>
                        <td style={{ ...tdS, textAlign: 'center' }}>
                          {hasRep
                            ? <button onClick={() => setExpandedKey(prev => prev === g.key ? null : g.key)} style={{ padding: '3px 10px', border: '1px solid #ddd', borderRadius: '5px', background: '#fff', color: '#555', fontSize: '11px', cursor: 'pointer' }}>{expanded ? '▲' : '▼'}</button>
                            : <span style={{ color: '#ccc', fontSize: '11px' }}>なし</span>}
                        </td>
                        <td style={{ ...tdS, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => setEditGroup(g)}
                            style={{ padding: '4px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', background: '#fff', color: '#555', marginRight: '6px' }}
                          >
                            修正
                          </button>
                          {hasRep && (
                            <button
                              onClick={() => handleConfirm(g)}
                              disabled={isChecked || updatingId === g.reportLog?.id}
                              style={{ padding: '4px 12px', border: '1px solid', borderRadius: '6px', fontSize: '11px', cursor: isChecked ? 'default' : 'pointer', borderColor: isChecked ? '#c3e0a0' : '#ddd', background: isChecked ? '#EAF3DE' : '#fff', color: isChecked ? '#3B6D11' : '#555', fontWeight: isChecked ? 500 : 400 }}
                            >
                              {updatingId === g.reportLog?.id ? '...' : isChecked ? '✓ 確認済' : '確認'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded && hasRep && (
                        <tr key={g.key + '_r'}>
                          <td colSpan={10} style={{ padding: '0 16px 16px', background: '#fafaf8', borderBottom: '1px solid #e8e8e4' }}>
                            <div style={{ paddingTop: '12px', fontSize: '12px', color: '#888' }}>
                              {/* 月初目標（goal種別のみ） */}
                              {g.reportLog?.report_type === 'goal' && (
                                <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
                                  <div style={{ fontSize: '10px', color: '#6B21A8', fontWeight: 600, marginBottom: '6px' }}>🎯 今月の目標</div>
                                  <div style={{ fontSize: '13px', color: '#1a1a1a', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{g.reportLog?.monthly_goal || '（未記入）'}</div>
                                </div>
                              )}
                              {/* 毎日実績（全種別共通） */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: g.reportLog?.report_type === 'review' ? '10px' : '0' }}>
                                {[
                                  { label: '新規コース', value: g.reportLog?.fact_new_course },
                                  { label: 'サブスク15', value: g.reportLog?.fact_sub_15 },
                                  { label: 'サブスク13', value: g.reportLog?.fact_sub_13 },
                                  { label: 'サブスク11', value: g.reportLog?.fact_sub_11 },
                                  { label: '既存顧客', value: g.reportLog?.fact_existing_customers },
                                  { label: '店販', value: g.reportLog?.fact_shop_sales },
                                  { label: '総売上', value: g.reportLog?.fact_total_revenue != null ? `¥${g.reportLog.fact_total_revenue.toLocaleString('ja-JP')}` : null },
                                ].map(({ label, value }) => (
                                  <div key={label} style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px', padding: '8px 10px' }}>
                                    <div style={{ fontSize: '10px', color: '#3B6D11', fontWeight: 600, marginBottom: '4px' }}>{label}</div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{value ?? 0}{typeof value === 'number' ? '件' : ''}</div>
                                  </div>
                                ))}
                              </div>
                              {/* 振り返り（review種別のみ） */}
                              {g.reportLog?.report_type === 'review' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                  {[
                                    { label: 'よかったこと①', value: g.reportLog?.review_good_1 },
                                    { label: 'よかったこと②', value: g.reportLog?.review_good_2 },
                                    { label: 'よかったこと③', value: g.reportLog?.review_good_3 },
                                    { label: '障害・うまくいかなかったこと', value: g.reportLog?.review_obstacle },
                                    { label: '質問', value: g.reportLog?.review_question },
                                    { label: 'アクションプラン', value: g.reportLog?.review_action_plan },
                                  ].map(({ label, value }) => (
                                    <div key={label} style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px', padding: '8px 10px' }}>
                                      <div style={{ fontSize: '10px', color: '#1D4ED8', fontWeight: 600, marginBottom: '4px' }}>{label}</div>
                                      <div style={{ fontSize: '12px', color: value ? '#1a1a1a' : '#ccc', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{value || '（未記入）'}</div>
                                    </div>
                                  ))}
                                </div>
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
          </div>
        )}
      </div>

      {/* 修正モーダル */}
      {editGroup && (
        <EditAttendanceModal
          group={editGroup}
          onClose={() => setEditGroup(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
