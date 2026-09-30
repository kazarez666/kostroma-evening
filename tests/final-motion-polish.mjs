import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});

  if(await page.locator('#startEvening').isVisible().catch(()=>false)){
    await page.locator('#startEvening').click();
  }
  assert.equal(await page.locator('.hero-card').evaluate(el=>el.classList.contains('hero-awake')),true,'Hero should wake with the evening');

  // Directional tab scene transitions.
  await page.locator('.mnav[data-tab="food"]').click();
  assert.equal(await page.locator('#food').evaluate(el=>el.classList.contains('scene-enter-forward')),true,'Food should enter forward from plan');
  await page.locator('.mnav[data-tab="plan"]').click();
  assert.equal(await page.locator('#plan').evaluate(el=>el.classList.contains('scene-enter-back')),true,'Plan should enter backward from food');

  // Dinner gets a satisfying confirmation without changing the mechanic.
  await page.locator('.mnav[data-tab="food"]').click();
  const dinner=page.locator('.food-choice').first();
  await dinner.click();
  assert.equal(await dinner.evaluate(el=>el.classList.contains('selected')),true);
  assert.equal(await dinner.evaluate(el=>el.classList.contains('just-picked')),true,'Selected dinner should get the pick animation');
  assert.equal(await page.locator('.dinner-box').evaluate(el=>el.classList.contains('is-confirming')),true,'Dinner box should acknowledge the choice');
  assert.equal(await page.locator('#chosenDinnerName').locator('xpath=ancestor::*[contains(@class,"chosen")]').evaluate(el=>el.classList.contains('is-updated')),true,'Chosen dinner summary should animate');

  // Fondue chips and recommended set have their own micro feedback.
  const fondue=page.locator('.fondue-chip').first();
  await fondue.click();
  assert.equal(await fondue.evaluate(el=>el.classList.contains('just-toggled')),true,'Fondue chip should pop on toggle');
  assert.equal(await page.locator('#fonduePicked').evaluate(el=>el.classList.contains('is-updated')),true,'Fondue summary should update visibly');
  await page.locator('#fondueRecommend').click();
  assert.equal(await page.locator('.fondue-box').evaluate(el=>el.classList.contains('is-recommended')),true,'Recommended fondue set should animate as a group');
  assert.equal(await page.locator('.fondue-chip.selected').count(),8);

  // Hidden trigger stays subtle; after using it, the reveal itself becomes cinematic.
  const trigger=page.locator('#secretOwnerTrigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  assert.equal(await page.locator('#caseSecretLaunch').evaluate(el=>el.classList.contains('owner-armed')),true,'Secret launcher should animate after the hidden trigger');
  await page.locator('#openSecretCase').click();
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('case-cinematic')),true,'Secret reveal should enter cinematic mode');
  assert.equal(await page.locator('#caseReveal').isVisible(),true);
  await page.waitForFunction(()=>document.querySelector('#caseReveal')?.classList.contains('is-open'),null,{timeout:3500});
  assert.equal(await page.locator('.case-reveal__opened').isVisible(),true);
  await page.locator('#caseRevealContinue').click();
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('case-cinematic')),false,'Cinematic mode should clean up after reveal');

  const widths=await page.evaluate(()=>({innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  assert.ok(widths.html<=widths.innerWidth+2&&widths.body<=widths.innerWidth+2,'Motion polish must not create mobile horizontal overflow '+JSON.stringify(widths));
  assert.deepEqual(errors,[],'Uncaught page errors: '+errors.join('\n'));
  console.log('FINAL_MOTION_POLISH_OK');
}finally{
  await browser.close();
}
