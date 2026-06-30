'use client';

import { useState } from 'react';
import { REPORT_SCHEMA, ReportField, ReportTypeDef, getReportTypeDef } from '@/lib/reportSchema';

type PreviewProps = { schema?: ReportTypeDef[] };

// LINE webview を模したスタッフ入力フォームのプレビュー。
// 構成定義（reportSchema）から生成するため、構成変更が即プレビューに反映される。

type Scenario = 'daily' | 'review' | 'goal';

// シナリオ → 表示する種別定義の並び（実機 showReportForm の表示順に対応）
const SCENARIO: Record<Scenario, { label: string; note: string; typeKeys: string[] }> = {
  daily:  { label: '通常日', note: '毎日実績のみ', typeKeys: ['daily'] },
  review: { label: '15日・月末', note: '毎日実績 ＋ 振り返り', typeKeys: ['daily', 'review'] },
  goal:   { label: '月初', note: '月初目標 ＋ 毎日実績', typeKeys: ['goal', 'daily'] },
};

// セクションヘッダーの絵文字（実機準拠）
const TYPE_EMOJI: Record<string, string> = { daily: '📊 本日の実績', review: '🔄 振り返り', goal: '🎯 今月の目標' };

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
      <label style={fieldLabel}>{f.label.replace(/^└ /, '└ ')}{f.unit && f.note && f.type === 'select' ? `（${f.note}）` : ''}</label>
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

function TypeBlock({ def }: { def: ReportTypeDef }) {
  const headerColor =
    def.key === 'review' ? { background: '#EFF6FF', color: '#1D4ED8' } :
    def.key === 'goal'   ? { background: '#FDF4FF', color: '#6B21A8' } :
                           { background: '#EAF3DE', color: '#3B6D11' };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, padding: '8px 12px', borderRadius: '8px', margin: '16px 0 12px', textAlign: 'left', ...headerColor }}>
        {TYPE_EMOJI[def.key] || def.label}
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
  const [scenario, setScenario] = useState<Scenario>('daily');
  const defs = SCENARIO[scenario].typeKeys.map(k => getReportTypeDef(k, schema)).filter(Boolean) as ReportTypeDef[];

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
          {/* LINE ヘッダーバー */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 600, padding: '4px 0 8px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '8px' }}>‹</span>
            ELAN MARIRE 出退勤
          </div>
          {/* アプリカード */}
          <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 16px', maxHeight: '440px', overflowY: 'auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '6px' }}>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#1a1a1a' }}>出退勤打刻</div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>山田 花子（プレビュー）</div>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0', margin: '14px 0' }} />

            {/* 種別の説明ノート */}
            <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '10px', padding: '10px 12px', marginBottom: '4px', textAlign: 'left', fontSize: '12px', color: '#795548', lineHeight: 1.7 }}>
              <strong style={{ color: '#e65100' }}>本日の日報</strong><br />
              {SCENARIO[scenario].note} を入力して退勤打刻を完了します。
            </div>

            {defs.map(def => <TypeBlock key={def.key} def={def} />)}

            {/* 送信ボタン */}
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
