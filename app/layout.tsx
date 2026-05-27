import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ELAN MARIRE 管理',
  description: 'スタッフ・出退勤・店舗の管理ダッシュボード',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
