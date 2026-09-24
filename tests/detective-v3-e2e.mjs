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
    assert.ok(ids.length>=3,path+' has too few openable files');
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

  // Board accepts mixed relevant/irrelevant material, custom notes, and removal.
  await app('board');
  await textVisible('Материалы и ваши выводы');
  const before=await page.locator('.board-clue').count();
  assert.ok(before>=6);
  const note=page.locator('[data-pin-note]').first();
  await note.fill('Проверить время и алиби.');
  assert.match(await note.inputValue(),/алиби/);
  await page.locator('[data-remove-pin]').first().click();
  assert.equal(await page.locator('.board-clue').count(),before-1);

  // Optional hints and final screen still open.
  await app('hints');
  await page.locator('#nextHint').click();
  assert.ok(await page.locator('.hint-level:not(.locked)').count()>=1);
  await app('final');
  assert.equal(await page.locator('#submitCase').count(),1);

  await page.locator('.mnav[data-tab="plan"]').click();
  await textVisible('План вечера');

  assert.deepEqual(errors,[]);
  console.log('DETECTIVE_V3_E2E_OK');
}finally{
  await browser.close();
}
