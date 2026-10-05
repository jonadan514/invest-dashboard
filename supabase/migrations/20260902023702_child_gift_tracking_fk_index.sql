drop index if exists public.idx_child_gift_deposits_child_date;

create index idx_child_gift_deposits_child_date
  on public.child_gift_deposits(child_id, user_id, gift_date desc);
