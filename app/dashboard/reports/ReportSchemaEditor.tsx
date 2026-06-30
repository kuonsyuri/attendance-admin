'use client';

import { useState } from 'react';
import {
  ReportTypeDef, ReportSection, ReportField, FieldType, FIELD_TYPE_LABEL,
  cloneDefaultSchema, saveReportSchema,
} from '@/lib/reportSchema';

// 日報構成エディタ — 種別 / セクション / 項目の作成・修正・削除・並べ替え。
// 保存先は Supabase app_settings（key='report_schema'）。

type Props = {
  schema: ReportTypeDef[];
  onChange: (next: ReportTypeDef[]) => void;
};

// ── スタイル ─────────────────────────────────────────────
const sectionCard: React.CSSProperties = { background: '#fff', border: '1px solid #e8e8e4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' };
const lbl: React.CSSProperties = { fontSize: '10px', color: '#999', fontWeight: 600, display: 'block', marginBottom: '3px' };
const inp: React.CSSProperties = { padding: '6px 9px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' };
const codeTag: React.CSSProperties = { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px' };
// 自動採番の読み取り専用表示
const roInp: React.CSSProperties = { ...inp, ...codeTag, background: '#f1f1ee', color: '#888', cursor: 'not-allowed' };
const miniBtn: React.CSSProperties = { padding: '3px 8px', border: '1px solid #ddd', borderRadius: '6px', background: '#fff', fontSize: '11px', color: '#555', cursor: 'pointer' };
const dangerBtn: React.CSSProperties = { ...miniBtn, color: '#b91c1c', borderColor: '#fecaca', background: '#fef2f2' };
const addBtn: React.CSSProperties = { padding: '6px 12px', border: '1px dashed #bbb', borderRadius: '7px', background: '#fafafa', fontSize: '12px', color: '#555', cursor: 'pointer' };

const FIELD_TYPES: FieldType[] = ['number', 'select', 'currency', 'textarea', 'computed'];

// 既存のキー/カラムを走査し、prefix + 連番 の未使用な次番号を返す（自動採番）
function nextNumberedId(schema: ReportTypeDef[], prefix: string): string {
  const re = new RegExp('^' + prefix + '(\\d+)$');
  let max = 0;
  const consider = (s: string | null | undefined) => {
    if (!s) return;
    const m = re.exec(s);
    if (m) max = Math.max(max, Number(m[1]));
  };
  schema.forEach(t => {
    consider(t.key);
    t.sections.forEach(sec => {
      consider(sec.key);
      sec.fields.forEach(f => { consider(f.key); consider(f.column); });
    });
  });
  return prefix + (max + 1);
}

export default function ReportSchemaEditor({ schema, onChange }: Props) {
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // 不変更新ヘルパ
  const mutate = (fn: (draft: ReportTypeDef[]) => void) => {
    const next = JSON.parse(JSON.stringify(schema)) as ReportTypeDef[];
    fn(next);
    onChange(next);
    setDirty(true);
    setMsg(null);
  };

  // ── 種別 ──
  const addType = () => mutate(d => {
    d.push({ key: nextNumberedId(d, 'type_'), label: '新しい種別', color: { bg: '#f1f5f9', color: '#475569' }, trigger: '（表示条件を入力）', sections: [] });
  });
  const updateType = (ti: number, patch: Partial<ReportTypeDef>) => mutate(d => { Object.assign(d[ti], patch); });
  const deleteType = (ti: number) => mutate(d => { d.splice(ti, 1); });
  const moveType = (ti: number, dir: -1 | 1) => mutate(d => {
    const j = ti + dir; if (j < 0 || j >= d.length) return;
    [d[ti], d[j]] = [d[j], d[ti]];
  });

  // ── セクション ──
  const addSection = (ti: number) => mutate(d => {
    d[ti].sections.push({ key: nextNumberedId(d, 'sec_'), label: '新しいセクション', fields: [] });
  });
  const updateSection = (ti: number, si: number, patch: Partial<ReportSection>) => mutate(d => { Object.assign(d[ti].sections[si], patch); });
  const deleteSection = (ti: number, si: number) => mutate(d => { d[ti].sections.splice(si, 1); });

  // ── 項目 ──
  const addField = (ti: number, si: number) => mutate(d => {
    const id = nextNumberedId(d, 'field_');
    d[ti].sections[si].fields.push({ key: id, column: id, label: '新しい項目', type: 'number', min: 0, max: 50 });
  });
  const updateField = (ti: number, si: number, fi: number, patch: Partial<ReportField>) => mutate(d => { Object.assign(d[ti].sections[si].fields[fi], patch); });
  const deleteField = (ti: number, si: number, fi: number) => mutate(d => { d[ti].sections[si].fields.splice(fi, 1); });
  const moveField = (ti: number, si: number, fi: number, dir: -1 | 1) => mutate(d => {
    const arr = d[ti].sections[si].fields; const j = fi + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[fi], arr[j]] = [arr[j], arr[fi]];
  });

  // ── 保存 / リセット ──
  const handleSave = async () => {
    setSaving(true); setMsg(null);
    const res = await saveReportSchema(schema);
    setSaving(false);
    if (res.error) {
      setMsg({ text: `保存失敗: ${res.error}`, ok: false });
    } else {
      setDirty(false);
      setMsg({ text: '保存しました', ok: true });
    }
  };
  const handleReset = () => {
    if (!confirm('既定構成に戻します。保存していない変更は失われます。よろしいですか？')) return;
    onChange(cloneDefaultSchema());
    setDirty(true);
    setMsg(null);
  };

  return (
    <div>
      {/* ツールバー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', position: 'sticky', top: '-20px', background: '#f5f5f3', padding: '8px 0', zIndex: 2 }}>
        <button onClick={handleSave} disabled={saving || !dirty} style={{ padding: '8px 18px', border: 'none', borderRadius: '8px', background: dirty ? '#3B6D11' : '#cbd5c0', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: dirty ? 'pointer' : 'default' }}>
          {saving ? '保存中…' : dirty ? '保存' : '保存済み'}
        </button>
        <button onClick={handleReset} style={miniBtn}>既定に戻す</button>
        {msg && <span style={{ fontSize: '12px', color: msg.ok ? '#3B6D11' : '#b91c1c' }}>{msg.text}</span>}
        {dirty && !msg && <span style={{ fontSize: '12px', color: '#b45309' }}>未保存の変更があります</span>}
      </div>

      {schema.map((rt, ti) => (
        <div key={ti} style={sectionCard}>
          {/* 種別ヘッダー */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e8e4', background: '#fafaf8' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 600, background: rt.color.bg, color: rt.color.color, alignSelf: 'center' }}>{rt.label || '（無題）'}</span>
              <div style={{ width: '130px' }}>
                <label style={lbl}>種別ラベル</label>
                <input style={inp} value={rt.label} onChange={e => updateType(ti, { label: e.target.value })} />
              </div>
              <div style={{ width: '110px' }}>
                <label style={lbl}>キー（自動採番）</label>
                <input style={roInp} value={rt.key} readOnly tabIndex={-1} title="自動採番（編集不可）" />
              </div>
              <div style={{ width: '90px' }}>
                <label style={lbl}>最低文字数</label>
                <input style={inp} type="number" value={rt.minChars ?? ''} placeholder="なし" onChange={e => updateType(ti, { minChars: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <label style={{ fontSize: '11px', color: '#555', display: 'flex', alignItems: 'center', gap: '4px', paddingBottom: '6px' }}>
                <input type="checkbox" checked={!!rt.immutable} onChange={e => updateType(ti, { immutable: e.target.checked || undefined })} />変更不可
              </label>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', paddingBottom: '6px' }}>
                <button style={miniBtn} onClick={() => moveType(ti, -1)} disabled={ti === 0}>↑</button>
                <button style={miniBtn} onClick={() => moveType(ti, 1)} disabled={ti === schema.length - 1}>↓</button>
                <button style={dangerBtn} onClick={() => deleteType(ti)}>種別削除</button>
              </div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <label style={lbl}>表示トリガー</label>
              <input style={inp} value={rt.trigger} onChange={e => updateType(ti, { trigger: e.target.value })} />
            </div>
          </div>

          {/* セクション */}
          {rt.sections.map((sec, si) => (
            <div key={si} style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0ec' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '8px' }}>
                <div style={{ width: '220px' }}>
                  <label style={lbl}>セクション名</label>
                  <input style={inp} value={sec.label} onChange={e => updateSection(ti, si, { label: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>セクション補足（任意・表示条件など）</label>
                  <input style={inp} value={sec.note ?? ''} placeholder="例：※新規に入った場合のみ記載" onChange={e => updateSection(ti, si, { note: e.target.value || undefined })} />
                </div>
                <button style={dangerBtn} onClick={() => deleteSection(ti, si)}>セクション削除</button>
              </div>

              {/* 項目テーブル */}
              {sec.fields.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {sec.fields.map((f, fi) => (
                    <div key={fi} style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', flexWrap: 'wrap', background: '#fafaf8', border: '1px solid #eee', borderRadius: '8px', padding: '8px' }}>
                      <div style={{ width: '170px' }}>
                        <label style={lbl}>項目ラベル</label>
                        <input style={inp} value={f.label} onChange={e => updateField(ti, si, fi, { label: e.target.value })} />
                      </div>
                      <div style={{ width: '110px' }}>
                        <label style={lbl}>形式</label>
                        <select style={inp} value={f.type} onChange={e => updateField(ti, si, fi, { type: e.target.value as FieldType })}>
                          {FIELD_TYPES.map(t => <option key={t} value={t}>{FIELD_TYPE_LABEL[t]}</option>)}
                        </select>
                      </div>
                      <div style={{ width: '120px' }}>
                        <label style={lbl}>カラム（自動採番）</label>
                        <input style={roInp} value={f.column ?? ''} readOnly tabIndex={-1} title="自動採番（編集不可）" />
                      </div>
                      <div style={{ width: '44px' }}>
                        <label style={lbl}>単位</label>
                        <input style={inp} value={f.unit ?? ''} onChange={e => updateField(ti, si, fi, { unit: e.target.value || undefined })} />
                      </div>
                      {(f.type === 'number' || f.type === 'select') && (
                        <>
                          <div style={{ width: '44px' }}>
                            <label style={lbl}>最小</label>
                            <input style={inp} type="number" value={f.min ?? ''} onChange={e => updateField(ti, si, fi, { min: e.target.value ? Number(e.target.value) : undefined })} />
                          </div>
                          <div style={{ width: '44px' }}>
                            <label style={lbl}>最大</label>
                            <input style={inp} type="number" value={f.max ?? ''} onChange={e => updateField(ti, si, fi, { max: e.target.value ? Number(e.target.value) : undefined })} />
                          </div>
                        </>
                      )}
                      <div style={{ flex: 1, minWidth: '120px' }}>
                        <label style={lbl}>補足</label>
                        <input style={inp} value={f.note ?? ''} onChange={e => updateField(ti, si, fi, { note: e.target.value || undefined })} />
                      </div>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        <button style={miniBtn} onClick={() => moveField(ti, si, fi, -1)} disabled={fi === 0}>↑</button>
                        <button style={miniBtn} onClick={() => moveField(ti, si, fi, 1)} disabled={fi === sec.fields.length - 1}>↓</button>
                        <button style={dangerBtn} onClick={() => deleteField(ti, si, fi)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button style={{ ...addBtn, marginTop: '8px' }} onClick={() => addField(ti, si)}>＋ 項目を追加</button>
            </div>
          ))}

          <div style={{ padding: '10px 16px' }}>
            <button style={addBtn} onClick={() => addSection(ti)}>＋ セクションを追加</button>
          </div>
        </div>
      ))}

      <button style={{ ...addBtn, width: '100%', padding: '12px' }} onClick={addType}>＋ 日報種別を追加</button>

      <div style={{ fontSize: '11px', color: '#a16207', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px', marginTop: '16px', lineHeight: 1.7 }}>
        ⚠ 保存先は Supabase <span style={codeTag}>app_settings</span>。この構成は表示・LINEプレビューに即反映されます。
        新規追加した項目を<strong>スタッフアプリ(attendance-app)で実際に入力・保存</strong>するには、対応するDBカラム追加とフォーム連携（次段階）が必要です。
      </div>
    </div>
  );
}
