'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const navItems = [
  { href: '/dashboard/attendance', label: '出退勤ログ', icon: '📋' },
  { href: '/dashboard/analytics', label: '分析', icon: '📊' },
  { href: '/dashboard/reports', label: '日報', icon: '📝' },
  { href: '/dashboard/staff', label: 'スタッフ管理', icon: '👥' },
  { href: '/dashboard/stores', label: '店舗管理', icon: '🏪' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // 認証は middleware（httpOnly Cookieセッション）が保証するため、
  // クライアント側のガードは不要。
  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    router.push('/');
    router.refresh();
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f3' }}>
      <aside
        className="no-print"
        style={{
          width: '210px', background: '#fff',
          borderRight: '1px solid #e8e8e4',
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 10,
        }}
      >
        <div style={{ padding: '24px 20px 18px', borderBottom: '1px solid #e8e8e4' }}>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>ELAN MARIRE</div>
          <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>管理ダッシュボード</div>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px' }}>
          <div style={{ fontSize: '10px', color: '#aaa', padding: '8px 10px 4px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            メニュー
          </div>
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href} href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '9px 10px', borderRadius: '8px', fontSize: '13px',
                  color: active ? '#3B6D11' : '#555',
                  background: active ? '#EAF3DE' : 'transparent',
                  fontWeight: active ? 500 : 400, marginBottom: '2px',
                }}
              >
                <span style={{ fontSize: '15px' }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #e8e8e4' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '7px',
              border: '1px solid #ddd', borderRadius: '7px',
              fontSize: '12px', color: '#888', background: 'transparent', cursor: 'pointer',
            }}
          >
            ログアウト
          </button>
        </div>
      </aside>

      <main style={{ marginLeft: '210px', flex: 1, minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
