import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  async function enter() {
    await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'domcontentloaded' });
    if (await page.locator('#startEvening').isVisible().catch(()=>false)) await page.locator('#startEvening').click();
  }
  await enter();

  // Evening tab is intentionally simple: packing card + route, no dashboard tiles.
  assert.equal(await page.locator('#todayCard').isVisible(), false);
  assert.equal(await page.locator('#planNow').isVisible(), false);
  assert.equal(await page.locator('#planFlow').isVisible(), true);
  assert.equal(await page.locator('#prepCard').isVisible(), true);

  // Surprise details stay out of normal visible planning and packing.
  assert.equal(await page.locator('#planFlow').getByText('Овечка', { exact:false }).count(), 0);
  assert.equal(await page.locator('[data-prep-item="Овечка"]').count(), 0);
  assert.equal(await page.locator('#ownerPrepModal').isVisible(), false);

  // A deliberate long press on the footer heart opens the private owner-only packing list.
  const heart = page.locator('#footerHeart');
  await heart.dispatchEvent('pointerdown', { pointerType: 'touch' });
  await page.waitForTimeout(1200);
  await heart.dispatchEvent('pointerup', { pointerType: 'touch' });
  assert.equal(await page.locator('#ownerPrepModal').isVisible(), true);
  assert.equal(await page.locator('[data-owner-prep-item="Овечка"]').count(), 1);
  assert.equal(await page.locator('[data-owner-prep-item="Моя футболка"]').count(), 1);
  assert.equal(await page.locator('[data-owner-prep-item="Фондю"]').count(), 1);
  assert.equal(await page.locator('[data-owner-prep-item="Искусственные кленовые листья"]').count(), 1);
  assert.match(await page.locator('#ownerPrepCount').innerText(), /Особенный вечер: 0 \/ 13/);
  await page.locator('[data-owner-prep-item="Овечка"]').check();
  await page.locator('[data-close-owner-prep]').last().click();

  // Open packing list directly and add a custom neutral item.
  await page.locator('#prepToggle').click();
  assert.equal(await page.locator('#prepBody').isVisible(), true);
  assert.equal(await page.locator('[data-prep-item]').count(), 47);
  await page.locator('#prepCustomInput').fill('Книга');
  await page.locator('#prepAdd').click();
  assert.equal(await page.locator('[data-prep-item="Книга"]').count(), 1);

  // Duplicate custom items should not be added.
  await page.locator('#prepCustomInput').fill('книга');
  await page.locator('#prepAdd').click();
  assert.equal(await page.locator('[data-prep-item="Книга"]').count(), 1);

  // Mark two things packed; the packing counter must reflect the remaining count.
  await page.locator('[data-prep-item="Паспорта"]').check();
  await page.locator('[data-prep-item="Книга"]').check();
  assert.match(await page.locator('#prepCount').innerText(), /2 \/ 48 собрано.*осталось 46/);

  // State survives reload.
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('#startEvening').isVisible().catch(()=>false)) await page.locator('#startEvening').click();
  await page.locator('#footerHeart').dispatchEvent('pointerdown', { pointerType: 'touch' });
  await page.waitForTimeout(1200);
  await page.locator('#footerHeart').dispatchEvent('pointerup', { pointerType: 'touch' });
  assert.equal(await page.locator('[data-owner-prep-item="Овечка"]').isChecked(), true);
  await page.locator('[data-close-owner-prep]').last().click();
  await page.locator('#prepToggle').click();
  assert.equal(await page.locator('[data-prep-item="Паспорта"]').isChecked(), true);
  assert.equal(await page.locator('[data-prep-item="Книга"]').isChecked(), true);

  // Hide packed and restore them.
  await page.locator('#prepHideDone').click();
  assert.equal(await page.locator('[data-prep-item="Паспорта"]').locator('..').locator('..').isVisible(), false);
  await page.locator('#prepHideDone').click();
  assert.equal(await page.locator('[data-prep-item="Паспорта"]').locator('..').locator('..').isVisible(), true);

  // Dinner choice is reflected inside the route itself.
  await page.locator('.mnav[data-tab="food"]').click();
  await page.locator('.food-choice[data-dinner="Пицца"]').click();
  await page.locator('.mnav[data-tab="plan"]').click();
  assert.match(await page.locator('#dinnerPlanName').innerText(), /Пицца/);

  // Shopping stays in the Food tab and can be frozen into a dedicated store list.
  await page.locator('.mnav[data-tab="food"]').click();
  await page.locator('[data-shopping-view="list"]').click();
  assert.equal(await page.locator('[data-shopping-item="Молоко для какао"]').count(), 1);
  await page.locator('#saveStoreList').click();
  assert.equal(await page.locator('#savedShoppingLaunch').isVisible(), true);
  await page.locator('.mnav[data-tab="plan"]').click();

  // Current evening stage is highlighted directly in the route, including the 17:00–19:00 prologue.
  assert.equal(await page.locator('[data-plan-phase="0"]').evaluate(el => el.classList.contains('is-current')), true);
  for (const id of ['24','25','26','27','1','2','3','4']) {
    await page.locator('[data-check="'+id+'"]').evaluate(el => {
      el.checked = true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  assert.equal(await page.locator('[data-plan-phase="2"]').evaluate(el => el.classList.contains('is-current')), true);

  // Custom prep items can be removed; base items remain.
  if (!(await page.locator('#prepBody').isVisible())) await page.locator('#prepToggle').click();
  await page.getByRole('button', { name: 'Удалить из сборов Книга' }).click();
  assert.equal(await page.locator('[data-prep-item="Книга"]').count(), 0);
  assert.equal(await page.locator('[data-prep-item="Паспорта"]').count(), 1);
  assert.equal(await page.locator('[data-prep-item="Зонт"]').count(), 1);
  assert.equal(await page.locator('[data-prep-item="Алиса"]').count(), 1);
  assert.equal(await page.locator('[data-prep-item="Зарядка для Алисы"]').count(), 1);
  assert.equal(await page.locator('[data-prep-item="Вибратор №1"]').count(), 1);
  assert.equal(await page.locator('[data-prep-item="Вибратор №2"]').count(), 1);
  assert.equal(await page.locator('[data-prep-item="Смазка"]').count(), 1);
  assert.equal(await page.locator('[data-prep-item="Зарядка для вибратора"]').count(), 1);
  assert.equal(await page.locator('[data-prep-item="Сексуальный костюм для Сони — по желанию"]').count(), 1);

  // After departure the packing card gets out of the way, but can be restored.
  await page.locator('#prepDepart').click();
  assert.equal(await page.locator('#prepCard').isVisible(), false);
  assert.equal(await page.locator('#prepRestore').isVisible(), true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('#startEvening').isVisible().catch(()=>false)) await page.locator('#startEvening').click();
  assert.equal(await page.locator('#prepCard').isVisible(), false);
  assert.equal(await page.locator('#prepRestore').isVisible(), true);
  await page.locator('#prepRestore').click();
  assert.equal(await page.locator('#prepCard').isVisible(), true);
  assert.equal(await page.locator('#prepBody').isVisible(), true);

  assert.deepEqual(errors, [], 'Uncaught page errors: '+errors.join('\n'));
  console.log('TODAY_PREP_OK');
} finally {
  await browser.close();
}
