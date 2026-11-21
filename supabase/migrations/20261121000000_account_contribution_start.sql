-- 연금저축·IRP 정기 납입 시작 달(YYYY-MM). 비어 있으면 시작 달을 모르는 것으로 본다.
alter table public.accounts
  add column if not exists contribution_start_month text;

alter table public.accounts
  drop constraint if exists accounts_contribution_start_month_format;

alter table public.accounts
  add constraint accounts_contribution_start_month_format
  check (contribution_start_month is null or contribution_start_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
