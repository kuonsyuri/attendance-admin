-- ============================================================
-- 日報新仕様（v2）の物理カラム追加
-- reportSchema.ts（単一定義）の column 値と完全一致させる。
-- Supabase SQL Editor で一度だけ実行。
--
-- 方針:
-- - 旧 fact_new_course（新規コース契約件数）は履歴保全のため残置・書き込み停止
-- - 新規追加はすべて nullable（過去行はNULLのまま）
-- ============================================================

alter table attendance_logs
  -- 毎日実績（新規・サブスク獲得）
  add column if not exists fact_new_customers    integer,  -- 新規顧客接客件数
  add column if not exists fact_ticket_29800     integer,  -- 新規チケット契約件数（29,800円）
  -- 新規の振り返り（新規に入った場合のみ記載・任意）
  add column if not exists dr_deal_factor        text,     -- 本日の成約・未成約の要因
  add column if not exists dr_counseling_improve text,     -- 次回へのカウンセリング改善点
  add column if not exists dr_progress           text,     -- 本日上手くできたこと（1つ）
  -- お客様が喜びそうなアイデア・改善提案（50円給与UP対象・任意）
  add column if not exists dr_issue              text,     -- 現場の課題・アイデア・気づき
  add column if not exists dr_improve_idea       text;     -- 私なりの改善アイデア
