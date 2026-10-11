comment on column financial_plan_settings.monthly_fixed_cost is
  '월 공금 납입금에서 배분 전에 한 번 차감하는 고정비 총액';

comment on column financial_plan_settings.monthly_joint_contribution is
  '가구가 매월 납입하는 공금 총액. 고정비 차감 후 잉여금만 단계별 배분';

comment on column financial_plan_settings.mortgage_interest is
  '월 고정비에 포함된 주담대 이자 구성액. 향후 부채·순자산 계산용';

comment on column financial_plan_settings.mortgage_principal is
  '월 고정비에 포함된 주담대 원금 상환액. 향후 부채·순자산 계산용';
