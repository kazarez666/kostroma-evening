import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));

const app=async id=>page.locator('[data-case-app="'+id+'"]').click();
const ask=async id=>{
  const q=page.locator('[data-interview-question="'+id+'"]');
  assert.equal(await q.count(),1,'expected interrogation question '+id+' to be available');
  await q.click();
};
const pinCurrent=async id=>{
  const b=page.locator('[data-pin="'+id+'"]');
  assert.equal(await b.count(),1,'expected pin '+id+' on current screen');
  if(!(await b.innerText()).includes('✓'))await b.click();
};
async function openCase(){
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  if(await page.locator('#startEvening').isVisible().catch(()=>false))await page.locator('#startEvening').click();
  await page.locator('#secretOwnerTrigger').click();
  await page.locator('#openSecretCase').click();
  await page.locator('#caseRevealContinue').click();
  await page.locator('#casePlanLaunch').click();
  await page.locator('#startCase').click();
}
async function baseInterview(sid,ids){
  await app('interview');
  await page.locator('[data-interview-suspect="'+sid+'"]').click();
  for(const id of ids)await ask(id);
  await page.locator('[data-interview-back]').click();
}
async function viewPolice(i){
  await app('police');
  if(await page.locator('[data-police-open="'+i+'"]').count())await page.locator('[data-police-open="'+i+'"]').click();
  else{
    await page.locator('[data-police-back]').click();
    await page.locator('[data-police-open="'+i+'"]').click();
  }
  await page.locator('[data-police-back]').click();
}

try{
  await openCase();

  // Early interviews create working theories before decisive evidence is assembled.
  await baseInterview('marina',['evening','conflict']);
  await baseInterview('denis',['evening','marina']);
  await baseInterview('alina',['evening','mood']);
  await baseInterview('pavel',['evening','access']);
  await baseInterview('artem',['evening','fear']);

  // Early working theories are possible, but the case is intentionally not closable yet.
  await app('interview');
  await page.locator('[data-interview-suspect="marina"]').click();
  assert.equal(await page.locator('[data-interview-question="money"]').count(),0,'mail evidence must be needed for Marina money follow-up');
  await page.locator('[data-interview-back]').click();
  await page.locator('[data-interview-suspect="alina"]').click();
  assert.equal(await page.locator('[data-interview-question="bus"]').count(),0,'Bashkinogram post must be needed for Alina bus follow-up');
  await page.locator('[data-interview-back]').click();
  await app('final');
  assert.equal(await page.locator('.final-interrogation-lock').count(),1,'early theories must not bypass the remaining investigation');

  // Browser research: profile -> social evidence.
  await app('web');
  await page.locator('#caseWebQuery').fill('Кирилл Волков');
  await page.locator('#caseWebSearch').click();
  await page.locator('[data-webpage="kirill"]').first().click();
  assert.match(await page.locator('.profile-page').innerText(),/Фиби сегодня ровно пять лет как дома/);

  await page.locator('#caseWebQuery').fill('Алина Петрова');
  await page.locator('#caseWebSearch').click();
  await page.locator('[data-webpage="alina"]').first().click();

  // Webmail must be found through the browser and unlocked normally.
  await page.locator('#caseWebQuery').fill('почта');
  await page.locator('#caseWebSearch').click();
  assert.ok(await page.locator('.browser-result').count()>=3);
  await page.locator('[data-webpage="mail"]').click();
  await page.locator('#mailPass').fill('fibi2019');
  await page.locator('#unlockMail').click();
  assert.ok(await page.locator('.mail-web-row').count()>=10);
  await page.locator('[data-mail-open="1"]').click();

  // The new evidence should create a persistent, non-spoiler interrogation signal.
  await app('people');
  assert.ok(await page.locator('.case-smart-updates').count()>=1,'new interrogation opportunities should be surfaced');
  assert.equal(await page.locator('[data-case-app="interview"]').getAttribute('data-unseen'),'1');

  // Laptop files: ordinary documents and the PIN-protected evidence folder.
  await app('devices');
  await page.locator('[data-device="laptop"]').click();
  await page.locator('[data-device="laptop_files"]').click();
  await page.locator('[data-filepath="docs"]').first().click();
  for(const id of ['lawyer_draft','source_protection']){
    await page.locator('[data-open-file="'+id+'"]').click();
    await page.locator('[data-close-file]').click();
  }
  await page.locator('[data-filepath="evidence"]').click();
  await page.locator('#filesPin').fill('0711');
  await page.locator('#unlockFiles').click();
  for(const id of ['payment','mail_export']){
    await page.locator('[data-open-file="'+id+'"]').click();
    await page.locator('[data-close-file]').click();
  }

  // Independent records required by the key testimony.
  for(const i of [0,1,2,4,5])await viewPolice(i);
  await viewPolice(7);

  // Key follow-ups. No hidden 100% combination is touched.
  await app('interview');
  await page.locator('[data-interview-suspect="marina"]').click();
  for(const id of ['return','money','last'])await ask(id);
  await page.locator('[data-interview-back]').click();

  await page.locator('[data-interview-suspect="denis"]').click();
  for(const id of ['payment','restaurant','badge','car'])await ask(id);
  await page.locator('[data-interview-back]').click();

  await page.locator('[data-interview-suspect="alina"]').click();
  for(const id of ['bus','jurist'])await ask(id);
  await page.locator('[data-interview-back]').click();

  await page.locator('[data-interview-suspect="pavel"]').click();
  for(const id of ['trophy','wifi'])await ask(id);
  await page.locator('[data-interview-back]').click();

  // Even four fully checked suspect paths are insufficient: the fifth core testimony still matters.
  await app('final');
  assert.equal(await page.locator('.final-interrogation-lock').count(),1,'four suspect paths must not be enough for the final');
  await app('interview');
  await page.locator('[data-interview-suspect="artem"]').click();
  for(const id of ['train','promise'])await ask(id);
  await page.locator('[data-interview-back]').click();

  const state=await page.evaluate(()=>({
    core:interrogationCoreReady(),
    progress:Object.fromEntries(suspectIds.map(id=>[id,interviewProgress(id).pct])),
    breakthroughs:Object.assign({},caseState.interrogation.breakthroughs),
    pins:[...(caseState.pins||[])],
    mail:caseState.mail,
    files:caseState.files
  }));
  assert.equal(state.core,true,'all required testimony should be reachable through normal UI');
  assert.equal(Object.values(state.breakthroughs).some(Boolean),false,'hidden 100% branches must not be needed');
  assert.ok(Object.values(state.progress).every(x=>x<100),'clean completion path should leave optional interrogation material');
  assert.equal(state.mail,true);
  assert.equal(state.files,true);
  assert.equal(state.pins.length,0,'viewed evidence should unlock required follow-ups without forcing board pins');

  await app('final');
  assert.equal(await page.locator('.final-interrogation-lock').count(),0,'final version should open after core testimony only');
  assert.equal(await page.locator('#finalWho').count(),1);

  assert.deepEqual(errors,[]);
  console.log('CASE24_CLEAN_PLAYTHROUGH_OK');
}finally{
  await browser.close();
}
