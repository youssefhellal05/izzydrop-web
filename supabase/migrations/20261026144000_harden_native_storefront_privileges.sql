-- Remove unsafe default table privileges from authenticated storefront users.
-- RLS protects row-level DML, but it does not protect against TRUNCATE.
begin;

revoke all privileges on table
  public.dropshipper_stores,
  public.dropshipper_store_products,
  public.dropshipper_store_product_variants
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.dropshipper_stores,
  public.dropshipper_store_products,
  public.dropshipper_store_product_variants
to authenticated;

-- Support the two foreign-key lookup paths reported by the performance advisor.
create index if not exists idx_dropshipper_store_products_product_link_id
  on public.dropshipper_store_products(product_link_id);

create index if not exists idx_dropshipper_store_product_variants_variant_id
  on public.dropshipper_store_product_variants(variant_id);

commit;
