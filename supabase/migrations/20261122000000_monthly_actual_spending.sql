-- 월간 기록에 그달 실제 지출(고정비+생활비, 주담대 원리금 포함, 저축·투자 이체 제외)을 적는다.
-- 비어 있으면 설정의 월 고정비로 계산한다(예전 기록과 같게).
alter table public.monthly_budgets
  add column if not exists actual_spending numeric;

alter table public.monthly_budgets
  drop constraint if exists monthly_budgets_actual_spending_check,
  add constraint monthly_budgets_actual_spending_check
    check (actual_spending is null or actual_spending >= 0);

comment on column public.monthly_budgets.actual_spending is
  '그달 실제 지출(고정비+생활비, 주담대 원리금 포함, 저축·투자 이체 제외). 비면 설정의 월 고정비를 쓴다.';
