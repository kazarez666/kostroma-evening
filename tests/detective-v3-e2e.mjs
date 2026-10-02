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
  await page.locator('#secretOwnerTrigger').click();
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
  await page.locator('[data-web-search-person="marina"]').first().click();
  await page.locator('[data-webpage="marina"]').first().click();
  assert.ok(await page.locator('.feed-post').count()>=8);
  assert.equal(await page.locator('.feed-post [data-pin]').count(),await page.locator('.feed-post').count());
  assert.ok(await page.locator('.bash-comments').count()>=1,'social profiles should contain activity and comments');
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

  // Webmail: discover the site in the browser and open a message as a board source.
  await app('web');
  await page.locator('#caseWebQuery').fill('почта');
  await page.locator('#caseWebSearch').click();
  assert.ok(await page.locator('.browser-result').count()>=3,'mail search should return multiple plausible services');
  await page.locator('[data-webpage="mail"]').click();
  assert.ok(await page.locator('.mail-web-row').count()>=10);
  await page.locator('[data-mail-open="1"]').click();
  assert.equal(await page.locator('.mail-web-message [data-pin="mail_1"]').count(),1);
  await page.locator('.mail-web-message [data-pin="mail_1"]').click();

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
  await page.locator('#messageSearch').fill('договор');
  await page.locator('#messageSearchBtn').click();
  assert.ok(await page.locator('[data-message-search-thread]').count()>=1,'message search should find older conversation history');
  await page.locator('[data-message-search-thread="alina"]').first().click();
  await textVisible('Нашла ещё два договора');

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
  assert.equal(await page.locator('.police-index-card').count(),7);
  await page.locator('[data-police-open="0"]').click();
  assert.equal(await page.locator('.police-paper').count(),1);
  await page.locator('[data-pin="police_0"]').click();
  await page.locator('[data-police-next]').click();
  assert.equal(await page.locator('.police-paper').count(),1);
  await page.locator('[data-police-back]').click();
  await page.locator('[data-police-open="5"]').click();
  await page.locator('[data-pin="police_5"]').click();

  // The board must not validate a decisive guess before the related testimony exists.
  await app('board');
  await page.locator('[data-board-view="questions"]').click();
  await page.locator('[data-board-answer="0"]').fill('Марина');
  await page.locator('[data-check-board="0"]').click();
  assert.match(await page.locator('#board-feedback-0').innerText(),/Пока рано/);
  assert.equal(await page.locator('#boardQuestionProgress').innerText(),'0/6');

  // Interrogations: five suspects, cinematic room, branching questions, progress and repeat visits.
  await app('interview');
  assert.equal(await page.locator('.interview-card').count(),5);
  assert.equal(await page.locator('.interrogation-overview').count(),1);
  assert.match(await page.locator('.interrogation-overview').innerText(),/Ключевые показания/);
  await page.locator('[data-interview-suspect="marina"]').click();
  await textVisible('Марина Орлова');
  assert.equal(await page.locator('.interview-stage').count(),1,'interrogation should open as a dedicated room scene');
  assert.equal(await page.locator('.interview-lamp').count(),1,'room should include the interrogation lamp');
  assert.equal(await page.locator('.interview-subject').count(),1,'suspect should sit in the interrogation scene');
  const emotionSrc=await page.locator('.interview-emotion-image').getAttribute('src');
  assert.ok(emotionSrc&&emotionSrc.startsWith('data:image/webp;base64,'),'generated emotion frame should be loaded instead of portrait fallback');
  assert.ok(await page.locator('.interview-emotion-image').evaluate(img=>img.complete&&img.naturalWidth>0),'emotion frame should decode successfully');
  assert.ok(await page.locator('[data-interview-question]').count()>=1);
  assert.ok(await page.locator('[data-interview-question]').count()>=3,'all currently available questions should be visible');
  assert.equal(await page.locator('[data-interview-question="return"]').count(),0,'evidence follow-up should wait for the base answer');

  await page.locator('[data-interview-question="evening"]').click();
  assert.ok(await page.locator('.interview-turn').count()>=1);
  assert.equal(await page.locator('[data-interview-question="return"]').count(),1,'access evidence should unlock a return-to-studio follow-up');

  await page.locator('[data-interview-question="conflict"]').click();
  assert.equal(await page.locator('[data-interview-question="money"]').count(),1,'payment evidence should unlock a money follow-up');
  await page.locator('[data-interview-question="return"]').click();
  await page.locator('[data-interview-question="money"]').click();
  assert.equal(await page.locator('[data-interview-question="last"]').count(),1,'Marina final key testimony must unlock after return + money');
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

  // All ordinary answers = 90%; a secret three-topic sequence can optionally take a suspect to 100%.
  await page.evaluate(()=>{
    const ordinary=interrogationData.marina.questions.filter(x=>!x.secret).map(x=>x.id);
    caseState.interrogation.asked.marina=ordinary;
    caseState.interrogation.history.marina=ordinary.slice();
    saveCase();
  });
  await page.locator('[data-interview-suspect="marina"]').click();
  assert.match(await page.locator('.interview-person-head .interview-meter__top').innerText(),/90%/);
  assert.equal(await page.locator('.interview-combo').count(),1);
  await page.locator('[data-interview-combo-step="last"]').click();
  await page.locator('[data-interview-combo-step="return"]').click();
  await page.locator('[data-interview-combo-step="money"]').click();
  assert.equal(await page.locator('[data-interview-question="breakthrough"]').count(),0,'wrong sequence must not unlock the hidden answer');
  await page.locator('[data-interview-combo-step="return"]').click();
  await page.locator('[data-interview-combo-step="money"]').click();
  await page.locator('[data-interview-combo-step="last"]').click();
  assert.equal(await page.locator('[data-interview-question="breakthrough"]').count(),1,'correct sequence should reveal the optional hidden question');
  await page.locator('[data-interview-question="breakthrough"]').click();
  assert.match(await page.locator('.interview-person-head .interview-meter__top').innerText(),/100%/);
  assert.match(await page.locator('.interview-done').last().innerText(),/100%/);
  await page.locator('[data-interview-back]').click();

  // Board accepts mixed relevant/irrelevant material, notes, manual time and user-defined links.
  await app('board');
  await textVisible('Материалы и ваши выводы');
  await page.locator('[data-board-view="questions"]').click();
  assert.equal(await page.locator('.investigation-question').count(),6);
  await page.locator('[data-board-answer="0"]').fill('Павел');
  await page.locator('[data-check-board="0"]').click();
  assert.match(await page.locator('#board-feedback-0').innerText(),/неверно/);
  await page.locator('[data-board-answer="0"]').fill('Марина');
  await page.locator('[data-check-board="0"]').click();
  assert.match(await page.locator('#board-feedback-0').innerText(),/Верно/);
  assert.equal(await page.locator('#boardQuestionProgress').innerText(),'1/6');
  await page.locator('[data-board-view="cards"]').click();
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

  // Suspect worksheet persists manual player thinking without grading it.
  await page.locator('[data-board-view="people"]').click();
  await textVisible('Люди и алиби');
  assert.equal(await page.locator('.suspect-sheet').count(),5);
  await page.locator('[data-suspect-mark="pavel"]').selectOption('solid');
  await page.locator('[data-suspect-note="pavel"]').fill('Проверить заправку и время дороги.');

  // A board card can reopen the original source instead of forcing manual hunting.
  await page.locator('[data-board-view="cards"]').click();
  const sourceButton=page.locator('[data-open-pin-source="thread_marina"]');
  assert.equal(await sourceButton.count(),1);
  await sourceButton.click();
  await textVisible('Pixel 8 · Сообщения');
  await textVisible('Марина');

  await app('board');
  await page.locator('[data-board-view="questions"]').click();
  assert.equal(await page.locator('#boardQuestionProgress').innerText(),'1/6');
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

  await page.locator('[data-board-view="notes"]').click();
  assert.equal(await page.locator('.notebook-kpis>div').count(),3);
  await page.locator('#caseNotebook').fill('Сверить допросы с журналом и ещё раз обсудить алиби.');
  await page.locator('[data-board-view="cards"]').click();
  await page.locator('[data-board-view="notes"]').click();
  assert.match(await page.locator('#caseNotebook').inputValue(),/Сверить допросы/);

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
  // Documents alone are not enough: the final form stays locked until key testimony exists.
  await app('final');
  assert.equal(await page.locator('.final-interrogation-lock').count(),1);
  assert.equal(await page.locator('#finalWho').count(),0);
  assert.match(await page.locator('.final-interrogation-lock').innerText(),/ключевые допросы/i);

  // Complete only the required testimony; optional 100% branches for the other suspects remain unnecessary.
  await page.evaluate(()=>{
    caseState.interrogation.asked.denis=['evening','marina','payment','restaurant','badge','car'];
    caseState.interrogation.asked.alina=['evening','draft','mood','bus','jurist'];
    caseState.interrogation.asked.pavel=['evening','access','trophy','wifi'];
    caseState.interrogation.asked.artem=['evening','fear','train','promise'];
    saveCase();
  });
  await app('final');
  assert.equal(await page.locator('.final-interrogation-lock').count(),0);
  assert.equal(await page.locator('#finalWho').count(),1);

  await page.locator('#finalWho').selectOption({index:1});
  for(const id of ['#finalMotive','#finalMethod','#finalEvidence']) await page.locator(id).selectOption({index:1});
  await page.locator('#submitCase').click();
  await page.locator('#finalFeedback').getByText('Пока неверно',{exact:false}).waitFor({state:'visible'});
  assert.match(await page.locator('#finalFeedback').innerText(),/Ничего не сброшено/);
  assert.equal(await page.locator('.case-solved').count(),0);
  await page.locator('.final-back').click();
  assert.equal(await page.locator('.board-tabs').count(),1);
  await app('final');
  assert.equal(await page.locator('#finalWho').inputValue(),'marina','wrong versions should remain editable after returning to evidence');
  await page.locator('#finalWho').selectOption('denis');
  await page.locator('#finalMotive').selectOption('revenge');
  await page.locator('#finalMethod').selectOption('cable');
  await page.locator('#finalEvidence').selectOption('photo_email');
  await page.locator('#submitCase').click();
  await textVisible('Вы раскрыли');
  await textVisible('0 из 3');

  await page.locator('.mnav[data-tab="plan"]').click();
  await page.locator('#plan .section-head h2').waitFor({state:'visible'});

  assert.deepEqual(errors,[]);
  console.log('DETECTIVE_V3_E2E_OK');
}finally{
  await browser.close();
}
