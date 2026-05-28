'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, AttendanceLog, Staff } from '@/lib/supabase';

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e8e8e4', borderRadius: '12px', overflow: 'hidden',
};
const inputStyle: React.CSSProperties = {
  padding: '7px 12px', border: '1px solid #ddd', borderRadius: '7px',
  fontSize: '13px', background: '#fff', outline: 'none',
};

type StaffSummary = {
  staffId: number;
  staffName: string;
  storeName: string;
  workDays: number;
  totalMinutes: number;
  stampedDays: number;
  reports: { date: string; reportType: string; summary: string }[];
  aiSummary?: string;
  summarizing?: boolean;
};

function calcMinutes(logs: AttendanceLog[]): number {
  const clockIn = logs.find((l) => l.type === 'clock_in');
  const clockOut = logs.find((l) => l.type === 'clock_out');
  if (!clockIn || !clockOut) return 0;
  return Math.round((new Date(clockOut.punched_at).getTime() - new Date(clockIn.punched_at).getTime()) / 60000);
}

function fmtDuration(minutes: number): string {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function SummaryPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'weekly' | 'monthly'>('monthly');
  const [summaries, setSummaries] = useState<StaffSummary[]>([]);

  // 期間計算
  const now = new Date();
  const getRange = useCallback(() => {
    if (mode === 'weekly') {
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return { from: monday.toISOString(), to: sunday.toISOString(), label: `今週 (${monday.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}〜${sunday.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })})` };
    } else {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { from: firstDay.toISOString(), to: lastDay.toISOString(), label: `${now.getFullYear()}年${now.getMonth() + 1}月` };
    }
  }, [mode]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = getRange();
    const [{ data: staffData }, { data: logData }] = await Promise.all([
      supabase.from('staff').select('*, stores(*)').order('name'),
      supabase
        .from('attendance_logs')
        .select('*, staff(*, stores(*))')
        .gte('punched_at', from)
        .lte('punched_at', to)
        .order('punched_at'),
    ]);
    setStaffList((staffData as Staff[]) || []);
    setLogs((logData as AttendanceLog[]) || []);
    setLoading(false);
  }, [getRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // スタッフ別集計
  useEffect(() => {
    if (logs.length === 0 && !loading) {
      setSummaries([]);
      return;
    }
    const map = new Map<number, { logs: Map<string, AttendanceLog[]>; staff: AttendanceLog['staff'] }>();

    for (const log of logs) {
      if (!map.has(log.staff_id)) map.set(log.staff_id, { logs: new Map(), staff: log.staff });
      const staffEntry = map.get(log.staff_id)!;
      const date = log.punched_at.slice(0, 10);
      if (!staffEntry.logs.has(date)) staffEntry.logs.set(date, []);
      staffEntry.logs.get(date)!.push(log);
    }

    const result: StaffSummary[] = [];
    for (const [staffId, entry] of Array.from(map.entries())) {
      let totalMinutes = 0;
      let stampedDays = 0;
      const reports: StaffSummary['reports'] = [];

      for (const [date, dayLogs] of Array.from(entry.logs.entries())) {
        totalMinutes += calcMinutes(dayLogs);
        if (dayLogs.some((l) => l.is_stamped)) stampedDays++;
        const reportLog = dayLogs.find((l) => l.report_type != null);
        if (reportLog) {
          const rt = reportLog.report_type || 'daily';
          let summary = '';
          if (rt === 'goal') {
            summary = `月初目標: ${reportLog.monthly_goal || '（未記入）'}`;
          } else if (rt === 'daily') {
            summary = [
              `新規コース: ${reportLog.fact_new_course ?? 0}件`,
              `サブスク合計: ${((reportLog.fact_sub_15 ?? 0) + (reportLog.fact_sub_13 ?? 0) + (reportLog.fact_sub_11 ?? 0))}件`,
              `既存顧客: ${reportLog.fact_existing_customers ?? 0}件`,
              `総売上: ${reportLog.fact_total_revenue != null ? `¥${reportLog.fact_total_revenue.toLocaleString('ja-JP')}` : '未入力'}`,
            ].join(' / ');
          } else if (rt === 'review') {
            summary = [
              `よかったこと①: ${reportLog.review_good_1 || ''}`,
              `よかったこと②: ${reportLog.review_good_2 || ''}`,
              `アクションプラン: ${reportLog.review_action_plan || ''}`,
            ].filter(s => s).join('\n');
          }
          reports.push({ date, reportType: rt, summary });
        }
      }

      result.push({
        staffId,
        staffName: entry.staff?.name || `#${staffId}`,
        storeName: entry.staff?.stores?.name || '—',
        workDays: entry.logs.size,
        totalMinutes,
        stampedDays,
        reports,
      });
    }

    result.sort((a, b) => b.workDays - a.workDays);
    setSummaries(result);
  }, [logs, loading]);

  const generateSummary = async (staffId: number) => {
    setSummaries((prev) =>
      prev.map((s) => (s.staffId === staffId ? { ...s, summarizing: true } : s))
    );

    const target = summaries.find((s) => s.staffId === staffId)!;
    const { label } = getRange();

    const reportText = target.reports.map((r) =>
      `【${r.date}（${r.reportType}）】\n${r.summary}`
    ).join('\n\n');

    const prompt = `以下は美容サロンスタッフ「${target.staffName}」の${label}の日報です。\n出勤日数: ${target.workDays}日 / 合計勤務: ${fmtDuration(target.totalMinutes)}\n\n${reportText}\n\n上記を200字以内で要約してください。業務の傾向、改善提案への対応、特記事項を簡潔にまとめてください。`;

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setSummaries((prev) =>
        prev.map((s) =>
          s.staffId === staffId ? { ...s, aiSummary: data.summary, summarizing: false } : s
        )
      );
    } catch {
      setSummaries((prev) =>
        prev.map((s) =>
          s.staffId === staffId ? { ...s, aiSummary: '要約の生成に失敗しました。APIキーを確認してください。', summarizing: false } : s
        )
      );
    }
  };

  const { label } = getRange();

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 500 }}>サマリー</h1>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
          スタッフ別の出勤実績と日報をAIで自動要約できます
        </p>
      </div>

      {/* 期間切り替え */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', alignItems: 'center' }}>
        {(['weekly', 'monthly'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '6px 16px', border: '1px solid', borderRadius: '7px', fontSize: '13px', cursor: 'pointer',
              borderColor: mode === m ? '#3B6D11' : '#ddd',
              background: mode === m ? '#3B6D11' : '#fff',
              color: mode === m ? '#fff' : '#555',
              fontWeight: mode === m ? 500 : 400,
            }}
          >
            {m === 'weekly' ? '今週' : '今月'}
          </button>
        ))}
        <span style={{ fontSize: '13px', color: '#888', marginLeft: '8px' }}>{label}</span>
        <button onClick={fetchData} style={{ marginLeft: 'auto', padding: '6px 14px', border: '1px solid #ddd', borderRadius: '7px', fontSize: '12px', background: '#fff', cursor: 'pointer', color: '#555' }}>
          更新
        </button>
      </div>

      {/* 集計テーブル */}
      <div style={{ ...card, marginBottom: '20px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>読み込み中...</div>
        ) : summaries.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>この期間のデータがありません</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: '#888', fontWeight: 500, letterSpacing: '0.04em', borderBottom: '1px solid #e8e8e4', background: '#fafaf8' }}>スタッフ</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: '#888', fontWeight: 500, letterSpacing: '0.04em', borderBottom: '1px solid #e8e8e4', background: '#fafaf8' }}>店舗</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '11px', color: '#888', fontWeight: 500, letterSpacing: '0.04em', borderBottom: '1px solid #e8e8e4', background: '#fafaf8' }}>出勤日数</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '11px', color: '#888', fontWeight: 500, letterSpacing: '0.04em', borderBottom: '1px solid #e8e8e4', background: '#fafaf8' }}>合計勤務</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '11px', color: '#888', fontWeight: 500, letterSpacing: '0.04em', borderBottom: '1px solid #e8e8e4', background: '#fafaf8' }}>確認済み</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '11px', color: '#888', fontWeight: 500, letterSpacing: '0.04em', borderBottom: '1px solid #e8e8e4', background: '#fafaf8' }}>日報</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '11px', color: '#888', fontWeight: 500, letterSpacing: '0.04em', borderBottom: '1px solid #e8e8e4', background: '#fafaf8', width: '120px' }}>AI要約</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.staffId}>
                  <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 500, borderBottom: '1px solid #f0f0ec' }}>{s.staffName}</td>
                  <td style={{ padding: '12px 14px', fontSize: '13px', color: '#666', borderBottom: '1px solid #f0f0ec' }}>{s.storeName}</td>
                  <td style={{ padding: '12px 14px', fontSize: '15px', fontWeight: 500, textAlign: 'center', borderBottom: '1px solid #f0f0ec' }}>{s.workDays}<span style={{ fontSize: '11px', color: '#888', fontWeight: 400 }}>日</span></td>
                  <td style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center', borderBottom: '1px solid #f0f0ec' }}>{fmtDuration(s.totalMinutes)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', borderBottom: '1px solid #f0f0ec' }}>
                    <span style={{ fontSize: '13px', color: s.stampedDays === s.workDays && s.workDays > 0 ? '#3B6D11' : '#888' }}>
                      {s.stampedDays}/{s.workDays}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', borderBottom: '1px solid #f0f0ec' }}>
                    <span style={{ fontSize: '13px', color: s.reports.length > 0 ? '#1a1a1a' : '#ccc' }}>
                      {s.reports.length}件
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', borderBottom: '1px solid #f0f0ec' }}>
                    {s.reports.length > 0 ? (
                      <button
                        onClick={() => generateSummary(s.staffId)}
                        disabled={s.summarizing}
                        style={{
                          padding: '5px 12px', border: '1px solid #c3e0a0', borderRadius: '6px',
                          background: '#EAF3DE', color: '#3B6D11', fontSize: '11px', cursor: 'pointer', fontWeight: 500,
                        }}
                      >
                        {s.summarizing ? '生成中...' : s.aiSummary ? '再生成' : '✨ 要約'}
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#ccc' }}>日報なし</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* AI要約カード */}
      {summaries.filter((s) => s.aiSummary).map((s) => (
        <div key={s.staffId} style={{ ...card, padding: '20px 24px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <span style={{ fontWeight: 500, fontSize: '14px' }}>{s.staffName}</span>
              <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>{s.storeName} ／ {label}</span>
            </div>
            <span style={{ fontSize: '11px', background: '#EAF3DE', color: '#3B6D11', padding: '2px 8px', borderRadius: '99px', fontWeight: 500 }}>✨ AI要約</span>
          </div>
          <p style={{ fontSize: '13px', color: '#333', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{s.aiSummary}</p>
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f0f0ec', display: 'flex', gap: '16px', fontSize: '12px', color: '#888' }}>
            <span>出勤 {s.workDays}日</span>
            <span>勤務時間 {fmtDuration(s.totalMinutes)}</span>
            <span>日報 {s.reports.length}件</span>
            <span>確認済み {s.stampedDays}/{s.workDays}日</span>
          </div>
        </div>
      ))}

      {/* API設定案内 */}
      <div style={{ marginTop: '12px', padding: '12px 16px', background: '#fafaf8', border: '1px solid #e8e8e4', borderRadius: '8px', fontSize: '12px', color: '#888' }}>
        💡 AI要約にはAnthropicのAPIキーが必要です。<code style={{ background: '#eee', padding: '1px 4px', borderRadius: '3px' }}>.env.local</code> に <code style={{ background: '#eee', padding: '1px 4px', borderRadius: '3px' }}>ANTHROPIC_API_KEY=sk-ant-...</code> を追加してください。
      </div>
    </div>
  );
}
