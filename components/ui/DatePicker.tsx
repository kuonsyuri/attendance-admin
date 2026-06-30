'use client';

import { useMemo } from 'react';
import { DatePick } from '@/lib/dateUtils';

// 年/月/日の階層セレクタ（出退勤ログ・分析・日報で共通利用）

const sel: React.CSSProperties = { padding: '6px 10px', border: '1px solid #ddd', borderRadius: '7px', fontSize: '13px', background: '#fff', outline: 'none' };

export function DatePicker({ value, onChange, label }: { value: DatePick; onChange: (v: DatePick) => void; label?: string }) {
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
