-- 부동산 항목의 실거래가 자동 갱신(국토교통부 아파트 매매 실거래가).
-- 시군구 코드(법정동 코드 앞 5자리)·단지명·전용면적이 모두 있으면 매달 실거래가로 그달 금액을 채운다(source = 'price_auto').
alter table public.net_worth_items
  add column if not exists price_lawd_cd text,
  add column if not exists price_apt_name text,
  add column if not exists price_area numeric;

alter table public.net_worth_items
  drop constraint if exists net_worth_items_price_lawd_cd_format,
  add constraint net_worth_items_price_lawd_cd_format
    check (price_lawd_cd is null or price_lawd_cd ~ '^[0-9]{5}$'),
  drop constraint if exists net_worth_items_price_area_check,
  add constraint net_worth_items_price_area_check
    check (price_area is null or price_area > 0);

alter table public.net_worth_snapshots
  drop constraint if exists net_worth_snapshots_source_check,
  add constraint net_worth_snapshots_source_check
    check (source in ('manual', 'mortgage_auto', 'price_auto'));

comment on column public.net_worth_items.price_lawd_cd is '실거래가 조회용 시군구 코드(법정동 코드 앞 5자리)';
comment on column public.net_worth_items.price_apt_name is '실거래가 조회용 아파트 단지명(실거래가 자료에 나오는 이름)';
comment on column public.net_worth_items.price_area is '실거래가 조회용 전용면적(㎡)';
comment on column public.net_worth_snapshots.source is
  'manual: 밸런스 시트 직접 입력, mortgage_auto: 월간 주담대 원금으로 계산, price_auto: 아파트 실거래가로 갱신';
