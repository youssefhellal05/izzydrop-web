# IzzyDrop automated QA — first slice

Run: `node tests/e2e/session-simulation.cjs` with Playwright 1.56.1 and Chromium installed.
The GitHub Actions workflow installs the dependencies in a temporary directory and runs this automatically on relevant pull requests.

This suite runs the actual repository common.js in Chromium and intercepts every browser request. Only fake credentials and fake auth responses are used. It never contacts production. No production account secrets are needed.

Nine scenarios cover login/refresh/logout, repeated delayed-refresh logout, two-tab logout, logout during another tab's refresh, activation after logout, invalid-refresh clearing/redirect, global logout propagation, switching accounts during refresh, and protected-page reload after account replacement.

## Evidence boundaries

PASS means the named shared-client behavior passed against a simulated backend. The pages are minimal integration fixtures, not the full workspace. This does not prove live login, real Supabase revocation, role authorization, workspace data clearing, back/forward behavior, or pilot readiness. Reports explicitly set productionSignoff to false.

The global logout test verifies the client request and cross-tab clearing with a successful simulated response. Actual server token revocation remains unverified.

## Remaining phases

1. Live read-only auth smoke checks using dedicated QA accounts and secure credentials.
2. A separately configured staging backend with a complete schema, functions, storage and disposable fixtures; repository migration files alone may not reconstruct the historical baseline.
3. Real workspace checks: protected routes, stale data, role separation and browser history.
4. Notifications, variant switching, sourcing lifecycle and lost-response order retries against staging.
5. Mobile checks and a small safe production smoke run.

Do not run order/product/inventory simulations against production. Do not copy real customer or financial data into fixtures. Do not interpret mocked order success as duplicate-order protection.

No production code, database migration, catalog listing or business record is changed by this first slice.
