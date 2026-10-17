'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const pages=[
  'index.html','login.html','app.html','supplier.html','admin.html',
  'product.html','supplier-variant.html','test-store.html',
  'policies.html','policies-2026-10-13-pilot-v1.html'
];
const controller=fs.readFileSync('design-preview.js','utf8');
const css=fs.readFileSync('design-v2.css','utf8');

function simulate(url,sharedState={},storageAvailable=true){
  const dataset={};
  const context={
    location:{search:new URL(url,'https://izzydrop.test').search},
    document:{documentElement:{dataset}},
    URLSearchParams,
    sessionStorage:{
      setItem(k,v){if(!storageAvailable)throw Error('blocked');sharedState[k]=v;},
      getItem(k){if(!storageAvailable)throw Error('blocked');return sharedState[k]??null;}
    }
  };
  vm.runInNewContext(controller,context,{timeout:1000});
  return dataset.izzyDesign||null;
}

test('V1 is unchanged for regular visitors without preview query',()=>{
  const state={};
  assert.equal(simulate('/index.html',state),null);
  assert.deepEqual(state,{});
});
test('V2 explicitly enabled, persists only within its session',()=>{
  const state={};
  assert.equal(simulate('/index.html?design=v2',state),'v2');
  assert.equal(simulate('/supplier.html',state),'v2');
  assert.equal(simulate('/app.html?view=orders',state),'v2');
  assert.equal(simulate('/supplier.html',{}),null);
});
test('V1 switch restores original design during the same session',()=>{
  const state={};
  assert.equal(simulate('/app.html?design=v2',state),'v2');
  assert.equal(simulate('/app.html?design=v1',state),null);
  assert.equal(simulate('/app.html',state),null);
});
test('blocked sessionStorage does not enable V2 by default',()=>{
  assert.equal(simulate('/index.html',{},false),null);
  assert.equal(simulate('/index.html?design=v2',{},false),'v2');
});
test('every primary page includes matching preview assets exactly once',()=>{
  for(const name of pages){
    const html=fs.readFileSync(name,'utf8');
    assert.equal((html.match(/design-preview\.js\?v=20261017-(?:pulse1|atlas1)/g)||[]).length,1,name);
    assert.equal((html.match(/design-v2\.css\?v=20261017-pulse1/g)||[]).length,1,name);
    assert.ok(html.indexOf('design-preview.js')<html.indexOf('</head>'),name);
    assert.ok(html.indexOf('design-v2.css')<html.indexOf('</head>'),name);
  }
});
test('new CSS is scoped to the V2 design only',()=>{
  assert.ok(css.includes('html[data-izzy-design="v2"]'));
  assert.ok(css.includes('html[data-izzy-design="v2"][data-theme="dark"]'));
  assert.ok(css.includes('html[dir="rtl"][data-izzy-design="v2"]'));
  // Check each ordinary top-level or @media selector list begins with a V2 scope.
  const withoutComments=css.replace(/\/\*[\s\S]*?\*\//g,'');
  const rules=withoutComments.split('{').slice(0,-1);
  for(const segment of rules){
    const last=segment.trim().split(/[;}]/).pop()?.trim()||'';
    if(!last||last.startsWith('@media'))continue;
    if(!last.includes('html[data-izzy-design="v2"]')&&!last.includes('html[dir="rtl"][data-izzy-design="v2"]')){
      // Selector might be the shared dark-mode predicate or a harmless at-rule.
      assert.ok(last.includes('html[data-izzy-design="v2"][data-theme="dark"]')||last.startsWith('@'),last.slice(0,120));
    }
  }
});
test('design controller does not touch live business data or authentication',()=>{
  for(const banned of ['fetch(', 'IZZY.request', 'localStorage', 'supabase', 'history.pushState']){
    assert.equal(controller.includes(banned),false,banned);
  }
});
