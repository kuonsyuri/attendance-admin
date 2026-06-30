'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase, Store } from '@/lib/supabase';

const AREAS = ['北海道', '東北', '関東', '中部', '近畿', '中国', '四国', '九州', '沖縄'];

const PREFECTURE_TO_AREA: Record<string, string> = {
  北海道: '北海道',
  青森県: '東北', 岩手県: '東北', 宮城県: '東北',
  秋田県: '東北', 山形県: '東北', 福島県: '東北',
  茨城県: '関東', 栃木県: '関東', 群馬県: '関東',
  埼玉県: '関東', 千葉県: '関東', 東京都: '関東', 神奈川県: '関東',
  新潟県: '中部', 富山県: '中部', 石川県: '中部', 福井県: '中部',
  山梨県: '中部', 長野県: '中部', 岐阜県: '中部', 静岡県: '中部', 愛知県: '中部',
  三重県: '近畿', 滋賀県: '近畿', 京都府: '近畿',
  大阪府: '近畿', 兵庫県: '近畿', 奈良県: '近畿', 和歌山県: '近畿',
  鳥取県: '中国', 島根県: '中国', 岡山県: '中国', 広島県: '中国', 山口県: '中国',
  徳島県: '四国', 香川県: '四国', 愛媛県: '四国', 高知県: '四国',
  福岡県: '九州', 佐賀県: '九州', 長崎県: '九州', 熊本県: '九州',
  大分県: '九州', 宮崎県: '九州', 鹿児島県: '九州',
  沖縄県: '沖縄',
};

