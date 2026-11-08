(() => {
'use strict';
const $=s=>document.querySelector(s), clean=v=>String(v??'').trim();
const state={session:IZZY.session(),dropshipper:null,stores:[]};
const status=$('#stores-status');
const isArabic=()=>window.IZZY_STORE_I18N?.isArabic?.()===true;
const t=(en,ar)=>isArabic()?ar:en;
function setStatus(msg,bad=false){status.textContent=msg||'';status.className='status'+(bad?' bad':'');}
function storeUrl(slug){const u=new URL('storefront.html',location.href);u.searchParams.set('slug',slug);return u.href;}
function dashboardUrl(id){const u=new URL('store-dashboard.html',location.href);u.searchParams.set('store_id',id);return u.href;}
function designUrl(id){const u=new URL('store-design.html',location.href);u.searchParams.set('store_id',id);return u.href;}
function render(){
 const root=$('#stores-grid');
 if(!state.stores.length){root.innerHTML="<div class='store-manager-empty my-stores-empty'><h3>"+t('No stores yet','لا توجد متاجر بعد')+"</h3><p>"+t('Create your first store to start building your storefront.','أنشئ متجرك الأول وابدأ في بناء واجهتك.')+"</p><button class='btn' data-create>"+t('Create your first store','أنشئ متجرك الأول')+"</button></div>";root.querySelector('[data-create]').onclick=showCreate;return;}
 root.innerHTML=state.stores.map(s=>{
   const closed=!!s.closed_at, published=!!s.published&&!closed;
   const badge=closed?t('Closed','مغلق'):(published?t('Published','منشور'):t('Draft','مسودة'));
   const cls=closed?'off':(published?'ok':'');
   return "<article class='my-store-card'><div class='my-store-card-top'><div class='my-store-avatar'>"+IZZY.esc((s.store_name||'S').slice(0,1).toUpperCase())+"</div><span class='tag "+cls+"'>"+badge+"</span></div><h2>"+IZZY.esc(s.store_name)+"</h2><p class='muted'>/"+IZZY.esc(s.slug)+"</p><p>"+IZZY.esc(s.description||t('No description yet.','لا يوجد وصف بعد.'))+"</p><div class='my-store-card-actions'><a class='btn' href='"+dashboardUrl(s.id)+"'>"+t('Manage store','إدارة المتجر')+"</a><a class='btn secondary' href='"+storeUrl(s.slug)+"' target='_blank' rel='noopener'>"+t('View store','عرض المتجر')+" ↗</a></div></article>";
 }).join('');
}
function showCreate(){$('#create-store-panel').hidden=false;$('#stores-overview').querySelector('.store-manager-heading').scrollIntoView({behavior:'smooth'});$('#new-store-name').focus();}
function hideCreate(){$('#create-store-panel').hidden=true;}
async function load(){
 try{
  setStatus(t('Loading your stores…','جارٍ تحميل متاجرك…'));
  const user=await IZZY.request('/auth/v1/user'); if(!user?.id)throw Error(t('Please sign in again.','يرجى تسجيل الدخول مرة أخرى.'));
  const ds=await IZZY.request('/rest/v1/dropshippers?select=id,status&profile_id=eq.'+encodeURIComponent(user.id)+'&limit=1');
  state.dropshipper=ds?.[0]; if(!state.dropshipper)throw Error(t('This account does not have a dropshipper workspace yet.','هذا الحساب لا يحتوي على مساحة عمل dropshipper بعد.'));
  if(state.dropshipper.status!=='active')throw Error(t('Your dropshipper account must be active before you can create a store.','يجب تفعيل حساب dropshipper قبل إنشاء متجر.'));
  state.stores=await IZZY.request('/rest/v1/dropshipper_stores?select=*&dropshipper_id=eq.'+encodeURIComponent(state.dropshipper.id)+'&order=created_at.desc');
  render();setStatus('');
 }catch(e){setStatus(e.message||t('Could not load your stores.','تعذر تحميل متاجرك.'),true);}
}
async function create(e){
 e.preventDefault();
 const name=clean($('#new-store-name').value), slug=clean($('#new-store-slug').value).toLowerCase(), description=clean($('#new-store-description').value);
 if(name.length<2)return setStatus(t('Enter a store name with at least 2 characters.','اكتب اسم متجر من حرفين على الأقل.'),true);
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return setStatus(t('Use lowercase letters, numbers and hyphens for the store link.','استخدم الحروف الإنجليزية الصغيرة والأرقام والشرطات في رابط المتجر.'),true);
 const reserved=/^(admin|app|api|assets|auth|login|logout|products|product|settings|store|storefront|store-manager|supplier|suppliers|checkout|orders|help|about)$/;
 if(reserved.test(slug))return setStatus(t('Choose a different store link.','اختر رابط متجر مختلفًا.'),true);
 $('#create-store-submit').disabled=true;setStatus(t('Creating your store…','جارٍ إنشاء متجرك…'));
 try{
  const row=await IZZY.request('/rest/v1/dropshipper_stores',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({dropshipper_id:state.dropshipper.id,store_name:name,slug,description,published:false})});
  const store=Array.isArray(row)?row[0]:row;
  if(!store?.id)throw Error(t('The store could not be created.','تعذر إنشاء المتجر.'));
  location.href=designUrl(store.id);
 }catch(e){setStatus(e.message||t('Could not create your store. The store link may already be in use.','تعذر إنشاء المتجر. ربما رابط المتجر مستخدم بالفعل.'),true);$('#create-store-submit').disabled=false;}
}
$('#create-store-btn').onclick=showCreate;$('#cancel-create-store').onclick=hideCreate;$('#create-store-form').addEventListener('submit',create);
$('#new-store-name').addEventListener('input',e=>{if(!$('#new-store-slug').dataset.edited)$('#new-store-slug').value=e.target.value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48);});
$('#new-store-slug').addEventListener('input',e=>e.target.dataset.edited='1');
load();
})();