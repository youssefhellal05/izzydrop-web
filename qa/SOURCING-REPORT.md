# IzzyDrop community sourcing implementation and production QA
Date: 2026-09-30. Production project: `bbqpowtmzsoorluqwfbm`.
Implementation commit: `9094c8ba7f06cd65b20f5e1ef31e6d9fd193fc2b`.
Repository: https://github.com/youssefhellal05/izzydrop-web

## Outcome and verification boundary
Implemented independent sourcing for products missing from IzzyDrop. The production workflow passed all 37 backend/RLS assertions. Three additional rollback-only commercial/publication checks and two alert-integrity checks passed. Frontend rendering/handler tests and both dashboard boot tests passed using the actual HTML/JS with mocked transport and a production board fixture.

Interactive browser control exists, but this browser has no signed-in IzzyDrop session. Navigating to the dashboard redirects to login. Authenticated browser clicks, rendered visual layout, and image-upload interaction have **not** been certified. Production RPC testing used the actual `authenticated` database role and existing account identities through JWT claim context; it did not forge or acquire HTTP login tokens.

## Model and lifecycle
- Request: `open → sourcing → sourced`; owner/admin can close; admin/owner RPC can archive.
- Supplier response: independently `sourcing → sourced`. Withdrawn state is reserved for admin management.
- Request state aggregates all supplier responses. A second supplier can research or finish after another has sourced it.
- A sourced offer is not inventory, a catalog listing, an order, or a My Products link.
- Catalog publication remains the existing supplier product workflow. A separate, optional post-sourcing action links an owned catalog product. Active listings trigger availability alerts immediately; linked drafts trigger alerts on their later transition to active.
- Availability is informational. Recommended retail is guidance. Estimated margin is retail minus supplier/source price, before delivery, platform fees and other costs.

## Database/schema changes
Applied migrations, with repository filenames matching actual Supabase migration versions:

| Version | Name |
|---|---|
| 20260930115616 | community_sourcing_v2 |
| 20260930121340 | sourcing_alert_integrity |

Reused `product_requests`: added description and expected quantity, nonnegative target cost, and new status states. Existing legacy status values stay valid for historical data.

Added:
- `sourcing_responses`: request/supplier ownership, unique supplier per request, independent commercial information, generated margin, source image/notes/origin/MOQ/lead time, sourced timestamp, optional eventual catalog relationship.
- `sourcing_comments`: author ownership, bounded comment content.
- `sourcing_request_interests`: unique request/dropshipper demand.
- `sourcing_response_interests`: unique supplier offer/dropshipper demand.
- Added `sourcing_response_id` and two alert types to existing `dropshipper_alerts`; unique recipient/response/event key and foreign-key index.
- Sourcing-specific publication and alert-integrity triggers. No normal catalog/variant/order/settlement RPC implementation was redesigned.

Useful legacy quote/link columns (`sourced_variant_id`, `sourcing_quote_id`) and their foreign keys remain intact for compatibility/history. New sourcing never writes them. The legacy quote table is retained; obsolete matching submission, acceptance and read RPC grants are retired.

## RPC/RLS changes
Public invoker endpoints: `sourcing_board`, `sourcing_create_request`, `sourcing_comment`, `sourcing_interest`, `sourcing_start`, `sourcing_save_response`, `sourcing_close_request`, `sourcing_link_catalog`.

Guarded mutation implementations live in the unexposed private schema, with explicit actor status/ownership checks, empty search paths, fully qualified names, and restricted execute grants. Board reads are security-invoker and use table RLS.

