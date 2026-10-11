-- Extend the existing investment-only enum. Apply before shared-schema.sql.
alter type public.invest_account_type add value if not exists 'debt';
alter type public.invest_account_type add value if not exists 'cash';
alter type public.invest_account_type add value if not exists 'mmf';