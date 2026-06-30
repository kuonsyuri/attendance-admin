'use client';

import { useState } from 'react';
import { supabase, AttendanceLog } from '@/lib/supabase';

// 出退勤ログ修正モーダル — 打刻時刻の編集・未打刻の追加。

type Slot = {
  key: string;
  label: string;
  type: 'clock_in' | 'clock_out' | 'meeting_start' | 'meeting_end';
  logId: number | null;   // 既存ログのID（null=未打刻＝新規追加枠）
  original: string;       // 初期値（datetime-local 形式 / 未打刻は ''）
  value: string;          // 編集中の値
};

type GroupLike = {
  date: string;
  staffId: number;
  staffName: string;
  storeId: number | null;
  storeName: string;
  clockIn?: AttendanceLog;
  clockOuts: AttendanceLog[];
  mtgStarts: AttendanceLog[];
  mtgEnds: AttendanceLog[];
};

const pad = (n: number) => String(n).padStart(2, '0');
function isoToLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToIso(s: string): string {
  return new Date(s).toISOString();
}

function buildSlots(g: GroupLike): Slot[] {
  const slots: Slot[] = [];
  // 出勤
  slots.push({ key: 'in', label: '出勤', type: 'clock_in', logId: g.clockIn?.id ?? null, original: g.clockIn ? isoToLocal(g.clockIn.punched_at) : '', value: g.clockIn ? isoToLocal(g.clockIn.punched_at) : '' });
  // 退勤①
  const out1 = g.clockOuts[0];
  slots.push({ key: 'out1', label: '退勤①', type: 'clock_out', logId: out1?.id ?? null, original: out1 ? isoToLocal(out1.punched_at) : '', value: out1 ? isoToLocal(out1.punched_at) : '' });
  // 残業（退勤②）
  const out2 = g.clockOuts[1];
  slots.push({ key: 'out2', label: '残業（退勤②）', type: 'clock_out', logId: out2?.id ?? null, original: out2 ? isoToLocal(out2.punched_at) : '', value: out2 ? isoToLocal(out2.punched_at) : '' });
  // MTG（既存のみ・編集）
  const starts = [...g.mtgStarts].sort((a, b) => a.punched_at.localeCompare(b.punched_at));
  const ends = [...g.mtgEnds].sort((a, b) => a.punched_at.localeCompare(b.punched_at));
  starts.forEach((s, i) => slots.push({ key: `ms${i}`, label: `MTG開始${i + 1}`, type: 'meeting_start', logId: s.id, original: isoToLocal(s.punched_at), value: isoToLocal(s.punched_at) }));
  ends.forEach((e, i) => slots.push({ key: `me${i}`, label: `MTG終了${i + 1}`, type: 'meeting_end', logId: e.id, original: isoToLocal(e.punched_at), value: isoToLocal(e.punched_at) }));
  return slots;
}

const inp: React.CSSProperties = { padding: '7px 10px', border: '1px solid #ddd', borderRadius: '7px', fontSize: '13px', background: '#fff', outline: 'none', width: '210px', fontFamily: 'inherit' };

export default function EditAttendanceModal({ group, onClose, onSaved }: { group: GroupLike; onClose: () => void; onSaved: () => void }) {
  const [slots, setSlots] = useState<Slot[]>(() => buildSlots(group));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = slots.some(s => s.value !== s.original);

  const setVal = (key: string, value: string) => {
    setSlots(prev => prev.map(s => s.key === key ? { ...s, value } : s));
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      for (const s of slots) {
        if (s.value === s.original) continue;
        if (s.logId != null) {
          // 既存ログの時刻更新（空クリアは削除非対応のためスキップ）
          if (!s.value) continue;
          const { error } = await supabase.from('attendance_logs').update({ punched_at: localToIso(s.value) }).eq('id', s.logId);
          if (error) throw new Error(`${s.label}の更新に失敗: ${error.message}`);
        } else if (s.value) {
          // 未打刻枠に入力 → 新規追加
          const { error } = await supabase.from('attendance_logs').insert({
            staff_id: group.staffId,
            store_id: group.storeId,
            type: s.type,
            punched_at: localToIso(s.value),
          });
          if (error) throw new Error(`${s.label}の追加に失敗: ${error.message}`);
        }
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="no-print"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 20px', overflowY: 'auto' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '460px', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e8e8e4' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a' }}>出退勤の修正</div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{group.staffName}　/　{group.date}　/　{group.storeName}</div>
          </div>
          <button onClick={onClose} aria-label="閉じる" style={{ width: '30px', height: '30px', border: '1px solid #ddd', borderRadius: '7px', background: '#fff', fontSize: '15px', color: '#888', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* 本文 */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', color: '#999', marginBottom: '12px' }}>時刻を修正、または未打刻の枠に入力して追加できます。</div>
          {slots.map(s => {
            const changed = s.value !== s.original;
            const isAdd = s.logId == null;
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ width: '110px', fontSize: '12px', fontWeight: 600, color: s.type === 'clock_in' ? '#3B6D11' : s.type === 'clock_out' ? '#c0392b' : '#555' }}>
                  {s.label}
                  {isAdd && <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '4px', fontWeight: 400 }}>未打刻</span>}
                </div>
                <input type="datetime-local" value={s.value} onChange={e => setVal(s.key, e.target.value)} style={{ ...inp, borderColor: changed ? '#3B6D11' : '#ddd', background: isAdd && !s.value ? '#fafafa' : '#fff' }} />
                {changed && <span style={{ fontSize: '11px', color: '#3B6D11' }}>{isAdd ? '＋追加' : '変更'}</span>}
              </div>
            );
          })}
          {error && <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '8px' }}>{error}</div>}
        </div>

        {/* フッター */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '14px 20px', borderTop: '1px solid #e8e8e4', background: '#fafaf8' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '7px', background: '#fff', fontSize: '13px', color: '#555', cursor: 'pointer' }}>キャンセル</button>
          <button onClick={handleSave} disabled={saving || !dirty} style={{ padding: '8px 20px', border: 'none', borderRadius: '7px', background: dirty ? '#3B6D11' : '#cbd5c0', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: dirty ? 'pointer' : 'default' }}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
