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

  // Movie roulette with all six slots and full-screen jar animation.
  await page.locator('.mnav[data-tab="movies"]').click();
  assert.equal(await page.evaluate(() => Array.from({length:80},()=>nextUnseenNote()).includes(SPECIAL_NOTE_INDEX)), false, 'Final note must not appear in ordinary note search');
  assert.equal(await page.evaluate(() => isAfterMidnight(new Date(2026,9,3,1,15))), true);
  assert.equal(await page.evaluate(() => isAfterMidnight(new Date(2026,9,2,23,59))), false);
  const movies=page.locator('.movie');
  await movies.nth(0).fill('Амели');
  await movies.nth(1).fill('Отпуск по обмену');
  await page.locator('#pickMovie').click();
  assert.equal(await page.locator('#movieRoulette').isVisible(), true);
  assert.equal(await page.locator('.movie-flying-slip').count(), 6);
  await page.waitForFunction(()=>!document.querySelector('#moviePulled')?.classList.contains('hidden'),null,{timeout:6000});
  assert.equal(await page.locator('#moviePulledTitle').innerText(), 'Как отделаться от парня за 10 дней');
  assert.equal(await page.locator('#movieResult').innerText(), '🍿 Как отделаться от парня за 10 дней');
  await page.locator('#movieRouletteDone').click();
  assert.equal(await page.locator('#movieRoulette').isVisible(), false);
  assert.equal(await page.locator('#movieAfter').isVisible(), true);
  assert.equal(await page.locator('#movieSecretNote').evaluate(el=>el.classList.contains('hidden')), true);
  assert.equal(await page.locator('#finishEvening').isVisible(), true);
  await page.locator('#finishEvening').click();
  assert.equal(await page.locator('#eveningFinale').isVisible(), true);
  assert.match(await page.locator('#finaleMovie').innerText(), /Как отделаться от парня за 10 дней/);
  await page.locator('#closeEveningFinale').click();
  assert.equal(await page.locator('#eveningFinale').isVisible(), false);

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
  await page.locator('#randomMoment').click();
  assert.equal(await page.locator('#momentModal').evaluate(el=>el.classList.contains('hidden')),false);
  await page.locator('[data-close-moment]').last().click();
  assert.equal(await page.locator('#momentModal').evaluate(el=>el.classList.contains('hidden')),true);

  // Evening header keeps the hidden-note hunt visible while other extras stay tucked away.
  await page.locator('.mnav[data-tab="plan"]').click();
  assert.equal(await page.locator('.romance-actions').isVisible(),false);
  assert.equal(await page.locator('#noteHuntBar').isVisible(),true);
  assert.equal(await page.locator('#noteCount').innerText(),'0/20');
  assert.match(await page.locator('#noteHuntHint').innerText(),/20 записок/);
  await page.locator('#noteCollection').click();
  assert.equal(await page.locator('#loveModal').evaluate(el=>el.classList.contains('hidden')),true);
  await page.locator('#footerHeart').evaluate(el=>el.click());
  assert.equal(await page.locator('#loveModal').evaluate(el=>el.classList.contains('hidden')),false);
  assert.equal(await page.locator('#noteCount').innerText(),'1/20');
  await page.locator('[data-close-love]').last().click();

  // One tap on the trip date opens a separate easter egg and does not count as a note.
  await page.locator('#datePill').evaluate(el=>el.click());
  assert.equal(await page.locator('#storyModal').isVisible(),true);
  assert.match(await page.locator('#storyModalTitle').innerText(),/Почему вообще существует этот сайт/);
  assert.equal(await page.locator('#noteCount').innerText(),'1/20');
  await page.locator('[data-close-story]').last().click();

  // The deliberately wrong button is visible in the hero near progress and escalates over three presses.
  assert.equal(await page.locator('.hero-card #doNotPress').count(),1);
  assert.equal(await page.locator('#doNotPress').isVisible(),true);
  for(let i=0;i<3;i++) await page.locator('#doNotPress').click();
  assert.equal(await page.locator('#storyModal').isVisible(),true);
  assert.match(await page.locator('#storyModalTitle').innerText(),/Раз уж ты всё-таки нажала/);
  await page.locator('[data-close-story]').last().click();

  // Once 19 ordinary notes are found and the movie was selected, the event-only final note appears.
  await page.evaluate(() => {
    foundNotes=Array.from({length:19},(_,i)=>i);
    sessionStorage.setItem('kostromaFoundNotes',JSON.stringify(foundNotes));
    specialNoteUnlocked=true;
    sessionStorage.setItem('kostromaSpecialNoteUnlocked','1');
    updateNoteCounter();
  });
  assert.equal(await page.locator('#noteCount').innerText(),'19/20');
  assert.match(await page.locator('#noteHuntHint').innerText(),/последняя появилась/);
  await page.locator('.mnav[data-tab="movies"]').click();
  assert.equal(await page.locator('#movieSecretNote').isVisible(),true);
  await page.locator('#movieSecretNote').click();
  assert.equal(await page.locator('#noteCount').innerText(),'20/20');
  assert.match(await page.locator('#noteMeta').innerText(),/Последняя записка/);
  await page.locator('[data-close-love]').last().click();
  await page.locator('.mnav[data-tab="plan"]').click();

  await page.locator('#luckyButton').evaluate(el=>el.click());
  assert.equal(await page.locator('#loveModal').evaluate(el=>el.classList.contains('hidden')),false);
  await page.locator('[data-close-love]').last().click();

  await page.locator('#couponSecret').evaluate(el=>el.click());
  assert.equal(await page.locator('#couponModal').evaluate(el=>el.classList.contains('hidden')),false);
  await page.locator('[data-close-coupon]').last().click();

  const cozyBefore=await page.locator('#cozyLevel').innerText();
  await page.locator('#cozyButton').evaluate(el=>el.click());
  assert.notEqual(await page.locator('#cozyLevel').innerText(),cozyBefore);

  // Evening tab shows the route immediately, without duplicate navigation controls.
  assert.equal(await page.locator('#planFlow').isVisible(),true);
  assert.equal(await page.locator('#todayCard').isVisible(),false);
  assert.equal(await page.locator('#planNow').isVisible(),false);
  assert.equal(await page.locator('#plan > .mini').isVisible(),false);
  await page.locator('label.check').first().click();
  assert.equal(await page.locator('[data-check="24"]').isChecked(),true);
  assert.notEqual((await page.locator('#progressText').innerText()).trim(),'не спешим');
  await page.locator('#reset').evaluate(el=>el.click());
  assert.equal((await page.locator('#progressText').innerText()).trim(),'не спешим');

  // Desktop smoke: normal nav and ability to leave secret case.
  const desktop=await boot({width:1280,height:900});
  for(const tab of ['food','movies','emoji','talk','plan']){
    await desktop.locator('.tab[data-tab="'+tab+'"]').click();
    assert.ok(await desktop.locator('#'+tab).evaluate(el=>el.classList.contains('active')));
  }
  assert.equal(await desktop.locator('#planPhaseDetective').isVisible(),false);
  assert.equal(await desktop.locator('#planP4Title').innerText(),'Фондю, свечи и творчество');
  await desktop.locator('#secretOwnerTrigger').click();
  await desktop.locator('#openSecretCase').click();
  await desktop.locator('#caseRevealContinue').click();
  await desktop.getByText('Дело на двоих: «Последний эфир»',{exact:false}).waitFor({state:'visible'});
  assert.ok(await desktop.locator('#plan').evaluate(el=>el.classList.contains('active')));
  assert.equal(await desktop.locator('#planPhaseDetective').isVisible(),true);
  assert.equal(await desktop.locator('#planP4Title').innerText(),'Фондю, свечи и творчество');
  assert.equal(await desktop.locator('#planPhaseDetective .time').innerText(),'22:15–23:45');
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
