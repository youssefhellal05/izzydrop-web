begin;
alter table public.order_settlements drop constraint if exists order_settlements_cod_remittance_status_check;
alter table public.order_settlements add constraint order_settlements_cod_remittance_status_check check (cod_remittance_status in ('not_remitted','partial','disputed','remitted','reversal_required'));
commit;
