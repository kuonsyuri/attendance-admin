'use client';

import { useState } from 'react';
import { REPORT_SCHEMA, ReportField, ReportTypeDef, getReportTypeDef } from '@/lib/reportSchema';

type PreviewProps = { schema?: ReportTypeDef[] };

// LINE webview を模したスタッフ入力フォームのプレビュー。
// 新レイアウト: 今月の目標を最上部に固定（初日=入力 / 以降=保存表示）、下部に毎日実績、振り返りは15日・月末のみ。

type Scenario = 'normal' | 'reviewDay' | 'firstDay' | 'carryover';

type ScenarioDef = { label: string; note: string; goalMode: 'input' | 'display'; showReview: boolean; prevMonth: boolean };

const SCENARIO: Record<Scenario, ScenarioDef> = {
  normal:    { label: '通常日',         note: '目標(表示) ＋ 毎日実績',                 goalMode: 'display', showReview: false, prevMonth: false },
  reviewDay: { label: '月中・月末',     note: '目標(表示) ＋ 毎日実績 ＋ 振り返り',       goalMode: 'display', showReview: true,  prevMonth: false },
  firstDay:  { label: '月初・初日',     note: '目標(入力) ＋ 毎日実績',                 goalMode: 'input',   showReview: false, prevMonth: false },
  carryover: { label: '月初＋前月振り返り未提出', note: '目標(入力) ＋ 毎日実績 ＋ 前月の振り返り', goalMode: 'input', showReview: true, prevMonth: true },
};

const SAMPLE_GOAL = '6月末までに新規サブスク契約を10件達成することによって、お客様の人生に本気で向き合えるカウンセラーへ成長する。';

const fieldWrap: React.CSSProperties = { textAlign: 'left', marginBottom: '12px' };
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 700, color: '#555', marginBottom: '5px', letterSpacing: '0.04em' };
const inputBase: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1.5px solid #e0e0e0', borderRadius: '10px', fontSize: '14px', background: '#fff', boxSizing: 'border-box' };

function FieldPreview({ f }: { f: ReportField }) {
  if (f.type === 'computed') {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7f7f4', border: '1px solid #eee', borderRadius: '8px', padding: '8px 11px', marginBottom: '12px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#555' }}>{f.label}</span>
        <span style={{ fontSize: '13px', color: '#888' }}>0{f.unit || ''}（自動）</span>
      </div>
    );
  }
  return (
    <div style={fieldWrap}>
      <label style={fieldLabel}>{f.label}{f.unit && f.note && f.type === 'select' ? `（${f.note}）` : ''}</label>
      {f.note && f.type === 'textarea' && (
        <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '5px', lineHeight: 1.5 }}>{f.note}</div>
      )}
      {f.type === 'select' ? (
        <select defaultValue="0" style={{ ...inputBase, appearance: 'none', WebkitAppearance: 'none', backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23888' d='M6 8L0 0h12z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '30px' }}>
          {Array.from({ length: (f.max ?? 50) - (f.min ?? 0) + 1 }, (_, i) => (f.min ?? 0) + i).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      ) : f.type === 'currency' ? (
        <input type="text" placeholder="例：150,000" readOnly style={inputBase} />
      ) : (
        <textarea placeholder="入力してください" readOnly style={{ ...inputBase, minHeight: '64px', resize: 'none', lineHeight: 1.6 }} />
      )}
    </div>
  );
}

