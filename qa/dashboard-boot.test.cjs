const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const board=JSON.parse(fs.readFileSync(__dirname+'/board-fixture.json','utf8'));
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function boot(file,script,supplier=false){
 const dom=new JSDOM(fs.readFileSync(__dirname+'/../'+file,'utf8'),{url:'https://example.test/'+file,runScripts:'outside-only'});
 const w=dom.window,calls=[],errors=[];
 w.addEventListener('error',e=>errors.push(e.message));
 w.IZZY={
  esc,money:v=>'EGP '+Number(v||0).toFixed(2),
  session:()=>({access_token:'mock-local-session',user:{id:'mock-user',email:'qa@example.test'}}),
  request:async path=>{
   if(path.startsWith('/rest/v1/dropshippers?'))return [{id:'qa-dropshipper',status:'active'}];
   if(path.startsWith('/rest/v1/suppliers?'))return [{id:'qa-supplier',status:'approved',business_name:'QA Supplier',notification_preferences:{},low_stock_threshold:5}];
   return [];
  },
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='sourcing_board')return board;
   if(name==='sourcing_create_request')return 'qa-new-request';
   if(name==='marketplace_shipping_quote')return {available:true,delivery_fee:80,service_area:'Cairo'};
   if(name==='dropshipper_cod_metrics')return {};
   return [];
  }
 };
 w.eval(fs.readFileSync(__dirname+'/../sourcing.js','utf8'));
 w.eval(fs.readFileSync(__dirname+'/../'+script,'utf8'));
 await new Promise(r=>setTimeout(r,100));
 assert.deepEqual(errors,[]);
 assert.equal(w.document.querySelector(supplier?'#supplier':'#dashboard').hidden,false);
 assert.ok(calls.some(c=>c.name==='sourcing_board'));
 assert.ok(!calls.some(c=>c.name==='dropshipper_sourcing_quotes'));
 const status=w.document.querySelector(supplier?'#status':'#dash-status');
 assert.ok(!status?.classList.contains('bad'),status?.textContent);
 if(!supplier){
  w.document.querySelector('[data-view="sourced"]').onclick();
  assert.equal(w.document.querySelector('#view-sourced').hidden,false);
  assert.match(w.document.querySelector('#sourced-products').textContent,/EGP 125.00/);
  const f=w.document.querySelector('#product-request-form');
  w.document.querySelector('#request-title').value='Mock absent product';
  w.document.querySelector('#request-description').value='Mock full requirements';
  w.document.querySelector('#request-quantity').value='40';
  await f.onsubmit({preventDefault(){},target:f});
  const call=calls.find(c=>c.name==='sourcing_create_request');
  assert.ok(call);assert.equal(call.args._data.description,'Mock full requirements');assert.equal(call.args._data.expected_quantity,40);
 }
 return calls.length;
}
(async()=>{await boot('app.html','app.js');await boot('supplier.html','supplier.js',true);console.log('PASS: actual dropshipper/supplier HTML boot, new RPC wiring, Sourced navigation, request payload, and dashboard load without JS errors (mock data).')})().catch(e=>{console.error(e);process.exitCode=1});
