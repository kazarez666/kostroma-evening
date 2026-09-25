import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'domcontentloaded' });
  if (await page.locator('#startEvening').isVisible().catch(()=>false)) await page.locator('#startEvening').click();

  // Plan opens in calm summary mode rather than as a task wall.
  assert.equal(await page.locator('#plan').evaluate(el => el.classList.contains('plan-details-collapsed')), true);
  assert.equal(await page.locator('#planFlow').isVisible(), false);
  assert.match(await page.locator('#planNowTitle').innerText(), /Приехали и выдохнули/);
  assert.match(await page.locator('#planNextTitle').innerText(), /Включаем уют/);

  await page.locator('#togglePlanDetails').click();
  assert.equal(await page.locator('#planFlow').isVisible(), true);
  for (const id of ['1','2','3','4']) {
    await page.locator('[data-check="'+id+'"]').check({ force: true });
  }
  assert.match(await page.locator('#planNowTitle').innerText(), /Включаем уют/);
  assert.doesNotMatch(await page.locator('#progressText').innerText(), /%/);

  // Activity tabs compact the decorative hero on laptop.
  await page.locator('.tab[data-tab="food"]').click();
  assert.equal(await page.evaluate(() => document.body.classList.contains('activity-mode')), true);
  assert.equal(await page.locator('.hero-main').isVisible(), false);

  // Food starts concise and expands on demand.
  const dinnerOptions = page.locator('.food-choice');
  assert.equal(await dinnerOptions.count(), 18);
  assert.ok((await dinnerOptions.evaluateAll(items => items.filter(el => getComputedStyle(el).display !== 'none').length)) <= 6);
  await page.locator('#toggleDinnerMore').click();
  assert.equal(await dinnerOptions.evaluateAll(items => items.filter(el => getComputedStyle(el).display !== 'none').length), 18);
  await page.locator('.food-choice[data-dinner="Рамен"]').click();
  await page.locator('#toggleDinnerMore').click();
  assert.equal(await page.locator('.food-choice[data-dinner="Рамен"]').isVisible(), true, 'Selected extra dinner must remain visible after collapsing');

  await page.locator('#fondueRecommend').click();
  assert.equal((await page.locator('#fondueCount').innerText()).trim(), '8');
  assert.ok(await page.locator('.fondue-chip.selected').count() === 8);
  assert.match(await page.locator('.shopping-reminder').innerText(), /шоколад/i);

  // Large mode occupies the viewport and exits cleanly.
  await page.locator('.tab[data-tab="emoji"]').click();
  await page.locator('#emoji [data-focus="emoji"]').click();
  assert.equal(await page.evaluate(() => document.body.classList.contains('focus-mode')), true);
  const focusBox = await page.locator('#emoji').boundingBox();
  assert.ok(focusBox && focusBox.width > 1200 && focusBox.height >= 850);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.body.classList.contains('focus-mode')), false);

  await page.locator('.tab[data-tab="talk"]').click();
  await page.locator('#talk [data-focus="talk"]').click();
  assert.equal(await page.locator('#focusExit').isVisible(), true);
  await page.locator('#focusExit').click();
  assert.equal(await page.evaluate(() => document.body.classList.contains('focus-mode')), false);

  // Central background leaves stay quiet on desktop.
  const centerOpacities = await page.locator('.secret-leaf[data-note-leaf="0"]').evaluateAll(items =>
    items.map(el => parseFloat(getComputedStyle(el).opacity))
  );
  assert.ok(Math.max(...centerOpacities) <= .07, 'Central ambient leaves should remain background-level');

  assert.deepEqual(errors, [], 'Uncaught page errors: '+errors.join('\n'));
  console.log('EVENING_UX_OK');
} finally {
  await browser.close();
}
