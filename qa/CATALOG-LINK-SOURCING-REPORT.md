# Sourcing: link a normally published product
Date: 2026-09-30. This report supersedes the earlier offer/automatic-publishing workflow reports.

## Delivered workflow
Community request → each approved supplier independently starts sourcing → obtains product → creates/publishes it using the unchanged normal Products flow → links their own published product → their response becomes Sourced and interested dropshippers receive alerts.
The community request remains visible. Another supplier can continue and later link a different product. Only owners manually close/archive requests.

## Database / RPC / security
Applied migration: `20260930154643_sourcing_link_published_catalog_only`.
- Removed `private.sourcing_publish_catalog(uuid)`, which inserted supplier_products, a default product_variants row, product_images and stock.
- Removed sourcing-only publication trigger `sourcing_catalog_publication` and `private.sourcing_catalog_published()`.
- Deprecated `private.sourcing_save_response`: old clients receive actionable instructions; no commercial fields are saved or auto-published.
- Dropped the obsolete `sourced_final_information` constraint. Added a sourcing response validation trigger for new completion/link changes. No existing records were rewritten or deleted.
- Reworked `private.sourcing_link_catalog`: approved supplier and response ownership, own active product, valid enabled variants, locked request/response/product/variants, immutable existing product relationship, idempotent same-product retries.
- Added member-gated read helpers `private.sourcing_catalog_product` and `private.sourcing_eligible_products`. These read current catalog product/image/variant prices, suggested retail and stock. No sourcing inventory or price copy is created.
- Updated `public.sourcing_board` with live product data and the current supplier's eligible products. Legacy offer price fields are omitted from its response projection.
- Existing RLS and admin policies remain intact; nonadmin writes continue through ownership-checked RPCs. New private helpers deny anon/PUBLIC execution and use an empty search_path.
- Existing legacy unlinked sourced records remain in community history, labelled awaiting a published product; they are excluded from Sourced Products until linked. Later-unpublished products are unavailable on discovery but their request/response history is retained.

## Frontend
Changed sourcing.js, app.js, supplier.js and their two HTML entry points only.
- Removed the supplier commercial/estimate form and Mark Sourced action.
- Added normal product creation shortcut, eligible published-product selector, refresh button, Link sourced product action, and explicit sequence instructions.
- Sourced Products uses real catalog images, enabled variants, price/retail ranges and current stock; links to normal product and original community thread.
- Suggested retail remains guidance. My Products stays a separate normal opt-in.
- Retained community image upload, comments, interest, multiple responses, alerts and all existing sourcing CSS (including dark/mobile fixes). Cache versions updated.
- Normal product creation, variants, catalog linking, inventory, orders, settlements and storefront implementations were not redesigned.

## Notifications
Successful first explicit link creates `sourcing_available` in existing dropshipper_alerts for active requester and interested dropshippers. The message identifies the request and availability in Products. Metadata identifies request, response and product; existing alert UI opens the sourced result. Unique recipient/response/type plus idempotent link handling prevent duplicates. No alert is emitted merely for starting research or creating a normal product.

## Verification
- 41 backend/RLS assertions passed using real production functions with authenticated database roles and existing test-account JWT claim identities, inside BEGIN/ROLLBACK. This tests database auth/RLS, not a browser login.
- 10 frontend renderer/action assertions passed; three modified JavaScript files parsed successfully.
- All 22 protected table whole-row counts/hashes matched the baseline after rollback: catalog, variants, images, orders/items, settlements/payouts, suppliers/dropshippers, storefront integrations, My Products, requests/quotes, comments/interests/responses/alerts, samples/shipping costs.
- Fake QA request: “QA ROLLBACK Catalog Link Beacon 2026-09-30”; normal test products A/B with multiple variants. All QA requests, products, comments, interests, responses and alerts were rolled back. No persistent QA records.
- Security advisor found no sourcing-specific findings. Existing unrelated anonymous/authenticated SECURITY DEFINER advisories and leaked-password protection setting were left unchanged. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- See catalog-link-backend-results.json, catalog-link-frontend-results.json and catalog-link-preservation.json for individual results.

## Preserved manual test
The exact title “Potato. Bottom. Up.” was not present in live data. The current request is **Bottom up**, ID `2996ba84-46e3-4261-aa3b-4ab13c6c06fb`, with sourcing response `0e2b7549-8f15-4f6b-bad0-b2ce0bb9057c`. Both were preserved byte-for-byte. No product was created or linked for this request.

## Remaining verification / limitations
Browser control returned HTTP 503; no interactive logged-in or mobile/dark-mode visual test was possible. Perform the final manual workflow on the preserved request: normal product creation with real variants, return to Requests, refresh/select product, link, then check requester alerts, Sourced Products and normal Products.
No known failures remain in the automated checks. Existing historical sourcing commercial columns remain for preservation only; new UI/RPC workflow does not write or display them. Prior QA scripts in this repository document obsolete models; run the new rollback-only script for current behavior.
