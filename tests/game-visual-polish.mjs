import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  if(await page.locator('#startEvening').isVisible().catch(()=>false))await page.locator('#startEvening').click();

  // Movie jar: visible cinematic phases and final reveal.
  await page.locator('.mnav[data-tab="movies"]').click();
  const movies=page.locator('.movie');
  await movies.nth(0).fill('Амели');
  await movies.nth(1).fill('Отпуск по обмену');
  await page.locator('#pickMovie').click();
  assert.equal(await page.locator('#movieRoulette').isVisible(),true);
  assert.equal(await page.locator('.movie-flying-slip').count(),6);
  assert.equal(await page.locator('.movie-jar-slip').count(),6);
  await page.waitForFunction(()=>document.querySelector('#movieJarWrap')?.classList.contains('is-shaking'),null,{timeout:2600});
  assert.match(await page.locator('#movieRouletteStatus').innerText(),/встряхиваем/i);
  await page.waitForFunction(()=>document.querySelector('#movieJarWrap')?.classList.contains('is-picking'),null,{timeout:5000});
  await page.waitForFunction(()=>document.querySelector('#movieRoulette')?.classList.contains('is-revealed'),null,{timeout:6000});
  assert.equal(await page.locator('#moviePulled').isVisible(),true);
  await page.locator('#movieRouletteDone').click();

  // Emoji game: richer round shell, reveal state and progress.
  await page.locator('.mnav[data-tab="emoji"]').click();
  assert.equal(await page.locator('#emojiCard').count(),1);
  const firstEmoji=await page.locator('#emojiLine').innerText();
  assert.ok(parseFloat(await page.locator('#emojiProgressFill').evaluate(el=>getComputedStyle(el).width))>0);
  await page.locator('#reveal').click();
  assert.equal(await page.locator('#emojiCard').evaluate(el=>el.classList.contains('is-revealed')),true);
  assert.equal(await page.locator('#emojiAnswer').isVisible(),true);
  await page.locator('#nextEmoji').click();
  assert.notEqual(await page.locator('#emojiLine').innerText(),firstEmoji);
  assert.equal((await page.locator('#emojiRoundTop').innerText()).trim(),'2');

  // Talk: six styled modes and animated card dealing.
  await page.locator('.mnav[data-tab="talk"]').click();
  assert.equal(await page.locator('#gamechips .chip').count(),6);
  const icons=await page.locator('#gamechips .chip').evaluateAll(els=>els.map(el=>el.getAttribute('data-icon')));
  assert.ok(icons.every(Boolean),'Every talk mode should have a visual icon');
  await page.locator('#gamechips .chip').nth(1).click();
  assert.match(await page.locator('#talkLabel').innerText(),/Абсурдный выбор/);
  assert.equal((await page.locator('#talkModeIcon').innerText()).trim(),'🌀');
  const initial=await page.locator('#talkQuestion').innerText();
  await page.locator('#nextQuestion').click();
  assert.notEqual(await page.locator('#talkQuestion').innerText(),initial);
  assert.match((await page.locator('#talkDrawCount').innerText()).trim(),/карточка 01/i);
  assert.equal(await page.locator('#talkCard').evaluate(el=>el.classList.contains('is-dealing')),true);

  const widths=await page.evaluate(()=>({innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  assert.ok(widths.html<=widths.innerWidth+2&&widths.body<=widths.innerWidth+2,'Polished games must not introduce mobile horizontal overflow '+JSON.stringify(widths));
  assert.deepEqual(errors,[],'Uncaught page errors: '+errors.join('\n'));
  console.log('GAME_VISUAL_POLISH_OK');
}finally{
  await browser.close();
}
