'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, Staff, PendingStaff, Store } from '@/lib/supabase';

// ── 定数 ────────────────────────────────────────────────
const ROLES = ['オペレーター（施術者）', 'チーフ（店長候補）', '店長', 'エリアマネージャー', '本部スタッフ'];

// ── スタイル ─────────────────────────────────────────────
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e8e8e4', borderRadius: '12px', overflow: 'hidden' };
const thS: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: '#888', fontWeight: 500, letterSpacing: '0.04em', borderBottom: '1px solid #e8e8e4', background: '#fafaf8', whiteSpace: 'nowrap' };
const tdS: React.CSSProperties = { padding: '10px 12px', fontSize: '13px', color: '#1a1a1a', borderBottom: '1px solid #f0f0ec', verticalAlign: 'middle' };
const sel: React.CSSProperties = { padding: '6px 10px', border: '1px solid #ddd', borderRadius: '7px', fontSize: '13px', background: '#fff', outline: 'none' };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '7px', fontSize: '13px', outline: 'none', marginBottom: '10px' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '11px', color: '#666', fontWeight: 500, marginBottom: '4px' };

// ── 型 ──────────────────────────────────────────────────
type EditForm     = { name: string; role: string; storeIds: number[]; hiredYear: string; memo: string };
type AddForm      = { name: string; role: string; storeIds: number[]; memo: string };
type ApprovalForm = { name: string; role: string; storeIds: number[] };
type Expansion    = { id: number; mode: 'view' | 'edit' } | null;

// ── ヘルパー ─────────────────────────────────────────────
function getStoreNames(s: Staff): string {
  if (s.staff_stores && s.staff_stores.length > 0)
    return s.staff_stores.map(ss => ss.stores?.name).filter(Boolean).join('、') || '—';
  return (s.stores as Store | undefined)?.name || '—';
}

function StoreCheckboxes({ storeList, ids, onChange }: { storeList: Store[]; ids: number[]; onChange: (ids: number[]) => void }) {
  const toggle = (sid: number) =>
    onChange(ids.includes(sid) ? ids.filter(i => i !== sid) : [...ids, sid]);
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '7px', padding: '8px 10px', marginBottom: '10px', maxHeight: '160px', overflowY: 'auto' }}>
      {storeList.length === 0
        ? <span style={{ fontSize: '12px', color: '#aaa' }}>店舗が登録されていません</span>
        : storeList.map(s => (
          <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', cursor: 'pointer', borderBottom: '1px solid #f5f5f5' }}>
            <input type="checkbox" checked={ids.includes(s.id)} onChange={() => toggle(s.id)} style={{ accentColor: '#3B6D11', cursor: 'pointer' }} />
            <span style={{ fontSize: '13px' }}>{s.name}</span>
          </label>
        ))}
    </div>
  );
}

