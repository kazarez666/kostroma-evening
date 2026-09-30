import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});

async function openCase(page){
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  if(await page.locator('#startEvening').isVisible().catch(()=>false)) await page.locator('#startEvening').click();
  await page.locator('#secretOwnerTrigger').click();
  await page.locator('#openSecretCase').click();
  await page.locator('#caseRevealContinue').click();
  await page.locator('#casePlanLaunch').click();
  await page.locator('#startCase').click();
}

async function audit(page,label){
  await page.waitForTimeout(20);
  const geometry=await page.evaluate(()=>({
    innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    bodyWidth:document.body.scrollWidth
  }));
  assert.ok(geometry.scrollWidth<=geometry.innerWidth+2,label+' causes document horizontal overflow: '+JSON.stringify(geometry));
  assert.ok(geometry.bodyWidth<=geometry.innerWidth+2,label+' causes body horizontal overflow: '+JSON.stringify(geometry));

  const fields=page.locator('#caseScreen input:not([type="checkbox"]):not([type="radio"]):visible,#caseScreen select:visible,#caseScreen textarea:visible');
  const tooSmall=await fields.evaluateAll(els=>els.map(el=>({tag:el.tagName,id:el.id,size:parseFloat(getComputedStyle(el).fontSize)})).filter(x=>x.size<15.5));
  assert.deepEqual(tooSmall,[],label+' has mobile form controls below 16px');

  const actions=page.locator('#caseScreen button:visible');
  if(await actions.count()){
    const target=actions.last();
    await target.evaluate(el=>{
      document.documentElement.style.scrollBehavior='auto';
      const t=el.getBoundingClientRect(),n=document.querySelector('.mobile-nav').getBoundingClientRect();
      const delta=t.bottom-(n.top-16);
      if(delta>0)window.scrollBy({top:delta,left:0,behavior:'instant'});
    });
    await page.waitForTimeout(50);
    const geometry=await target.evaluate(el=>{
      const t=el.getBoundingClientRect(),n=document.querySelector('.mobile-nav').getBoundingClientRect();
      return {target:{top:t.top,bottom:t.bottom,left:t.left,right:t.right},nav:{top:n.top,bottom:n.bottom},scroll:{scrollY,innerHeight,scrollHeight:document.documentElement.scrollHeight}};
    });
    assert.ok(geometry.target.bottom<=geometry.nav.top-8,label+' cannot be scrolled clear of the fixed bottom nav '+JSON.stringify(geometry));
  }
}

const viewports=[
  {width:360,height:780,name:'360'},
  {width:390,height:844,name:'390'},
  {width:430,height:932,name:'430'},
  {width:390,height:600,name:'390-keyboard'}
];

try{
  for(const vp of viewports){
    const context=await browser.newContext({viewport:{width:vp.width,height:vp.height}});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await openCase(page);

    const app=async id=>page.locator('[data-case-app="'+id+'"]').click();

    await audit(page,vp.name+' briefing');

    await app('people');await audit(page,vp.name+' people');

    await app('devices');
    await page.locator('[data-device="phone"]').click();
    await page.locator('[data-device="phone_messages"]').click();
    await audit(page,vp.name+' phone messages');

    await app('devices');
    await page.locator('[data-device="laptop"]').click();
    await page.locator('[data-device="laptop_files"]').click();
    await page.locator('[data-filepath="docs"]').first().click();
    await audit(page,vp.name+' laptop files');

    await app('web');
    await page.locator('#caseWebQuery').fill('почта');
    await page.locator('#caseWebSearch').click();
    await audit(page,vp.name+' browser results');
    await page.locator('[data-webpage="mail"]').click();
    await audit(page,vp.name+' webmail login');

    await app('interview');
    await page.locator('[data-interview-suspect="marina"]').click();
    await audit(page,vp.name+' interrogation room');
    await page.locator('[data-interview-back]').click();

    await app('police');
    await page.locator('[data-police-open="0"]').click();
    await audit(page,vp.name+' police reader');

    await app('board');
    await page.locator('[data-board-view="questions"]').click();
    await audit(page,vp.name+' board questions');
    await page.locator('[data-board-view="notes"]').click();
    await audit(page,vp.name+' investigator notebook');

    await app('hints');await audit(page,vp.name+' hints');
    await app('final');await audit(page,vp.name+' final gate');

    assert.deepEqual(errors,[],vp.name+' page errors: '+errors.join('\n'));
    await context.close();
  }
  console.log('MOBILE_CASE_AUDIT_OK');
}finally{
  await browser.close();
}
