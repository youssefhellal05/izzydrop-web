(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const clean=v=>String(v??'').trim();
  const isAr=()=>window.IZZY_STORE_I18N?.isArabic?.()===true;
  const local=(en,ar)=>isAr()?ar:en;
  const slugify=v=>clean(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48).replace(/-+$/g,'');
  const route=(file,extra={})=>{const u=new URL(file,location.href);Object.entries(extra).forEach(([k,v])=>u.searchParams.set(k,v));if(isAr())u.searchParams.set('lang','ar');return u.href};
  const status=$('#create-store-status');
  const setStatus=(m,bad=false)=>{status.textContent=m||'';status.className='status'+(bad?' bad':'')};
  const reserved=new Set(['admin','app','api','assets','auth','login','logout','products','product','settings','store','storefront','store-manager','supplier','suppliers','checkout','orders','help','about','my-stores','store-create','store-dashboard']);
  $('#back-to-stores').href=route('my-stores.html');
  $('#create-back-link').href=route('my-stores.html');
  let nameTouched=false;
  $('#new-store-name').addEventListener('input',()=>{
    if(!nameTouched)$('#new-store-slug').value=slugify($('#new-store-name').value);
  });
  $('#new-store-slug').addEventListener('input',()=>{
    nameTouched=true;
    $('#new-store-slug').value=slugify($('#new-store-slug').value);
  });
  $('#create-store-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const button=$('#create-store-submit');
    const name=clean($('#new-store-name').value);
    const slug=slugify($('#new-store-slug').value);
    const description=clean($('#new-store-description').value);
    if(name.length<2||name.length>80)return setStatus(local('Enter a store name between 2 and 80 characters.','أدخل اسم متجر يتراوح بين حرفين و80 حرفًا.'),true);
    if(slug.length<2||slug.length>48||reserved.has(slug))return setStatus(local('Choose a different store link. Use lowercase English letters, numbers and hyphens.','اختر رابطًا آخر باستخدام أحرف إنجليزية صغيرة وأرقام وشرطات.'),true);
    button.disabled=true;
    button.textContent=local('Creating your store…','جارٍ إنشاء متجرك…');
    setStatus(local('Saving your store as a draft…','جارٍ حفظ متجرك كمسودة…'));
    try{
      if(!IZZY.session()?.access_token){location.replace('login.html');return;}
      const user=await IZZY.request('/auth/v1/user');
      const ds=await IZZY.request('/rest/v1/dropshippers?select=id,profile_id,status&profile_id=eq.'+encodeURIComponent(user.id)+'&limit=1');
      const dropshipper=ds?.[0];
      if(!dropshipper)throw new Error(local('This account does not have a dropshipper workspace.','هذا الحساب لا يحتوي على مساحة عمل دروبشيبر.'));
      if(dropshipper.status!=='active')throw new Error(local('Your dropshipper account must be active before creating a store.','يجب أن يكون حساب الدروبشيبر نشطًا قبل إنشاء متجر.'));
      const result=await IZZY.request('/rest/v1/dropshipper_stores',{
        method:'POST',headers:{Prefer:'return=representation'},
        body:JSON.stringify({dropshipper_id:dropshipper.id,store_name:name,slug,description,published:false})
      });
      const store=Array.isArray(result)?result[0]:result;
      if(!store?.id)throw new Error(local('The store was created but its ID could not be confirmed. Open My Stores and continue from there.','تم إنشاء المتجر، لكن تعذر تأكيد رقمه. افتح صفحة متاجري للمتابعة.'));
      location.assign(route('store-design.html',{store_id:store.id}));
    }catch(error){
      const raw=clean(error?.message);
      const duplicate=/duplicate key|unique constraint|dropshipper_stores_slug/i.test(raw);
      setStatus(duplicate?local('That store link is already in use. Choose another one.','رابط المتجر مستخدم بالفعل. اختر رابطًا آخر.'):raw||local('Could not create the store. Please try again.','تعذر إنشاء المتجر. حاول مرة أخرى.'),true);
      button.disabled=false;
      button.textContent=local('Continue to store design →','المتابعة إلى تصميم المتجر ←');
    }
  });
})();