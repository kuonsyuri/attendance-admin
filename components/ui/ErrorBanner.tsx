'use client';

// データ取得失敗の標準表示（全ページ共通）。
// 静かな失敗（空表示＝0件に見える）を禁止し、失敗は必ずこのバナーで可視化する。

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '13px', color: '#b91c1c', flex: 1, lineHeight: 1.6 }}>
        ⚠️ {message}
        <span style={{ display: 'block', fontSize: '11px', color: '#dc6b6b', marginTop: '2px' }}>
          表示中の集計・一覧は不完全な可能性があります。
        </span>
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{ padding: '7px 16px', border: '1px solid #fecaca', borderRadius: '7px', background: '#fff', fontSize: '12px', color: '#b91c1c', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          再読み込み
        </button>
      )}
    </div>
  );
}

/** Supabaseレスポンス群からエラーメッセージを合成（無ければnull） */
export function collectErrors(...results: Array<{ error: { message: string } | null }>): string | null {
  const msgs = results.filter(r => r.error).map(r => r.error!.message);
  if (msgs.length === 0) return null;
  return `データの取得に失敗しました：${Array.from(new Set(msgs)).join(' / ')}`;
}
