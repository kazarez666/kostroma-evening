import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'domcontentloaded' });
  if (await page.locator('#startEvening').isVisible().catch(()=>false)) await page.locator('#startEvening').click();

  // The detective teaser must not be visible to a normal visitor.
  assert.equal(await page.locator('#caseSecretLaunch').isVisible(), false);
  assert.equal(await page.locator('#secretOwnerTrigger').isVisible(), true);

  // Owner trigger should look like a tiny decorative leaf: findable for the owner, subtle to everyone else.
  assert.equal((await page.locator('#secretOwnerTrigger').innerText()).trim(), '🍂');
  const box = await page.locator('#secretOwnerTrigger').boundingBox();
  assert.ok(box && box.width <= 20 && box.height <= 20, 'Owner leaf must stay tiny');
  const opacity = await page.locator('#secretOwnerTrigger').evaluate(el => parseFloat(getComputedStyle(el).opacity));
  assert.ok(opacity <= .36, 'Owner leaf must remain visually subtle');

  // First owner action only arms the visible surprise card; it does not reveal the detective.
  await page.locator('#secretOwnerTrigger').click();
  assert.equal(await page.locator('#caseSecretLaunch').isVisible(), true);
  assert.equal(await page.locator('#secretOwnerTrigger').isVisible(), false);
  assert.equal(await page.locator('#caseReveal').isVisible(), false);
  assert.equal(await page.locator('[data-tab="detective"]').count(), 0);

  // Arming survives a reload in the same tab/session.
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('#startEvening').isVisible().catch(()=>false)) await page.locator('#startEvening').click();
  assert.equal(await page.locator('#caseSecretLaunch').isVisible(), true);
  assert.equal(await page.locator('#secretOwnerTrigger').isVisible(), false);

  // Only the second, visible action starts the existing reveal flow.
  await page.locator('#openSecretCase').click();
  assert.equal(await page.locator('#caseReveal').isVisible(), true);
  await page.locator('#caseRevealContinue').waitFor({ state: 'visible' });
  await page.locator('#caseRevealContinue').click();
  assert.equal(await page.locator('[data-tab="detective"]').count(), 2);

  assert.deepEqual(errors, [], 'Uncaught page errors: '+errors.join('\n'));
  console.log('SECRET_TRIGGER_OK');
} finally {
  await browser.close();
}
