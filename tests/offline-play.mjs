import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/index.html');
  await page.evaluate(async () => { await navigator.serviceWorker.register('./sw.js'); await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  if (await page.locator('#startEvening').isVisible()) await page.locator('#startEvening').click();
  await page.locator('#secretOwnerTrigger').click();
  await page.locator('#openSecretCase').click();
  await page.locator('#caseRevealContinue').click();
  await page.locator('#casePlanLaunch').click();
  await page.locator('#startCase').click();
  await page.locator('[data-case-app="people"]').click();
  await page.locator('.person-v2 img').first().waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('.person-v2 img')?.naturalWidth > 0);
  await page.locator('[data-case-app="devices"]').click();
  await page.locator('[data-device="phone"]').click();
  await page.locator('[data-device="phone_photos"]').click();
  await page.locator('.photo-grid-v2 img').first().scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.photo-grid-v2 img')?.naturalWidth > 0);
  console.log('OFFLINE_PLAY_OK');
} finally {
  await browser.close();
}
