const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname,'../../app.js'),'utf8');
const start = source.indexOf('let fallbackManualOrderAttempt=null;');
const end = source.indexOf('const notificationBell=',start);
assert(start >= 0 && end > start, 'Order handler extraction boundaries changed');
const handler = source.slice(start,end);
const fields = {'order-product':'qa-product','order-variant':'qa-variant','order-qty':'2','order-customer-name':'QA Retry','order-customer-phone':'00000000000','order-customer-email':'','order-address1':'QA address','order-city':'Cairo','order-governorate':'Cairo','order-ref':'qa-reference'};
const html = '<!doctype html><form id="order-form">'+Object.entries(fields).map(([id,value])=>'<input id="'+id+'" value="'+value+'">').join('')+'<button id="order-submit" type="submit">Submit</button></form><div id="order-status"></div><div id="order-create-card"></div><button id="toggle-order-form"></button>';
const results=[];
(async()=>{
 let browser;
 try{
  browser=await chromium.launch();
  for(const reload of [false,true]){
   const context=await browser.newContext({serviceWorkers:'block'});
   try{
    let lost=false; const requests=[];
    await context.route('**/*',async route=>{
     const u=new URL(route.request().url());
     if(u.origin!=='http://localhost:43210')return route.abort();
     if(u.pathname==='/order'){
      requests.push(route.request().postDataJSON());
      if(!lost){lost=true;return route.abort('failed');}
      return route.fulfill({json:'qa-same-order'});
     }
     return route.fulfill({contentType:'text/html',body:html});
    });
    const page=await context.newPage();
    async function boot(){
     await page.goto('http://localhost:43210/');
     await page.addScriptTag({content:"const $=s=>document.querySelector(s); const SESSION={user:{id:'qa-user'}}; const SHIPPING={available:true}; const renderOrderPreview=()=>{}; const load=async()=>{}; const IZZY={rpc:async(name,args)=>{const r=await fetch('/order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});return r.json();}};"+handler});
    }
    await boot();
    await page.click('#order-submit');
    await page.waitForFunction(()=>document.querySelector('#order-status').classList.contains('bad'));
    assert.equal(requests.length,1);
    const first=requests[0]._idempotency_key;
    assert.match(first,/^[0-9a-f-]{36}$/);
    if(reload)await boot();
    await page.click('#order-submit');
    await page.waitForFunction(()=>document.querySelector('#order-status').textContent.includes('Order created'));
    assert.equal(requests.length,2);
    assert.equal(requests[1]._idempotency_key,first);
    assert.deepEqual(requests[1],requests[0]);
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('izzydrop:manual-order-attempt:v1:qa-user')),null);
    results.push({name:reload?'Lost response then reload and retry':'Lost response then retry',status:'PASS',same_key:true,identical_payload:true,cleared_after_success:true});
   }finally{await context.close();}
  }
 }catch(e){results.push({status:'FAIL',error:e.message});process.exitCode=1;}
 finally{
  if(browser)await browser.close();
  fs.mkdirSync('qa-results',{recursive:true});
  const report={scope:'Actual order handler in Chromium with an aborted mock RPC response. Backend verified separately by rollback SQL. Not a committed live HTTP order test.',results};
  fs.writeFileSync('qa-results/order-retry.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
 }
})();
