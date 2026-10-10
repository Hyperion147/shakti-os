/*
 * Real-browser scroll and corner-radius regression (run against a running dashboard).
 * Uses isolated synthetic sessions/data; never submits an action or contacts
 * the real API/Supabase. Requires an available Playwright installation:
 *   node tests/scrolling.browser.cjs [playwright-module] [chromium-executable] [dashboard-origin] [screenshot-dir]
 * Optional screenshot-dir saves fixture-only screenshots; use a temporary folder.
 */
/* Node provides __dirname, process and Buffer as globals; do not redeclare them. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { mkdirSync } = require('node:fs');
const { chromium } = require(process.argv[2] || 'playwright');
// Pass synthetic NEXT_PUBLIC_* values matching the test server explicitly.
// Never load a private dotenv file or use a real stored browser session.

const dashboardOrigin = process.argv[4] || 'http://localhost:3000';
const screenshotDirectory = process.argv[5];
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').origin;
const authUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scroll-test.supabase.co');
const storageKey = `sb-${authUrl.hostname.split('.')[0]}-auth-token`;
const user = { id: 'scroll-test-operator', email: 'scroll-test@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
const expires = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expires, role: 'authenticated' })).toString('base64url')}.not-a-real-signature`;
const session = { access_token: jwt, refresh_token: 'isolated-test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expires, user };
const incidents = Array.from({ length: 24 }, (_, index) => ({
  id: `scroll-incident-${index}`, type: 'crowd_risk', location: `gate_${index + 1}`,
  status: 'RESPONDING', severity: 'HIGH', confidence: 0.9, risk: 0.75,
  latitude: index === 0 ? 23.3852 : index === 1 ? 23.412 : null,
  longitude: index === 0 ? 85.318 : index === 1 ? 85.425 : null,
  factors: { crowd_density: 0.8, citizen_report_count: 3 },
  created_at: '2026-09-19T12:00:00Z', updated_at: '2026-09-19T12:03:00Z',
}));
const events = Array.from({ length: 40 }, (_, index) => ({
  id: `scroll-event-${index}`, type: 'citizen_report', source: 'scroll_test_source',
  location: 'gate_1', confidence: 0.9, incident_id: incidents[0].id,
  timestamp: '2026-09-19T12:00:00Z', payload: {
    description: `Evidence row ${index + 1}: a synthetic access observation for scroll testing.`,
    category: 'crowd', urgency: 'high', venue_event_id: 'scroll-test-venue',
  },
}));
const timeline = events.map((event) => ({
  id: `timeline-${event.id}`, incident_id: incidents[0].id, type: 'event.correlated',
  timestamp: event.timestamp, details: { event_id: event.id, event_type: event.type, source: event.source, risk: 0.75, severity: 'HIGH' },
}));

async function main() {
  const executablePath = process.argv[3];
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const results = [];
  let mutations = 0;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: storageKey, value: session });
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === apiOrigin) {
        const headers = { 'access-control-allow-origin': dashboardOrigin, 'access-control-allow-headers': 'authorization,content-type' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (request.method() !== 'GET') {
          mutations += 1;
          return route.fulfill({ status: 405, headers, json: { detail: 'Browser scroll checks never mutate operational data' } });
        }
        let data;
        if (url.pathname === '/me') data = { ...user, is_operator: true };
        else if (url.pathname === '/incidents') data = incidents;
        else if (url.pathname === '/events' || url.pathname.endsWith('/events')) data = events;
        else if (url.pathname.endsWith('/timeline')) data = timeline;
        else if (url.pathname.startsWith('/incidents/')) data = incidents[0];
        else if (url.pathname === '/venues') data = [];
        else if (url.pathname === '/integrations') data = { n8n: { configured: false, authenticated: false } };
        else return route.fulfill({ status: 404, headers, json: { detail: 'Unknown test route' } });
        return route.fulfill({ headers, json: data });
      }
      if (url.origin === authUrl.origin) return route.fulfill({ json: user });
      if (url.origin === dashboardOrigin) return route.continue();
      return route.abort(); // No tiles, external services or private telemetry.
    });
    await context.routeWebSocket(`${apiOrigin.replace(/^http/, 'ws')}/**`, (socket) => {
      socket.onMessage(() => socket.send(JSON.stringify({ type: 'authenticated' })));
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const check = async (name, action) => {
      try { results.push({ name, ok: true, ...(await action()) }); }
      catch (error) { results.push({ name, ok: false, error: error.message.split('\n')[0] }); }
    };
    const card = (title) => page.locator('[data-slot="card"]').filter({ has: page.getByText(title, { exact: true }) });
    const radiusCheck = async (locator, max, min = 0) => {
      await locator.first().waitFor({ state: 'attached' });
      const radii = await locator.evaluateAll((elements) => elements.map((element) => {
        const style = getComputedStyle(element);
        return { element: element.getAttribute('data-slot') || element.tagName, radii: [
          style.borderTopLeftRadius, style.borderTopRightRadius,
          style.borderBottomRightRadius, style.borderBottomLeftRadius,
        ].map(parseFloat) };
      }));
      assert(radii.length > 0, 'No matching elements for radius check');
      for (const item of radii) {
        assert(item.radii.every((radius) => radius >= min && radius <= max),
          `${item.element}: expected ${min}–${max}px corners, got ${item.radii.join(', ')}px`);
      }
      return { elements: radii.length, maxRadius: Math.max(...radii.flatMap((item) => item.radii)) };
    };
    const controls = () => page.locator('[data-slot="button"], [data-slot="input"], [data-slot="textarea"], [data-slot="select-trigger"]');
    const screenshot = async (name) => {
      if (!screenshotDirectory) return;
      mkdirSync(screenshotDirectory, { recursive: true });
      if (name === 'landing-desktop') {
        // Trigger the real scroll-reveal animations before a full-page capture.
        for (const section of await page.locator('main > section').all()) {
          await section.scrollIntoViewIfNeeded();
          await page.waitForTimeout(600);
        }
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      }
      await page.screenshot({ path: path.join(screenshotDirectory, `${name}.png`), fullPage: true });
    };
    const scrollCheck = async (root) => {
      const viewport = root.locator('[data-slot="scroll-area-viewport"]');
      await root.scrollIntoViewIfNeeded();
      const size = await viewport.evaluate((element) => ({
        rootHeight: element.parentElement.clientHeight,
        viewportHeight: element.clientHeight, contentHeight: element.scrollHeight,
      }));
      assert(size.viewportHeight <= size.rootHeight + 1, `viewport escapes its height limit: ${JSON.stringify(size)}`);
      assert(size.contentHeight > size.viewportHeight, `fixture does not overflow: ${JSON.stringify(size)}`);
      await viewport.evaluate((element) => { element.scrollTop = 0; });
      const bounds = await root.boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + Math.min(bounds.height / 2, 100));
      await page.mouse.wheel(0, 550);
      await page.waitForTimeout(250);
      const scrollTop = await viewport.evaluate((element) => element.scrollTop);
      assert(scrollTop > 0, 'Mouse wheel did not scroll content');
      await viewport.focus();
      await page.keyboard.press('End');
      await page.waitForTimeout(250);
      const end = await viewport.evaluate((element) => element.scrollTop + element.clientHeight >= element.scrollHeight - 2);
      assert(end, 'Keyboard could not reach the last row');
      return { ...size, scrollTop, reachedEnd: end };
    };

    await page.goto(`${dashboardOrigin}/incidents/${incidents[0].id}`);
    await card('Signals / evidence').locator('tbody tr').first().waitFor();
    await check('Incident cards use 12px corners', () => radiusCheck(page.locator('[data-slot="card"]'), 12, 12));
    await check('Incident inputs and actions are not pills', () => radiusCheck(controls(), 8, 4));
    await screenshot('incident-desktop');
    await check('Incident evidence table', () => scrollCheck(card('Signals / evidence').locator('[data-slot="scroll-area"]')));
    await check('Fixed-height incident timeline', () => scrollCheck(card('Timeline').locator('[data-slot="scroll-area"]')));

    await page.setViewportSize({ width: 390, height: 844 });
    await screenshot('incident-mobile');
    await check('Narrow-screen evidence table', () => scrollCheck(card('Signals / evidence').locator('[data-slot="scroll-area"]')));
    await check('Evidence table horizontal scrolling', async () => {
      const table = card('Signals / evidence').locator('[data-slot="table-container"]');
      const dimensions = await table.evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
        return { clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, scrollLeft: element.scrollLeft };
      });
      assert(dimensions.scrollWidth > dimensions.clientWidth && dimensions.scrollLeft > 0, 'Wide table is not horizontally scrollable');
      return dimensions;
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${dashboardOrigin}/dashboard`);
    await card('Incident queue').locator('[data-slot="scroll-area"]').waitFor();
    await check('Dashboard panels use 12px corners', () => radiusCheck(page.locator('[data-slot="card"]'), 12, 12));
    await check('Dashboard badges use compact 4px corners', () => radiusCheck(page.locator('[data-slot="badge"]'), 4, 4));
    await check('Dashboard tabs use 6–8px corners', () => radiusCheck(page.locator('[data-slot="tabs-list"], [data-slot="tabs-trigger"]'), 8, 6));
    await check('Map frame uses 12px corners', () => radiusCheck(page.getByRole('region', { name: 'Incident situation map' }), 12, 12));
    await check('Avatars remain circular', async () => {
      const avatar = page.getByRole('link', { name: 'Operator profile and settings' });
      const shape = await avatar.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height, radius: parseFloat(getComputedStyle(element).borderTopLeftRadius) };
      });
      assert.equal(shape.width, shape.height);
      assert(shape.radius >= shape.width / 2);
      return shape;
    });
    const regionalMapCheck = async () => {
      const region = page.getByRole('region', { name: 'Incident situation map' });
      const markers = region.locator('.leaflet-overlay-pane path.leaflet-interactive');
      await markers.nth(1).waitFor({ state: 'attached' });
      assert.equal(await markers.count(), 2, 'Expected Ranchi fixture markers');
      // Read all rectangles in one frame; scrolling must not skew comparisons.
      const geometry = await region.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height,
          markers: [...element.querySelectorAll('.leaflet-overlay-pane path.leaflet-interactive')].map((marker) => {
            const box = marker.getBoundingClientRect();
            return { left: box.left - bounds.left, top: box.top - bounds.top,
              right: box.right - bounds.left, bottom: box.bottom - bounds.top };
          }) };
      });
      for (const marker of geometry.markers) {
        assert(marker.left >= 16 && marker.top >= 16 &&
          marker.right <= geometry.width - 16 && marker.bottom <= geometry.height - 16,
          `Initial view clips a Ranchi marker: ${JSON.stringify(geometry)}`);
      }
      return { plottedMarkers: 2, mapWidth: geometry.width, mapHeight: geometry.height };
    };
    await check('Initial desktop map includes Ranchi', regionalMapCheck);
    await screenshot('dashboard-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${dashboardOrigin}/dashboard`);
    await check('Initial narrow-screen map includes Ranchi', regionalMapCheck);
    await screenshot('dashboard-mobile');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${dashboardOrigin}/dashboard`);
    await check('Dashboard incident queue', () => scrollCheck(card('Incident queue').locator('[data-slot="scroll-area"]')));
    await page.getByRole('button', { name: 'Search (Ctrl+K)', exact: true }).click();
    await page.getByRole('dialog').locator('[data-slot="scroll-area"] button').first().waitFor();
    await check('Search dialog uses 12px corners', () => radiusCheck(page.getByRole('dialog'), 12, 12));
    await screenshot('search-dialog');
    await check('Search result list', () => scrollCheck(page.getByRole('dialog').locator('[data-slot="scroll-area"]')));
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await check('Page scrolling resumes after closing search', async () => {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.mouse.move(1200, 500);
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(250);
      const offset = await page.evaluate(() => window.scrollY);
      assert(offset > 0, 'Page remained scroll-locked');
      return { offset };
    });
    await page.goto(`${dashboardOrigin}/incidents`);
    await page.getByRole('textbox', { name: 'Search incidents', exact: true }).waitFor();
    await check('Table filters use 6–8px corners', () => radiusCheck(controls(), 8, 6));
    await screenshot('incidents-desktop');
    await page.getByRole('combobox', { name: 'Filter by severity' }).click();
    await page.getByRole('listbox').waitFor();
    await check('Filter menu uses 8px corners', () => radiusCheck(page.locator('[data-slot="select-content"]'), 8, 8));
    await page.keyboard.press('Escape');

    await page.goto(`${dashboardOrigin}/login`);
    await page.getByLabel('Email address', { exact: true }).waitFor();
    await check('Login controls use 6–8px corners', () => radiusCheck(controls(), 8, 6));
    await screenshot('login-desktop');
    await page.goto(dashboardOrigin);
    await page.getByText('Event-driven intelligence', { exact: true }).waitFor();
    await check('Landing panels stay within 16px', () => radiusCheck(page.locator('article, main section > div.rounded-2xl'), 16, 8));
    await check('Landing action buttons use 8px corners', () => radiusCheck(page.locator('[data-slot="button"]'), 8, 8));
    await screenshot('landing-desktop');
    assert.equal(mutations, 0, 'Unexpected state-changing API request');
    console.log(JSON.stringify(results, null, 2));
    if (results.some((result) => !result.ok)) process.exitCode = 1;
  } finally { await browser.close(); }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
