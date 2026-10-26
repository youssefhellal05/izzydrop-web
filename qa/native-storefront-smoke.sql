-- Applied only to a disposable CI database after native storefront fixture + migration.
INSERT INTO public.dropshippers (id, profile_id, business_name, status)
VALUES ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Private seller account','active');
INSERT INTO public.suppliers (id, business_name, status)
VALUES ('30000000-0000-0000-0000-000000000001','PRIVATE_SUPPLIER_IDENTITY','approved');
INSERT INTO public.supplier_products
 (id,supplier_id,name,name_en,description,description_en,currency,status,admin_blocked)
VALUES
 ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Supplier source title','Supplier source title','Supplier source description','Supplier source description','EGP','active',false);
INSERT INTO public.dropshipper_product_links (id,dropshipper_id,supplier_product_id,status)
VALUES ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','active');
INSERT INTO public.product_variants (id,product_id,is_enabled,stock_quantity,variant_name,sku,option_values,variant_image_url)
VALUES ('60000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',true,12,'Blue','BLUE-1','{"Color":"Blue"}','https://images.example.test/blue.jpg');
INSERT INTO public.product_images (id,product_id,url,position)
VALUES ('70000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','https://images.example.test/source.jpg',0);
INSERT INTO public.dropshipper_stores (id,dropshipper_id,slug,store_name,description,published)
VALUES ('80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','youssef-shop','Youssef Shop','A sample store',true);
INSERT INTO public.dropshipper_store_products
 (id,store_id,product_link_id,is_published,content_reviewed_at,title_override,description_override,selected_image_urls,custom_image_urls)
VALUES
 ('90000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',true,now(),
  'My custom title','My own product copy','["https://images.example.test/selected.jpg"]','["https://images.example.test/my-photo.jpg"]');
INSERT INTO public.dropshipper_store_product_variants (store_product_id,variant_id,retail_price,enabled)
VALUES ('90000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001',725.50,true);

DO $$
DECLARE doc jsonb;
BEGIN
  doc := public.public_dropshipper_store_by_slug('youssef-shop');
  IF doc IS NULL THEN RAISE EXCEPTION 'Published store was not returned'; END IF;
  IF doc->'store'->>'store_name' <> 'Youssef Shop' THEN RAISE EXCEPTION 'Store name mismatch'; END IF;
  IF doc->'products'->0->>'title' <> 'My custom title' THEN RAISE EXCEPTION 'Store title override was not returned'; END IF;
  IF doc->'products'->0->>'description' <> 'My own product copy' THEN RAISE EXCEPTION 'Store description override was not returned'; END IF;
  IF (doc->'products'->0->'variants'->0->>'price')::numeric <> 725.50 THEN RAISE EXCEPTION 'Store-specific variant price was not returned'; END IF;
  IF doc->'products'->0->'variants'->0->>'in_stock' <> 'true' THEN RAISE EXCEPTION 'Public variant availability flag was not returned'; END IF;
  IF doc::text LIKE '%stock_quantity%' THEN RAISE EXCEPTION 'Public storefront exposed exact stock quantities'; END IF;
  IF doc::text NOT LIKE '%selected.jpg%' OR doc::text NOT LIKE '%my-photo.jpg%' THEN RAISE EXCEPTION 'Selected and custom images were not returned'; END IF;
  IF doc::text LIKE '%PRIVATE_SUPPLIER_IDENTITY%' OR doc::text LIKE '%supplier_cost%' OR doc::text LIKE '%cost_price%' OR doc::text LIKE '%supplier_id%' THEN
    RAISE EXCEPTION 'Public storefront leaked supplier information or cost fields';
  END IF;
  IF public.public_dropshipper_store_by_slug('not-published') IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown store lookup should return NULL';
  END IF;
END $$;

UPDATE public.dropshipper_store_products SET content_reviewed_at = NULL
WHERE id = '90000000-0000-0000-0000-000000000001';
DO $storefront_review_check$
DECLARE doc jsonb;
BEGIN
  doc := public.public_dropshipper_store_by_slug('youssef-shop');
  IF jsonb_array_length(doc->'products') <> 0 THEN
    RAISE EXCEPTION 'Unreviewed supplier-sourced content must never appear in the public store';
  END IF;
END $storefront_review_check$;
UPDATE public.dropshipper_store_products SET content_reviewed_at = now()
WHERE id = '90000000-0000-0000-0000-000000000001';

UPDATE public.dropshipper_store_product_variants SET enabled = false
WHERE store_product_id = '90000000-0000-0000-0000-000000000001';
DO $storefront_variants_check$
DECLARE doc jsonb;
BEGIN
  doc := public.public_dropshipper_store_by_slug('youssef-shop');
  IF jsonb_array_length(doc->'products') <> 0 THEN
    RAISE EXCEPTION 'Product should be omitted when the seller disables every variant';
  END IF;
END $storefront_variants_check$;
UPDATE public.dropshipper_store_product_variants SET enabled = true
WHERE store_product_id = '90000000-0000-0000-0000-000000000001';

DO $storefront_rls_check$
BEGIN
  IF has_table_privilege('anon','public.dropshipper_stores','SELECT') THEN
    RAISE EXCEPTION 'anon role can directly read the private store profile table';
  END IF;
  IF has_table_privilege('anon','public.dropshipper_store_products','SELECT') THEN
    RAISE EXCEPTION 'anon role can directly read the private store-product table';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.dropshipper_stores'::regclass) THEN
    RAISE EXCEPTION 'Store profiles must have RLS enabled';
  END IF;
END $storefront_rls_check$;

DO $storefront_privileges_check$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'dropshipper_stores',
    'dropshipper_store_products',
    'dropshipper_store_product_variants'
  ] LOOP
    IF has_table_privilege('authenticated', 'public.' || table_name, 'TRUNCATE') THEN
      RAISE EXCEPTION 'authenticated must not be able to TRUNCATE public.%', table_name;
    END IF;
    IF has_table_privilege('authenticated', 'public.' || table_name, 'REFERENCES') THEN
      RAISE EXCEPTION 'authenticated must not have REFERENCES on public.%', table_name;
    END IF;
    IF has_table_privilege('authenticated', 'public.' || table_name, 'TRIGGER') THEN
      RAISE EXCEPTION 'authenticated must not have TRIGGER on public.%', table_name;
    END IF;
    IF NOT (
      has_table_privilege('authenticated', 'public.' || table_name, 'SELECT')
      AND has_table_privilege('authenticated', 'public.' || table_name, 'INSERT')
      AND has_table_privilege('authenticated', 'public.' || table_name, 'UPDATE')
      AND has_table_privilege('authenticated', 'public.' || table_name, 'DELETE')
    ) THEN
      RAISE EXCEPTION 'authenticated is missing required CRUD privileges on public.%', table_name;
    END IF;
  END LOOP;
END $storefront_privileges_check$;

SET ROLE anon;
SELECT public.public_dropshipper_store_by_slug('youssef-shop');
RESET ROLE;
