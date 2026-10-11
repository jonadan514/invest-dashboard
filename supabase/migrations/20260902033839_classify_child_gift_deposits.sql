-- 자녀 계좌 납입을 증여자 관계와 입금 성격별로 구분한다.
-- 기존 기록은 안전하게 직계존속의 증여로 유지한다.

alter table public.child_gift_deposits
  drop constraint if exists child_gift_deposits_donor_check;

alter table public.child_gift_deposits
  alter column donor set default 'me',
  add column donor_name text,
  add column relationship_category text not null default 'direct_ascendant',
  add column transfer_type text not null default 'gift';

alter table public.child_gift_deposits
  add constraint child_gift_deposits_donor_check
    check (donor in ('parents', 'me', 'spouse', 'grandparents', 'other_relative', 'non_relative')),
  add constraint child_gift_deposits_relationship_category_check
    check (relationship_category in ('direct_ascendant', 'other_relative', 'non_relative')),
  add constraint child_gift_deposits_donor_relationship_check
    check (
      (donor in ('parents', 'me', 'spouse', 'grandparents') and relationship_category = 'direct_ascendant')
      or (donor = 'other_relative' and relationship_category = 'other_relative')
      or (donor = 'non_relative' and relationship_category = 'non_relative')
    ),
  add constraint child_gift_deposits_transfer_type_check
    check (transfer_type in ('gift', 'living_education', 'customary'));

comment on column public.child_gift_deposits.donor_name is
  '고모, 외조부 등 실제 입금자를 구분하기 위한 선택 입력값';
comment on column public.child_gift_deposits.relationship_category is
  '증여재산공제 계산용 관계 구분: 직계존속, 기타 친족, 친족 외';
comment on column public.child_gift_deposits.transfer_type is
  '입금 성격: 증여, 생활비·교육비, 통상적 용돈·축하금';
