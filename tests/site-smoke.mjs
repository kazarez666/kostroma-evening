import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const errors=[];
async function boot(viewport){
  const p=await browser.newPage({viewport});
  p.on('pageerror',e=>errors.push(String(e)));
  await p.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  if(await p.locator('#startEvening').isVisible().catch(()=>false)) await p.locator('#startEvening').click();
  return p;
}
try{
  const page=await boot({width:390,height:844});

  // Main mobile navigation.
  for(const tab of ['food','movies','emoji','talk','plan']){
    await page.locator('.mnav[data-tab="'+tab+'"]').click();
    assert.ok(await page.locator('#'+tab).evaluate(el=>el.classList.contains('active')),tab+' not active');
  }

  // Dinner + fondue.
  await page.locator('.mnav[data-tab="food"]').click();
  await page.locator('.food-choice[data-dinner="Пицца"]').click();
  assert.match(await page.locator('#chosenDinnerName').innerText(),/Пицца/);
  await page.locator('#fondueRecommend').click();
  assert.equal((await page.locator('#fondueCount').innerText()).trim(),'8');
  assert.ok(await page.locator('.fondue-chip:disabled').count()>0,'Unselected fondue options should lock at 8');
  await page.locator('.fondue-chip.selected').first().click();
  assert.equal((await page.locator('#fondueCount').innerText()).trim(),'7');
  assert.equal(await page.locator('.fondue-chip:disabled').count(),0,'Options should unlock after removing one item');

  // Movie lottery with all six slots.
  await page.locator('.mnav[data-tab="movies"]').click();
  const movies=page.locator('.movie');
  await movies.nth(0).fill('Амели');
  await movies.nth(1).fill('Отпуск по обмену');
  await page.locator('#pickMovie').click();
  await page.waitForFunction(()=>document.querySelector('#movieResult')?.textContent?.startsWith('🍿'),null,{timeout:5000});
  assert.doesNotMatch(await page.locator('#movieResult').innerText(),/Добавьте/);

  // Emoji game.
  await page.locator('.mnav[data-tab="emoji"]').click();
  const before=await page.locator('#emojiIndex').innerText();
  await page.locator('#reveal').click();
  assert.equal(await page.locator('#emojiAnswer').evaluate(el=>el.classList.contains('hidden')),false);
  await page.locator('#nextEmoji').click();
  assert.notEqual(await page.locator('#emojiIndex').innerText(),before);

  // Conversation game.
  await page.locator('.mnav[data-tab="talk"]').click();
  assert.equal(await page.locator('#gamechips button').count(),6);
  const initial=await page.locator('#talkQuestion').innerText();
  await page.locator('#nextQuestion').click();
  assert.notEqual(await page.locator('#talkQuestion').innerText(),initial);
  await page.locator('#showAll').click();
  assert.equal(await page.locator('#allQuestions').evaluate(el=>el.classList.contains('hidden')),false);

  // Romantic interactions open and close cleanly.
  await page.locator('.mnav[data-tab="plan"]').click();
  await page.locator('#randomMoment').click();
  assert.equal(await page.locator('#momentModal').evaluate(el=>el.classList.contains('hidden')),false);
  await page.locator('[data-close-moment]').last().click();
  assert.equal(await page.locator('#momentModal').evaluate(el=>el.classList.contains('hidden')),true);

  await page.locator('#luckyButton').click();
  assert.equal(await page.locator('#loveModal').evaluate(el=>el.classList.contains('hidden')),false);
  await page.locator('[data-close-love]').last().click();

  await page.locator('#couponSecret').click();
  assert.equal(await page.locator('#couponModal').evaluate(el=>el.classList.contains('hidden')),false);
  await page.locator('[data-close-coupon]').last().click();

  const cozyBefore=await page.locator('#cozyLevel').innerText();
  await page.locator('#cozyButton').click();
  assert.notEqual(await page.locator('#cozyLevel').innerText(),cozyBefore);

  // Calm plan still exposes the detailed checklist on demand.
  assert.equal(await page.locator('#plan').evaluate(el=>el.classList.contains('plan-details-collapsed')),true);
  await page.locator('#togglePlanDetails').click();
  await page.locator('label.check').first().click();
  assert.equal(await page.locator('[data-check="1"]').isChecked(),true);
  assert.notEqual((await page.locator('#progressText').innerText()).trim(),'не спешим');
  await page.locator('#reset').click();
  assert.equal((await page.locator('#progressText').innerText()).trim(),'не спешим');

  // Desktop smoke: normal nav and ability to leave secret case.
  const desktop=await boot({width:1280,height:900});
  for(const tab of ['food','movies','emoji','talk','plan']){
    await desktop.locator('.tab[data-tab="'+tab+'"]').click();
    assert.ok(await desktop.locator('#'+tab).evaluate(el=>el.classList.contains('active')));
  }
  await desktop.locator('#openSecretCase').click();
  await desktop.locator('#caseRevealContinue').click();
  await desktop.getByText('Дело на двоих: «Последний эфир»',{exact:false}).waitFor({state:'visible'});
  assert.ok(await desktop.locator('#plan').evaluate(el=>el.classList.contains('active')));
  assert.equal(await desktop.locator('#casePlanLaunch').isVisible(),true);
  await desktop.locator('#casePlanLaunch').click();
  assert.ok(await desktop.locator('#detective').evaluate(el=>el.classList.contains('active')));
  await desktop.locator('.tab[data-tab="plan"]').click();
  assert.ok(await desktop.locator('#plan').evaluate(el=>el.classList.contains('active')));

  assert.deepEqual(errors,[], 'Uncaught page errors: '+errors.join('\n'));
  console.log('SITE_SMOKE_OK');
}finally{
  await browser.close();
}
