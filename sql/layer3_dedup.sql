-- ============================================================
-- 層3 データ構造 — 二重管理の解消（段階移行）
-- Supabase SQL Editor で「セクション1〜3」を順に実行。
-- セクション4（列削除）はコード切替＋本番検証の後に別途実行（不可逆）。
-- ============================================================


-- ────────────────────────────────────────────────
-- セクション1：事前検査（実行して結果を確認するだけ・変更なし）
-- ────────────────────────────────────────────────

-- 1-a. 同一スタッフ・同一JST日に clock_in が複数ある重複（ユニーク制約の障害）
--      → 行が返ったら、後述の制約を貼る前に重複を手で整理すること。
select staff_id,
       ((punched_at at time zone 'UTC') + interval '9 hours')::date as jst_date,
       count(*) as cnt
from attendance_logs
where type = 'clock_in'
group by 1, 2
having count(*) > 1
order by cnt desc;

-- 1-b. staff_stores が欠損しているスタッフ（store_id はあるが関連表に無い）
select s.id, s.name, s.store_id
from staff s
where s.store_id is not null
  and not exists (select 1 from staff_stores ss where ss.staff_id = s.id);

-- 1-c. 座標の正本(latitude/longitude)が欠損している店舗（旧lat/lngのみ）
select id, name, lat, lng, latitude, longitude
from stores
where (latitude is null and lat is not null)
   or (longitude is null and lng is not null);


-- ────────────────────────────────────────────────
-- セクション2：バックフィル（正本を完全化する・安全／冪等）
-- ────────────────────────────────────────────────

-- 2-a. staff_stores（正本）へ store_id を補完
insert into staff_stores (staff_id, store_id)
select s.id, s.store_id
from staff s
where s.store_id is not null
  and not exists (select 1 from staff_stores ss where ss.staff_id = s.id);

-- 2-b. latitude/longitude（正本）へ lat/lng を補完
update stores set latitude  = lat where latitude  is null and lat is not null;
update stores set longitude = lng where longitude is null and lng is not null;


-- ────────────────────────────────────────────────
-- セクション3：整合制約（二重打刻をDB層で禁止・追加のみ）
--   ※ セクション1-a が0件であることを確認してから実行
-- ────────────────────────────────────────────────

-- JST日付を返す不変関数（インデックス式に使うため IMMUTABLE 指定）
create or replace function jst_date(ts timestamptz)
returns date language sql immutable as $$
  select ((ts at time zone 'UTC') + interval '9 hours')::date
$$;

-- 出勤は「スタッフ×JST日」で1件のみ（退勤②・MTG複数は対象外）
create unique index if not exists uniq_clock_in_per_jst_day
on attendance_logs (staff_id, jst_date(punched_at))
where type = 'clock_in';


-- ────────────────────────────────────────────────
-- セクション4-a：旧列のNOT NULL解除（★コード切替の「前」に実行）
--   これを実行すると、コードが旧列を書かなくても INSERT が通る。
--   実行・確認後に「正本のみ書き込み」のコードをデプロイする。
-- ────────────────────────────────────────────────
-- alter table stores alter column lat drop not null;
-- alter table stores alter column lng drop not null;
-- alter table staff  alter column store_id drop not null;

-- ────────────────────────────────────────────────
-- セクション4-b：旧列の最終削除（★コード切替＋本番検証の「後」に実行・不可逆）
--   正本(staff_stores / latitude・longitude)のみで運用できたことを確認してから。
-- ────────────────────────────────────────────────
-- alter table stores drop column lat;
-- alter table stores drop column lng;
-- alter table staff  drop column store_id;
