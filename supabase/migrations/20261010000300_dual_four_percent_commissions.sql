begin;

-- Existing order items receive zero additional fee. New items snapshot 4%.
alter table public.order_items add column if not exists dropshipper_fee_rate_at_purchase numeric not null default 0;
alter table public.order_items alter column dropshipper_fee_rate_at_purchase set default 4;
alter table public.order_item_settlements add column if not exists dropshipper_fee_rate numeric not null default 0;
alter table public.order_item_settlements add column if not exists dropshipper_fee_amount numeric not null default 0;
alter table public.marketplace_settings add column if not exists dropshipper_fee_rate numeric not null default 4;
update public.marketplace_settings set default_commission_rate=4, dropshipper_fee_rate=4, updated_at=now() where id=true;

-- Financial sync keeps its existing remittance and reversal safeguards.
-- This trigger adjusts only new fee snapshots as settlement rows are written.
create or replace function public.calculate_dropshipper_fee_for_settlement()
returns trigger language plpgsql set search_path='public' as $$
declare rate numeric;
begin
  select dropshipper_fee_rate_at_purchase into rate from public.order_items where id=new.order_item_id;
  if not found then raise exception 'Order item snapshot not found'; end if;
  new.dropshipper_fee_rate:=coalesce(rate,0);
  new.dropshipper_fee_amount:=round(new.supplier_gross_amount*new.dropshipper_fee_rate/100,2);
  new.dropshipper_profit_amount:=round(new.retail_amount-new.supplier_gross_amount-new.dropshipper_fee_amount,2);
  return new;
end; $$;

drop trigger if exists trg_calculate_dropshipper_fee on public.order_item_settlements;
create trigger trg_calculate_dropshipper_fee
before insert or update of retail_amount,supplier_gross_amount,dropshipper_profit_amount
on public.order_item_settlements for each row
execute function public.calculate_dropshipper_fee_for_settlement();

-- Fee snapshots are immutable after an order is recorded.
create or replace function public.protect_order_item_dropshipper_fee()
returns trigger language plpgsql set search_path='public' as $$
begin
  if new.dropshipper_fee_rate_at_purchase is distinct from old.dropshipper_fee_rate_at_purchase then
    raise exception 'Order fee snapshot cannot be changed';
  end if;
  return new;
end; $$;

drop trigger if exists trg_protect_order_item_dropshipper_fee on public.order_items;
create trigger trg_protect_order_item_dropshipper_fee
before update on public.order_items for each row
execute function public.protect_order_item_dropshipper_fee();

commit;
