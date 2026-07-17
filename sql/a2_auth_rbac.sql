-- ============================================================
-- Phase A2 (STEP 1): Supabase Auth + RBAC の土台
-- Supabase SQL Editor で実行。安全・追加のみ・冪等（破壊的変更なし）。
-- 既存 staff.role（職種表示）はそのまま残し、権限は app_role に分離する
-- （表記揺れで権限が崩れるのを防ぐため、表示と権限を別列にする）。
-- ============================================================

-- 1) 権限ロール列（admin/manager/staff の3値のみ許可）
alter table staff add column if not exists app_role text
  check (app_role in ('admin','manager','staff')) default 'staff';

-- 2) Supabase Auth ユーザー(auth.users)との紐付け列
alter table staff add column if not exists auth_user_id uuid unique;

-- 3) 既存 role から app_role を初期割当（レビュー用の既定・後で個別変更可）
--    本部スタッフ→admin ／ 店長→manager ／ それ以外→staff（コンソール非ログイン）
update staff set app_role = case
  when role = '本部スタッフ' then 'admin'
  when role = '店長'         then 'manager'
  else 'staff'
end;

-- 4) ログイン中ユーザーの app_role を返す関数（A3のRLSで使う土台）
create or replace function auth_app_role() returns text
language sql stable security definer as $$
  select app_role from staff where auth_user_id = auth.uid()
$$;

-- 5) 【確認】割当結果と、ログイン発行が必要な人（admin/manager）の一覧＋作るべきメール
select id, name, role, app_role,
       (id::text || '@elan.local') as login_email
from staff
where app_role in ('admin','manager')
order by app_role, id;