const AREA_TO_PREFECTURES: Record<string, string[]> = {};
for (const [pref, area] of Object.entries(PREFECTURE_TO_AREA)) {
  if (!AREA_TO_PREFECTURES[area]) AREA_TO_PREFECTURES[area] = [];
  AREA_TO_PREFECTURES[area].push(pref);
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e8e8e4', borderRadius: '12px', overflow: 'hidden' };
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: '#888', fontWeight: 500, letterSpacing: '0.04em', borderBottom: '1px solid #e8e8e4', background: '#fafaf8' };
const td: React.CSSProperties = { padding: '12px 14px', fontSize: '13px', color: '#1a1a1a', borderBottom: '1px solid #f0f0ec', verticalAlign: 'middle' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 500 };
const selectStyle: React.CSSProperties = { padding: '8px 10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '13px', background: '#fff', cursor: 'pointer', outline: 'none' };
const actionBtn: React.CSSProperties = { padding: '4px 10px', border: '1px solid #ddd', borderRadius: '6px', background: '#fff', fontSize: '11px', color: '#555', cursor: 'pointer' };
const greenBtn: React.CSSProperties = { padding: '8px 18px', background: '#3B6D11', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' };

type StoreFormData = {
  name: string;
  address: string;
  phone: string;
  responsible_person: string;
  store_type: string;
  prefecture: string;
  area: string;
  latitude: string;
  longitude: string;
  radius_m: string;
  memo: string;
};

const defaultForm: StoreFormData = {
  name: '', address: '', phone: '', responsible_person: '',
  store_type: '', prefecture: '', area: '',
  latitude: '', longitude: '', radius_m: '50', memo: '',
};

type Expansion = { id: number; mode: 'view' | 'edit' } | null;

function extractPrefecture(address: string): string {
  for (const p of Object.keys(PREFECTURE_TO_AREA)) {
    if (address.includes(p)) return p;
  }
  return '';
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=jp`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'ja' } });
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error('Geocoding failed:', e);
  }
  return null;
}

function StoreFormFields({
  form, setForm, geocoding, onAddressBlur,
}: {
  form: StoreFormData;
  setForm: (f: StoreFormData) => void;
  geocoding: boolean;
  onAddressBlur: () => void;
}) {
  return (
    <>
      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>店舗名 *</label>
        <input style={inputStyle} type="text" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例：青山店" />
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>住所（入力後にフォーカスを外すと都道府県・座標を自動取得）</label>
        <input style={inputStyle} type="text" value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          onBlur={onAddressBlur}
          placeholder="例：東京都渋谷区神宮前1-1-1" />
        {geocoding && <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>位置情報を取得中...</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div>
          <label style={labelStyle}>都道府県（自動）</label>
          <input style={inputStyle} type="text" value={form.prefecture}
            onChange={(e) => {
              const pref = e.target.value;
              setForm({ ...form, prefecture: pref, area: PREFECTURE_TO_AREA[pref] || form.area });
            }} placeholder="東京都" />
        </div>
        <div>
          <label style={labelStyle}>エリア（自動）</label>
          <input style={inputStyle} type="text" value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="関東" />
        </div>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>電話番号</label>
        <input style={inputStyle} type="text" value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="03-1234-5678" />
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>責任者</label>
        <input style={inputStyle} type="text" value={form.responsible_person}
          onChange={(e) => setForm({ ...form, responsible_person: e.target.value })} placeholder="山田 太郎" />
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>店舗区分</label>
        <select style={{ ...selectStyle, width: '100%' }} value={form.store_type}
          onChange={(e) => setForm({ ...form, store_type: e.target.value })}>
          <option value="">選択してください</option>
          <option value="direct">直営</option>
          <option value="fc">FC</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div>
          <label style={labelStyle}>緯度（自動）</label>
          <input style={inputStyle} type="number" step="0.000001" value={form.latitude}
            onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="35.670000" />
        </div>
        <div>
          <label style={labelStyle}>経度（自動）</label>
          <input style={inputStyle} type="number" step="0.000001" value={form.longitude}
            onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="139.726000" />
        </div>
        <div>
          <label style={labelStyle}>打刻半径（m）</label>
          <input style={inputStyle} type="number" value={form.radius_m}
            onChange={(e) => setForm({ ...form, radius_m: e.target.value })} placeholder="50" />
        </div>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>メモ</label>
        <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={form.memo}
          onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="備考など" />
      </div>
    </>
  );
}

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [expansion, setExpansion] = useState<Expansion>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<StoreFormData>(defaultForm);
  const [editForm, setEditForm] = useState<StoreFormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [editGeocoding, setEditGeocoding] = useState(false);

  const [filterArea, setFilterArea] = useState('');
  const [filterPref, setFilterPref] = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [appliedArea, setAppliedArea] = useState('');
  const [appliedPref, setAppliedPref] = useState('');
  const [appliedStore, setAppliedStore] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('stores').select('*').order('name');
      if (error) throw error;
      setStores((data as Store[]) || []);
    } catch (e) {
      console.error('Failed to fetch stores:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prefecturesForFilter = filterArea ? (AREA_TO_PREFECTURES[filterArea] || []) : Object.keys(PREFECTURE_TO_AREA);

  const preFilteredStores = stores.filter((s) => {
    if (filterArea && s.area !== filterArea) return false;
    if (filterPref && s.prefecture !== filterPref) return false;
    return true;
  });

  const displayStores = stores.filter((s) => {
    if (appliedArea && s.area !== appliedArea) return false;
    if (appliedPref && s.prefecture !== appliedPref) return false;
    if (appliedStore && s.id !== parseInt(appliedStore)) return false;
    return true;
  });

  const handleSearch = () => {
    setAppliedArea(filterArea);
    setAppliedPref(filterPref);
    setAppliedStore(filterStore);
    setExpansion(null);
  };

  const handleAddressBlur = async (
    currentForm: StoreFormData,
    setCurrentForm: (f: StoreFormData) => void,
    setGeoLoading: (v: boolean) => void,
  ) => {
    if (!currentForm.address) return;
    const pref = extractPrefecture(currentForm.address);
    const area = pref ? (PREFECTURE_TO_AREA[pref] || '') : '';
    setGeoLoading(true);
    const coords = await geocodeAddress(currentForm.address);
    setCurrentForm({
      ...currentForm,
      prefecture: pref || currentForm.prefecture,
      area: area || currentForm.area,
      latitude: coords ? String(coords.lat) : currentForm.latitude,
      longitude: coords ? String(coords.lng) : currentForm.longitude,
    });
    setGeoLoading(false);
  };

  const handleAdd = async () => {
    if (!form.name) return alert('店舗名は必須です');
    setSaving(true);
    try {
      const lat = parseFloat(form.latitude) || 0;
      const lng = parseFloat(form.longitude) || 0;
      const payload = {
        name: form.name,
        address: form.address || null,
        phone: form.phone || null,
        responsible_person: form.responsible_person || null,
        store_type: form.store_type || null,
        prefecture: form.prefecture || null,
        area: form.area || null,
        latitude: lat || null,
        longitude: lng || null,
        radius_m: parseInt(form.radius_m) || 50,
        memo: form.memo || null,
      };
      const { error } = await supabase.from('stores').insert(payload);
      if (error) throw error;
      setShowModal(false);
      setForm(defaultForm);
      fetchData();
    } catch (e) {
      alert('登録に失敗しました');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async (storeId: number) => {
    if (!editForm.name) return alert('店舗名は必須です');
    setSaving(true);
    try {
      const lat = parseFloat(editForm.latitude) || 0;
      const lng = parseFloat(editForm.longitude) || 0;
      const payload = {
        name: editForm.name,
        address: editForm.address || null,
        phone: editForm.phone || null,
        responsible_person: editForm.responsible_person || null,
        store_type: editForm.store_type || null,
        prefecture: editForm.prefecture || null,
        area: editForm.area || null,
        latitude: lat || null,
        longitude: lng || null,
        radius_m: parseInt(editForm.radius_m) || 50,
        memo: editForm.memo || null,
      };
      const { error } = await supabase.from('stores').update(payload).eq('id', storeId);
      if (error) throw error;
      setExpansion(null);
      fetchData();
    } catch (e) {
      alert('保存に失敗しました');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}件の店舗を削除しますか？\nこの店舗に紐づくスタッフ所属情報も影響を受けます。`)) return;
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from('stores').delete().in('id', ids);
      if (error) throw error;
      setSelectedIds(new Set());
      setDeleteMode(false);
      fetchData();
    } catch (e) {
      alert('削除に失敗しました');
      console.error(e);
    }
  };

  const openEdit = (s: Store) => {
    setEditForm({
      name: s.name || '',
      address: s.address || '',
      phone: s.phone || '',
      responsible_person: s.responsible_person || '',
      store_type: s.store_type || '',
      prefecture: s.prefecture || '',
      area: s.area || '',
      latitude: s.latitude != null ? String(s.latitude) : '',
      longitude: s.longitude != null ? String(s.longitude) : '',
      radius_m: String(s.radius_m || 50),
      memo: s.memo || '',
    });
    setExpansion({ id: s.id, mode: 'edit' });
  };

  const toggleView = (id: number) => {
    if (expansion?.id === id && expansion.mode === 'view') {
      setExpansion(null);
    } else {
      setExpansion({ id, mode: 'view' });
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const colSpan = deleteMode ? 8 : 7;
  const editingId = expansion?.mode === 'edit' ? expansion.id : null;

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 500 }}>店舗管理</h1>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>店舗の追加・編集とエリア情報を管理します</p>
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px', padding: '16px', background: '#fff', border: '1px solid #e8e8e4', borderRadius: '12px' }}>
        <select style={selectStyle} value={filterArea} onChange={(e) => { setFilterArea(e.target.value); setFilterPref(''); setFilterStore(''); }}>
          <option value="">エリア（全て）</option>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select style={selectStyle} value={filterPref} onChange={(e) => { setFilterPref(e.target.value); setFilterStore(''); }}>
          <option value="">都道府県（全て）</option>
          {prefecturesForFilter.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select style={selectStyle} value={filterStore} onChange={(e) => setFilterStore(e.target.value)}>
          <option value="">店舗（全て）</option>
          {preFilteredStores.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
        </select>
        <button onClick={handleSearch} style={{ ...greenBtn, padding: '8px 16px' }}>検索</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => { setForm(defaultForm); setShowModal(true); }} style={greenBtn}>+ 登録</button>
          <button
            onClick={() => { setDeleteMode(!deleteMode); setSelectedIds(new Set()); }}
            style={{ padding: '8px 18px', background: deleteMode ? '#c0392b' : '#fff', color: deleteMode ? '#fff' : '#c0392b', border: '1px solid #f5c6c6', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
          >
            {deleteMode ? '削除モード終了' : '削除'}
          </button>
          {deleteMode && selectedIds.size > 0 && (
            <button onClick={handleDelete} style={{ ...greenBtn, background: '#c0392b' }}>
              {selectedIds.size}件を削除
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={card}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>読み込み中...</div>
        ) : displayStores.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>該当する店舗がありません</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {deleteMode && <th style={{ ...th, width: '40px' }}></th>}
                <th style={th}>エリア</th>
                <th style={th}>都道府県</th>
                <th style={th}>店舗名</th>
                <th style={th}>責任者</th>
                <th style={th}>メモ</th>
                <th style={{ ...th, width: '40px' }}></th>
                <th style={{ ...th, width: '70px' }}></th>
              </tr>
            </thead>
            <tbody>
              {displayStores.map((s) => (
                <React.Fragment key={s.id}>
                  <tr style={{ background: expansion?.id === s.id ? '#f9f9f7' : 'transparent' }}>
                    {deleteMode && (
                      <td style={td}>
                        <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} />
                      </td>
                    )}
                    <td style={td}>
                      {s.area ? (
                        <span style={{ display: 'inline-block', padding: '2px 8px', background: '#EAF3DE', color: '#3B6D11', borderRadius: '99px', fontSize: '11px', fontWeight: 500 }}>
                          {s.area}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ ...td, fontSize: '12px', color: '#555' }}>{s.prefecture || '—'}</td>
                    <td style={{ ...td, fontWeight: 500 }}>{s.name}</td>
                    <td style={{ ...td, fontSize: '12px', color: '#555' }}>{s.responsible_person || '—'}</td>
                    <td style={{ ...td, fontSize: '12px', color: '#888', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.memo ? (s.memo.length > 30 ? s.memo.slice(0, 30) + '...' : s.memo) : '—'}
                    </td>
                    <td style={td}>
                      <button onClick={() => toggleView(s.id)} style={{ ...actionBtn, fontWeight: 600 }}>
                        {expansion?.id === s.id && expansion.mode === 'view' ? '▼' : '>'}
                      </button>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => openEdit(s)} style={{ ...actionBtn, color: '#3B6D11', borderColor: '#b8d89a' }}>
                        編集
                      </button>
                    </td>
                  </tr>

                  {/* View expand */}
                  {expansion?.id === s.id && expansion.mode === 'view' && (
                    <tr>
                      <td colSpan={colSpan} style={{ padding: '16px 24px', background: '#f9f9f7', borderBottom: '1px solid #e8e8e4' }}>
                        <div style={{ fontSize: '13px', color: '#444', lineHeight: '2' }}>
                          <div><strong>住所：</strong>{s.address || '—'}</div>
                          <div><strong>電話番号：</strong>{s.phone || '—'}</div>
                          <div><strong>店舗区分：</strong>{s.store_type === 'direct' ? '直営' : s.store_type === 'fc' ? 'FC' : '—'}</div>
                          <div><strong>緯度 / 経度：</strong>
                            {s.latitude != null ? `${s.latitude.toFixed(6)} / ${s.longitude != null ? s.longitude.toFixed(6) : '—'}` : '—'}
                            {s.latitude != null ? (
                              <a href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '8px', fontSize: '11px', color: '#3B6D11' }}>地図</a>
                            ) : null}
                          </div>
                          <div style={{ marginTop: '8px' }}><strong>メモ：</strong></div>
                          <div style={{ whiteSpace: 'pre-wrap', marginTop: '4px', padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #e8e8e4', minHeight: '48px' }}>
                            {s.memo || '—'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      {editingId !== null && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={(e) => { if (e.target === e.currentTarget) setExpansion(null); }}
        >
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 500, marginBottom: '20px' }}>店舗を編集</h2>
            <StoreFormFields
              form={editForm}
              setForm={setEditForm}
              geocoding={editGeocoding}
              onAddressBlur={() => handleAddressBlur(editForm, setEditForm, setEditGeocoding)}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button onClick={() => setExpansion(null)} style={{ ...actionBtn, padding: '9px 18px', fontSize: '13px' }}>
                キャンセル
              </button>
              <button onClick={() => handleEditSave(editingId)} disabled={saving} style={greenBtn}>
                {saving ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 500, marginBottom: '20px' }}>店舗を登録</h2>
            <StoreFormFields
              form={form}
              setForm={setForm}
              geocoding={geocoding}
              onAddressBlur={() => handleAddressBlur(form, setForm, setGeocoding)}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button onClick={() => setShowModal(false)} style={{ ...actionBtn, padding: '9px 18px', fontSize: '13px' }}>
                キャンセル
              </button>
              <button onClick={handleAdd} disabled={saving} style={greenBtn}>
                {saving ? '保存中...' : '登録する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
