# IzzyDrop Project Checkpoint

**Last updated:** 2026-10-26  
**Active task:** WooCommerce store connection and on-demand product publish/sync  
**Working branch:** `feat/woocommerce-store-connection`  
**Pull request:** [#36 — Add WooCommerce store connection and product sync](https://github.com/youssefhellal05/izzydrop-web/pull/36)  
**Production status:** Not deployed; PR remains a draft.

## Architecture decisions

- IzzyDrop is its own Egyptian dropshipping marketplace.
- Supabase remains the backend, database, authentication, storage, and Edge Function platform.
- Shopify and WooCommerce are optional store integrations for dropshippers. Neither is the core marketplace platform.
- Keep changes isolated to the feature branch and preserve the existing Shopify OAuth and IzzyDrop storefront flows.
- WooCommerce credentials and product/variant mappings are server-managed. Browser clients have no direct table access to secrets or mappings.
- Do not apply migrations, deploy Edge Functions, merge the PR, or change production data without explicit approval.

## Completed in PR #36

- WooCommerce connection form and server-side credential verification.
- Connection status and disconnect controls. Disconnect removes the saved connection and local mappings; products already published to WooCommerce remain in that external store.
- RLS-protected, service-role-only tables for WooCommerce credentials, product mappings, and variant mappings.
- My Products action to publish/sync a linked product as a WooCommerce simple or variable product.
- Idempotent generated SKUs and saved parent/variant mappings.
- On-demand syncing of product images, current suggested/custom selling prices, and current variant stock.
- Guards for dropshipper ownership, active product link, product/supplier availability, currency mismatch, enabled variants, consistent options, and duplicate option combinations.
- Regression tests and an updated Atlas markup-parity check for the intentional Store Connections UI changes.

## Verification

Latest code revision checked: `4ef0e0b9cd42b90b8152606102936401f8066fda`.

- [WooCommerce regression — passed](https://github.com/youssefhellal05/izzydrop-web/actions/runs/40234326954)
- [Atlas layout isolation — passed](https://github.com/youssefhellal05/izzydrop-web/actions/runs/40234326957)
- [V2 preview safety — passed](https://github.com/youssefhellal05/izzydrop-web/actions/runs/40234327035)

Checks cover JavaScript syntax, Deno type-checking of both WooCommerce Edge Functions, source-level integration assertions, and markup/design isolation. They do **not** replace a real WooCommerce store end-to-end test.

## Known limitations / risks

- Neither WooCommerce Edge Function is deployed and the migration has not been applied to production.
- No live WooCommerce credential verification, product publish, or price/stock sync has been exercised against a real store.
- Sync is manual/on-demand; automatic scheduled price/stock updates, order import/webhooks, and remote product deletion on disconnect are not implemented.
- WooCommerce outbound requests now resolve A/AAAA records, reject mixed/private/reserved answers, connect directly to the selected public IP, and start TLS while verifying the original hostname. Redirects are not followed. Connection-level security changes are awaiting the new CI run and final review; do not deploy until those checks pass.
- Do not describe the connection as production-ready until a deliberate outbound-request security review and live-store E2E test are complete.

## Exact next task

1. Review the DNS-rebinding hardening and rerun the WooCommerce CI, including Deno type-checking.
2. After all checks pass, complete the already-approved PR #36 promotion, apply the additive migration, and deploy `woocommerce-connect` and `woocommerce-products` to `izzydrop-production` (`bbqpowtmzsoorluqwfbm`).
3. Use a real WooCommerce store connected through the in-product form—**never paste consumer secrets into chat**—to test:
   - connect/status/disconnect and secret clearing;
   - one single-variant product and one multi-variant product;
   - repeated publish/sync does not create duplicates;
   - price and stock updates, images, and out-of-stock variants;
   - currency mismatch and invalid/unavailable product rejection.
4. Record results and any failures in this file. Keep the PR draft and do not merge if a live-store test fails.

## Resume rule

Continue in this branch from the exact next task above. Inspect the existing implementation before changing architecture; do not redesign unrelated systems or test Shopify while validating WooCommerce.
