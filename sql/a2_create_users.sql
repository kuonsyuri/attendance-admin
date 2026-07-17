-- ============================================================
-- Phase A2 (STEP 2): admin/manager の Auth ユーザーを一括作成
-- Supabase SQL Editor で実行。
--
-- ★実行前に必ず: 下の VALUES の 'CHANGE_ME_x' を各人の初期パスワードに置き換える。
--   （パスワードは実行者が設定する。ここに実在の値を残さないこと）
--
-- email = <staff.id>@elan.local（STEP1の login_email と一致）。
-- パスワードは bcrypt でハッシュ化して保存。メール確認済み(即ログイン可)で作成。
-- ============================================================

create extension if not exists pgcrypto;

with input(email, password) as (
  values
    ('3@elan.local', 'CHANGE_ME_3'),  -- 川嶋康太 (admin)
    ('5@elan.local', 'CHANGE_ME_5'),  -- 南翔琉 (admin)
    ('6@elan.local', 'CHANGE_ME_6'),  -- 宮内麻利亜 (admin)
    ('7@elan.local', 'CHANGE_ME_7'),  -- 小林朱門 (admin)
    ('8@elan.local', 'CHANGE_ME_8'),  -- HIROMI (admin)
    ('9@elan.local', 'CHANGE_ME_9')   -- 寺﨑 裕希 (manager)
),
new_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user
  )
  select
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated', 'authenticated',
    email,
    crypt(password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false
  from input
  where not exists (select 1 from auth.users u where u.email = input.email)
  returning id, email
)
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), nu.id,
  jsonb_build_object('sub', nu.id::text, 'email', nu.email),
  'email', nu.email,
  now(), now(), now()
from new_users nu;

-- 【確認】作成されたユーザー
select id, email, email_confirmed_at is not null as confirmed
from auth.users where email like '%@elan.local' order by email;
