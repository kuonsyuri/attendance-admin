# CLAUDE.md — ELAN MARIRE 出退勤APP

> Claude Code がこのプロジェクトを開いたとき自動で読み込むコンテキストファイル。
> 実装前に必ずこのファイルを熟読すること。

---

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| アプリ名 | ELAN MARIRE 出退勤APP |
| 目的 | スタッフの出退勤管理・管理者ダッシュボード |
| Supabase Project Ref | `fhhzbuxnwrihcdphuxdk` |

---

## リポジトリ構成

```
ELAN MARIRE出退勤APP/
├── attendance-app/       # スタッフ向けアプリ（静的HTML/JS）
└── attendance-admin/     # 管理者ダッシュボード（Next.js 14）
```

---

## 技術スタック

### attendance-admin（管理ダッシュボード）
- **フレームワーク**: Next.js 14.2.5（App Router）
- **言語**: TypeScript
- **UI**: React 18（インラインCSS）
- **DB / BaaS**: Supabase
- **デプロイ**: Vercel
- **認証**: パスワード認証（localStorage）

### attendance-app（スタッフ向け）
- 静的 HTML / JavaScript
- Vercel（静的ホスティング）

---

## attendance-admin ページ構成（現状）

```
app/
├── page.tsx                   # ログインページ
├── layout.tsx
├── globals.css
└── dashboard/
    ├── layout.tsx             # ダッシュボード共通レイアウト
    ├── page.tsx               # ダッシュボードトップ
    ├── attendance/page.tsx    # 出退勤ログ（既存）
    ├── staff/page.tsx         # スタッフ管理（既存）
    ├── stores/page.tsx        # 店舗管理（既存）
    ├── summary/page.tsx       # サマリー → 分析ページに再編
    └── api/summarize/         # API Route
```

---

## 環境変数（Vercel設定済み）

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_PASSWORD
```

---

## 現在のSupabaseテーブル（既存）

- `attendance_logs` — 出退勤・MTGログ・日報
- `staff` — スタッフ情報
- `staff_stores` — スタッフと店舗の多対多
- `stores` — 店舗情報
- `pending_staff` — 承認待ちスタッフ

---

## 実装方針・ルール

1. **既存コードを尊重する** — 動いている機能は壊さない
2. **TypeScript厳守** — `any` 禁止。型定義を必ず書く
3. **UIはインラインCSS統一** — 外部CSSライブラリは追加しない
4. **Supabaseクライアントは既存の初期化方法に合わせる**
5. **エラーハンドリング必須** — Supabaseの全クエリにtry/catch
6. **コンポーネント分割** — 200行超えたら分割を検討
7. **実装フェーズ指示書（impl-phases.md）に従って順番に実装する**

---

## 参照ドキュメント

- `impl-phases.md` — フェーズ別実装指示書（具体的な仕様はここを見る）
- Obsidian: `Projects/ELAN-MARIRE-出退勤APP/仕様書-UI再編.md`（UI仕様の原本）
