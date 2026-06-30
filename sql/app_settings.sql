-- 日報構成など、アプリ設定を保持する汎用キー/バリュー表
-- Supabase SQL Editor で一度だけ実行してください。

create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

-- 管理画面はパスワード認証＋anonキー利用のため、anon に read/insert/update を許可。
drop policy if exists "app_settings_select" on app_settings;
drop policy if exists "app_settings_insert" on app_settings;
drop policy if exists "app_settings_update" on app_settings;

create policy "app_settings_select" on app_settings for select using (true);
create policy "app_settings_insert" on app_settings for insert with check (true);
create policy "app_settings_update" on app_settings for update using (true) with check (true);
