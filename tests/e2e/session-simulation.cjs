'use strict';
// Browser integration tests for the actual shared auth client, NOT live Supabase sign-off.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const common = fs.readFileSync(path.join(__dirname, '../../common.js'), 'utf8');
const results = [];
const session = (id = 'qa-a', refresh = 'qa-refresh-a') => ({
  access_token: 'qa-access-' + id, refresh_token: refresh, user: { id }
});
const origin = 'http://izzydrop.test';
let browser;
async function fixture() {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  let mode = 'valid', pending, seen;
  const entered = () => new Promise(resolve => { seen = resolve; });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) {
      if (url.pathname === '/common.js') return route.fulfill({ contentType: 'application/javascript', body: common });
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="fixture">Auth integration fixture</div><script>window.IZZY_CONFIG={supabaseUrl:"https://qa.invalid",supabaseKey:"fake-public-key"};</script><script src="/common.js"></script></body></html>' });
    }
    if (url.origin !== 'https://qa.invalid') return route.abort();
    if (url.pathname === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'password') {
        return route.fulfill({ json: session(JSON.parse(route.request().postData()).email, 'qa-refresh-' + JSON.parse(route.request().postData()).email) });
      }
      if (mode === 'delay') {
        pending = route; if (seen) seen(); return;
      }
      if (mode === 'invalid') return route.fulfill({ status: 400, json: { error_code: 'refresh_token_not_found', message: 'Invalid refresh token' } });
      return route.fulfill({ json: session('qa-a', 'qa-refresh-new') });
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    return route.fulfill({ status: 401, json: { message: 'Invalid JWT' } });
  });
  const page = await context.newPage();
  await page.goto(origin + '/index.html');
  return {
    context, page,
    mode(value) { mode = value; },
    entered,
    async release() {
      assert.ok(pending, 'Refresh must actually be in flight');
      const held = pending; pending = null;
      await held.fulfill({ json: session('qa-a', 'qa-refresh-new') }).catch(() => {});
    }
  };
}
async function run(name, body) {
  let f;
  try { f = await fixture(); await body(f); results.push({ name, result: 'PASS', scope: 'simulated-backend browser integration' }); }
  catch (error) { results.push({ name, result: 'FAIL', detail: error.message, scope: 'simulated-backend browser integration' }); }
  finally { if (f) await f.context.close(); }
}
async function seed(page, value = session()) { await page.evaluate(s => IZZY.saveSession(s), value); }
async function protectedTab(f) {
  const page = await f.context.newPage();
  await page.goto(origin + '/app.html'); return page;
}
(async () => {
  try {
    browser = await chromium.launch({ headless: true });
    await run('Login saves returned account; normal refresh rotates token; logout clears it', async f => {
      await f.page.evaluate(() => IZZY.login('qa-a', 'fake-password'));
      assert.equal(await f.page.evaluate(() => IZZY.session().user.id), 'qa-a');
      assert.equal(await f.page.evaluate(() => IZZY.refresh()), true);
      assert.equal(await f.page.evaluate(() => IZZY.session().refresh_token), 'qa-refresh-new');
      await f.page.evaluate(() => IZZY.logout());
      assert.equal(await f.page.evaluate(() => IZZY.session()), null);
    });
    await run('Logout during in-flight refresh, repeated 5 times', async f => {
      for (let i = 0; i < 5; i++) {
        await seed(f.page); f.mode('delay'); const started = f.entered();
        await f.page.evaluate(() => { window.refreshResult = IZZY.refresh(); });
        await started; await f.page.evaluate(() => IZZY.logout()); await f.release();
        assert.equal(await f.page.evaluate(() => window.refreshResult), false);
        assert.equal(await f.page.evaluate(() => IZZY.session()), null);
      }
    });
    await run('Two-tab logout redirects protected tab without reload', async f => {
      await seed(f.page); const other = await protectedTab(f);
      await f.page.evaluate(() => IZZY.logout());
      await other.waitForURL('**/login.html?reason=signed_out');
      assert.equal(await other.evaluate(() => IZZY.session()), null);
    });
    await run('Logout while second tab refresh is in flight', async f => {
      await seed(f.page); const other = await protectedTab(f);
      f.mode('delay'); const started = f.entered();
      await other.evaluate(() => { window.refreshResult = IZZY.refresh(); });
      await started; await f.page.evaluate(() => IZZY.logout());
      await other.waitForURL('**/login.html?reason=signed_out');
      await f.release();
      assert.equal(await other.evaluate(() => IZZY.session()), null);
    });
    await run('Background tab sees logout when activated', async f => {
      await seed(f.page); const other = await protectedTab(f);
      await f.page.bringToFront(); await f.page.evaluate(() => IZZY.logout());
      await other.bringToFront(); await other.waitForURL('**/login.html?reason=signed_out');
      assert.equal(await other.evaluate(() => IZZY.session()), null);
    });
    await run('Invalid refresh clears credentials and redirects protected page', async f => {
      await seed(f.page); await f.page.goto(origin + '/app.html'); f.mode('invalid');
      await f.page.evaluate(() => { IZZY.refresh(); });
      await f.page.waitForURL('**/login.html?reason=session_expired');
      assert.equal(await f.page.evaluate(() => IZZY.session()), null);
    });
    await run('Global logout clears all open tabs', async f => {
      await seed(f.page);
      const tabs = await Promise.all([protectedTab(f), protectedTab(f)]);
      await f.page.evaluate(() => IZZY.logoutEverywhere());
      for (const tab of tabs) {
        await tab.waitForURL('**/login.html?reason=signed_out');
        assert.equal(await tab.evaluate(() => IZZY.session()), null);
      }
    });
    await run('Account switching during refresh never restores User A', async f => {
      await seed(f.page); f.mode('delay'); const started = f.entered();
      await f.page.evaluate(() => { window.refreshResult = IZZY.refresh(); });
      await started; await f.page.evaluate(() => IZZY.logout());
      await f.page.evaluate(() => IZZY.login('qa-b', 'fake-password'));
      await f.release();
      assert.equal(await f.page.evaluate(() => window.refreshResult), false);
      assert.equal(await f.page.evaluate(() => IZZY.session().user.id), 'qa-b');
    });
    await run('Protected tab reloads on direct account replacement', async f => {
      await seed(f.page); const other = await protectedTab(f);
      const navigation = other.waitForEvent('load');
      await seed(f.page, session('qa-b', 'qa-refresh-b')); await navigation;
      assert.equal(await other.evaluate(() => IZZY.session().user.id), 'qa-b');
    });
  } catch (error) {
    results.push({ name: 'Browser setup', result: 'BLOCKED', detail: error.message });
  } finally {
    if (browser) await browser.close();
    fs.mkdirSync(path.join(__dirname, '../../qa-results'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../../qa-results/session-simulation.json'), JSON.stringify({
      scope: 'Real common.js in Chromium with intercepted fake auth responses; no production requests.',
      productionSignoff: false,
      remaining: ['Live login/refresh/logout', 'Actual protected workspace UI and back/forward', 'Notifications', 'Orders/idempotency on isolated staging', 'Sourcing/catalog/variants/mobile'],
      results
    }, null, 2));
    for (const result of results) console.log(result.result + ' — ' + result.name + (result.detail ? ': ' + result.detail : ''));
    if (results.some(r => r.result !== 'PASS')) process.exitCode = 1;
  }
})();
