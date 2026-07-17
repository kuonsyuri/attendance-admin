-- ============================================================
-- Phase A2 (STEP 3): 作成した Auth ユーザーを staff に自動紐付け
-- ★ STEP 2（Supabaseダッシュボードで admin/manager のユーザーを
--   email = <staff.id>@elan.local で作成）した後に実行する。
-- email の数字部分で突き合わせるので、uuidを手でコピーする必要はない。
-- ============================================================

update staff s
set auth_user_id = u.id
from auth.users u
where u.email = (s.id::text || '@elan.local')
  and s.auth_user_id is null;

-- 【確認】紐付け結果（auth_user_id が入っていれば成功）
select id, name, app_role, auth_user_id
from staff
where app_role in ('admin','manager')
order by app_role, id;
