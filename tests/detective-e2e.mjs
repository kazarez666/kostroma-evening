import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({headless:true});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));

async function visibleText(text) {
  await page.getByText(text, { exact:false }).first().waitFor({state:'visible', timeout:5000});
}

try {
  await page.goto('http://127.0.0.1:4173/index.html', {waitUntil:'domcontentloaded'});

  // Dismiss the romantic intro exactly as a real visitor would.
  if (await page.locator('#startEvening').isVisible().catch(()=>false)) {
    await page.locator('#startEvening').click();
  }

  // Secret case must not appear as a normal top/mobile tab.
  assert.equal(await page.locator('[data-tab="detective"]').count(), 0, 'Detective should not be a normal navigation tab');
  await page.locator('#openSecretCase').click();
  await visibleText('Последний эфир');
  await page.locator('#startCase').click();

  // Four-page dossier.
  await visibleText('Уголовное дело №24/10-26');
  for (const expected of ['Осмотр места и тела','Известная хронология','Круг лиц и задачи расследования']) {
    await page.locator('#caseNextPage').click();
    await visibleText(expected);
  }
  await page.locator('#casePrevPage').click();
  await visibleText('Известная хронология');

  // People -> public profile -> back to web.
  await page.locator('[data-case-app="people"]').click();
  await visibleText('Люди');
  await visibleText('Марина Орлова');
  await page.locator('[data-profile="marina"]').first().click();
  await visibleText('Марина Орлова');
  await visibleText('Дома наконец-то');
  await page.locator('[data-web-home]').click();
  await visibleText('Открытый веб');

  // Devices -> laptop -> files. Every folder must be navigable and there must be a way out.
  await page.locator('[data-case-app="devices"]').click();
  await page.locator('[data-device="laptop"]').click();
  await page.locator('[data-device="laptop_files"]').click();
  await visibleText('/Users/kvolkov');

  for (const path of ['desktop','podcast','invoices','downloads','docs']) {
    await page.locator('[data-filepath="'+path+'"]').first().click();
    await visibleText('/Users/kvolkov/');
    await page.locator('[data-filepath="root"]').first().click();
  }

  // Locked evidence folder and PIN.
  await page.locator('[data-filepath="docs"]').first().click();
  await page.locator('[data-filepath="evidence"]').click();
  await page.locator('#filesPin').fill('0711');
  await page.locator('#unlockFiles').click();
  await visibleText('payment_fragment.pdf');
  // Back to laptop home from inside files.
  await page.locator('[data-device="laptop"]').first().click();
  await visibleText('ThinkPad · образ диска');

  // Mail login.
  await page.locator('[data-device="laptop_mail"]').click();
  await page.locator('#mailPass').fill('fibi2019');
  await page.locator('#unlockMail').click();
  await visibleText('удалить после чтения');

  // Phone sections.
  await page.locator('[data-case-app="devices"]').click();
  await page.locator('[data-device="phone"]').click();
  for (const target of ['phone_messages','phone_photos','phone_calls','phone_notes']) {
    await page.locator('[data-device="'+target+'"]').click();
    assert.ok((await page.locator('#caseScreen').innerText()).length > 40, target+' rendered empty');
    await page.locator('[data-device="hub"]').first().click();
    await page.locator('[data-device="phone"]').click();
  }

  // Police materials and all clue buttons.
  await page.locator('[data-case-app="police"]').click();
  await visibleText('Материалы полиции');
  assert.equal(await page.locator('.police-file').count(), 7);
  for (let i=0;i<10;i++) {
    const pending = page.locator('[data-add-clue]:not(.added)');
    if (await pending.count()===0) break;
    await pending.first().click();
  }

  // Add message clue and mail clue explicitly if needed.
  await page.locator('[data-case-app="devices"]').click();
  await page.locator('[data-device="phone"]').click();
  await page.locator('[data-device="phone_messages"]').click();
  const msgClue = page.locator('[data-add-clue="meeting"]');
  if (await msgClue.count()) await msgClue.click();

  await page.locator('[data-device="hub"]').first().click();
  await page.locator('[data-device="laptop"]').click();
  await page.locator('[data-device="laptop_mail"]').click();
  const leak = page.locator('[data-add-clue="leak"]').first();
  if (await leak.count()) await leak.click();

  // Board should be usable.
  await page.locator('[data-case-app="board"]').click();
  await visibleText('Вопросы расследования');
  assert.ok((await page.locator('.board-clue').count()) >= 5, 'Too few saved evidence cards');

  // Hints open sequentially.
  await page.locator('[data-case-app="hints"]').click();
  await page.locator('#nextHint').click();
  assert.ok((await page.locator('.hint-level:not(.locked)').count()) >= 1);

  // Final answer path.
  await page.locator('[data-case-app="final"]').click();
  await page.locator('#finalWho').selectOption('marina');
  await page.locator('#finalMotive').selectOption('leak');
  await page.locator('#finalMethod').selectOption('trophy');
  await page.locator('#finalEvidence').selectOption('wifi_voice');
  await page.locator('#submitCase').click();
  await visibleText('Вы раскрыли');

  // Leave detective back to normal site from mobile bottom nav.
  await page.locator('.mnav[data-tab="plan"]').click();
  await visibleText('План вечера');

  assert.deepEqual(pageErrors, [], 'Uncaught page errors: '+pageErrors.join('\n'));
  console.log('DETECTIVE_E2E_OK');
} finally {
  await browser.close();
}
