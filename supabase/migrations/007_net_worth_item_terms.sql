-- 자산·부채 항목 생성 시 금융 조건을 함께 기록한다.

alter table net_worth_items
  add column if not exists interest_rate numeric,
  add column if not exists start_date date,
  add column if not exists maturity_date date,
  add column if not exists monthly_payment numeric;

alter table net_worth_items
  drop constraint if exists net_worth_items_interest_rate_check,
  add constraint net_worth_items_interest_rate_check
    check (interest_rate is null or interest_rate >= 0),
  drop constraint if exists net_worth_items_monthly_payment_check,
  add constraint net_worth_items_monthly_payment_check
    check (monthly_payment is null or monthly_payment >= 0),
  drop constraint if exists net_worth_items_date_range_check,
  add constraint net_worth_items_date_range_check
    check (start_date is null or maturity_date is null or maturity_date >= start_date);

comment on column net_worth_items.interest_rate is '예적금 또는 대출의 연 이율(%)';
comment on column net_worth_items.monthly_payment is '월 납입액 또는 월 상환액';

