# IzzyDrop Project Checkpoint

**Last updated:** 2026-10-26  
**Active task:** WooCommerce live-store end-to-end validation  
**Working branch:** `main` (feature branch remains available for reference)  
**Pull request:** [#36 — Add WooCommerce store connection and product sync](https://github.com/youssefhellal05/izzydrop-web/pull/36)  
**Production status:** PR #36 merged at `b992d2d1a539cb1a4cf11f126c0eb1a34d834c71`; migration applied; both Edge Functions deployed; GitHub Pages deployment succeeded. A real WooCommerce store E2E test is still pending.

## Architecture decisions

- IzzyDrop is its own Egyptian dropshipping marketplace.
- Supabase remains the backend, database, authentication, storage, and Edge Function platform.
- Shopify and WooCommerce are optional store integrations for dropshippers. Neither is the core marketplace platform.
- Keep changes isolated to the feature branch and preserve the existing Shopify OAuth and IzzyDrop storefront flows.
- WooCommerce credentials and product/variant mappings are server-managed. Browser clients have no direct table access to secrets or mappings.
- Production rollout for PR #36 was explicitly approved. Future migrations, deployments, merges, or other production-impacting changes still require explicit approval when not already covered.

## Completed in PR #36

- WooCommerce connection form and server-side credential verification.
- Connection status and disconnect controls. Disconnect removes the saved connection and local mappings; products already published to WooCommerce remain in that external store.
- RLS-protected, service-role-only tables for WooCommerce credentials, product mappings, and variant mappings.
- My Products action to publish/sync a linked product as a WooCommerce simple or variable product.
- Idempotent generated SKUs and saved parent/variant mappings.
- On-demand syncing of product images, current suggested/custom selling prices, and current variant stock.
- Guards for dropshipper ownership, active product link, product/supplier availability, currency mismatch, enabled variants, consistent options, and duplicate option combinations.
- Pinned outbound HTTPS requests: resolve A/AAAA DNS, reject any private/reserved result, connect directly to the selected public IP, verify TLS against the original hostname, and do not follow redirects.

## Verification

Latest code revision checked: PR head `b88418b63d338518cee76778be2f98c2cc339a97`; merged to `main` at `b992d2d1a539cb1a4cf11f126c0eb1a34d834c71`.

- [WooCommerce connection regression — passed](https://github.com/youssefhellal05/izzydrop-web/actions/runs/40235448799)
- [Atlas layout isolation — passed](https://github.com/youssefhellal05/izzydrop-web/actions/runs/40235448832)
- [V2 preview safety — passed](https://github.com/youssefhellal05/izzydrop-web/actions/runs/40235448777)
- [GitHub Pages deployment — passed](https://github.com/youssefhellal05/izzydrop-web/actions/runs/40235629545)

Production verification: migration `20261025_woocommerce_store_credentials` recorded as version `20261025212653`; both new functions report `ACTIVE`, version 1, with `verify_jwt=true`. All three new tables have RLS enabled, `anon` and `authenticated` lack direct SELECT permission, and `service_role` has SELECT permission.

Checks cover JavaScript syntax, Deno type-checking of both WooCommerce Edge Functions, source-level integration assertions, and markup/design isolation. They do **not** replace a real WooCommerce store end-to-end test.

## Known limitations / risks

- No live WooCommerce credential verification, product publish, or price/stock sync has been exercised against a real store. Do not claim end-to-end readiness until this passes.
- Connection-level checks and automated CI are green, but a production invocation against a user-supplied valid session and a real WooCommerce store has not yet been observed.
- Sync is manual/on-demand; automatic scheduled price/stock updates, order import/webhooks, and remote product deletion on disconnect are not implemented.
- WooCommerce outbound requests use raw HTTP/1.1 over a TCP connection pinned to a validated public IP, with TLS hostname/certificate validation, no redirects, a timeout, and an 8 MiB response limit. Only HTTPS port 443 is supported; stores that redirect must be entered using their final canonical URL.
- Sync is manual/on-demand; automatic scheduled price/stock updates, order import/webhooks, and remote product deletion on disconnect are not implemented.
- Do not describe the integration as end-to-end verified until a deliberate live-store test succeeds.

## Exact next task

Use a real WooCommerce store connected through the production in-product form—**never paste consumer secrets into chat**—to test:
   - connect/status/disconnect and secret clearing;
   - one single-variant product and one multi-variant product;
   - repeated publish/sync does not create duplicates;
   - price and stock updates, images, and out-of-stock variants;
   - currency mismatch and invalid/unavailable product rejection.
Record results and any failures here. If connection or product sync fails, keep the integration closed to wider rollout and fix the specific failure before declaring completion.

## Resume rule

Continue from `main` and the exact next task above. Inspect the existing implementation before changing architecture; do not redesign unrelated systems or test Shopify while validating WooCommerce.


## Parallel feature branch — Native hosted storefront MVP

**Approved scope:** Build a simple native storefront for each dropshipper, with no subscriptions or custom domains in phase one. Keep current product linking, Shopify, WooCommerce, and external website connections intact.

- **Feature branch:** feat/native-storefronts-phase-1
- **Current implementation draft:** store-manager.html/js/css adds store profile and slug setup, marketplace product selection, per-variant selling prices, product title/description overrides, supplier-photo selection, custom photo uploads, and show/hide/remove controls. storefront.html/js/css renders the public product showcase.
- **Database migration draft:** supabase/migrations/20261026_native_dropshipper_storefronts.sql creates owner-scoped store/product/variant tables, RLS policies, a public catalog RPC that omits supplier identity and supplier cost fields, and a separately scoped public image bucket.
- **Phase boundary:** Public pages are showcase-only. Customer checkout, COD order creation, payment handling, and delivery tracking remain phase two and must use the existing secure order/fulfillment invariants rather than bypassing them.
- **URL limitation:** The draft currently generates a working static-host URL in the form storefront.html?slug=.... The attractive /store/<slug> path and a custom main domain are not configured or verified yet; choose routing/domain behavior before launch rather than promising a path that current hosting may not serve correctly.
- **PR:** Draft PR #37 — https://github.com/youssefhellal05/izzydrop-web/pull/37
- **Checks passing:** Native storefront regression / isolated PostgreSQL migration privacy smoke test — https://github.com/youssefhellal05/izzydrop-web/actions/runs/40334002497; V2 preview safety — https://github.com/youssefhellal05/izzydrop-web/actions/runs/40334002487; Atlas layout isolation — https://github.com/youssefhellal05/izzydrop-web/actions/runs/40334002523. JavaScript syntax checks passed.
- **Production status (updated 2026-10-26):** PR #37 was merged into `main` as `57133e0e1baf872c0a4917285efd3b859b17fb2b`; migration `20261026_native_dropshipper_storefronts` applied successfully to production Supabase; RLS, storage bucket, and public RPC verified. GitHub Pages build/deployment succeeded for the merge commit. No production stores or store listings have been created yet. Existing supplier product/order records were not modified. A full public-page browser smoke test remains unverified because the connected web runtime could not fetch the GitHub Pages URL.
- **Exact next task:** Through the normal supplier/admin workflow, make at least one appropriate product active (do not change product status as part of the storefront work), then test with a real dropshipper account: create a store, customize title/description/photos, set a variant price, publish, and verify the public link hides supplier identity/cost and exposes only stock availability. Checkout/COD remain Phase 2. Do not disrupt the separate pending WooCommerce live-store E2E task on main.



## Continuation checkpoint — hosted dropshipper storefront v1 (2026-10-26)

- **Merged release:** PR #37 — https://github.com/youssefhellal05/izzydrop-web/pull/37; source branch `feat/native-storefronts-phase-1`; merge commit `57133e0e1baf872c0a4917285efd3b859b17fb2b` on `main`.
- **Validation at this head:** JavaScript syntax/source checks passed; native storefront privacy and frontend regression checks passed; disposable PostgreSQL fixture + migration + privacy/presentation smoke test passed; existing Atlas layout isolation and V2 visual preview safety workflows passed. Runs: https://github.com/youssefhellal05/izzydrop-web/actions/runs/40340122796, https://github.com/youssefhellal05/izzydrop-web/actions/runs/40340123136, https://github.com/youssefhellal05/izzydrop-web/actions/runs/40340123080.
- **Review fixes in this continuation:** Corrected three dollar-quote delimiters in the CI-only smoke SQL; removed supplier SKU fallback from public variant names; hardened the three storefront SECURITY DEFINER functions' search paths by explicitly placing `pg_catalog` first.
- **Production status (updated after release):** PR merged, production migration applied, and GitHub Pages deployment workflow succeeded on the merge commit. New tables have RLS enabled, owner/admin policies are present, the `storefront-images` bucket has owner-scoped write policies, and the anonymous public catalog RPC is callable for published-store reads. No stores/listings were created and no supplier/product/order data was modified.
- **Phase boundary and URL limitation:** Phase 1 remains a product showcase only. Checkout, COD order creation, payment handling, and delivery tracking are Phase 2. The generated URL is `storefront.html?slug=...`; `/store/<slug>` and custom domains are not configured or verified.
- **Data note:** The read-only production check found all 6 current supplier products are inactive. The storefront may therefore show no products until normal supplier/admin catalog workflows make eligible products active; do not change those product statuses as part of this feature.
- **Exact next task:** Real-account smoke test once a product is active in the normal catalog workflow. All 6 current supplier products are inactive, so no genuine populated public storefront could be created/tested during release. Verify store creation/edit/publish and public content privacy without altering statuses, orders, or integration settings. Checkout, COD order creation, payment, and delivery tracking remain Phase 2.


## Production privilege hardening — 2026-10-26

- **Follow-up PR:** https://github.com/youssefhellal05/izzydrop-web/pull/38 — merged as `d934a8e951799c1f8ba7c48d6c8ea8fceb5dd444`.
- **Reason:** Post-release review detected Supabase default table grants gave `authenticated` TRUNCATE, REFERENCES, and TRIGGER privileges on the new storefront tables. The three tables had no rows at the time.
- **Fix:** Applied production migration `harden_native_storefront_privileges` (version `20261026143929`) to revoke non-CRUD privileges from PUBLIC/anon/authenticated, re-grant only SELECT/INSERT/UPDATE/DELETE to authenticated, and add indexes for the `product_link_id` and `variant_id` foreign keys.
- **Verification:** All three tables have RLS enabled; anon has no direct SELECT; authenticated CRUD privileges are true while TRUNCATE/REFERENCES/TRIGGER are false. Both indexes exist. The CI migration smoke test and source tests passed: https://github.com/youssefhellal05/izzydrop-web/actions/runs/40341540811.
- **Existing data:** Still zero storefronts/store listings. All six supplier products remain inactive. No supplier statuses, order rows, or integration credentials were changed.
- **Remaining release check:** Confirm the latest GitHub Pages deployment finishes after the security-hotfix merge/checkpoint commit. Then follow the existing next task above: a real-account storefront smoke test after an appropriate product is activated through normal admin/supplier workflow. Keep Phase 1 browse-only; checkout/COD remains Phase 2.


## Pre-release readiness implementation — 2026-11-18

**Implementation branch:** \`feat/pre-release-readiness\`  
**Base/main at implementation start:** \`0373a51902b86e7cef45206ce6e680c3fd863606\`  
**Validated feature commit before this checkpoint update:** \`d3b1a237ccf9ce30c5acab8ca4a83029864103e3\`

### Implemented in the feature branch

- Signup now collects a phone number and saves it in the account metadata/profile flow. SMS verification remains deliberately off for launch.
- Supplier and dropshipper verification forms now capture the agreed legal name, ID document, contact phone, business/residential address, optional Google Maps link, registration status and payout readiness. Supplier tax documents are optional where they are not applicable; registered suppliers must provide commercial registration evidence.
- Verification submission and approval are gated on confirmed email. Database triggers prevent unverified dropshippers from linking products or publishing native store listings.
- Existing native store builder is preserved. Product linking and publish controls now explain and enforce the identity approval requirement.
- Native storefront now has bilingual Arabic/English RTL-aware cash-on-delivery checkout for one selected variant and quantity. Server-side checkout validates the store, identity, stock, customer delivery details, Cairo delivery availability, rate limits and idempotency; it creates an existing-format order and records customer price without returning supplier cost or supplier identity.
- Admin Control Center now has an operational Accounts view, profile editing, dropshipper suspend/reactivate, payout destination editing, supplier/dropshipper verification detail editing, customer delivery detail editing and per-variant available-stock adjustment. New admin changes are role-gated and audited. Private ID/registration documents remain private and are opened with expiring signed URLs. Passwords and auth secrets are not exposed.
- Admin approval for a supplier whose registration is in progress or not yet completed prompts for an explanatory approval note, matching the database rule.
- The four staged migrations are:
  - \`20261118120000_pre_release_verification_admin.sql\`
  - \`20261118130000_native_storefront_checkout.sql\`
  - \`20261118140000_admin_order_inventory_controls.sql\`
  - \`20261118150000_admin_verification_edit_controls.sql\`
- Native storefront checkout Edge Function source is at \`supabase/functions/native-storefront-gateway/index.ts\`. Its service-role key is read from server environment only and is not included in browser assets.

### Validation

- GitHub Actions run **44330009156** completed successfully on commit \`d3b1a237ccf9ce30c5acab8ca4a83029864103e3\`.
- Browser source syntax checks: PASS.
- Pre-release, native storefront and pilot onboarding regression suites: PASS.
- PostgreSQL SQL parser for all four staged migrations: PASS.
- Deno type-check for the native storefront gateway: PASS.
- The live Supabase production project was inspected read-only only. **No migration was applied and no production data was changed.**
- GitHub Pages/main was not changed or deployed from this branch.

### Before production release

1. Confirm the production impact on the currently published but empty, unverified store. The new identity gate will keep it hidden until its owner submits documents and an admin approves them.
2. After explicit production-release approval, apply the four migrations to production in timestamp order. The project owner has chosen not to create a Supabase staging branch.
3. Configure \`SUPABASE_URL\` and \`SUPABASE_SERVICE_ROLE_KEY\` as Edge Function secrets and deploy \`native-storefront-gateway\` to production. Never expose the service-role key in browser code or chat.
4. Publish the frontend only after the migrations and Edge Function are in place. Then run smoke tests for signup/email verification, document upload/review, product linking, store publishing, COD checkout and admin controls.
5. Run Arabic/English and mobile browser smoke tests. Current checkout supports one product variant per order, with quantity; it is not a multi-item cart.
6. Keep PR #58 draft until the existing-store impact is accepted and the production deployment is explicitly approved.

**Current release status:** implementation and automated source/regression checks are green, but the new migrations and Edge Function are not deployed. The owner has chosen to skip staging. Production remains unchanged until the deployment is explicitly approved. Keep the native store URL behavior as implemented (\`storefront.html?slug=...\`) until pretty-path routing is separately verified.

### PR review validation update — 2026-11-18

- **Draft PR #58:** https://github.com/youssefhellal05/izzydrop-web/pull/58
- **Latest code commit validated:** `120083556d6c544c77a6bfa494f6a6779609af26`.
- **All PR checks passed on that code commit:**
  - Pre-release readiness: run `44331651236`
  - Native storefront regression: run `44331651069`
  - Pilot onboarding: run `44331651504`
  - Atlas layout isolation: run `44331651388`
  - V2 visual preview safety: run `44331651214`
- The Atlas markup-parity test now normalizes only the intentional additions to login, supplier, admin, dashboard and storefront pages. Independent source comparison confirmed the changed HTML pages match main after those exact additions are normalized.
- PR remains **draft and unmerged**. The production website and production Supabase database have not been changed.
- **Historical note superseded by the final audit below:** staging is waived by owner decision. Production rollout is still pending explicit approval, migration deployment, Edge Function deployment and post-deployment smoke tests.


## Final pre-release audit — 2026-11-18

**Latest implementation commit:** `402929b890176059b61971cb27ea4badca0746ff`  
**Branch:** `feat/pre-release-readiness`  
**PR:** [#58 — Pre-release readiness](https://github.com/youssefhellal05/izzydrop-web/pull/58) — open, draft, unmerged.

### Final validation

All five GitHub Actions checks passed on the latest implementation commit:
- Pre-release readiness — run 44373187725
- Native storefront regression — run 44373187710
- Pilot onboarding — run 44373187692
- Atlas layout isolation — run 44373187789
- V2 visual preview safety — run 44373187695

SQL parsing, browser source/regression checks and Edge Function type-checking passed. The production Supabase project was inspected read-only. All four PR migrations remain unapplied and `native-storefront-gateway` remains undeployed.

### Owner decision about staging

The owner has chosen to skip a Supabase staging branch. Do not create one or request a staging cost confirmation. No staging branch has been created and no staging charge has been incurred.

### Read-only production facts

- Supabase project status: healthy.
- 4 active dropshippers.
- 2 approved suppliers; both currently have `verification_required=false`.
- 1 published/open dropshipper store; it currently has zero published products.
- 0 dropshipper identity-verification records and 0 approved records.
- 1 processing order and 1 delivered order.

### Existing-store impact

The new migration gates public store visibility and publication on approved dropshipper identity. The one existing published store will therefore become hidden until its owner submits identity documents and an admin approves the verification. Do not silently bypass this gate or fabricate an approval. Confirm that this empty store may remain hidden, or have the real owner complete verification before deployment.

### Final production sequence

1. Confirm how to handle the existing empty, unverified store.
2. After explicit approval, apply the four migrations in timestamp order to production.
3. Deploy `native-storefront-gateway` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured as server-side secrets.
4. Publish frontend changes only after database and Edge Function deployment.
5. Run post-deployment smoke tests for verification, linking/publishing, COD checkout, admin edits, Arabic/English RTL and mobile.

**Release status:** Code and automated checks are ready; production rollout is **not complete**. PR #58 remains draft because the existing-store impact and production deployment have not been approved. No production schema, account, order, or other business data was changed during this audit.
