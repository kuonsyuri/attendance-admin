'use client';

// 全モーダルの標準骨格（単一定義）。
// オーバーレイ／中央カード／背景クリックで閉じる／90vh制限を共通化する。
// - title あり: 標準ヘッダ（h2）付きの白カード（フォーム系）
// - unpadded : 子側でヘッダ・本文・フッタを構成（内部スクロールは子の overflowY で行う）

export function Modal({
  onClose,
  maxWidth = 440,
  title,
  unpadded = false,
  background = '#fff',
  children,
}: {
  onClose: () => void;
  maxWidth?: number;
  title?: string;
  unpadded?: boolean;
  background?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="no-print"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}
    >
      <div
        style={{
          background,
          borderRadius: '14px',
          width: '100%',
          maxWidth: `${maxWidth}px`,
          maxHeight: '90vh',
          boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          padding: unpadded ? 0 : '28px',
          overflowY: unpadded ? 'hidden' : 'auto',
        }}
      >
        {title && <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '20px' }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}
