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

  // Shopping starts as three clear switchable modes.
  assert.equal(await page.locator('[data-shopping-view]').count(), 3);
  assert.equal(await page.locator('[data-shopping-panel="friday"]').isVisible(), true);
  assert.equal(await page.locator('[data-shopping-panel="breakfast"]').isVisible(), false);
  assert.equal(await page.locator('[data-shopping-panel="list"]').isVisible(), false);
  assert.match(await page.locator('#fridayShoppingPreview').innerText(), /Coca-Cola Original/);
  assert.match(await page.locator('#fridayShoppingPreview').innerText(), /Pringles/);

  // Fondue choice appears in Friday preview and in the real final list.
  await page.locator('#fondueRecommend').click();
  assert.match(await page.locator('#shoppingFonduePreview').innerText(), /Клубника/);
  assert.equal(await page.locator('[data-shopping-item="Клубника"]').count(), 1);

  // Breakfast is a separate planning mode; options enter the final list only after selection.
  await page.locator('[data-shopping-view="breakfast"]').click();
  assert.equal(await page.locator('[data-shopping-panel="breakfast"]').isVisible(), true);
  assert.equal(await page.locator('[data-shopping-item="Яйца"]').count(), 0);
  await page.getByRole('button', { name: 'Яйца', exact: true }).click();
  await page.getByRole('button', { name: 'Сыр', exact: true }).click();
  assert.match(await page.locator('#breakfastPicked').innerText(), /Яйца/);
  assert.match(await page.locator('#breakfastPicked').innerText(), /Сыр/);
  assert.equal(await page.locator('[data-shopping-item="Яйца"]').count(), 1);

  // Final list contains only actual purchases and supports custom rows.
  await page.locator('[data-shopping-view="list"]').click();
  assert.equal(await page.locator('[data-shopping-panel="list"]').isVisible(), true);
  assert.equal(await page.locator('[data-shopping-item="Молоко для какао"]').count(), 1);
  assert.equal(await page.locator('[data-shopping-item="Coca-Cola Original"]').count(), 1);
  assert.equal(await page.locator('[data-shopping-item="Pringles"]').count(), 1);
  await page.locator('#shoppingCustomInput').fill('Вода 2 л');
  await page.locator('#shoppingAdd').click();
  assert.equal(await page.locator('[data-shopping-item="Вода 2 л"]').count(), 1);

  // Duplicate names should not create duplicate rows.
  await page.locator('#shoppingCustomInput').fill('вода 2 л');
  await page.locator('#shoppingAdd').click();
  assert.equal(await page.locator('[data-shopping-item="Вода 2 л"]').count(), 1);

  // Check state and selected breakfast survive reload.
  await page.locator('[data-shopping-item="Вода 2 л"]').check();
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('#startEvening').isVisible().catch(()=>false)) await page.locator('#startEvening').click();
  await page.locator('.mnav[data-tab="food"]').click();
  assert.equal(await page.locator('[data-shopping-view="list"]').evaluate(el => el.classList.contains('active')), true);
  assert.equal(await page.locator('[data-shopping-item="Вода 2 л"]').isChecked(), true);
  assert.equal(await page.locator('[data-shopping-item="Яйца"]').count(), 1);

  // Hide bought items and bring them back.
  await page.locator('#shoppingHideDone').click();
  assert.equal(await page.locator('[data-shopping-item="Вода 2 л"]').locator('..').locator('..').isVisible(), false);
  await page.locator('#shoppingHideDone').click();
  assert.equal(await page.locator('[data-shopping-item="Вода 2 л"]').locator('..').locator('..').isVisible(), true);

  // Store mode keeps the final list full-screen.
  await page.locator('#shoppingStoreMode').click();
  assert.equal(await page.evaluate(() => document.body.classList.contains('shopping-mode')), true);
  const card = await page.locator('#shoppingCard').boundingBox();
  assert.ok(card && card.width >= 389 && card.height >= 843);
  assert.equal(await page.locator('[data-shopping-panel="list"]').isVisible(), true);
  const row = await page.locator('[data-shopping-item="Вода 2 л"]').locator('..').boundingBox();
  assert.ok(row && row.height >= 50);
  await page.locator('#shoppingStoreExit').click();

  // Remove custom item; automatic Friday/fondue items remain.
  await page.getByRole('button', { name: 'Удалить Вода 2 л' }).click();
  assert.equal(await page.locator('[data-shopping-item="Вода 2 л"]').count(), 0);
  assert.equal(await page.locator('[data-shopping-item="Шоколад для фондю"]').count(), 1);
  assert.equal(await page.locator('[data-shopping-item="Клубника"]').count(), 1);

  // Breakfast can be removed again from its own mode.
  await page.locator('[data-shopping-view="breakfast"]').click();
  assert.equal(await page.getByRole('button', { name: 'Яйца', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Яйца', exact: true }).click();
  await page.locator('[data-shopping-view="list"]').click();
  assert.equal(await page.locator('[data-shopping-item="Яйца"]').count(), 0);

  assert.deepEqual(errors, [], 'Uncaught page errors: '+errors.join('\n'));
  console.log('SHOPPING_LIST_OK');
} finally {
  await browser.close();
}
