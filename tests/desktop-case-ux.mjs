import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));

  await page.goto('http://127.0.0.1:4173/index.html');
  if (await page.locator('#startEvening').isVisible()) await page.locator('#startEvening').click();

  await page.locator('#openSecretCase').click();
  await page.locator('#caseRevealContinue').waitFor({ state: 'visible' });
  await page.locator('#caseRevealContinue').click();
  await page.locator('#casePlanLaunch').click();
  await page.locator('#startCase').click();

  const deskDisplay = await page.locator('#caseDesk').evaluate(el => getComputedStyle(el).display);
  assert.equal(deskDisplay, 'grid', 'Laptop case desk should use a two-column grid');

  const appsBox = await page.locator('#caseApps').boundingBox();
  const screenBox = await page.locator('#caseScreen').boundingBox();
  assert.ok(appsBox && screenBox);
  assert.ok(appsBox.width >= 200 && appsBox.width <= 235, 'Laptop case nav should be a compact left rail');
  assert.ok(screenBox.x >= appsBox.x + appsBox.width - 3, 'Case content should sit to the right of the navigation');
  assert.ok(screenBox.width > 650, 'Laptop case content should have a generous reading width');

  assert.ok(await page.locator('.case-app[data-unseen="1"]').count() >= 5,
    'Unopened investigation sections should carry a neutral unread dot');
  await page.locator('[data-case-app="devices"]').click();
  assert.equal(await page.locator('[data-case-app="devices"]').getAttribute('data-unseen'), '0');

  await page.locator('[data-case-app="police"]').click();
  const firstDoc = page.locator('[data-police-open="0"]');
  assert.match(await firstDoc.innerText(), /не открывали/i);
  await firstDoc.click();
  await page.locator('[data-police-back]').click();
  assert.match(await page.locator('[data-police-open="0"]').innerText(), /просмотрено/i);

  await page.locator('[data-case-app="devices"]').click();
  await page.locator('[data-device="laptop"]').click();
  await page.locator('[data-device="laptop_files"]').click();
  await page.locator('[data-filepath="desktop"]').click();
  const file = page.locator('[data-open-file]').first();
  assert.match(await file.innerText(), /не открывали/i);
  const fileId = await file.getAttribute('data-open-file');
  await file.click();
  await page.locator('[data-close-file]').click();
  assert.match(await page.locator('[data-open-file="'+fileId+'"]').innerText(), /просмотрено/i);

  await page.reload();
  if (await page.locator('#startEvening').isVisible()) await page.locator('#startEvening').click();
  await page.locator('.tabs [data-tab="detective"]').click();
  assert.equal(await page.locator('[data-case-app="devices"]').getAttribute('data-unseen'), '0',
    'Viewed section state should survive reload');
  assert.match(await page.locator('.case-autosave').innerText(), /сохраняется автоматически/);

  assert.deepEqual(errors, [], 'Uncaught page errors: ' + errors.join('\n'));
  console.log('DESKTOP_CASE_UX_OK');
} finally {
  await browser.close();
}
