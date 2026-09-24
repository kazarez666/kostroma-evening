import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));

const textVisible=async t=>page.getByText(t,{exact:false}).first().waitFor({state:'visible',timeout:5000});
const app=async id=>page.locator('[data-case-app="'+id+'"]').click();

try{
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  if(await page.locator('#startEvening').isVisible().catch(()=>false)) await page.locator('#startEvening').click();
  await page.locator('#openSecretCase').click();
  await page.locator('#caseRevealContinue').click();
  await page.getByText('Дело на двоих: «Последний эфир»',{exact:false}).waitFor({state:'visible'});
  await page.locator('#casePlanLaunch').click();
  await page.locator('#startCase').click();

  // The normal dossier still works.
  await textVisible('Уголовное дело №24/10-26');
  for(const t of ['Осмотр места и тела','Известная хронология','Круг лиц и задачи расследования']){
    await page.locator('#caseNextPage').click();
    await textVisible(t);
  }

  // Every person can be pinned: pin availability itself must not reveal importance.
  await app('people');
  assert.equal(await page.locator('.person-v2').count(),6);
  assert.equal(await page.locator('.person-v2 [data-pin^="profile_"]').count(),6);
  await page.locator('[data-pin="profile_pavel"]').click();

  // Public posts are uniformly pinnable.
  await page.locator('[data-profile="marina"]').first().click();
  assert.ok(await page.locator('.feed-post').count()>=2);
  assert.equal(await page.locator('.feed-post [data-pin]').count(),await page.locator('.feed-post').count());
  await page.locator('.feed-post [data-pin]').last().click();

  // Unlock forensic snapshots in-state so this test focuses on navigation and file behavior.
  await page.evaluate(()=>{caseState.mail=true;caseState.files=true;saveCase()});

  // All laptop folders contain multiple openable files.
  await app('devices');
  await page.locator('[data-device="laptop"]').click();
  await page.locator('[data-device="laptop_files"]').click();
  for(const path of ['desktop','podcast','invoices','downloads','docs']){
    await page.locator('[data-filepath="'+path+'"]').first().click();
    const ids=await page.locator('[data-open-file]').evaluateAll(els=>els.map(x=>x.dataset.openFile));
    assert.ok(ids.length>=5,path+' has too few openable files');
    for(const id of ids){
      await page.locator('[data-open-file="'+id+'"]').click();
      assert.equal(await page.locator('.file-viewer').count(),1);
      assert.equal(await page.locator('.file-viewer [data-pin="file_'+id+'"]').count(),1);
      await page.locator('[data-close-file]').click();
    }
    await page.locator('[data-filepath="root"]').first().click();
  }

  // evidence_backup also contains several files and each opens like an ordinary file.
  await page.locator('[data-filepath="docs"]').first().click();
  await page.locator('[data-filepath="evidence"]').click();
  const evidence=await page.locator('[data-open-file]').evaluateAll(els=>els.map(x=>x.dataset.openFile));
  assert.ok(evidence.length>=3);
  for(const id of evidence){
    await page.locator('[data-open-file="'+id+'"]').click();
    assert.equal(await page.locator('.file-viewer [data-pin="file_'+id+'"]').count(),1);
    await page.locator('[data-close-file]').click();
  }
  await page.locator('[data-open-file]').first().click();
  await page.locator('.file-viewer [data-pin]').click();

  // Mail: every mailbox item has the exact same board affordance.
  await page.locator('[data-device="laptop"]').first().click();
  await page.locator('[data-device="laptop_mail"]').click();
  assert.ok(await page.locator('.mail-item').count()>=3);
  assert.equal(await page.locator('.mail-item [data-pin]').count(),await page.locator('.mail-item').count());
  await page.locator('.mail-item [data-pin]').last().click();

  // All five message threads are pinnable, including irrelevant-looking ones.
  await app('devices');
  await page.locator('[data-device="phone"]').click();
  await page.locator('[data-device="phone_messages"]').click();
  const threads=await page.locator('[data-thread]').evaluateAll(els=>els.map(x=>x.dataset.thread));
  assert.equal(new Set(threads).size,5);
  for(const id of threads){
    await page.locator('[data-thread="'+id+'"]').click();
    assert.equal(await page.locator('[data-pin="thread_'+id+'"]').count(),1);
  }
  await page.locator('[data-thread="pavel"]').click();
  await page.locator('[data-pin="thread_pavel"]').click();
  await page.locator('[data-thread="marina"]').click();
  await page.locator('[data-pin="thread_marina"]').click();

  // Photos, calls and notes use the same neutral pin mechanic.
  await page.locator('[data-device="hub"]').first().click();
  await page.locator('[data-device="phone"]').click();
  await page.locator('[data-device="phone_photos"]').click();
  assert.equal(await page.locator('.photo-item [data-pin]').count(),await page.locator('.photo-item').count());
  await page.locator('.photo-item [data-pin]').nth(1).click();

  await page.locator('[data-device="hub"]').first().click();
  await page.locator('[data-device="phone"]').click();
  await page.locator('[data-device="phone_calls"]').click();
  assert.equal(await page.locator('.call-item [data-pin]').count(),await page.locator('.call-item').count());

  await page.locator('[data-device="hub"]').first().click();
  await page.locator('[data-device="phone"]').click();
  await page.locator('[data-device="phone_notes"]').click();
  assert.equal(await page.locator('.note-item [data-pin]').count(),await page.locator('.note-item').count());

  // Every police document is equally pinnable.
  await app('police');
  assert.equal(await page.locator('.police-file').count(),7);
  assert.equal(await page.locator('.police-file [data-pin]').count(),7);
  await page.locator('.police-file [data-pin]').nth(0).click();
  await page.locator('.police-file [data-pin]').nth(5).click();

  // Interrogations: five suspects, branching questions, evidence unlocks and repeat visits.
  await app('interview');
  assert.equal(await page.locator('.interview-card').count(),5);
  await page.locator('[data-interview-suspect="marina"]').click();
  await textVisible('Марина Орлова');
  assert.ok(await page.locator('[data-interview-question]').count()>=1);
  assert.ok(await page.locator('[data-interview-question]').count()<=3,'interrogation should present at most three choices at once');
  assert.equal(await page.locator('[data-interview-question="return"]').count(),0,'evidence follow-up should wait for the base answer');

  await page.locator('[data-interview-question="evening"]').click();
  assert.ok(await page.locator('.interview-turn').count()>=1);
  assert.equal(await page.locator('[data-interview-question="return"]').count(),1,'access evidence should unlock a return-to-studio follow-up');

  await page.locator('[data-interview-question="conflict"]').click();
  assert.equal(await page.locator('[data-interview-question="money"]').count(),1,'payment evidence should unlock a money follow-up');
  await page.locator('[data-interview-question="return"]').click();
  await page.locator('[data-interview-question="money"]').click();
  assert.ok(await page.locator('.interview-turn').count()>=4);
  assert.equal(await page.locator('.interview-a [data-pin]').count(),await page.locator('.interview-turn').count(),'every interrogation answer should be pinnable');
  await page.locator('[data-pin="interview_marina_return"]').click();

  await page.locator('[data-interview-back]').click();
  await page.locator('[data-interview-suspect="marina"]').click();
  assert.ok(await page.locator('.interview-turn').count()>=4,'repeat interrogation should retain the protocol');
  await page.locator('[data-interview-back]').click();

  await page.locator('[data-interview-suspect="pavel"]').click();
  await page.locator('[data-interview-question="evening"]').click();
  assert.ok(await page.locator('.interview-turn').count()>=1);
  await page.locator('[data-interview-back]').click();

  // Board accepts mixed relevant/irrelevant material, notes, manual time and user-defined links.
  await app('board');
  await textVisible('Материалы и ваши выводы');
  const before=await page.locator('.board-clue').count();
  assert.ok(before>=6);
  const note=page.locator('[data-pin-note]').first();
  await note.fill('Проверить время и алиби.');
  assert.match(await note.inputValue(),/алиби/);

  const timeInputs=page.locator('[data-pin-time]');
  assert.ok(await timeInputs.count()>=2);
  await timeInputs.nth(0).fill('21:11');
  await timeInputs.nth(1).fill('21:23');
  await page.locator('[data-board-view="timeline"]').click();
  await textVisible('События по времени');
  assert.equal(await page.locator('.timeline-row').count(),2);
  const times=await page.locator('.timeline-row time').allTextContents();
  assert.deepEqual(times,['21:11','21:23']);

  await page.locator('[data-board-view="links"]').click();
  await textVisible('Что с чем связано?');
  await page.locator('#linkFrom').selectOption({index:1});
  await page.locator('#linkType').selectOption('подтверждает');
  await page.locator('#linkTo').selectOption({index:2});
  await page.locator('#addBoardLink').click();
  assert.equal(await page.locator('.link-row').count(),1);
  await page.locator('[data-remove-link]').click();
  assert.equal(await page.locator('.link-row').count(),0);

  // Suspect worksheet and shared notebook persist manual player thinking without grading it.
  await page.locator('[data-board-view="people"]').click();
  await textVisible('Люди и алиби');
  assert.equal(await page.locator('.suspect-sheet').count(),5);
  await page.locator('[data-suspect-mark="pavel"]').selectOption('solid');
  await page.locator('[data-suspect-note="pavel"]').fill('Проверить заправку и время дороги.');
  await page.locator('#caseNotebook').fill('Рабочая версия: сначала восстановить окно 21:15–21:30.');
  assert.match(await page.locator('#caseNotebook').inputValue(),/21:15/);

  // A board card can reopen the original source instead of forcing manual hunting.
  await page.locator('[data-board-view="cards"]').click();
  const sourceButton=page.locator('[data-open-pin-source="thread_marina"]');
  assert.equal(await sourceButton.count(),1);
  await sourceButton.click();
  await textVisible('Pixel 8 · Сообщения');
  await textVisible('Марина');

  await app('board');
  await page.locator('[data-board-view="cards"]').click();
  const interviewSource=page.locator('[data-open-pin-source="interview_marina_return"]');
  assert.equal(await interviewSource.count(),1);
  await interviewSource.click();
  assert.equal(await page.locator('.interview-rec').count(),1);
  await textVisible('ПРОТОКОЛ · МАРИНА ОРЛОВА');
  await textVisible('Марина Орлова');

  await app('board');
  await page.locator('[data-board-view="people"]').click();
  assert.equal(await page.locator('[data-suspect-mark="pavel"]').inputValue(),'solid');
  assert.match(await page.locator('[data-suspect-note="pavel"]').inputValue(),/заправку/);
  assert.match(await page.locator('#caseNotebook').inputValue(),/21:15/);

  await page.locator('[data-board-view="cards"]').click();
  await page.locator('[data-remove-pin]').first().click();
  assert.equal(await page.locator('.board-clue').count(),before-1);

  // Optional hints and the complete final-answer flow still work.
  await app('hints');
  assert.equal(await page.locator('.hint-level:not(.locked)').count(),0);
  assert.equal(await page.locator('.hint-level.locked').first().innerText().then(t=>t.includes('Закрыта')),true);
  await page.locator('[data-next-hint="devices"]').click();
  assert.equal(await page.locator('.hint-level:not(.locked)').count(),1);
  await page.locator('[data-next-hint="timeline"]').click();
  assert.equal(await page.locator('.hint-level:not(.locked)').count(),2);
  assert.equal(await page.locator('.hint-group').last().locator('.hint-level:not(.locked)').count(),0);
  await app('final');
  for(const id of ['#finalWho','#finalMotive','#finalMethod','#finalEvidence']) await page.locator(id).selectOption({index:1});
  await page.locator('#submitCase').click();
  await textVisible('Вы раскрыли');

  await page.locator('.mnav[data-tab="plan"]').click();
  await textVisible('План вечера');

  assert.deepEqual(errors,[]);
  console.log('DETECTIVE_V3_E2E_OK');
}finally{
  await browser.close();
}