// ── メインページ ──────────────────────────────────────────
export default function StaffPage() {
  const [staffList, setStaffList]     = useState<Staff[]>([]);
  const [pendingList, setPendingList] = useState<PendingStaff[]>([]);
  const [storeList, setStoreList]     = useState<Store[]>([]);
  const [adoptCounts, setAdoptCounts] = useState<Map<number, number>>(new Map());
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<'staff' | 'pending'>('staff');

  const [filterStore,   setFilterStore]   = useState('');
  const [filterRole,    setFilterRole]    = useState('');
  const [filterAdopted, setFilterAdopted] = useState('');

  const [deleteMode,  setDeleteMode]  = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [expansion, setExpansion] = useState<Expansion>(null);
  const [editForm,  setEditForm]  = useState<EditForm>({ name: '', role: '', storeIds: [], hiredYear: '', memo: '' });

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({ name: '', role: '', storeIds: [], memo: '' });
  const [saving,  setSaving]  = useState(false);

  // 承認モーダル用
  const [approvalTarget, setApprovalTarget] = useState<PendingStaff | null>(null);
  const [approvalForm,   setApprovalForm]   = useState<ApprovalForm>({ name: '', role: '', storeIds: [] });
  const [approving,      setApproving]      = useState(false);

  // LINEフォロワー同期
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: sData }, { data: pData }, { data: stData }, { data: adoptData }] = await Promise.all([
      supabase.from('staff').select('*, staff_stores(*, stores(*))').order('name'),
      // status='pending' のみ表示
      supabase.from('pending_staff').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('stores').select('*').order('name'),
      supabase.from('attendance_logs').select('staff_id').eq('is_adopted', true),
    ]);
    setStaffList((sData as Staff[]) || []);
    setPendingList((pData as PendingStaff[]) || []);
    setStoreList((stData as Store[]) || []);
    const counts = new Map<number, number>();
    for (const row of (adoptData || []) as { staff_id: number }[])
      counts.set(row.staff_id, (counts.get(row.staff_id) || 0) + 1);
    setAdoptCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() =>
    staffList
      .filter(s => {
        if (filterStore) {
          const ids = s.staff_stores?.map(ss => String(ss.store_id)) || [];
          if (!ids.includes(filterStore)) return false;
        }
        if (filterRole && s.role !== filterRole) return false;
        if (filterAdopted !== '' && (adoptCounts.get(s.id) || 0) < Number(filterAdopted)) return false;
        return true;
      })
      .sort((a, b) => (adoptCounts.get(a.id) || 0) - (adoptCounts.get(b.id) || 0)),
    [staffList, filterStore, filterRole, filterAdopted, adoptCounts]);

  // ── 展開 ────────────────────────────────────────────────
  const toggleView = (id: number) =>
    setExpansion(prev => prev?.id === id && prev.mode === 'view' ? null : { id, mode: 'view' });

  const openEdit = (s: Staff) => {
    const ids = s.staff_stores?.map(ss => Number(ss.store_id)) || (s.store_id ? [s.store_id] : []);
    const hiredYear = s.hired_at ? String(new Date(s.hired_at).getFullYear()) : '';
    setEditForm({ name: s.name, role: s.role || '', storeIds: ids, hiredYear, memo: s.memo || '' });
    setExpansion(prev => prev?.id === s.id && prev.mode === 'edit' ? null : { id: s.id, mode: 'edit' });
  };

  // ── 削除モード ───────────────────────────────────────────
  const toggleDeleteMode = () => { setDeleteMode(p => !p); setSelectedIds(new Set()); setExpansion(null); };
  const toggleSelect = (id: number) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`選択した${selectedIds.size}名を削除しますか？\n※ 出退勤ログも含めて完全に削除されます。`)) return;
    try {
      const res = await fetch('/api/delete-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: process.env.NEXT_PUBLIC_APP_PASSWORD ?? '',
          staffIds: Array.from(selectedIds),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert('削除に失敗しました:\n' + (data.errors?.join('\n') || data.error || `HTTP ${res.status}`));
        return;
      }
    } catch {
      alert('削除リクエストに失敗しました。再試行してください。');
      return;
    }
    setDeleteMode(false); setSelectedIds(new Set()); await fetchData();
  };

  // ── 編集保存 ─────────────────────────────────────────────
  const handleEditSave = async (staffId: number) => {
    if (!editForm.name) return alert('名前は必須です');
    setSaving(true);
    const hiredAt = editForm.hiredYear ? `${editForm.hiredYear}-04-01` : null;
    await supabase.from('staff').update({
      name: editForm.name, role: editForm.role,
      store_id: editForm.storeIds[0] || null, hired_at: hiredAt, memo: editForm.memo,
    }).eq('id', staffId);
    await supabase.from('staff_stores').delete().eq('staff_id', staffId);
    for (const sid of editForm.storeIds)
      await supabase.from('staff_stores').insert({ staff_id: staffId, store_id: sid });
    setSaving(false); setExpansion(null); await fetchData();
  };

  // ── 手動登録 ─────────────────────────────────────────────
  const handleAdd = async () => {
    if (!addForm.name) return alert('名前は必須です');
    if (addForm.storeIds.length === 0) return alert('店舗を選択してください');
    setSaving(true);
    const { data, error } = await supabase.from('staff')
      .insert({ name: addForm.name, role: addForm.role, store_id: addForm.storeIds[0], memo: addForm.memo })
      .select('id').single();
    if (error || !data) { setSaving(false); return alert('登録に失敗しました: ' + (error?.message || '')); }
    for (const sid of addForm.storeIds)
      await supabase.from('staff_stores').insert({ staff_id: data.id, store_id: sid });
    setSaving(false); setShowAdd(false); setAddForm({ name: '', role: '', storeIds: [], memo: '' }); await fetchData();
  };

  // ── LINE申請：承認モーダルを開く ──────────────────────────
  const openApproval = (p: PendingStaff) => {
    setApprovalTarget(p);
    setApprovalForm({ name: p.display_name, role: '', storeIds: [] });
  };

  // ── LINE申請：承認確定 ────────────────────────────────────
  const confirmApproval = async () => {
    if (!approvalTarget) return;
    if (!approvalForm.name) return alert('名前は必須です');
    if (approvalForm.storeIds.length === 0) return alert('店舗を選択してください');
    setApproving(true);

    // 承認時の値をローカルにコピー（非同期中のstate変化を防ぐ）
    const lineUserId = approvalTarget.line_user_id;
    const pendingId  = approvalTarget.id;
    const { name, role, storeIds } = approvalForm;

    // 1. staffテーブルにINSERT（.select()なし → RLSの影響を受けない）
    const { error: staffError } = await supabase.from('staff').insert({
      line_user_id: lineUserId,
      name,
      role,
      store_id: storeIds[0],
    });

    if (staffError) {
      setApproving(false);
      return alert('スタッフ登録に失敗しました: ' + staffError.message);
    }

    // 2. 挿入したスタッフのIDをline_user_idで取得
    const { data: newStaff, error: fetchError } = await supabase
      .from('staff')
      .select('id')
      .eq('line_user_id', lineUserId)
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !newStaff) {
      setApproving(false);
      return alert('スタッフIDの取得に失敗しました: ' + (fetchError?.message || ''));
    }

    // 3. staff_storesに全選択店舗を登録
    await Promise.all(
      storeIds.map(sid =>
        supabase.from('staff_stores').insert({ staff_id: newStaff.id, store_id: sid })
      )
    );

    // 4. pending_staffのstatusをapprovedに更新
    await supabase.from('pending_staff')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', pendingId);

    setApproving(false);
    setApprovalTarget(null);
    await fetchData();
  };

  // ── LINEフォロワー一括同期 ────────────────────────────────
  const syncLineFollowers = async () => {
    if (!confirm('LINEの全フォロワーを申請リストに同期しますか？\n既登録スタッフはスキップされます。')) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/sync-line-followers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: process.env.NEXT_PUBLIC_APP_PASSWORD ?? '' }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert('同期エラー: ' + (data.error || res.status));
      } else {
        alert(`同期完了！\nフォロワー: ${data.followers}名\n新規追加: ${data.added}名\nスキップ: ${data.skipped}名`);
        await fetchData();
      }
    } catch {
      alert('同期中にエラーが発生しました');
    } finally {
      setSyncing(false);
    }
  };

  // ── LINE申請：却下（削除ではなくstatus変更） ──────────────
  const rejectPending = async (p: PendingStaff) => {
    if (!confirm(`「${p.display_name}」の申請を却下しますか？`)) return;
    await supabase.from('pending_staff')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', p.id);
    await fetchData();
  };

  const btnBase: React.CSSProperties = { padding: '7px 14px', border: '1px solid #ddd', borderRadius: '7px', fontSize: '12px', cursor: 'pointer', background: '#fff', color: '#555' };

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 500 }}>スタッフ管理</h1>
          <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>スタッフの登録・編集と、LINE申請の承認ができます</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowAdd(true)} style={{ ...btnBase, background: '#3B6D11', color: '#fff', border: 'none', fontWeight: 500 }}>登録</button>
          <button
            onClick={deleteMode ? handleBulkDelete : toggleDeleteMode}
            style={{ ...btnBase, ...(deleteMode ? { background: '#c0392b', color: '#fff', border: 'none' } : {}) }}
          >
            {deleteMode ? `削除（${selectedIds.size}名選択中）` : '削除'}
          </button>
          {deleteMode && <button onClick={toggleDeleteMode} style={btnBase}>キャンセル</button>}
        </div>
      </div>

      {/* タブ */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '16px', borderBottom: '1px solid #e8e8e4' }}>
        {(['staff', 'pending'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 18px', border: 'none', background: 'transparent', fontSize: '13px', cursor: 'pointer', color: tab === t ? '#3B6D11' : '#888', fontWeight: tab === t ? 600 : 400, borderBottom: tab === t ? '2px solid #3B6D11' : '2px solid transparent', marginBottom: '-1px' }}>
            {t === 'staff' ? `登録済み (${staffList.length})` : `LINE申請中 (${pendingList.length})`}
          </button>
        ))}
      </div>

      {/* ── スタッフタブ ── */}
      {tab === 'staff' && (
        <>
          {/* 検索バー */}
          <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '12px', padding: '14px 20px', marginBottom: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filterStore} onChange={e => setFilterStore(e.target.value)} style={{ ...sel, width: '140px' }}>
              <option value="">店舗</option>
              {storeList.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ ...sel, width: '180px' }}>
              <option value="">役職</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: '#888' }}>採択数</span>
              <input type="number" min={0} placeholder="0" value={filterAdopted} onChange={e => setFilterAdopted(e.target.value)} style={{ ...sel, width: '60px' }} />
              <span style={{ fontSize: '12px', color: '#888' }}>以上</span>
            </div>
            <button onClick={fetchData} style={{ marginLeft: 'auto', padding: '7px 20px', background: '#3B6D11', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>検索</button>
          </div>

          {/* テーブル */}
          <div style={card}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>読み込み中...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>スタッフが見つかりません</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {deleteMode && <th style={{ ...thS, width: '40px', textAlign: 'center' }}>☐</th>}
                    <th style={thS}>店舗</th>
                    <th style={thS}>スタッフ名</th>
                    <th style={thS}>役職</th>
                    <th style={{ ...thS, textAlign: 'center' }}>採用年度</th>
                    <th style={{ ...thS, textAlign: 'center' }}>採択数</th>
                    <th style={{ ...thS, width: '60px' }}></th>
                    <th style={{ ...thS, width: '40px', textAlign: 'center' }}>▼</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const adopted = adoptCounts.get(s.id) || 0;
                    const hiredYear = s.hired_at ? String(new Date(s.hired_at).getFullYear()) : '—';
                    const isExpView = expansion?.id === s.id && expansion.mode === 'view';
                    const isExpEdit = expansion?.id === s.id && expansion.mode === 'edit';
                    const isExp = isExpView || isExpEdit;

                    return (
                      <>
                        <tr key={s.id} style={{ background: isExp ? '#fafaf8' : 'transparent' }}>
                          {deleteMode && (
                            <td style={{ ...tdS, textAlign: 'center' }}>
                              <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} style={{ accentColor: '#c0392b', cursor: 'pointer', width: '15px', height: '15px' }} />
                            </td>
                          )}
                          <td style={{ ...tdS, fontSize: '12px', color: '#666' }}>{getStoreNames(s)}</td>
                          <td style={{ ...tdS, fontWeight: 500 }}>{s.name}</td>
                          <td style={{ ...tdS, fontSize: '12px' }}>{s.role || '—'}</td>
                          <td style={{ ...tdS, textAlign: 'center', fontSize: '12px', color: '#666' }}>{hiredYear}</td>
                          <td style={{ ...tdS, textAlign: 'center' }}>
                            <span style={{ fontSize: '15px', fontWeight: 600, color: adopted > 0 ? '#3B6D11' : '#ccc' }}>{adopted}</span>
                            <span style={{ fontSize: '11px', color: '#888' }}>件</span>
                          </td>
                          <td style={{ ...tdS, textAlign: 'center' }}>
                            <button onClick={() => openEdit(s)} style={{ padding: '3px 10px', border: '1px solid #ddd', borderRadius: '5px', background: isExpEdit ? '#EAF3DE' : '#fff', color: isExpEdit ? '#3B6D11' : '#555', fontSize: '11px', cursor: 'pointer' }}>編集</button>
                          </td>
                          <td style={{ ...tdS, textAlign: 'center' }}>
                            <button onClick={() => toggleView(s.id)} style={{ padding: '3px 10px', border: '1px solid #ddd', borderRadius: '5px', background: '#fff', color: '#555', fontSize: '11px', cursor: 'pointer' }}>{isExpView ? '▲' : '>'}</button>
                          </td>
                        </tr>

                        {/* 閲覧展開 */}
                        {isExpView && (
                          <tr key={s.id + '_view'}>
                            <td colSpan={deleteMode ? 8 : 7} style={{ padding: '12px 16px 16px', background: '#fafaf8', borderBottom: '1px solid #e8e8e4' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                {[
                                  { label: '店舗', value: getStoreNames(s) },
                                  { label: 'スタッフ名', value: s.name },
                                  { label: '役職', value: s.role || '—' },
                                  { label: '採用年度', value: hiredYear },
                                  { label: '採択数', value: `${adopted}件` },
                                ].map(({ label, value }) => (
                                  <div key={label} style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '7px', padding: '8px 12px' }}>
                                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '3px' }}>{label}</div>
                                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{value}</div>
                                  </div>
                                ))}
                              </div>
                              {s.memo && (
                                <div style={{ marginTop: '10px', background: '#fff', border: '1px solid #e8e8e4', borderRadius: '7px', padding: '10px 12px' }}>
                                  <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>メモ</div>
                                  <div style={{ fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{s.memo}</div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}

                        {/* 編集展開 */}
                        {isExpEdit && (
                          <tr key={s.id + '_edit'}>
                            <td colSpan={deleteMode ? 8 : 7} style={{ padding: '12px 16px 16px', background: '#fafaf8', borderBottom: '1px solid #e8e8e4' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '640px' }}>
                                <div>
                                  <span style={lbl}>スタッフ名</span>
                                  <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={inp} />
                                  <span style={lbl}>役職</span>
                                  <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} style={{ ...sel, width: '100%', marginBottom: '10px' }}>
                                    <option value="">選択してください</option>
                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                  </select>
                                  <span style={lbl}>採用年度</span>
                                  <input value={editForm.hiredYear} onChange={e => setEditForm({ ...editForm, hiredYear: e.target.value })} placeholder="例：2024" style={inp} />
                                </div>
                                <div>
                                  <span style={lbl}>店舗（複数選択可）</span>
                                  <StoreCheckboxes storeList={storeList} ids={editForm.storeIds} onChange={ids => setEditForm({ ...editForm, storeIds: ids })} />
                                  <span style={lbl}>メモ</span>
                                  <textarea value={editForm.memo} onChange={e => setEditForm({ ...editForm, memo: e.target.value })} rows={3} style={{ ...inp, resize: 'vertical' }} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button onClick={() => setExpansion(null)} style={{ padding: '6px 16px', border: '1px solid #ddd', borderRadius: '7px', background: '#fff', fontSize: '12px', cursor: 'pointer', color: '#555' }}>キャンセル</button>
                                <button onClick={() => handleEditSave(s.id)} disabled={saving} style={{ padding: '6px 16px', background: '#3B6D11', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>{saving ? '保存中...' : '保存する'}</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── LINE申請タブ ── */}
      {tab === 'pending' && (
        <>
          {/* 同期ボタン */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
            <button
              onClick={syncLineFollowers}
              disabled={syncing}
              style={{ padding: '7px 16px', border: '1px solid #ddd', borderRadius: '7px', fontSize: '12px', cursor: 'pointer', background: '#fff', color: '#555', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {syncing ? '同期中...' : '📲 LINEフォロワーを同期'}
            </button>
          </div>

        <div style={card}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>読み込み中...</div>
          ) : pendingList.length === 0 ? (
            <div style={{ padding: '60px 40px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📱</div>
              <div style={{ color: '#aaa', fontSize: '14px' }}>申請中のスタッフはいません</div>
              <div style={{ color: '#bbb', fontSize: '12px', marginTop: '6px' }}>LINEで友達追加すると自動的にここに表示されます</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thS, width: '48px' }}></th>
                  <th style={thS}>表示名</th>
                  <th style={thS}>LINE ID</th>
                  <th style={thS}>申請日時</th>
                  <th style={{ ...thS, width: '180px', textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {pendingList.map(p => (
                  <tr key={p.id}>
                    <td style={{ ...tdS, textAlign: 'center' }}>
                      {p.picture_url ? (
                        <img
                          src={p.picture_url}
                          alt={p.display_name}
                          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e8e8e4' }}
                        />
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#EAF3DE', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                          👤
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdS, fontWeight: 500 }}>{p.display_name}</td>
                    <td style={{ ...tdS, fontSize: '11px', color: '#aaa', fontFamily: 'monospace' }}>{p.line_user_id.slice(0, 16)}...</td>
                    <td style={{ ...tdS, color: '#888', fontSize: '12px' }}>{new Date(p.created_at).toLocaleString('ja-JP')}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>
                      <button
                        onClick={() => openApproval(p)}
                        style={{ padding: '4px 14px', border: '1px solid #c3e0a0', borderRadius: '6px', background: '#EAF3DE', color: '#3B6D11', fontSize: '11px', cursor: 'pointer', fontWeight: 500 }}
                      >
                        承認
                      </button>
                      <button
                        onClick={() => rejectPending(p)}
                        style={{ marginLeft: '6px', padding: '4px 12px', border: '1px solid #f5c6c6', borderRadius: '6px', background: '#fff', color: '#c0392b', fontSize: '11px', cursor: 'pointer' }}
                      >
                        却下
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </>
      )}

      {/* ── 手動登録モーダル ── */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '20px' }}>スタッフを登録</h2>
            <span style={lbl}>スタッフ名 *</span>
            <input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} placeholder="例：田中 さくら" style={inp} />
            <span style={lbl}>役職</span>
            <select value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })} style={{ ...sel, width: '100%', marginBottom: '10px' }}>
              <option value="">選択してください</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <span style={lbl}>店舗 * <span style={{ fontWeight: 400, color: '#aaa' }}>（複数選択可）</span></span>
            <StoreCheckboxes storeList={storeList} ids={addForm.storeIds} onChange={ids => setAddForm({ ...addForm, storeIds: ids })} />
            <span style={lbl}>メモ</span>
            <textarea value={addForm.memo} onChange={e => setAddForm({ ...addForm, memo: e.target.value })} rows={3} style={{ ...inp, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '8px 18px', border: '1px solid #ddd', borderRadius: '7px', background: '#fff', fontSize: '13px', cursor: 'pointer', color: '#555' }}>キャンセル</button>
              <button onClick={handleAdd} disabled={saving} style={{ padding: '8px 18px', background: '#3B6D11', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>{saving ? '登録中...' : '登録する'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LINE承認モーダル ── */}
      {approvalTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={e => { if (e.target === e.currentTarget) setApprovalTarget(null); }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* ヘッダー */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              {approvalTarget.picture_url ? (
                <img src={approvalTarget.picture_url} alt={approvalTarget.display_name} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👤</div>
              )}
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>{approvalTarget.display_name}</div>
                <div style={{ fontSize: '11px', color: '#aaa', fontFamily: 'monospace', marginTop: '2px' }}>{approvalTarget.line_user_id.slice(0, 20)}...</div>
              </div>
            </div>

            <h2 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '16px', color: '#3B6D11' }}>📋 スタッフ情報を入力して承認</h2>

            <span style={lbl}>スタッフ名 *</span>
            <input
              value={approvalForm.name}
              onChange={e => setApprovalForm({ ...approvalForm, name: e.target.value })}
              style={inp}
            />

            <span style={lbl}>役職</span>
            <select
              value={approvalForm.role}
              onChange={e => setApprovalForm({ ...approvalForm, role: e.target.value })}
              style={{ ...sel, width: '100%', marginBottom: '10px' }}
            >
              <option value="">選択してください</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <span style={lbl}>店舗 * <span style={{ fontWeight: 400, color: '#aaa' }}>（複数選択可）</span></span>
            <StoreCheckboxes
              storeList={storeList}
              ids={approvalForm.storeIds}
              onChange={ids => setApprovalForm({ ...approvalForm, storeIds: ids })}
            />

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                onClick={() => setApprovalTarget(null)}
                style={{ padding: '8px 18px', border: '1px solid #ddd', borderRadius: '7px', background: '#fff', fontSize: '13px', cursor: 'pointer', color: '#555' }}
              >
                キャンセル
              </button>
              <button
                onClick={confirmApproval}
                disabled={approving}
                style={{ padding: '8px 20px', background: '#3B6D11', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
              >
                {approving ? '承認中...' : '✓ 承認する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
