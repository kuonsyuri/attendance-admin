# impl-phases.md — フェーズ別実装指示書

> ELAN MARIRE 出退勤APP リニューアル実装指示書
> Claude Code はこのファイルに沿って順番に実装すること。
> 1フェーズずつ完了を確認してから次へ進む。

---

## フェーズ0：DBスキーマ変更（最初に必ず実施）

実装開始前にSupabaseのテーブルをマイグレーションする。

### attendance_logs テーブル

```sql
-- typeカラムの値を統一
-- 既存: 'clock_in' | 'clock_out' | 'meeting_start' | 'meeting_end'
-- ※既存のまま継続、変更不要

-- 日報カラム刷新（既存データはリセット）
ALTER TABLE attendance_logs DROP COLUMN IF EXISTS report_work;
ALTER TABLE attendance_logs DROP COLUMN IF EXISTS report_notice;
ALTER TABLE attendance_logs DROP COLUMN IF EXISTS report_improve;

ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS report_fact text;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS report_think text;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS report_action text;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS report_request text;

-- 採択・ステータス
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS is_adopted boolean DEFAULT false;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS adopted_at timestamptz;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS report_status text DEFAULT 'unread'
  CHECK (report_status IN ('unread', 'checked', 'adopted'));
```

### staff テーブル

```sql
ALTER TABLE staff ADD COLUMN IF NOT EXISTS hired_at date;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS memo text;

-- hired_at を既存レコードの created_at で初期化
UPDATE staff SET hired_at = created_at::date WHERE hired_at IS NULL;
```

### stores テーブル

```sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS prefecture text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS area text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS responsible_person text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_type text CHECK (store_type IN ('direct', 'fc'));
ALTER TABLE stores ADD COLUMN IF NOT EXISTS latitude float8;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS longitude float8;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS memo text;
```

---

## フェーズ1：attendance-admin メニュー構成の更新

### 変更内容
- `summary/` → `analytics/` にリネーム（分析ページに再編）
- `dashboard/reports/` を新規追加（日報ページ）
- サイドバーのメニュー名・順番を更新

### メニュー順（上から）
1. 出退勤ログ → `/dashboard/attendance`
2. 分析 → `/dashboard/analytics`
3. 日報 → `/dashboard/reports`
4. スタッフ管理 → `/dashboard/staff`
5. 店舗管理 → `/dashboard/stores`

---

## フェーズ2：出退勤ログページ（`/dashboard/attendance`）

### 検索バー
| 項目 | コンポーネント | 備考 |
|------|--------------|------|
| 期間（スタート〜エンド） | 階層型カレンダーピッカー | 年月日を段階的に選択 |
| エリア | select | エリアマスター9区分 |
| 都道府県 | select | エリア選択に連動して絞り込み |
| 店舗 | select | 都道府県選択に連動 |
| スタッフ | select | 店舗選択に連動 |
| ミーティング回数 | select | 0回〜5回以上 |
| 稼働時間 | number input | ○時間以上でフィルター |
| 検索ボタン | button | 1項目以上で検索可 |

### サマリーテーブル（検索結果に連動）
カード5枚：ログ件数 / 店舗数 / スタッフ数 / 日報件数 / ミーティング回数

### メインテーブル列
| 列名 | 内容 | 備考 |
|------|------|------|
| 日付 | 年/月/日(曜) | |
| スタッフ名 | staff.name | |
| 店舗名 | stores.name | |
| 出勤時間 | clock_in のタイムスタンプ | 緑色表示 |
| 退勤時間 | clock_out①のタイムスタンプ | 赤色表示。なければ「—」|
| 残業時間 | clock_out②のタイムスタンプ | 退勤2回目の時刻。なければ「—」|
| MTG回数 | meeting_start の件数 | バッジ表示 |
| MTG時間 | meeting_start〜meeting_end の合計時間 | 「x.xx時間」表示 |
| 日報 | ▼ボタン | クリックでFTA-R全文展開 |
| 操作 | [確認]ボタン | report_status を checked に更新 |