- All new tables have RLS and explicit grants.
- Active dropshippers, approved suppliers and admins can read the board.
- Non-admin direct writes are blocked; validated RPCs handle ownership and transitions.
- Dropshippers can create requests, edit their own comments, show unique interest, and close/archive their own posts.
- Approved suppliers can start/update/complete only their own responses and link only their own separately created catalog products.
- Admin policies retain full CRUD access.
- Anonymous access is denied.
- Request locking serializes completion with interest recording and supplier progress.
- Supabase security advisor returned no sourcing-specific findings after implementation. Existing non-sourcing advisories were left outside scope. [Supabase advisor reference](https://supabase.com/docs/guides/database/database-linter).

## Frontend changes
`app.html/app.js`: community board, all/open/my request filters, search, description/expected demand fields, comment creation/author edits, interest counts, supplier progress, close action, dedicated Sourced products navigation/page, actionable existing alerts and sourced-offer deep links.

`supplier.html/supplier.js`: independent Start sourcing action, optional research estimates, final commercial fields, image URL/upload, dynamic margin guidance, Mark Sourced action, community discussion/demand, other supplier progress, and separate post-sourcing catalog relationship action.

`sourcing.js/sourcing.css`: shared rendering/handlers using existing cards, buttons, notices and theme. User text is escaped; product/image links allow only HTTP(S). Supplier email-shaped business names are replaced by a neutral display label.

The response form has no existing product or variant selector. A catalog selector exists only in the clearly separated section after an offer has been sourced.

## Notification behavior
- On sourcing completion: requester plus all active interested dropshippers.
- On linked catalog availability: requester plus request/offer interested dropshippers.
- Existing alert system; click opens the exact Sourced card.
- Database unique key prevents duplicate event alerts, even after read.
- Non-admin users may change only read status on sourcing alerts; deduplication identities cannot be tampered with.
- Offer-specific interest also records unique request-level demand.
- Newly interested users after completion can see the sourced offer immediately. They remain eligible for later availability notifications. No order is created.

## Verified obsolete QA cleanup
Removed only the matching earlier QA artifacts after verifying all three IDs, title/notes, accepted status, Classic ownership, Blue / M identity, 67/100 pricing and 69 quoted stock, NULL custom retail/Shopify IDs, plus absence of dependent storefront integrations or additional quotes.

| Artifact | Removed ID |
|---|---|
| Old request | 6d9615fa-6c99-4ae2-91a7-b5b050ee3f3b |
| Old accepted quote | 33ed8130-6826-47a7-8a83-9bf077253083 |
| Old Classic My Products link | 9cd7581d-a397-4330-9109-ca0469870082 |

Classic and Blue / M themselves were not deleted or changed.

## Persisted new QA records
One request: **QA Community Sourcing — Fold-flat Solar Desk Beacon — 2026-09-30**. Clearly fictitious; do not fulfill/import.

| Record | ID / final state |
|---|---|
| Request | d38a32f2-0e35-4b3e-b7b1-83e2ebdd7824 — sourced |
| Primary supplier response | c5dc7544-1734-4588-8d4e-e27c8b70bda8 — sourced |
| Second supplier response | fe752b9a-6e83-4c14-9430-3b6969d16328 — sourcing |
| Community comment | c7a0ff04-c2d4-4680-b997-89de92956ea0 |
| Requester alert | 6da9920b-a54c-4de2-99ec-9ed0ec8ce45a |
| Interested account alert | f16f3ee9-a564-403c-8c24-3cdf6de8b780 |

Final commercial data: supplier price EGP 125, recommended retail EGP 200, estimated margin EGP 75, available quantity 250, MOQ 10, lead time 14 days, origin China. Request target EGP 125; expected demand 40 units. Three unique request interests and one unique offer-specific interest. No catalog relationship or automatic My Products link. The QA image is an explicitly fake placeholder using the existing favicon. No QA records were deleted after testing.

A non-admin existing dropshipper was used as requester so admin permissions would not mask RLS problems. Existing additional dropshippers and both approved suppliers participated.

## Every backend assertion
| Test | Result |
|---|---|
| Anonymous API access denied | PASS |
| Another dropshipper requests sourced offer without duplicates | PASS |
| Another dropshipper sees request | PASS |
| Another supplier not declined or closed | PASS |
| Approved supplier sees community request | PASS |
| Begin sourcing without catalog match | PASS |
| Cannot edit another dropshipper comment | PASS |
| Comment created and author can edit | PASS |
| Direct request ownership reassignment blocked | PASS |
| Dropshipper cannot act as supplier | PASS |
| Duplicate request interest prevented | PASS |
| Exactly two completion alerts despite repeat completion | PASS |
| Fake requested product absent from normal catalog | PASS |
| Incomplete completion rejected | PASS |
| Interested second dropshipper notified | PASS |
| Multiple suppliers work independently | PASS |
| No sourcing response auto-added to My Products | PASS |
| Non-admin active requester | PASS |
| Offer demand rolls into request demand | PASS |
| Old accept-and-add path retired | PASS |
| One request created without catalog product | PASS |
| Optional research estimates saved | PASS |
| QA request final state | PASS |
| Recommended price is independent commercial guidance | PASS |
| Repeated start uses same response | PASS |
| Request aggregates sourced state | PASS |
| Request aggregates sourcing state | PASS |
| Requester gets one actionable notification | PASS |
| RLS blocks direct cross-supplier response update | PASS |
| RLS blocks direct cross-user comment update | PASS |
| RLS blocks direct forged supplier response | PASS |
| Sourced final values correct | PASS |
| Sourced offer visible under requester RLS | PASS |
| Supplier cannot change another supplier offer via RPC | PASS |
| Supplier cannot close another user request via RPC | PASS |
| Supplier cannot close requester post | PASS |
| Two distinct interested dropshippers | PASS |

Additional checks:
| Test | Result |
|---|---|
| Two simultaneously sourced offers with different commercial data | PASS — rollback-only |
| Optional catalog relationship and availability alerts to three demand participants | PASS — rollback-only |
| Repeated catalog linking produces no duplicate availability alerts | PASS — rollback-only |
| Mark sourcing alert read | PASS — rollback-only |
| Prevent sourcing alert identity tampering | PASS — rollback-only |
| Board and Sourced card rendering; exact prices/margin/guidance | PASS — DOM test |
| Comment/interest/completion handlers and refresh callbacks | PASS — DOM test |
| Supplier completion form independent of catalog/variants | PASS — DOM test |
| Escaped hostile text and blocked javascript URL schemes | PASS — DOM test |
| Both real dashboard HTML files boot without JS errors | PASS — mocked transport |
| Sourced navigation and new request description/demand payload | PASS — mocked transport |
| JavaScript syntax and git whitespace checks | PASS |
| Authenticated live-browser end-to-end interaction | NOT VERIFIED — signed-in session unavailable |
| Supplier file-upload interaction and pixel-level mobile/dark layout | NOT VERIFIED — signed-in session unavailable |
| Draft-to-active publication event executed against a real product | NOT EXECUTED — would change unrelated catalog data; trigger inspected and active-product linking tested transactionally |

## Preservation checks
Exact row counts AND whole-row hashes matched before/after for all 13 protected sets:

| Data | Before count | After count | Whole-row hash |
|---|---:|---:|---|
| orders | 1 | 1 | IDENTICAL |
| suppliers | 2 | 2 | IDENTICAL |
| order_items | 1 | 1 | IDENTICAL |
| dropshippers | 3 | 3 | IDENTICAL |
| product_images | 2 | 2 | IDENTICAL |
| product_variants | 13 | 13 | IDENTICAL |
| order_settlements | 0 | 0 | IDENTICAL |
| supplier_products | 4 | 4 | IDENTICAL |
| order_item_settlements | 0 | 0 | IDENTICAL |
| storefront_integrations | 2 | 2 | IDENTICAL |
| supplier_payout_details | 0 | 0 | IDENTICAL |
| storefront_integration_variants | 3 | 3 | IDENTICAL |
| dropshipper_product_links_except_verified_qa | 2 | 2 | IDENTICAL |

Customer orders stayed **1 → 1**. Catalog products **4 → 4**. Variants **13 → 13**. My Products links **3 → 2** only because the specifically authorized obsolete QA Classic link was removed; both other links remained byte-for-byte identical. No stock decrement occurred. No sourcing order, payout or settlement was created. Publication simulation was rolled back and neither changed nor published any normal product.

## Deployment verification
GitHub Pages build/deploy run **36713970226** completed successfully for implementation commit 9094c8ba7f06cd65b20f5e1ef31e6d9fd193fc2b.
Run: https://github.com/youssefhellal05/izzydrop-web/actions/runs/36713970226
All six deployed frontend assets (app.html, app.js, supplier.html, supplier.js, sourcing.js, sourcing.css) matched the committed source bytes exactly. See deployment-results.json for SHA-256 hashes.

Verified stock at the end, with before/after equality established by the complete variant-row fingerprint:

| Product / variant | Before | After |
|---|---:|---:|
| Classic / Blue / M | 69 | 69 |
| Ttddfg / White | 600 | 600 |
| Ttddfg / Black | 700 | 700 |

These values are from this run's current production baseline; previous chat QA results are not substituted for live data.

## Remaining bugs / UX recommendations
No demonstrated backend or DOM-handler failure remains in the tested sourcing flow.
Remaining verification gap: authenticated browser interaction and visual/mobile/dark-mode QA, including image upload.
Recommended follow-ups within sourcing:
1. Complete Arabic translations for the new sourcing copy.
2. Add server pagination when community volume grows; the present board reads all permitted sourcing posts/comments/responses.
3. Add a clearer verified supplier business identity. The current safe fallback avoids exposing email addresses.
4. Consider moderation/report controls for community content before opening sourcing widely.

## Reproduction and test files
Production test script: `qa/community-sourcing-e2e.sql` — **already executed once; rerunning creates another QA request**.
Raw assertions: `qa/backend-results.json`.
Protected-data query: `qa/protected-fingerprint.sql`.
DOM tests: `qa/frontend.test.cjs`, `qa/dashboard-boot.test.cjs` using jsdom 26.1.0.
Both migration files are under `supabase/migrations/`.

User flow: Dropshipper → Sourcing requests → submit missing-product requirements → community comments/interest → Supplier → Sourcing requests → Start sourcing → Save estimates → enter final price/retail/lead time/image/notes → Mark Sourced → requester/interested alerts → Dropshipper → Sourced products → Request this product. Catalog creation/publication and My Products selection remain separate explicit workflows.
