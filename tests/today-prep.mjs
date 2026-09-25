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

  // Today dashboard is compact and immediately useful.
  assert.equal(await page.locator('#todayCard').isVisible(), true);
  assert.match(await page.locator('#todayLead').innerText(), /поезд|Костром|вечер/i);
  assert.match(await page.locator('#todayPrep').innerText(), /осталось 7/);
  assert.match(await page.locator('#todayShopping').innerText(), /осталось 7/);
  assert.match(await page.locator('#todayDinner').innerText(), /не выбран/i);

  // Surprise purchases stay out of the normal packing list.
  assert.equal(await page.locator('[data-prep-item="Овечка «Мила»"]').count(), 0);
  assert.equal(await page.locator('#ownerPrepModal').isVisible(), false);

  // A deliberate long press on the footer heart opens the private owner-only packing list.
  const heart = page.locator('#footerHeart');
  await heart.dispatchEvent('pointerdown', { pointerType: 'touch' });
  await page.waitForTimeout(1200);
  await heart.dispatchEvent('pointerup', { pointerType: 'touch' });
  assert.equal(await page.locator('#ownerPrepModal').isVisible(), true);
  assert.equal(await page.locator('[data-owner-prep-item="Овечка «Мила»"]').count(), 1);
  assert.equal(await page.locator('[data-owner-prep-item="Тёмно-зелёные футболки"]').count(), 1);
  assert.equal(await page.locator('[data-owner-prep-item="Фондюшница"]').count(), 1);
  assert.equal(await page.locator('[data-owner-prep-item="50 искусственных кленовых листьев"]').count(), 1);
  await page.locator('[data-owner-prep-item="Овечка «Мила»"]').check();
  await page.locator('[data-close-owner-prep]').last().click();

  // Open prep from Today and add a custom neutral item.
  await page.locator('#todayPrepOpen').click();
  assert.equal(await page.locator('#prepBody').isVisible(), true);
  assert.equal(await page.locator('[data-prep-item]').count(), 7);
  await page.locator('#prepCustomInput').fill('Зонт');
  await page.locator('#prepAdd').click();
  assert.equal(await page.locator('[data-prep-item="Зонт"]').count(), 1);

  // Duplicate custom items should not be added.
  await page.locator('#prepCustomInput').fill('зонт');
  await page.locator('#prepAdd').click();
  assert.equal(await page.locator('[data-prep-item="Зонт"]').count(), 1);

  // Mark two things packed; dashboard must reflect the remaining count.
  await page.locator('[data-prep-item="Документы"]').check();
  await page.locator('[data-prep-item="Зонт"]').check();
  assert.match(await page.locator('#todayPrep').innerText(), /осталось 6/);

  // State survives reload.
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('#startEvening').isVisible().catch(()=>false)) await page.locator('#startEvening').click();
  await page.locator('#footerHeart').dispatchEvent('pointerdown', { pointerType: 'touch' });
  await page.waitForTimeout(1200);
  await page.locator('#footerHeart').dispatchEvent('pointerup', { pointerType: 'touch' });
  assert.equal(await page.locator('[data-owner-prep-item="Овечка «Мила»"]').isChecked(), true);
  await page.locator('[data-close-owner-prep]').last().click();
  await page.locator('#todayPrepOpen').click();
  assert.equal(await page.locator('[data-prep-item="Документы"]').isChecked(), true);
  assert.equal(await page.locator('[data-prep-item="Зонт"]').isChecked(), true);

  // Hide packed and restore them.
  await page.locator('#prepHideDone').click();
  assert.equal(await page.locator('[data-prep-item="Документы"]').locator('..').locator('..').isVisible(), false);
  await page.locator('#prepHideDone').click();
  assert.equal(await page.locator('[data-prep-item="Документы"]').locator('..').locator('..').isVisible(), true);

  // Dinner choice should immediately appear in Today.
  await page.locator('.mnav[data-tab="food"]').click();
  await page.locator('.food-choice[data-dinner="Пицца"]').click();
  await page.locator('.mnav[data-tab="plan"]').click();
  assert.match(await page.locator('#todayDinner').innerText(), /Пицца/);

  // Shopping progress also flows into Today.
  await page.locator('#todayShoppingOpen').click();
  assert.equal(await page.locator('#food').evaluate(el => el.classList.contains('active')), true);
  await page.locator('[data-shopping-item="Молоко"]').check();
  await page.locator('.mnav[data-tab="plan"]').click();
  assert.match(await page.locator('#todayShopping').innerText(), /осталось 6/);

  // Current evening stage is live, not a hardcoded label.
  for (const id of ['1','2','3','4']) {
    await page.locator('[data-check="'+id+'"]').evaluate(el => {
      el.checked = true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  assert.match(await page.locator('#todayStage').innerText(), /Включаем уют/);

  // Custom prep items can be removed; base items remain.
  await page.locator('#todayPrepOpen').click();
  await page.getByRole('button', { name: 'Удалить из сборов Зонт' }).click();
  assert.equal(await page.locator('[data-prep-item="Зонт"]').count(), 0);
  assert.equal(await page.locator('[data-prep-item="Документы"]').count(), 1);

  assert.deepEqual(errors, [], 'Uncaught page errors: '+errors.join('\n'));
  console.log('TODAY_PREP_OK');
} finally {
  await browser.close();
}