### 日報展開（▼クリック）
行を展開してFTA-R全文を読み取り専用で表示。  
Fact / Think / Action / Request-Share の4セクション。

---

## フェーズ3：分析ページ（`/dashboard/analytics`）

※旧サマリーページを完全再構築

### 検索バー
期間 / 店舗 / スタッフ / 採択（採択数○以上） / 検索ボタン

### 分析カード（6枚）
出勤日数 / 稼働時間 / MTG回数 / MTG時間 / 採択率 / 採択数

### メインテーブル
採択数の多い順にランキング表示

| 順位 | スタッフ名 | 店舗名 | 出勤日数 | 稼働時間 | MTG回数 | MTG時間 | 採択数 | 採択率 |
|------|-----------|--------|---------|---------|--------|--------|--------|--------|

---

## フェーズ4：日報ページ（`/dashboard/reports`）※新規作成

### 検索バー
期間 / 店舗 / スタッフ / 検索ボタン

### ステータスフィルター（タブ or ボタン切り替え）
全件 / 未確認 / 確認済み / 採用済み

### メインテーブル列
日付 / 店舗名 / スタッフ名 / ステータスバッジ / ▼（展開）

### 展開行（FTA-R全文）
4セクション表示＋操作ボタン

**確認ボタン**：report_status を 'unread' → 'checked' に更新  
**採用ボタン**：
1. チェックボックス確認ダイアログ「本当に採用しますか？」
2. OK → report_status = 'adopted'、is_adopted = true、adopted_at = now()

### ステータスバッジ
- 未確認：グレー
- 確認済み：ブルー
- 採用済み：グリーン

### PDF出力ボタン
- 検索バーの絞り込み結果をまとめてPDF化
- 1ユニット = 日付 ＋ スタッフ名 ＋ 店舗名 ＋ FTA-R全文
- ライブラリ: `jspdf` または `@react-pdf/renderer` を使用

---

## フェーズ5：スタッフ管理ページ（`/dashboard/staff`）

### 検索バー
店舗[select] / 役職[select] / 採択数[number]（○以上） / 検索ボタン

### 右上ボタン
[登録] [削除]

### メインテーブル列
☐ / 店舗 / スタッフ名 / 役職 / 採用年度 / 採択数 / [編集] / >

- 採択数は昇順（少ない順）
- ☐：削除モード時のみ表示（削除ボタン押下で切り替え）

### 行展開：閲覧（> クリック → ▼）
店舗 / スタッフ名 / 役職 / 採用年度 / 採択数 / メモ全文（読み取り専用）

### 行展開：編集（[編集] クリック）
| 項目 | 形式 | 備考 |
|------|------|------|
| 店舗 | チェックボックス複数選択 | staff_stores テーブルで管理 |
| スタッフ名 | text input | |
| 役職 | select | 下記5択 |
| 採用年度 | text input | hired_at を年度表示・手動修正可 |
| メモ | textarea | staff.memo に保存 |

### [登録] モーダル
店舗（複数選択）/ スタッフ名 / 役職 / メモ  
採用年度 = 登録日（created_at）を自動セット

### [削除] フロー
1. 削除ボタン押下 → 各行に☐表示
2. 対象を選択
3. 削除ボタン押下
4. 確認ダイアログ「本当に削除しますか？」→ 実行

### 役職プルダウン
オペレーター（施術者）/ チーフ（店長候補）/ 店長 / エリアマネージャー / 本部スタッフ

---

## フェーズ6：店舗管理ページ（`/dashboard/stores`）

### 検索バー
エリア[select] / 都道府県[select] / 店舗[select] / [登録] / [削除]

### エリアマスター（固定）
北海道 / 東北 / 関東 / 中部 / 近畿 / 中国 / 四国 / 九州 / 沖縄

**都道府県→エリア対応表**（実装に使用）
```typescript
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
```

### メインテーブル列
☐ / エリア / 都道府県 / 店舗名 / 責任者 / メモ / > / [編集]

### 行展開：閲覧（> → ▼）
メモ全文（読み取り専用）

