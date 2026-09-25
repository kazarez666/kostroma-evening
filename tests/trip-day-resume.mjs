import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const errors = [];
context.on('page', page => page.on('pageerror', error => errors.push(String(error))));
await context.addInitScript(() => {
  const RealDate = Date;
  window.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [localStorage.getItem('testDateOverride') || '2026-10-01T12:00:00']));
    }
    static now() { return new RealDate(localStorage.getItem('testDateOverride') || '2026-10-01T12:00:00').getTime(); }
  };
});

try {
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/index.html');
  await page.evaluate(() => {
    localStorage.setItem('case24Schema', 'case24-polish-v7');
    localStorage.setItem('case24State', JSON.stringify({ started: true, pins: ['profile_kirill'] }));
    localStorage.setItem('testDateOverride', '2026-10-02T19:00:00');
  });

  // Old testing state is cleared once on the trip day.
  await page.reload();
  assert.equal(await page.evaluate(() => localStorage.getItem('case24TripPrepared')), '2026-10-02');
  assert.equal(await page.evaluate(() => caseState.started), false);
  assert.equal(await page.locator('#casePlanLaunch').isVisible(), false);

  if (await page.locator('#startEvening').isVisible()) await page.locator('#startEvening').click();
  await page.locator('#secretOwnerTrigger').click();
  await page.locator('#openSecretCase').click();
  await page.locator('#caseRevealContinue').click();
  await page.locator('#casePlanLaunch').waitFor({ state: 'visible' });
  await page.locator('#casePlanLaunch').click();
  await page.locator('#startCase').click();
  await page.locator('[data-case-app="people"]').click();
  await page.locator('[data-pin="profile_kirill"]').click();
  assert.equal(await page.evaluate(() => caseState.pins.includes('profile_kirill')), true);

  // Opening a fresh tab has a new sessionStorage, but must preserve the reveal and case.
  const reopened = await context.newPage();
  await reopened.goto('http://127.0.0.1:4173/index.html');
  assert.equal(await reopened.locator('#casePlanLaunch').isVisible(), true);
  if (await reopened.locator('#startEvening').isVisible()) await reopened.locator('#startEvening').click();
  await reopened.locator('#casePlanLaunch').click();
  assert.equal(await reopened.locator('#caseDesk').isVisible(), true);
  assert.equal(await reopened.evaluate(() => caseState.pins.includes('profile_kirill')), true);

  await reopened.reload();
  assert.equal(await reopened.locator('#casePlanLaunch').isVisible(), true);
  assert.equal(await reopened.evaluate(() => caseState.pins.includes('profile_kirill')), true);
  assert.deepEqual(errors, [], 'Uncaught page errors: ' + errors.join('\n'));
  console.log('TRIP_DAY_RESUME_OK');
} finally {
  await browser.close();
}
