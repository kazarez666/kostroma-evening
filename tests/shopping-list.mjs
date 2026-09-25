import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'domcontentloaded' });
  if (await page.locator('#startEvening').isVisible().catch(()=>false)) await page.locator('#startEvening').click();
  await page.locator('.mnav[data-tab="food"]').click();

  // Add a custom item ahead of the trip.
  await page.locator('#shoppingCustomInput').fill('Вода 2 л');
  await page.locator('#shoppingAdd').click();
  assert.equal(await page.locator('[data-shopping-item="Вода 2 л"]').count(), 1);

  // Duplicate names should not create duplicate rows.
  await page.locator('#shoppingCustomInput').fill('вода 2 л');
  await page.locator('#shoppingAdd').click();
  assert.equal(await page.locator('[data-shopping-item="Вода 2 л"]').count(), 1);

  // Check state survives a reload.
  await page.locator('[data-shopping-item="Вода 2 л"]').check();
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('#startEvening').isVisible().catch(()=>false)) await page.locator('#startEvening').click();
  await page.locator('.mnav[data-tab="food"]').click();
  assert.equal(await page.locator('[data-shopping-item="Вода 2 л"]').isChecked(), true);
  assert.match(await page.locator('#shoppingCount').innerText(), /куплено/);

  // Hide bought items and bring them back.
  await page.locator('#shoppingHideDone').click();
  assert.equal(await page.locator('[data-shopping-item="Вода 2 л"]').locator('..').locator('..').isVisible(), false);
  await page.locator('#shoppingHideDone').click();
  assert.equal(await page.locator('[data-shopping-item="Вода 2 л"]').locator('..').locator('..').isVisible(), true);

  // Store mode should take over the phone viewport with large rows.
  await page.locator('#shoppingStoreMode').click();
  assert.equal(await page.evaluate(() => document.body.classList.contains('shopping-mode')), true);
  const card = await page.locator('#shoppingCard').boundingBox();
  assert.ok(card && card.width >= 389 && card.height >= 843);
  const row = await page.locator('[data-shopping-item="Вода 2 л"]').locator('..').boundingBox();
  assert.ok(row && row.height >= 50);
  await page.locator('#shoppingStoreExit').click();
  assert.equal(await page.evaluate(() => document.body.classList.contains('shopping-mode')), false);

  // Selected fondue products still flow into the same list.
  await page.locator('#fondueRecommend').click();
  assert.equal(await page.locator('[data-shopping-item="Клубника"]').count(), 1);

  // Custom items can be removed without affecting automatic items.
  await page.getByRole('button', { name: 'Удалить Вода 2 л' }).click();
  assert.equal(await page.locator('[data-shopping-item="Вода 2 л"]').count(), 0);
  assert.equal(await page.locator('[data-shopping-item="Шоколад"]').count(), 1);

  assert.deepEqual(errors, [], 'Uncaught page errors: '+errors.join('\n'));
  console.log('SHOPPING_LIST_OK');
} finally {
  await browser.close();
}
