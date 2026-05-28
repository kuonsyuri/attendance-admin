'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase, AttendanceLog, Store } from '@/lib/supabase';

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

type StaffStat = {
  staffId: number;
  staffName: string;
  storeName: string;
  storeId: number | null;
  storePref: string | null;
  storeArea: string | null;
  workDays: number;
  workMinutes: number;
  mtgCount: number;
  mtgMinutes: number;
  adoptedCount: number;
  reportCount: number;
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

function fmtHours(min: number): string {
  if (min <= 0) return '0h';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function buildStats(logs: AttendanceLog[]): StaffStat[] {
  const map = new Map<number, { days: Map<string, AttendanceLog[]>; first: AttendanceLog }>();

  for (const log of logs) {
    if (!map.has(log.staff_id)) map.set(log.staff_id, { days: new Map(), first: log });
    const entry = map.get(log.staff_id)!;
    const date = log.punched_at.slice(0, 10);
    if (!entry.days.has(date)) entry.days.set(date, []);
    entry.days.get(date)!.push(log);
  }

  const result: StaffStat[] = [];
  for (const [staffId, { days, first }] of Array.from(map.entries())) {
    let workDays = 0, workMinutes = 0, mtgCount = 0, mtgMinutes = 0, adoptedCount = 0, reportCount = 0;

    for (const dayLogs of Array.from(days.values())) {
      const clockIn = dayLogs.find((l: AttendanceLog) => l.type === 'clock_in');
      const clockOuts = dayLogs.filter((l: AttendanceLog) => l.type === 'clock_out').sort((a: AttendanceLog, b: AttendanceLog) => a.punched_at.localeCompare(b.punched_at));
      if (clockIn) {
        workDays++;
        if (clockOuts.length > 0) {
          const last = clockOuts[clockOuts.length - 1];
          workMinutes += Math.max(0, Math.round((new Date(last.punched_at).getTime() - new Date(clockIn.punched_at).getTime()) / 60000));
        }
      }

      const starts = dayLogs.filter((l: AttendanceLog) => l.type === 'meeting_start').sort((a: AttendanceLog, b: AttendanceLog) => a.punched_at.localeCompare(b.punched_at));
      const ends = dayLogs.filter((l: AttendanceLog) => l.type === 'meeting_end').sort((a: AttendanceLog, b: AttendanceLog) => a.punched_at.localeCompare(b.punched_at));
      mtgCount += starts.length;
      mtgMinutes += starts.reduce((sum: number, s: AttendanceLog, i: number) => {
        const e = ends[i];
        if (!e) return sum;
        const diff = new Date(e.punched_at).getTime() - new Date(s.punched_at).getTime();
        return sum + (diff > 0 ? Math.round(diff / 60000) : 0);
      }, 0);

      const reports = dayLogs.filter((l: AttendanceLog) => l.report_type != null);
      reportCount += reports.length;
      adoptedCount += reports.filter((l: AttendanceLog) => l.report_status === 'checked').length;
    }

    result.push({
      staffId,
      staffName: first.staff?.name || `#${staffId}`,
      storeName: first.store?.name || first.staff?.stores?.name || '—',
      storeId: first.store?.id ?? first.staff?.stores?.id ?? null,
      storePref: first.store?.prefecture ?? first.staff?.stores?.prefecture ?? null,
      storeArea: first.store?.area ?? first.staff?.stores?.area ?? null,
      workDays, workMinutes, mtgCount, mtgMinutes, adoptedCount, reportCount,
    });
  }

  return result.sort((a, b) => b.adoptedCount - a.adoptedCount);
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
export default function AnalyticsPage() {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState<DatePick>(fromDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString()));
  const [dateTo, setDateTo] = useState<DatePick>(fromDate(now.toISOString()));
  const [filterArea, setFilterArea] = useState('');
  const [filterPref, setFilterPref] = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [filterAdopted, setFilterAdopted] = useState('');
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [storeList, setStoreList] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: storeData }, { data: logData }] = await Promise.all([
      supabase.from('stores').select('*').order('name'),
      supabase
        .from('attendance_logs')
        .select('*, staff(*), store:stores(*)')
        .gte('punched_at', toISO(dateFrom))
        .lte('punched_at', toISO(dateTo, true))
        .order('punched_at'),
    ]);
    setStoreList((storeData as Store[]) || []);
    setLogs((logData as AttendanceLog[]) || []);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const allStats = useMemo(() => buildStats(logs), [logs]);

  const prefsByArea = useMemo(() =>
    filterArea ? Object.entries(PREFECTURE_TO_AREA).filter(([, a]) => a === filterArea).map(([p]) => p) : [],
    [filterArea]);

  const filteredStores = useMemo(() =>
    storeList.filter(s =>
      (!filterArea || s.area === filterArea) && (!filterPref || s.prefecture === filterPref)
    ), [storeList, filterArea, filterPref]);

  const staffOptions = useMemo(() => {
    const src = allStats.filter(s => {
      if (filterArea && s.storeArea !== filterArea) return false;
      if (filterPref && s.storePref !== filterPref) return false;
      if (filterStore && String(s.storeId) !== filterStore) return false;
      return true;
    });
    return src.map(s => ({ id: s.staffId, name: s.staffName }));
  }, [allStats, filterArea, filterPref, filterStore]);

  const stats = useMemo(() => allStats.filter(s => {
    if (filterArea && s.storeArea !== filterArea) return false;
    if (filterPref && s.storePref !== filterPref) return false;
    if (filterStore && String(s.storeId) !== filterStore) return false;
    if (filterStaff && String(s.staffId) !== filterStaff) return false;
    if (filterAdopted !== '' && s.adoptedCount < Number(filterAdopted)) return false;
    return true;
  }), [allStats, filterArea, filterPref, filterStore, filterStaff, filterAdopted]);

  const total = useMemo(() => ({
    workDays: stats.reduce((s, r) => s + r.workDays, 0),
    workMinutes: stats.reduce((s, r) => s + r.workMinutes, 0),
    mtgCount: stats.reduce((s, r) => s + r.mtgCount, 0),
    mtgMinutes: stats.reduce((s, r) => s + r.mtgMinutes, 0),
    adoptedCount: stats.reduce((s, r) => s + r.adoptedCount, 0),
    reportCount: stats.reduce((s, r) => s + r.reportCount, 0),
  }), [stats]);

  const overallRate = total.reportCount > 0 ? Math.round((total.adoptedCount / total.reportCount) * 100) : 0;

  const adoptRate = (r: StaffStat) =>
    r.reportCount === 0 ? '—' : `${Math.round((r.adoptedCount / r.reportCount) * 100)}%`;

  const handleAreaChange = (v: string) => { setFilterArea(v); setFilterPref(''); setFilterStore(''); setFilterStaff(''); };
  const handlePrefChange = (v: string) => { setFilterPref(v); setFilterStore(''); setFilterStaff(''); };
  const handleStoreChange = (v: string) => { setFilterStore(v); setFilterStaff(''); };

  const medalColor = (i: number) =>
    i === 0 ? '#f0c040' : i === 1 ? '#c0c0c0' : i === 2 ? '#c08050' : '#f0f0f0';

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 500 }}>分析</h1>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>期間別のスタッフパフォーマンス・日報確認ランキング</p>
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
            {staffOptions.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: '#888' }}>確認済み数</span>
            <input type="number" min={0} placeholder="0" value={filterAdopted} onChange={e => setFilterAdopted(e.target.value)} style={{ ...sel, width: '60px' }} />
            <span style={{ fontSize: '12px', color: '#888' }}>以上</span>
          </div>
          <button onClick={fetchData} style={{ marginLeft: 'auto', padding: '7px 20px', background: '#3B6D11', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
            検索
          </button>
        </div>
      </div>

      {/* 分析カード 6枚 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '16px' }}>
        {[
          { label: '出勤日数', value: `${total.workDays}日` },
          { label: '稼働時間', value: fmtHours(total.workMinutes) },
          { label: 'MTG回数', value: `${total.mtgCount}回` },
          { label: 'MTG時間', value: fmtHours(total.mtgMinutes) },
          { label: '確認率', value: `${overallRate}%` },
          { label: '確認済み数', value: `${total.adoptedCount}件`, highlight: true },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', border: `1px solid ${c.highlight ? '#c3e0a0' : '#e8e8e4'}`, borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{c.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: c.highlight ? '#3B6D11' : '#1a1a1a' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* ランキングテーブル */}
      <div style={card}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>読み込み中...</div>
        ) : stats.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>該当するデータがありません</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thS, textAlign: 'center', width: '52px' }}>順位</th>
                <th style={thS}>スタッフ</th>
                <th style={thS}>店舗</th>
                <th style={{ ...thS, textAlign: 'center' }}>出勤日数</th>
                <th style={{ ...thS, textAlign: 'center' }}>稼働時間</th>
                <th style={{ ...thS, textAlign: 'center' }}>MTG回数</th>
                <th style={{ ...thS, textAlign: 'center' }}>MTG時間</th>
                <th style={{ ...thS, textAlign: 'center', color: '#3B6D11' }}>確認済み数</th>
                <th style={{ ...thS, textAlign: 'center' }}>確認率</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((r, i) => (
                <tr key={r.staffId} style={{ background: i === 0 ? '#fffdf0' : 'transparent' }}>
                  <td style={{ ...tdS, textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '26px', height: '26px', borderRadius: '50%', fontSize: '12px', fontWeight: 700,
                      background: medalColor(i), color: i < 3 ? '#fff' : '#999',
                    }}>
                      {i + 1}
                    </span>
                  </td>
                  <td style={{ ...tdS, fontWeight: 500 }}>{r.staffName}</td>
                  <td style={{ ...tdS, color: '#666', fontSize: '12px' }}>{r.storeName}</td>
                  <td style={{ ...tdS, textAlign: 'center' }}>
                    {r.workDays}<span style={{ fontSize: '11px', color: '#888' }}>日</span>
                  </td>
                  <td style={{ ...tdS, textAlign: 'center', fontSize: '12px', color: '#555' }}>{fmtHours(r.workMinutes)}</td>
                  <td style={{ ...tdS, textAlign: 'center' }}>
                    {r.mtgCount > 0
                      ? <span style={{ background: '#EAF3DE', color: '#3B6D11', padding: '2px 8px', borderRadius: '99px', fontSize: '12px', fontWeight: 500 }}>{r.mtgCount}回</span>
                      : <span style={{ color: '#ccc' }}>—</span>}
                  </td>
                  <td style={{ ...tdS, textAlign: 'center', fontSize: '12px', color: '#555' }}>
                    {r.mtgMinutes > 0 ? fmtHours(r.mtgMinutes) : '—'}
                  </td>
                  <td style={{ ...tdS, textAlign: 'center' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: r.adoptedCount > 0 ? '#3B6D11' : '#ccc' }}>{r.adoptedCount}</span>
                    <span style={{ fontSize: '11px', color: '#888' }}>件</span>
                  </td>
                  <td style={{ ...tdS, textAlign: 'center', color: '#555' }}>{adoptRate(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
