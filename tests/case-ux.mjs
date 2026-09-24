import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('http://127.0.0.1:4173/index.html');
  if (await page.locator('#startEvening').isVisible()) await page.locator('#startEvening').click();

  assert.equal(await page.locator('[data-tab="detective"]').count(), 0);
  await page.locator('#openSecretCase').click();
  assert.equal(await page.locator('#caseReveal').isVisible(), true);
  assert.equal(await page.evaluate(() => !!document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('#caseReveal')), true,
    'The reveal should fill the screen instead of scrolling past it');
  if (process.env.CI) mkdirSync('test-artifacts', { recursive: true });
  if (process.env.CI) await page.screenshot({ path: 'test-artifacts/reveal-opening-mobile.png' });
  await page.locator('#caseRevealContinue').waitFor({ state: 'visible' });
  if (process.env.CI) await page.screenshot({ path: 'test-artifacts/reveal-ready-mobile.png' });
  await page.locator('#caseRevealContinue').click();
  assert.equal(await page.locator('#caseReveal').isVisible(), false);
  await page.waitForFunction(() => {
    const r = document.querySelector('#planPhaseFour').getBoundingClientRect();
    return r.top < innerHeight / 2 && r.bottom > innerHeight / 2;
  });
  if (process.env.CI) await page.screenshot({ path: 'test-artifacts/revealed-plan-mobile.png' });
  await page.locator('.mobile-nav [data-tab="detective"]').waitFor();
  assert.equal(await page.locator('.tabs [data-tab="detective"]').count(), 1);
  await page.locator('.mobile-nav [data-tab="food"]').click();
  await page.locator('.mobile-nav [data-tab="detective"]').click();
  assert.equal(await page.locator('#detective').evaluate(el => el.classList.contains('active')), true);
  await page.waitForFunction(() => {
    const top = document.querySelector('#detective').getBoundingClientRect().top;
    return top >= -2 && top < 30;
  });

  await page.locator('#startCase').click();
  await page.locator('[data-case-app="police"]').click();
  assert.equal(await page.locator('.police-index-card').count(), 7);
  await page.locator('[data-police-open="6"]').click();
  assert.equal(await page.locator('.police-paper').count(), 1);
  const sheetTop = await page.locator('.police-paper .case-doc-title').evaluate(el => el.getBoundingClientRect().top);
  assert.ok(sheetTop > 0 && sheetTop < 300, 'Opening any police sheet should show its heading first');
  if (process.env.CI) {
    await page.waitForTimeout(420);
    await page.screenshot({ path: 'test-artifacts/police-document-mobile.png' });
  }

  const lastPin = page.locator('[data-pin="police_6"]');
  await lastPin.scrollIntoViewIfNeeded();
  const top = await page.locator('#caseApps').evaluate(el => el.getBoundingClientRect().top);
  assert.ok(top >= -2 && top < 80, 'Case navigation should stay available while reading long documents');
  await page.locator('[data-case-app="brief"]').click();
  await page.waitForFunction(() => {
    const top = document.querySelector('#caseDesk').getBoundingClientRect().top;
    return top >= -2 && top < 30;
  });
  await page.locator('[data-case-app="police"]').click();
  await page.locator('[data-police-open="6"]').click();
  await lastPin.scrollIntoViewIfNeeded();
  await lastPin.evaluate(el => { window.savedPinNode = el; });
  await lastPin.click();
  assert.equal(await page.evaluate(() => document.querySelector('[data-pin="police_6"]') === window.savedPinNode), true,
    'Pinning must not recreate the document being read');
  assert.match(await lastPin.innerText(), /На доске/);
  assert.equal(await page.locator('#caseProgress').innerText(), '1');

  const freshTab = await context.newPage();
  await freshTab.goto('http://127.0.0.1:4173/index.html');
  assert.equal(await freshTab.locator('[data-tab="detective"]').count(), 0,
    'The secret navigation should remain hidden in a fresh pre-trip browser session');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForFunction(() => document.querySelectorAll('.secret-leaf').length === 30);
  const leafLayout = await page.locator('.secret-leaf').evaluateAll(leaves => leaves.map(el => ({
    x: el.getBoundingClientRect().x / innerWidth,
    interactive: getComputedStyle(el).pointerEvents !== 'none',
  })));
  assert.ok(leafLayout.some(leaf => leaf.x > .35 && leaf.x < .65), 'Leaves should reach the middle of the interface');
  assert.ok(leafLayout.every(leaf => !leaf.interactive), 'Decorative leaves must not block case controls');
  if (process.env.CI) await page.screenshot({ path: 'test-artifacts/scattered-leaves-desktop.png' });
  assert.deepEqual(errors, [], 'Uncaught page errors: ' + errors.join('\n'));
  console.log('CASE_UX_OK');
} finally {
  await browser.close();
}
