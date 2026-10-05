-- 복합 외래키 전체 열을 선두에 배치해 계좌 삭제·변경 시 참조 검사를 빠르게 한다.

drop index if exists public.idx_child_gift_deposits_account_date;

create index idx_child_gift_deposits_account_date
  on public.child_gift_deposits(child_account_id, user_id, child_id, gift_date desc)
  where child_account_id is not null;
