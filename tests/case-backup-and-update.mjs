import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('http://127.0.0.1:4173/index.html');
  if (await page.locator('#startEvening').isVisible()) await page.locator('#startEvening').click();
  await page.locator('#openSecretCase').click();
  await page.locator('#caseRevealContinue').click();
  await page.locator('#casePlanLaunch').click();
  await page.locator('#startCase').click();
  await page.locator('[data-case-app="police"]').click();

  for (const index of [0, 5, 6]) {
    await page.locator(`[data-police-open="${index}"]`).click();
    const titleTop = await page.locator('.police-paper .case-doc-title').evaluate(el => el.getBoundingClientRect().top);
    assert.ok(titleTop > 0 && titleTop < 300, `Document ${index} must open near its heading on laptop: ${titleTop}`);
    if (index === 0) await page.locator('[data-pin="police_0"]').click();
    await page.locator('[data-police-back]').click();
  }
  assert.equal(await page.locator('.police-index-card').count(), 7);
  await page.locator('[data-case-app="interview"]').click();
  await page.locator('[data-interview-suspect="pavel"]').click();
  await page.locator('[data-interview-question="evening"]').click();
  await page.locator('[data-interview-question="work"]').click();
  await page.locator('[data-case-app="police"]').click();
  assert.equal(await page.locator('.police-index-card').count(), 8, 'The optional update should arrive after exploration');
  await page.locator('[data-police-open="7"]').click();
  assert.match(await page.locator('.police-paper').innerText(), /сверка временных отметок/i);
  await page.locator('[data-police-back]').click();

  await page.locator('[data-case-app="board"]').click();
  await page.locator('[data-pin-note="police_0"]').fill('Проверить вместе по часам');
  await page.locator('[data-pin-time="police_0"]').fill('21:11');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportCase').click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(backup.state.pinNotes.police_0, 'Проверить вместе по часам');
  assert.equal(backup.state.midpointUnlocked, true);

  await page.locator('[data-pin-note="police_0"]').fill('Временная запись');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#importCaseFile').setInputFiles({
    name: 'delo-24-sohranenie.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.waitForFunction(() => document.querySelector('#caseBackupStatus').textContent.includes('восстановлено'));
  assert.match(await page.locator('#caseBackupStatus').innerText(), /восстановлено/);
  assert.equal(await page.locator('[data-pin-note="police_0"]').inputValue(), 'Проверить вместе по часам');
  assert.equal(await page.locator('[data-pin-time="police_0"]').inputValue(), '21:11');

  await page.evaluate(() => localStorage.setItem('case24Schema', 'older-version'));
  await page.reload();
  if (await page.locator('#startEvening').isVisible()) await page.locator('#startEvening').click();
  await page.locator('.tabs [data-tab="detective"]').click();
  assert.equal(await page.locator('[data-pin-note="police_0"]').inputValue(), 'Проверить вместе по часам',
    'A site version change must preserve an ongoing investigation');
  await page.evaluate(() => { caseState.solved = true; saveCase(); renderCaseApp('final'); });
  assert.match(await page.locator('.case-recap').innerText(), /Проверить вместе по часам/);
  assert.match(await page.locator('.case-recap').innerText(), /21:11/);
  assert.deepEqual(errors, []);
  console.log('CASE_BACKUP_AND_UPDATE_OK');
} finally {
  await browser.close();
}
