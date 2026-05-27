'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const S = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f3',
  } as React.CSSProperties,
  card: {
    background: '#fff',
    border: '1px solid #e8e8e4',
    borderRadius: '16px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '360px',
  } as React.CSSProperties,
  logo: {
    fontSize: '13px',
    color: '#888',
    letterSpacing: '0.08em',
    marginBottom: '4px',
    textTransform: 'uppercase' as const,
  },
  title: { fontSize: '22px', fontWeight: 500, color: '#1a1a1a', marginBottom: '32px' },
  label: { display: 'block', fontSize: '13px', color: '#555', marginBottom: '6px', fontWeight: 500 } as React.CSSProperties,
  input: {
    width: '100%', padding: '10px 14px',
    border: '1px solid #ddd', borderRadius: '8px',
    fontSize: '15px', outline: 'none',
  } as React.CSSProperties,
  btn: {
    width: '100%', padding: '11px',
    background: '#3B6D11', color: '#fff',
    border: 'none', borderRadius: '8px',
    fontSize: '15px', fontWeight: 500,
    marginTop: '24px', cursor: 'pointer',
  } as React.CSSProperties,
  error: { color: '#c0392b', fontSize: '13px', marginTop: '10px', textAlign: 'center' as const },
};

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('bihada_auth') === 'ok') {
        router.push('/dashboard/attendance');
      }
    }
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (password === process.env.NEXT_PUBLIC_APP_PASSWORD) {
      localStorage.setItem('bihada_auth', 'ok');
      router.push('/dashboard/attendance');
    } else {
      setError('パスワードが違います');
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <p style={S.logo}>ELAN MARIRE</p>
        <h1 style={S.title}>管理ダッシュボード</h1>
        <form onSubmit={handleSubmit}>
          <label style={S.label}>パスワード</label>
          <input
            style={S.input} type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワードを入力" autoFocus required
          />
          {error && <p style={S.error}>{error}</p>}
          <button
            style={S.btn} type="submit" disabled={loading}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#27500A')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#3B6D11')}
          >
            {loading ? '確認中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}
