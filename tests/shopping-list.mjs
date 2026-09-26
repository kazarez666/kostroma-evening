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

  // Shopping starts as three clear planning modes.
  assert.equal(await page.locator('[data-shopping-view]').count(), 3);
  assert.equal(await page.locator('[data-shopping-panel="friday"]').isVisible(), true);
  assert.equal(await page.locator('[data-shopping-panel="breakfast"]').isVisible(), false);
  assert.equal(await page.locator('[data-shopping-panel="list"]').isVisible(), false);
  assert.match(await page.locator('#fridayShoppingPreview').innerText(), /Coca-Cola Original/);
  assert.match(await page.locator('#fridayShoppingPreview').innerText(), /Pringles/);

  // Friday plan is editable.
  await page.locator('#fridayCustomInput').fill('Орешки');
  await page.locator('#fridayCustomAdd').click();
  assert.equal(await page.locator('#fridayShoppingPreview .plan-product-row').filter({ hasText: 'Орешки' }).count(), 1);

  // Fondue ingredients are normal-sized Friday rows with a fondue badge.
  await page.locator('#fondueRecommend').click();
  const strawberryFriday = page.locator('#fridayShoppingPreview .plan-product-row').filter({ hasText: 'Клубника' });
  assert.equal(await strawberryFriday.count(), 1);
  assert.match(await strawberryFriday.innerText(), /для фондю/);

  // Breakfast has editable options and selected items flow forward.
  await page.locator('[data-shopping-view="breakfast"]').click();
  await page.getByRole('button', { name: 'Яйца', exact: true }).click();
  await page.locator('#breakfastCustomInput').fill('Хлопья');
  await page.locator('#breakfastCustomAdd').click();
  assert.match(await page.locator('#breakfastPicked').innerText(), /Яйца/);
  assert.match(await page.locator('#breakfastPicked').innerText(), /Хлопья/);
  assert.equal(await page.getByRole('button', { name: 'Хлопья', exact: true }).getAttribute('aria-pressed'), 'true');

  // Final list is an editable preview assembled from Friday + fondue + breakfasts.
  await page.locator('[data-shopping-view="list"]').click();
  assert.equal(await page.locator('[data-shopping-item="Молоко для какао"]').count(), 1);
  assert.equal(await page.locator('[data-shopping-item="Клубника"]').count(), 1);
  assert.equal(await page.locator('[data-shopping-item="Орешки"]').count(), 1);
  assert.equal(await page.locator('[data-shopping-item="Яйца"]').count(), 1);
  assert.equal(await page.locator('[data-shopping-item="Хлопья"]').count(), 1);

  await page.locator('#shoppingCustomInput').fill('Вода 2 л');
  await page.locator('#shoppingAdd').click();
  assert.equal(await page.locator('[data-shopping-item="Вода 2 л"]').count(), 1);

  // Freeze a snapshot for the actual store trip.
  assert.equal(await page.locator('#savedShoppingLaunch').isVisible(), false);
  await page.locator('#saveStoreList').click();
  assert.equal(await page.locator('#savedShoppingLaunch').isVisible(), true);
  await page.locator('#openSavedShopping').click();
  assert.equal(await page.locator('#storeListModal').isVisible(), true);
  assert.equal(await page.locator('[data-store-item="Pringles"]').count(), 1);
  assert.equal(await page.locator('[data-store-item="Клубника"]').count(), 1);
  assert.equal(await page.locator('[data-store-item="Хлопья"]').count(), 1);

  // Tap a product after putting it into the cart: it gets crossed out and persists.
  await page.locator('[data-store-item="Pringles"]').click();
  assert.equal(await page.locator('[data-store-item="Pringles"]').evaluate(el => el.classList.contains('done')), true);
  assert.match(await page.locator('#storeListProgress').innerText(), /^1 \/ /);
  await page.locator('[data-close-store-list]').last().click();

  // Editing the plan does NOT silently mutate the frozen store list.
  await page.locator('[data-shopping-view="friday"]').click();
  await page.locator('#fridayCustomInput').fill('Сок');
  await page.locator('#fridayCustomAdd').click();
  await page.locator('#openSavedShopping').click();
  assert.equal(await page.locator('[data-store-item="Сок"]').count(), 0);
  await page.locator('[data-close-store-list]').last().click();

  // Explicitly freezing again updates the snapshot while preserving matching checked items.
  await page.locator('[data-shopping-view="list"]').click();
  await page.locator('#saveStoreList').click();
  await page.locator('#openSavedShopping').click();
  assert.equal(await page.locator('[data-store-item="Сок"]').count(), 1);
  assert.equal(await page.locator('[data-store-item="Pringles"]').evaluate(el => el.classList.contains('done')), true);
  await page.locator('[data-close-store-list]').last().click();

  // Saved store list and custom planning choices survive reload.
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('#startEvening').isVisible().catch(()=>false)) await page.locator('#startEvening').click();
  await page.locator('.mnav[data-tab="food"]').click();
  assert.equal(await page.locator('#savedShoppingLaunch').isVisible(), true);
  assert.match(await page.locator('#fridayShoppingPreview').innerText(), /Орешки/);
  await page.locator('[data-shopping-view="breakfast"]').click();
  assert.match(await page.locator('#breakfastPicked').innerText(), /Хлопья/);
  await page.locator('#openSavedShopping').click();
  assert.equal(await page.locator('[data-store-item="Сок"]').count(), 1);
  assert.equal(await page.locator('[data-store-item="Pringles"]').evaluate(el => el.classList.contains('done')), true);
  await page.locator('[data-close-store-list]').last().click();

  // Custom Friday and breakfast options can be removed without touching fixed items.
  await page.locator('[data-shopping-view="friday"]').click();
  await page.getByRole('button', { name: 'Удалить из пятницы Орешки' }).click();
  assert.equal(await page.locator('#fridayShoppingPreview .plan-product-row').filter({ hasText: 'Орешки' }).count(), 0);
  await page.locator('[data-shopping-view="breakfast"]').click();
  await page.getByRole('button', { name: 'Удалить вариант завтрака Хлопья' }).click();
  assert.doesNotMatch(await page.locator('#breakfastPicked').innerText(), /Хлопья/);

  assert.deepEqual(errors, [], 'Uncaught page errors: '+errors.join('\n'));
  console.log('SHOPPING_LIST_OK');
} finally {
  await browser.close();
}
