# IzzyDrop pilot supplier verification and agreement plan
Updated: 2026-10-13. **Development branch only; not deployed.**

## Scope and decisions
- Preserve the independent IzzyDrop flow, existing supplier/dropshipper accounts, approved products, orders, payouts, commissions, and production auth/session fixes.
- Signup for supplier or dropshipper: require an unchecked, accessible opt-in to the role-appropriate current Marketplace Terms, COD/order policy, and payout rules; separately link the Privacy Notice. Store the exact accepted policy version and server timestamp, without trusting editable user metadata as an authorization source.
- Keep dropshipper onboarding light. Do not collect national-ID photographs automatically.
- Suppliers submit business name, business contact/address, registration/tax details as applicable, and payout details only when needed. Optional private documents requested based on review.
- Admin manually reviews: Approve, Request changes (reason and resubmission), Reject. Do not grant approved status from the browser.
- Before approval, a supplier may prepare **drafts only**; no public listing, sourcing fulfillment, customer order, stock reservation, or settlements.
- Existing approved suppliers retain their current access. Any additional review of legacy suppliers must not silently suspend them.

## Verified existing implementation
1. `login.html` previously had passive policy fine print, without an explicit checkbox. `login.js` calls `IZZY.signup`, which calls Supabase Auth in `common.js`.
2. `policies.html` already includes supplier/dropshipper responsibilities, order/COD terms, payouts, privacy and disputes.
3. `suppliers` already has pending/approved/rejected/suspended statuses and admin review RPC; `supplier-documents` is private with owner/admin RLS.
4. `supplier_products` currently permits only approved suppliers to manage rows, and `supplier_create_product_v2` explicitly checks `status='approved'`. The supplier UI also entirely gates pending suppliers.
5. Existing `admin_review_supplier` RPC permits approve/reject/suspend, not request changes.
6. Production database tables currently have RLS enabled. This does not substitute for endpoint-level test coverage.

## Phase 1: versioned signup agreements
- Snapshot policy text: `policies-2026-10-13-pilot-v1.html`, linked from the unchecked checkbox on the signup page.
- Keep the version identifier immutable; revise terms by publishing a new file/version, never silently editing an accepted snapshot.
- Complete JS validation and Auth signup payload wiring. The current GitHub attempt to update the signup JavaScript was blocked, so **this is not finished**.
- Proposed backend `account_agreement_acceptances`: append-only `(user_id, account_type, version, accepted_at, method)`, enforced by the database; only user/admin read access, no client updates or deletes. Record acceptance from the registration event with the server timestamp; do not treat client-modifiable metadata as proof of authorization.
- Do not enforce new requirements against existing users until backfill/grandfathering and reacceptance flows are reviewed.
- Obtain Egyptian legal review of agreement wording and retention before enabling commercial onboarding.

## Phase 2: supplier verification without unnecessary sensitive documents
- Add owner-writable application data separated from admin-controlled verification status (draft/submitted/needs_changes/approved/rejected), with audit entries for each decision.
- Keep existing `suppliers.status` as the final capability gate; backend alone can approve.
- Use private `supplier-documents` bucket with existing policies; add strict upload types, file size, safe download/access checks, retention/delete process.
- New admin review UI should display relevant fields, missing items, resubmission notes and Approve/Request changes/Reject. Add server-side RPC enforcement before approving *new* accounts.
- Prevent one supplier from seeing another's verification or documents.

## Phase 3: pre-approval draft products
- Preserve approved supplier's existing product RPC and operations.
- Implement a separate restricted draft-create/update path for pending suppliers. The backend must enforce ownership and status `draft`; never allow new or updated rows to become active by client request.
- Keep the existing full supplier workspace gated until approved; expose a minimal onboarding + draft editor only.
- Check variant rows, image uploads, product APIs and public catalog queries so pending drafts never appear publicly.
- No integration/order/shipping/settlement access before approval.

## Phase 4: tests and rollout
- Verify supplier signup unchecked-box rejection; both account types accepted with exact stored version; email-confirmation path; mobile screens; broken link and repeated click protections.
- Verify existing sessions, login, logout (including multi-tab), supplier activation, owner-only document read and admin-only decisions.
- Try malicious authenticated requests that publish drafts, fake approved status, alter others' verification, or forge accepted policy status; all must fail.
- Verify pending supplier can edit its own drafts, but products stay hidden from dropshippers and public catalog and cannot generate orders.
- Test rejection, changes requested, resubmission, approval and audit details using test accounts only.
- Confirm production schema compatibility and no changes to real/settled orders, payouts, financials or accepted existing supplier access.
- Test staging or test accounts first; deploy only after the complete coordinated DB + frontend implementation is verified. Maintain a rollback plan.

## Implementation checkpoint — 2026-10-13

**Code implemented on the feature branch:**
- Required, unchecked signup assent for both account types; versioned pilot policies.
- Pilot signup writes version and acceptance indicator in the original Auth signup event; an `auth.users` insert trigger stores the immutable server-timestamped evidence.
- Existing `common.js` auth/session logic is **unchanged**. Pilot-specific Auth signup is isolated in `login.js`.
- New supplier verification form collects address, phone, commercial registration status/number, tax number, optional notes, and private commercial registration/tax card uploads (PDF/JPG/PNG, maximum 5 MB each).
- Server-side verification submission validates ownership of the supplier and uploaded private-storage paths; storage bucket remains nonpublic.
- Admin can inspect verification details and short-lived signed document links, approve, request changes with reason, or reject. Reviewed decisions are audited.
- New supplier approval is enforced in the existing server RPC: reviewed verification **and** a recorded accepted version are required. Existing suppliers are grandfathered with `verification_required=false`.
- Pending suppliers can save/edit/delete drafts in an isolated, RLS-protected `supplier_onboarding_drafts` table. These drafts **cannot** enter the actual marketplace/order system. Approved suppliers can import the draft's basic text/prices into the existing product wizard before adding required category, photos, and variants.
- Added `qa/pilot-onboarding.test.cjs` and isolated GitHub Actions checks for source/security invariants.

**Staging and release gate (NOT yet complete):**
1. The new SQL file `supabase/migrations/20261013_pilot_supplier_onboarding.sql` is **staged in GitHub only**; it has not been applied to the live Supabase project.
2. There are no existing Supabase development branches. Create/use a disposable staging database (subject to Supabase branch cost confirmation) and apply the migration **there** before deployment.
3. Run authenticated supplier/dropshipper signup, email-confirmation and exact acceptance-version tests on staging.
4. Test approved and pending accounts side by side; verify existing accounts, protected roles, login, logout, cross-tab sessions and IDOR attempts.
5. Test valid/invalid MIME, oversized document, owner-only storage access, admins reviewing valid documents, and signed URL expiration.
6. Attempt to write another supplier's application, forge approval, forge a draft's supplier owner, or directly insert an approved marketplace product. All must be denied.
7. Test draft create/edit/delete, new supplier manual approval, resubmission after request changes, rejects, imports, actual product creation after approval and marketplace invisibility before approval.
8. Validate mobile UX, server role grants and regression tests, then obtain legal review of pilot policies and data retention before commercial go-live.
9. Deploy coordinated database + frontend changes only after the staging gate. If rollback is needed, revert frontend first and preserve immutable agreement/audit records; do not drop them as a quick rollback.

**Production untouched:** No production schema migration, frontend deployment, supplier status update, real order, payout, commission, or financial record was performed in this implementation.
