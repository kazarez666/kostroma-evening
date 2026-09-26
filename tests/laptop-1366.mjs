import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'domcontentloaded' });
  if (await page.locator('#startEvening').isVisible().catch(()=>false)) await page.locator('#startEvening').click();

  // Compact activity shell should leave the actual activity high in the viewport.
  await page.locator('.tab[data-tab="food"]').click();
  const foodTop = await page.locator('#food .section-head').evaluate(el => el.getBoundingClientRect().top);
  assert.ok(foodTop < 260, 'Food content should begin high enough on a 768px-tall laptop');

  // Evening route remains readable without horizontal overflow.
  await page.locator('.tab[data-tab="plan"]').click();
  const flowBox = await page.locator('#planFlow').boundingBox();
  const firstPhase = await page.locator('[data-plan-phase="1"]').boundingBox();
  assert.ok(flowBox && flowBox.x >= 0 && flowBox.x + flowBox.width <= 1366);
  assert.ok(firstPhase && firstPhase.x >= 0 && firstPhase.x + firstPhase.width <= 1366);
  assert.equal(await page.locator('#planNow').isVisible(), false);

  // Movie draw gives a short animated state and settles cleanly.
  await page.locator('.tab[data-tab="movies"]').click();
  const movies = page.locator('.movie');
  await movies.nth(0).fill('Амели');
  await movies.nth(1).fill('Отпуск по обмену');
  await page.locator('#pickMovie').click();
  await page.waitForFunction(() => document.querySelector('.draw')?.classList.contains('is-drawing'));
  await page.waitForFunction(() => document.querySelector('#movieResult')?.textContent?.startsWith('🍿'), null, { timeout: 5000 });
  assert.equal(await page.locator('.draw').evaluate(el => el.classList.contains('is-drawing')), false);
  assert.equal(await page.locator('#movieResult').evaluate(el => el.classList.contains('is-winner')), true);

  // Fullscreen modes must fit a common 1366x768 laptop without burying core controls.
  await page.locator('.tab[data-tab="emoji"]').click();
  await page.locator('#emoji [data-focus="emoji"]').click();
  const emojiCard = await page.locator('#emoji .emoji-card').boundingBox();
  const emojiActions = await page.locator('#emoji .actions').boundingBox();
  assert.ok(emojiCard && emojiCard.y < 170 && emojiCard.y + emojiCard.height <= 760);
  assert.ok(emojiActions && emojiActions.y + emojiActions.height <= 740, 'Emoji controls should stay on-screen');
  await page.keyboard.press('Escape');

  await page.locator('.tab[data-tab="talk"]').click();
  await page.locator('#talk [data-focus="talk"]').click();
  const talkActions = await page.locator('#talk .actions').boundingBox();
  assert.ok(talkActions && talkActions.y + talkActions.height <= 740, 'Conversation controls should stay on-screen');
  assert.equal(await page.locator('#showAll').isVisible(), false, 'Focus mode should keep only the essential talk control');
  await page.keyboard.press('Escape');

  assert.deepEqual(errors, [], 'Uncaught page errors: '+errors.join('\n'));
  console.log('LAPTOP_1366_OK');
} finally {
  await browser.close();
}
