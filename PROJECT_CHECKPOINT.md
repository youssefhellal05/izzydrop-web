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
