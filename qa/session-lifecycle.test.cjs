const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/../common.js','utf8');
const session=(id='one',token='refresh-one')=>({access_token:'access-'+id,refresh_token:token,user:{id}});
const response=(status,body)=>({status,ok:status>=200&&status<300,text:async()=>JSON.stringify(body)});
function harness({fetch,shared=new Map(),locks,path='app.html'}={}){
 const events={},docEvents={},intervals=[],redirects=[];
 const localStorage={getItem:k=>shared.get(k)||null,setItem:(k,v)=>shared.set(k,v),removeItem:k=>shared.delete(k)};
 const document={documentElement:{dataset:{},style:{}},visibilityState:'visible',querySelectorAll:()=>[],addEventListener:(k,f)=>docEvents[k]=f};
 const w={IZZY_CONFIG:{supabaseUrl:'https://auth.test',supabaseKey:'public'},navigator:{locks},addEventListener:(k,f)=>events[k]=f,setInterval:(f,ms)=>intervals.push({f,ms})};
 const context=vm.createContext({window:w,document,localStorage,location:{pathname:'/'+path,href:'https://site.test/'+path,replace:u=>redirects.push(u),reload:()=>redirects.push('reload')},URL,Date,fetch:fetch||(()=>{throw Error('unexpected fetch')}),Intl});
 Object.defineProperty(context,'IZZY',{get:()=>w.IZZY});
 vm.runInContext(source,context);
 return {api:w.IZZY,events,docEvents,document,intervals,redirects,shared};
}
function mutex(){let queue=Promise.resolve();return {request:(_key,work)=>{const next=queue.then(work);queue=next.catch(()=>{});return next}}}
const tick=()=>new Promise(r=>setImmediate(r));
test('revoked session is rejected before protected data is fetched on reload',async()=>{
 const calls=[];const h=harness({fetch:async u=>{calls.push(u);return response(400,{error_code:'refresh_token_not_found'})}});h.api.saveSession(session());
 await assert.rejects(h.api.request('/rest/v1/orders'),/expired/);
 assert.equal(calls.length,1);assert.match(calls[0],/grant_type=refresh_token/);assert.equal(h.api.session(),null);assert.equal(h.redirects.length,1);
});
test('valid session refreshes once before parallel boot requests',async()=>{
 let refreshes=0;const h=harness({fetch:async u=>{if(u.includes('grant_type')){refreshes++;await tick();return response(200,session('one','rotated'))}return response(200,[])}});h.api.saveSession(session());
 await Promise.all([h.api.request('/rest/v1/a'),h.api.request('/rest/v1/b')]);await h.api.request('/rest/v1/c');assert.equal(refreshes,1);
});
test('active device detects remote global logout on next 30-second check',async()=>{
 let revoked=false;const h=harness({fetch:async()=>revoked?response(400,{error_code:'refresh_token_not_found'}):response(200,session())});h.api.saveSession(session());
 await h.events.pageshow();revoked=true;assert.equal(h.intervals[0].ms,30000);h.intervals[0].f();await tick();assert.equal(h.api.session(),null);assert.match(h.redirects[0],/session_expired/);
});
test('focus and foreground checks detect revocation without page refresh',async()=>{
 for(const event of ['focus','visibility']){const h=harness({fetch:async()=>response(400,{error_code:'refresh_token_not_found'})});h.api.saveSession(session());
 if(event==='focus')await h.events.focus();else {h.docEvents.visibilitychange();await tick()}
 assert.equal(h.api.session(),null);assert.equal(h.redirects.length,1);}
});
test('logout during refresh cannot restore a deleted session',async()=>{
 let resolve;const h=harness({fetch:()=>new Promise(r=>resolve=r)});h.api.saveSession(session());const pending=h.api.refresh();h.api.logout();resolve(response(200,session('one','rotated')));assert.equal(await pending,false);assert.equal(h.api.session(),null);
});
test('account switching during refresh cannot overwrite the new account',async()=>{
 let resolve;const h=harness({fetch:()=>new Promise(r=>resolve=r)});h.api.saveSession(session());const pending=h.api.refresh();h.api.saveSession(session('two','refresh-two'));resolve(response(200,session('one','rotated')));assert.equal(await pending,false);assert.equal(h.api.session().user.id,'two');
});
test('temporary network/server errors preserve the stored login',async()=>{
 for(const fetch of [async()=>{throw Error('offline')},async()=>response(503,{message:'unavailable'})]){const h=harness({fetch});h.api.saveSession(session());await h.events.focus();assert.equal(h.api.session().user.id,'one');assert.equal(h.redirects.length,0)}
});
test('Back navigation after logout keeps cached private content hidden',async()=>{
 const h=harness();h.api.saveSession(session());h.events.pagehide();assert.equal(h.document.documentElement.style.visibility,'hidden');h.api.logout();await h.events.pageshow();assert.equal(h.document.documentElement.style.visibility,'hidden');assert.match(h.redirects.at(-1),/signed_out/);
});
test('cross-tab logout redirects and account change reloads',()=>{
 const h=harness();h.events.storage({key:'izzy_session',oldValue:JSON.stringify(session()),newValue:null});assert.match(h.redirects[0],/signed_out/);
 h.events.storage({key:'izzy_session',oldValue:JSON.stringify(session()),newValue:JSON.stringify(session('two'))});assert.equal(h.redirects.at(-1),'reload');
});
test('tabs serialize token rotation with Web Locks',async()=>{
 const shared=new Map(),locks=mutex();let refreshes=0;const fetch=async()=>{refreshes++;await tick();return response(200,session('one','rotated'))};
 const a=harness({shared,locks,fetch}),b=harness({shared,locks,fetch});a.api.saveSession(session());await Promise.all([a.api.refresh(),b.api.refresh()]);assert.equal(refreshes,1);assert.equal(a.api.session().refresh_token,'rotated');
});
test('global logout waits for refresh and revokes the latest token',async()=>{
 const shared=new Map(),locks=mutex();let release,logoutHeader;const fetch=async(u,opt)=>{if(u.includes('grant_type'))return new Promise(r=>release=r);logoutHeader=opt.headers.Authorization;return response(204,{})};
 const a=harness({shared,locks,fetch}),b=harness({shared,locks,fetch});a.api.saveSession(session());const refreshing=a.api.refresh();await tick();const logout=b.api.logoutEverywhere();release(response(200,{...session('one','rotated'),access_token:'new-access'}));await Promise.all([refreshing,logout]);assert.equal(logoutHeader,'Bearer new-access');assert.equal(a.api.session(),null);
});
test('failed global logout retains session and surfaces error',async()=>{
 const h=harness({fetch:async()=>response(503,{message:'Service unavailable'})});h.api.saveSession(session());await assert.rejects(h.api.logoutEverywhere(),/Service unavailable/);assert.ok(h.api.session());
});
test('public pages do not poll or force authenticated refresh',async()=>{
 let calls=0;const h=harness({path:'index.html',fetch:async()=>{calls++;return response(200,[])}});await h.api.request('/rest/v1/catalog');assert.equal(calls,1);assert.equal(h.intervals.length,0);
});