### 行展開：編集（[編集] クリック）
店舗名 / 住所 / 電話番号 / 責任者 / 直営・FC / 緯度 / 経度 / メモ

### [登録] モーダル（同項目）

### 住所入力時の自動処理
1. 住所文字列から都道府県を抽出
2. 都道府県からエリアを自動判定（PREFECTURE_TO_AREAを使用）
3. 緯度/経度をジオコーディングAPIで自動取得
   - 推奨API: `https://nominatim.openstreetmap.org/search`（無料・APIキー不要）
   - フォールバック: 手動入力

### [削除] フロー（2段認証）
☐チェック → 削除ボタン → 確認ダイアログ「本当に削除しますか？」→ 実行

---

## フェーズ7：attendance-app（スタッフ向け）リニューアル

### GPS打刻制限
出退勤ボタン押下時に `navigator.geolocation.getCurrentPosition` で現在地取得。  
登録店舗の `stores.latitude` / `stores.longitude` との距離を計算。  
**半径50m超の場合はボタンを無効化**し、エラーメッセージ表示。

距離計算（Haversine公式）:
```javascript
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球半径（m）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) *
            Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

### 日報入力フォーム（FTA-R形式）
退勤①時のみ表示。全項目必須。合計100文字以上で送信ボタン有効化。  
下書きを `localStorage` に保存（送信後に削除）。  
送信後 → 完了画面「お疲れ様でした」

**Factセクション（数値入力）**
- 新規コース契約件数（select 0〜50）
- 新規サブスク契約件数（select 0〜50）
  - 内訳：15,000円 / 13,000円 / 11,000円 コース（各 select 0〜50）
- 既存顧客来店件数（select 0〜50）
- 店販購入件数（select 0〜50）
- 本日の個人総売上（text input、カンマ自動整形）

**Thinkセクション（テキスト）**
- 本日の気づき・お客様の反応（textarea）
- 改善点【接客・技術面】（textarea）
- 改善点【仕組み・サロン環境面】（textarea）
- 本日の成約・未成約の要因（textarea）
- 改善点【アプローチ・トーク面】（textarea）
- 改善点【ツール・動線面】（textarea）

**Actionセクション（テキスト）**
- 最優先タスク（textarea）
- 顧客アプローチ（textarea）
- サロンワーク（textarea）

**Request/Shareセクション（テキスト）**
- 現場の課題・気づいたこと（textarea）
- 私なりの改善アイデア（textarea）

### ボタン状態遷移ルール
| 状態 | 出勤 | 退勤 | MTG開始 | MTG終了 |
|------|------|------|---------|---------|
| 未出勤 | ○ | ✕ | ○ | ✕ |
| 出勤後 | ✕ | ○ | ○ | ✕ |
| MTG中 | ✕ | ○ | ✕ | ○ |
| 退勤①後 | ✕ | ○ | ○ | ✕ |
| 退勤②後 | ✕ | ✕ | ○ | ✕ |

---

## 将来拡張（現フェーズでは未実装・設計のみ）

### Googleスプレッドシート自動連携
日報送信時にSupabase Edge Function → Google Sheets APIで4タブに自動書き込み

```
Factタブ    → 日付 / スタッフ名 / 店舗名 / Fact内容
Thinkタブ   → 日付 / スタッフ名 / 店舗名 / Think内容
Actionタブ  → 日付 / スタッフ名 / 店舗名 / Action内容
Requestタブ → 日付 / スタッフ名 / 店舗名 / Request内容
```

**実装方針（将来）**:
- Supabase Edge Function（Deno）でトリガー設定
- Google Sheets API v4 + サービスアカウント認証
- `attendance_logs` テーブルへのINSERT時に発火

---

## 実装チェックリスト

- [ ] フェーズ0：DBスキーマ変更
- [ ] フェーズ1：メニュー構成更新
- [ ] フェーズ2：出退勤ログページ
- [ ] フェーズ3：分析ページ
- [ ] フェーズ4：日報ページ（新規）
- [ ] フェーズ5：スタッフ管理ページ
- [ ] フェーズ6：店舗管理ページ
- [ ] フェーズ7：attendance-app リニューアル
