'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const vm=require('node:vm');
const controller=fs.readFileSync('design-preview.js','utf8');
const css=fs.readFileSync('design-atlas.css','utf8');
const pages=[
  'index.html','login.html','app.html','supplier.html','admin.html',
  'product.html','supplier-variant.html','test-store.html',
  'policies.html','policies-2026-10-13-pilot-v1.html'
];
const make=(url,state={},available=true)=>{
 const dataset={};
 vm.runInNewContext(controller,{
   URLSearchParams,
   location:{search:new URL(url,'https://izzydrop.test').search},
   document:{documentElement:{dataset}},
   sessionStorage:{
     setItem(k,v){if(!available)throw Error('storage unavailable');state[k]=v},
     getItem(k){if(!available)throw Error('storage unavailable');return state[k]??null}
   }
 },{timeout:1000});
 return dataset.izzyDesign||null;
};
test('Atlas is independently opt-in; V1 stays default',()=>{
 const state={};
 assert.equal(make('/index.html',state),null);
 assert.equal(make('/index.html?design=atlas',state),'atlas');
 assert.equal(make('/supplier.html',state),'atlas');
 assert.equal(make('/app.html?design=v1',state),null);
 assert.equal(make('/login.html',state),null);
 assert.equal(make('/app.html?design=v2',state),'v2');
 assert.equal(make('/app.html?design=atlas',state),'atlas');
 assert.equal(make('/index.html',{}),null);
 assert.equal(make('/index.html?design=atlas',{},false),'atlas');
});
test('Preview switch does not touch accounts, business API, or persistent preferences',()=>{
 for(const banned of ['fetch(', 'IZZY.request', 'localStorage', 'window.location.href', 'supabase', 'history.pushState']){
   assert.ok(!controller.includes(banned),'Preview touched forbidden behavior: '+banned);
 }
});
test('Changed functionality-bearing page markup has no unrelated drift',()=>{
 const changedFiles=new Set(execFileSync('git',['diff','--name-only','origin/main...HEAD'],{encoding:'utf8'})
   .trim().split(String.fromCharCode(10)).filter(Boolean));
 const wooCredentialsBlock=String.raw`            <div class="field" id="woocommerce-credentials" hidden>
              <label class="field-label" for="woocommerce-key">WooCommerce consumer key</label>
              <input id="woocommerce-key" type="password" autocomplete="off" placeholder="ck_…" spellcheck="false">
              <label class="field-label" for="woocommerce-secret">WooCommerce consumer secret</label>
              <input id="woocommerce-secret" type="password" autocomplete="off" placeholder="cs_…" spellcheck="false">
              <small class="muted">Create a WooCommerce REST API key with Read/Write access in your WordPress admin. Credentials are sent to IzzyDrop’s server for verification.</small>
            </div>
`;
 const disconnectButton='            <button id="disconnect-woocommerce" class="btn secondary" type="button" hidden>Disconnect WooCommerce</button>';
 for(const path of pages){
   // The PR merge result inherits unchanged pages from main; a stale feature-branch checkout
   // must not be treated as a change to a page that is absent from the PR diff.
   if(!changedFiles.has(path))continue;
   let base=execFileSync('git',['show','origin/main:'+path],{encoding:'utf8'});
   let next=fs.readFileSync(path,'utf8');
   assert.equal(next.split('design-atlas.css?v=20261017-atlas1').length-1,1,path+' Atlas link');
   assert.equal(next.split('design-preview.js?v=20261017-atlas1').length-1,1,path+' preview script');
   // Compare the base and PR markup after removing only the opt-in Atlas asset loader
   // from both sides; main may already contain that loader.
   base=base.replace('design-preview.js?v=20261017-atlas1','design-preview.js?v=20261017-pulse1')
            .replace('<link rel="stylesheet" href="design-atlas.css?v=20261017-atlas1">','');
   next=next.replace('design-preview.js?v=20261017-atlas1','design-preview.js?v=20261017-pulse1')
            .replace('<link rel="stylesheet" href="design-atlas.css?v=20261017-atlas1">','');
   if(path==='app.html'){
     // WooCommerce adds an optional credentials area, disconnect action, and updated cache URL.
     next=next.replace('Connect a sales channel to IzzyDrop. Shopify uses secure authorization; WooCommerce uses API credentials that are sent directly to IzzyDrop over HTTPS.',
       'Connect your Shopify store securely. You’ll be redirected to Shopify to approve IzzyDrop.');
     next=next.replace('Shopify authorization and WooCommerce API credential verification are supported here. Custom website connections use the separate IzzyDrop web integration.',
       'After authorization, we’ll verify the connection and its permissions. WooCommerce and custom website connections are not available yet.');
     next=next.replace(wooCredentialsBlock,'').replace(disconnectButton+String.fromCharCode(10),'');
     next=next.replace('app.js?v=20261025-woocommerceconnectmanage1','app.js?v=20261019-verification1');
   }
   assert.equal(next,base,path+' drifted outside opt-in asset loader and explicitly allowed integration changes');
 }
});
test('Atlas transforms real layout families, not merely colors',()=>{
 const needed=[
  '#choose>.choice-grid','grid-column:2;grid-row:1/5',
  'grid-template-columns:minmax(0,1fr);gap:22px;padding-top:0',
  'grid-template-columns:minmax(228px,280px) minmax(0,1fr)',
  'grid-row:1/span 2',
  'grid-template-columns:1.12fr .9fr .9fr',
  '.dropshipper-product-card:first-child',
  '.settings-menu','grid-template-columns:1fr'
 ];
 for(const phrase of needed)assert.ok(css.includes(phrase),'Missing structural rule '+phrase);
});
test('Atlas styling cannot affect unselected V1 or V2',()=>{
 assert.ok(css.includes('html[data-izzy-design="atlas"]'));
 assert.ok(css.includes('html[data-izzy-design="atlas"][data-theme="dark"]'));
 assert.ok(css.includes('html[dir="rtl"][data-izzy-design="atlas"]'));
 assert.ok(!css.includes('html[data-izzy-design="v2"]'));
 const withoutComments=css.replace(/\/\*[\s\S]*?\*\//g,'');
 const selectors=withoutComments.split('{').slice(0,-1).map(s=>s.trim().split(/[;}]/).pop()?.trim()||'');
 for(const selector of selectors){
   if(!selector||selector.startsWith('@'))continue;
   assert.ok(
     selector.startsWith('html[data-izzy-design="atlas"]')||
     selector.startsWith('html[data-izzy-design="atlas"][data-theme="dark"]')||
     selector.startsWith('html[dir="rtl"][data-izzy-design="atlas"]'),
     'Unscoped Atlas CSS: '+selector.slice(0,140)
   );
 }
});
