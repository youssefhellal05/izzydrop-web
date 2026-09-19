(()=>{
  const C=window.IZZY_CONFIG;
  const KEY='izzy_session';
  const jsonHeaders=(token)=>({apikey:C.supabaseKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})});
  async function readJson(r){const t=await r.text();if(!t)return null;try{return JSON.parse(t)}catch{return {text:t}}}
  async function request(path,opt={}){
    const session=IZZY.session();
    let r=await fetch(C.supabaseUrl+path,{...opt,headers:{...jsonHeaders(session?.access_token),...(opt.headers||{})}});
    if(r.status===401&&session?.refresh_token){
      const ok=await IZZY.refresh();
      if(ok){const s=IZZY.session();r=await fetch(C.supabaseUrl+path,{...opt,headers:{...jsonHeaders(s?.access_token),...(opt.headers||{})}})}
    }
    const d=await readJson(r);
    if(!r.ok)throw Error(d?.message||d?.error_description||d?.error||d?.text||'Request failed');
    return d;
  }
  window.IZZY={
    config:C,
    session(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}},
    saveSession(s){localStorage.setItem(KEY,JSON.stringify(s))},
    logout(){localStorage.removeItem(KEY)},
    async refresh(){const s=this.session();if(!s?.refresh_token)return false;const r=await fetch(C.supabaseUrl+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:jsonHeaders(),body:JSON.stringify({refresh_token:s.refresh_token})});if(!r.ok)return false;this.saveSession(await r.json());return true},
    async login(email,password){const r=await fetch(C.supabaseUrl+'/auth/v1/token?grant_type=password',{method:'POST',headers:jsonHeaders(),body:JSON.stringify({email,password})});const d=await readJson(r);if(!r.ok)throw Error(d?.error_description||d?.message||'Login failed');this.saveSession(d);return d},
    async signup({email,password,fullName,businessName,type}){const r=await fetch(C.supabaseUrl+'/auth/v1/signup',{method:'POST',headers:jsonHeaders(),body:JSON.stringify({email,password,data:{full_name:fullName,business_name:businessName,requested_account_type:type}})});const d=await readJson(r);if(!r.ok)throw Error(d?.msg||d?.message||d?.error_description||'Sign up failed');if(d?.access_token)this.saveSession(d);return d},
    request,
    async rpc(name,args={},auth=true){if(auth)return request(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(args)});const r=await fetch(C.supabaseUrl+`/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:C.supabaseKey,'Content-Type':'application/json'},body:JSON.stringify(args)});const d=await readJson(r);if(!r.ok)throw Error(d?.message||d?.error||d?.text||'Request failed');return d},
    esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))},
    money(n,c='EGP'){try{return new Intl.NumberFormat('en-EG',{style:'currency',currency:c||'EGP'}).format(Number(n||0))}catch{return `${n||0} ${c||'EGP'}`}},
    productUrl(slug){return `${location.origin}${location.pathname.replace(/[^/]*$/,'')}product.html?slug=${encodeURIComponent(slug)}`}
  };
})();