// 最上部に固定する「今月の目標」
function GoalPinned({ goalDef, mode }: { goalDef: ReportTypeDef | undefined; mode: 'input' | 'display' }) {
  const field = goalDef?.sections?.[0]?.fields?.[0];
  return (
    <div style={{ position: 'sticky', top: '-18px', zIndex: 3, background: '#fff', paddingTop: '6px', marginBottom: '8px' }}>
      <div style={{ border: '1px solid #E9D5FF', background: '#FDF4FF', borderRadius: '12px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#6B21A8' }}>🎯 今月の目標</span>
          <span style={{ fontSize: '10px', fontWeight: 600, color: mode === 'input' ? '#9333ea' : '#6B21A8', background: '#F3E8FF', padding: '2px 8px', borderRadius: '99px' }}>
            {mode === 'input' ? '初日に入力' : '登録済み・固定表示'}
          </span>
        </div>
        {mode === 'input' ? (
          <>
            {field?.note && <div style={{ fontSize: '10px', color: '#a78bda', marginBottom: '6px', lineHeight: 1.5 }}>{field.note}</div>}
            <textarea placeholder="今月の目標を入力してください" readOnly style={{ ...inputBase, minHeight: '72px', resize: 'none', lineHeight: 1.6, borderColor: '#E9D5FF' }} />
            <div style={{ fontSize: '10px', color: '#b45309', marginTop: '5px' }}>※一度送信すると今月は変更できません</div>
          </>
        ) : (
          <>
            <div style={{ background: '#fff', border: '1px solid #E9D5FF', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#3b2156', lineHeight: 1.7 }}>{SAMPLE_GOAL}</div>
            <div style={{ fontSize: '10px', color: '#9b8bb4', marginTop: '5px' }}>初日に登録した目標を表示（変更不可）</div>
          </>
        )}
      </div>
    </div>
  );
}

function TypeBlock({ def, titleOverride }: { def: ReportTypeDef; titleOverride?: string }) {
  const headerColor = def.key === 'review'
    ? { background: '#EFF6FF', color: '#1D4ED8' }
    : { background: '#EAF3DE', color: '#3B6D11' };
  const emoji = titleOverride || (def.key === 'review' ? '🔄 振り返り' : '📊 本日の実績');
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, padding: '8px 12px', borderRadius: '8px', margin: '16px 0 12px', textAlign: 'left', ...headerColor }}>
        {emoji}
      </div>
      {def.sections.map(sec => (
        <div key={sec.key} style={{ marginBottom: '4px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#555', margin: '14px 0 4px', letterSpacing: '0.02em' }}>── {sec.label} ──</div>
          {sec.note && <div style={{ fontSize: '10px', color: '#d9700a', marginBottom: '8px', lineHeight: 1.5 }}>{sec.note}</div>}
          {sec.fields.map(f => <FieldPreview key={f.key} f={f} />)}
        </div>
      ))}
      {def.minChars && (
        <div style={{ textAlign: 'right', fontSize: '12px', color: '#bbb', margin: '8px 0 4px' }}>テキスト入力 0 / {def.minChars}字</div>
      )}
    </div>
  );
}

export default function ReportFormPreview({ schema = REPORT_SCHEMA }: PreviewProps) {
  const [scenario, setScenario] = useState<Scenario>('normal');
  const sc = SCENARIO[scenario];
  const goalDef = getReportTypeDef('goal', schema);
  const dailyDef = getReportTypeDef('daily', schema);
  const reviewDef = getReportTypeDef('review', schema);

  return (
    <div>
      {/* シナリオ切替 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {(Object.keys(SCENARIO) as Scenario[]).map(s => {
          const active = scenario === s;
          return (
            <button
              key={s}
              onClick={() => setScenario(s)}
              style={{ padding: '6px 12px', border: `1px solid ${active ? '#06C755' : '#ddd'}`, borderRadius: '8px', background: active ? '#06C755' : '#fff', color: active ? '#fff' : '#555', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
            >
              {SCENARIO[s].label}
              <span style={{ fontSize: '10px', opacity: 0.85, marginLeft: '5px' }}>{SCENARIO[s].note}</span>
            </button>
          );
        })}
      </div>

      {/* LINE webview フレーム */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '320px', background: '#7494C0', borderRadius: '22px', padding: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 600, padding: '4px 0 8px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '8px' }}>‹</span>
            ELAN MARIRE 出退勤
          </div>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 16px', maxHeight: '460px', overflowY: 'auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '6px' }}>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#1a1a1a' }}>出退勤打刻</div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>山田 花子（プレビュー）</div>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0', margin: '14px 0' }} />

            {/* ① 今月の目標（最上部・固定） */}
            <GoalPinned goalDef={goalDef} mode={sc.goalMode} />

            {/* 案内ノート */}
            <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '10px', padding: '9px 12px', margin: '4px 0 4px', textAlign: 'left', fontSize: '11px', color: '#795548', lineHeight: 1.6 }}>
              {sc.prevMonth
                ? <><strong style={{ color: '#e65100' }}>月初の出勤日</strong>：前月末の振り返りが未記入のため、今月の目標とあわせて記入します</>
                : sc.showReview
                  ? <><strong style={{ color: '#e65100' }}>本日は振り返り日</strong>（月中・月末に自動表示。月末週に未記入なら翌月初の出勤日に持ち越し）</>
                  : sc.goalMode === 'input'
                    ? <><strong style={{ color: '#e65100' }}>今月の初日</strong>：目標を入力し、毎日実績を記入して退勤します</>
                    : <>毎日実績を記入して退勤打刻を完了します</>}
            </div>

            {/* ② 毎日実績（下部） */}
            {dailyDef && <TypeBlock def={dailyDef} />}

            {/* ③ 振り返り（月中・月末／持ち越し時は前月分） */}
            {sc.showReview && reviewDef && <TypeBlock def={reviewDef} titleOverride={sc.prevMonth ? '🔄 振り返り（前月分）' : undefined} />}

            <button disabled style={{ display: 'block', width: '100%', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, background: '#1a1a1a', color: '#fff', marginTop: '8px', cursor: 'default' }}>
              退勤を完了する
            </button>
          </div>
        </div>
      </div>

      <div style={{ fontSize: '11px', color: '#aaa', textAlign: 'center', padding: '10px 4px 0' }}>
        実機 attendance-app の入力フォームを構成定義から再現したプレビューです（操作は無効）。
      </div>
    </div>
  );
}
