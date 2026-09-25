(()=>{
  const C=window.IZZY_CONFIG;
  const KEY='izzy_session';
  const THEME_KEY='izzy_theme';
  const savedTheme=localStorage.getItem(THEME_KEY)==='dark'?'dark':'light';
  document.documentElement.dataset.theme=savedTheme;
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
    theme(){return document.documentElement.dataset.theme||'light'},
    setTheme(theme){const next=theme==='dark'?'dark':'light';localStorage.setItem(THEME_KEY,next);document.documentElement.dataset.theme=next;const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',next==='dark'?'#0b0d10':'#111318');return next},
    session(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}},
    saveSession(s){localStorage.setItem(KEY,JSON.stringify(s))},
    logout(){localStorage.removeItem(KEY)},
    async refresh(){const s=this.session();if(!s?.refresh_token)return false;const r=await fetch(C.supabaseUrl+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:jsonHeaders(),body:JSON.stringify({refresh_token:s.refresh_token})});if(!r.ok)return false;this.saveSession(await r.json());return true},
    async login(email,password){const r=await fetch(C.supabaseUrl+'/auth/v1/token?grant_type=password',{method:'POST',headers:jsonHeaders(),body:JSON.stringify({email,password})});const d=await readJson(r);if(!r.ok)throw Error(d?.error_description||d?.message||'Login failed');this.saveSession(d);return d},
    async consumeAuthRedirect(){const raw=location.hash.startsWith('#')?location.hash.slice(1):'';if(!raw)return null;const p=new URLSearchParams(raw);const access_token=p.get('access_token'),refresh_token=p.get('refresh_token'),type=p.get('type');if(!access_token)return null;const ur=await fetch(C.supabaseUrl+'/auth/v1/user',{headers:jsonHeaders(access_token)});const user=await readJson(ur);if(!ur.ok)throw Error(user?.message||'Could not open invite');const session={access_token,refresh_token,token_type:p.get('token_type')||'bearer',expires_in:Number(p.get('expires_in')||3600),user};this.saveSession(session);history.replaceState({},document.title,location.pathname+location.search);return {type,session}},
    async requestPasswordReset(email){
      const address=String(email||'').trim();
      if(!address)throw Error('Enter your email address.');
      const redirectTo=new URL('login.html',location.href).href;
      const r=await fetch(C.supabaseUrl+'/auth/v1/recover?redirect_to='+encodeURIComponent(redirectTo),{
        method:'POST',
        headers:jsonHeaders(),
        body:JSON.stringify({email:address})
      });
      const d=await readJson(r);
      if(!r.ok)throw Error(d?.message||d?.error_description||'Could not send recovery email');
      return d;
    },
    async updatePassword(password){const s=this.session();if(!s?.access_token)throw Error('Your session has expired. Please log in again.');const r=await fetch(C.supabaseUrl+'/auth/v1/user',{method:'PUT',headers:jsonHeaders(s.access_token),body:JSON.stringify({password})});const d=await readJson(r);if(!r.ok)throw Error(d?.message||d?.error_description||'Could not set password');s.user=d;this.saveSession(s);return d},
    async updateEmail(email){const s=this.session();if(!s?.access_token)throw Error('Your session has expired. Please log in again.');const redirectTo=new URL('login.html',location.href).href;const r=await fetch(C.supabaseUrl+'/auth/v1/user?redirect_to='+encodeURIComponent(redirectTo),{method:'PUT',headers:jsonHeaders(s.access_token),body:JSON.stringify({email})});const d=await readJson(r);if(!r.ok)throw Error(d?.message||d?.error_description||'Could not update email');if(d?.email===email){s.user=d;this.saveSession(s)}return d},
    async logoutEverywhere(){const s=this.session();if(!s?.access_token){this.logout();return}const r=await fetch(C.supabaseUrl+'/auth/v1/logout?scope=global',{method:'POST',headers:{apikey:C.supabaseKey,Authorization:`Bearer ${s.access_token}`}});if(!r.ok){const d=await readJson(r);throw Error(d?.message||d?.error_description||'Could not sign out all devices')}this.logout()},
    request,
    async uploadProductImage(path,file){
      const s=this.session();if(!s?.access_token)throw Error('Please log in.');
      const parts=String(path).split('/');
      parts[0]=s.user?.id||parts[0];
      const clean=parts.map(encodeURIComponent).join('/');
      let res=await fetch(C.supabaseUrl+'/storage/v1/object/product-images/'+clean,{
        method:'POST',
        headers:{apikey:C.supabaseKey,Authorization:`Bearer ${s.access_token}`,'Content-Type':file.type||'application/octet-stream','x-upsert':'false'},
        body:file
      });
      if(res.status===401&&s.refresh_token){
        const ok=await this.refresh();
        if(ok){const ns=this.session();res=await fetch(C.supabaseUrl+'/storage/v1/object/product-images/'+clean,{method:'POST',headers:{apikey:C.supabaseKey,Authorization:`Bearer ${ns.access_token}`,'Content-Type':file.type||'application/octet-stream','x-upsert':'false'},body:file})}
      }
      const d=await readJson(res);if(!res.ok)throw Error(d?.message||d?.error||'Image upload failed');
      return C.supabaseUrl+'/storage/v1/object/public/product-images/'+clean;
    },
    async deleteProductImage(path){
      const s=this.session();if(!s?.access_token)return;
      await fetch(C.supabaseUrl+'/storage/v1/object/product-images',{
        method:'DELETE',
        headers:jsonHeaders(s.access_token),
        body:JSON.stringify({prefixes:[String(path)]})
      }).catch(()=>{});
    },
    async rpc(name,args={},auth=true){if(auth)return request(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(args)});const r=await fetch(C.supabaseUrl+`/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:C.supabaseKey,'Content-Type':'application/json'},body:JSON.stringify(args)});const d=await readJson(r);if(!r.ok)throw Error(d?.message||d?.error||d?.text||'Request failed');return d},
    esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))},
    money(n,c='EGP'){try{return new Intl.NumberFormat('en-EG',{style:'currency',currency:c||'EGP'}).format(Number(n||0))}catch{return `${n||0} ${c||'EGP'}`}},
    productUrl(slug){return `${location.origin}${location.pathname.replace(/[^/]*$/,'')}product.html?slug=${encodeURIComponent(slug)}`}
  };

  function installPasswordToggles(){
    document.querySelectorAll('input[type="password"]').forEach(input=>{
      if(input.dataset.eyeReady)return;
      input.dataset.eyeReady='1';
      const wrap=document.createElement('div');
      wrap.className='password-field';
      input.parentNode.insertBefore(wrap,input);
      wrap.appendChild(input);
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='password-eye';
      btn.setAttribute('aria-label','Show password');
      btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>';
      btn.onclick=()=>{const show=input.type==='password';input.type=show?'text':'password';btn.classList.toggle('on',show);btn.setAttribute('aria-label',show?'Hide password':'Show password')};
      wrap.appendChild(btn);
    });
  }

  function installSupplierVariantFlowSeparation(){
    const choice=document.getElementById('variant-choice-card');
    const simple=document.getElementById('simple-product-stock-field');
    const builder=document.getElementById('variant-builder-card');
    if(!choice||!simple||!builder||document.getElementById('variant-flow-entry'))return;
    choice.hidden=true;
    const entry=document.createElement('div');
    entry.id='variant-flow-entry';
    entry.className='card';
    entry.style.marginTop='16px';
    entry.innerHTML='<div class="row"><div><b>Does this product have multiple variants?</b><small>Only use this for products with choices like color, size, model, storage, or material.</small></div><button type="button" class="btn secondary" id="open-variant-flow">Create variant product</button></div>';
    simple.insertAdjacentElement('afterend',entry);
    const back=document.createElement('button');
    back.id='back-to-simple-product';
    back.type='button';
    back.className='btn secondary';
    back.style.marginBottom='16px';
    back.textContent='Back to single product';
    builder.insertBefore(back,builder.firstChild);
    const sync=()=>{
      const variantsOn=!builder.hidden;
      entry.hidden=variantsOn;
      back.hidden=!variantsOn;
    };
    entry.querySelector('#open-variant-flow').onclick=()=>{
      choice.querySelector('[data-product-version-mode="options"]')?.click();
      sync();
      builder.scrollIntoView({behavior:'smooth',block:'start'});
    };
    back.onclick=()=>{
      choice.querySelector('[data-product-version-mode="single"]')?.click();
      sync();
      simple.scrollIntoView({behavior:'smooth',block:'center'});
    };
    const observer=new MutationObserver(sync);
    observer.observe(builder,{attributes:true,attributeFilter:['hidden']});
    sync();
  }

  IZZY.installPasswordToggles=installPasswordToggles;
  installPasswordToggles();
  installSupplierVariantFlowSeparation();
})();