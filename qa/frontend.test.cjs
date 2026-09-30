// NODE_PATH pointing at jsdom@26.1.0, or install that version locally before running.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const fixture=JSON.parse(fs.readFileSync(__dirname+'/board-fixture.json','utf8'));
const dom=new JSDOM('<main><input id="sourcing-search"><select id="sourcing-filter"><option value="all">All</option><option value="mine">Mine</option></select><div id="product-requests"></div><div id="sourced-products"></div><div id="supplier-requests"></div></main>',{url:'https://example.test/app.html',runScripts:'outside-only'});
const w=dom.window,calls=[];
w.IZZY={
 esc:v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),
 money:v=>'EGP '+Number(v).toFixed(2),
 rpc:async(name,args)=>{calls.push({name,args});return 'qa-response'},
 session:()=>({user:{id:'qa-user'}})
};
w.confirm=()=>true;
w.eval(fs.readFileSync(__dirname+'/../sourcing.js','utf8'));
const d=w.document;
let refreshes=0;
const refresh=async()=>{refreshes++};
(async()=>{
 w.IZZY_SOURCING.renderDropshipper(fixture,refresh);
 assert.equal(d.querySelectorAll('#product-requests article').length,1);
 assert.equal(d.querySelectorAll('#sourced-products article').length,1);
 const sourced=d.querySelector('#sourced-products');
 assert.match(sourced.textContent,/EGP 125.00/);
 assert.match(sourced.textContent,/EGP 200.00/);
 assert.match(sourced.textContent,/EGP 75.00/);
 assert.match(sourced.textContent,/Guidance only/);
 assert.match(sourced.textContent,/not reserved stock/);
 assert.equal(sourced.querySelector('[data-interest-offer]').textContent,'Request this product');
 assert.equal(sourced.querySelector('[data-interest-offer]').disabled,false);
 await sourced.querySelector('[data-interest-offer]').onclick();
 assert.equal(calls.at(-1).name,'sourcing_interest');
 assert.equal(calls.at(-1).args._response_id,fixture.responses.find(o=>o.status==='sourced').id);
 const comments=d.querySelector('.sourcing-comment-form');
 comments.elements.body.value='QA community demand';
 await comments.onsubmit({preventDefault(){}});
 assert.equal(calls.at(-1).name,'sourcing_comment');
 assert.equal(calls.at(-1).args._body,'QA community demand');
 assert.equal(refreshes,2);
 const own=structuredClone(fixture);
 own.responses.forEach(o=>o.is_mine=o.status==='sourced');
 own.responses[0].status='sourcing';
 w.IZZY_SOURCING.renderSupplier(own,[],refresh);
 const f=d.querySelector('.sourcing-response-form');
 assert.ok(f);
 assert.equal(f.querySelector('[name="product_id"]'),null);
 assert.equal(f.querySelector('[name="variant_id"]'),null);
 f.elements.supplier_price.value='150';
 f.elements.recommended_retail.value='240';
 f.elements.supplier_price.oninput();
 assert.match(f.querySelector('.sourcing-margin-preview').textContent,/EGP 90.00/);
 const complete=f.querySelector('[name="complete"]');
 complete.onclick();
 assert.equal(f.elements.lead_time_days.required,true);
 await f.onsubmit({preventDefault(){},submitter:complete});
 assert.equal(calls.at(-1).name,'sourcing_save_response');
 assert.equal(calls.at(-1).args._mark_sourced,true);
 assert.equal(calls.at(-1).args._data.supplier_price,'150');
 assert.equal(calls.at(-1).args._data.recommended_retail,'240');
 assert.ok(calls.every(c=>c.name.startsWith('sourcing_')));
 const hostile=structuredClone(fixture);
 hostile.requests[0].title='<img src=x onerror="alert(1)">';
 hostile.requests[0].source_url='javascript:alert(1)';
 hostile.responses[0].image_url='javascript:alert(1)';
 w.IZZY_SOURCING.renderDropshipper(hostile,refresh);
 assert.equal(d.querySelector('img[src="x"]'),null);
 assert.equal(d.querySelector('[href^="javascript:"]'),null);
 assert.equal(d.querySelector('[src^="javascript:"]'),null);
 assert.match(d.querySelector('#product-requests').textContent,/<img src=x/);
 console.log('PASS: board and sourced cards, independent supplier form, prices/margin/guidance, demand/comment/completion handlers, refresh, escaped content and URL schemes.');
})().catch(e=>{console.error(e);process.exitCode=1});
