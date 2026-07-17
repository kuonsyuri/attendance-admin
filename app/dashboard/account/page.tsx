'use client';

import { useEffect, useState } from 'react';
import { colors, card, input, label, btnPrimary } from '@/lib/theme';

type Me = { sub: number | null; role: 'admin' | 'manager'; name: string; legacy: boolean };

const ROLE_LABEL: Record<Me['role'], string> = { admin: '本部スタッフ', manager: '店舗責任者' };

export default function AccountPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Me | null) => setMe(d))
      .catch(() => setMe(null));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDone(false);
    if (next !== confirm) {
      setError('新しいパスワードが一致しません');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
        setCurrent('');
        setNext('');
        setConfirm('');
      } else {
        setError(d.error || 'パスワードの変更に失敗しました');
      }
    } catch {
      setError('通信エラーが発生しました');
    }
    setSaving(false);
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: '520px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 500, color: colors.text, marginBottom: '4px' }}>アカウント</h1>
      <p style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '24px' }}>
        ログイン中のアカウント情報とパスワードの変更
      </p>

      <div style={{ ...card, padding: '20px', marginBottom: '20px' }}>
        {me ? (
          <div style={{ display: 'flex', gap: '32px', fontSize: '13px' }}>
            <div>
              <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: '3px' }}>スタッフID</div>
              <div style={{ color: colors.text }}>{me.sub ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: '3px' }}>氏名</div>
              <div style={{ color: colors.text }}>{me.name}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: '3px' }}>権限</div>
              <span style={{ background: colors.brandBg, color: colors.brand, border: `1px solid ${colors.brandBorder}`, borderRadius: '5px', padding: '2px 8px', fontSize: '12px' }}>
                {ROLE_LABEL[me.role]}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: colors.textMuted }}>読み込み中...</div>
        )}
      </div>

      {me?.legacy && (
        <div style={{ background: '#FFF8E6', border: '1px solid #F0DFA8', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#7A5C00', marginBottom: '20px', lineHeight: 1.6 }}>
          共有パスワードでログインしています。操作の記録が個人に紐づきません。
          一度ログアウトし、<strong>スタッフID</strong>とご自身のパスワードでログインし直してください。
        </div>
      )}

      <div style={{ ...card, padding: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 500, color: colors.text, marginBottom: '16px' }}>パスワード変更</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={label}>現在のパスワード</label>
            <input style={input} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={label}>新しいパスワード（8文字以上）</label>
            <input style={input} type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={label}>新しいパスワード（確認）</label>
            <input style={input} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>

          {error && <p style={{ color: colors.danger, fontSize: '12px', marginBottom: '10px' }}>{error}</p>}
          {done && <p style={{ color: colors.brand, fontSize: '12px', marginBottom: '10px' }}>パスワードを変更しました。次回のログインから新しいパスワードを使用してください。</p>}

          <button style={{ ...btnPrimary, opacity: saving || me?.legacy ? 0.5 : 1 }} type="submit" disabled={saving || me?.legacy}>
            {saving ? '変更中...' : 'パスワードを変更'}
          </button>
        </form>
      </div>
    </div>
  );
}
