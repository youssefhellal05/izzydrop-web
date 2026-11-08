(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const clean=v=>String(v??'').trim();
  const isAr=()=>window.IZZY_STORE_I18N?.isArabic?.()===true;
  const local=(en,ar)=>isAr()?ar:en;
  const params=new URLSearchParams(location.search);
  const storeId=params.get('store_id');
  const state={user:null,dropshipper:null,store:null,products:[],hasDesign:false};
  const msg=$('#store-dashboard-status-message'),actionMsg=$('#dashboard-action-status');
  const route=(file,extra={})=>{const u=new URL(file,location.href);Object.entries(extra).forEach(([k,v])=>u.searchParams.set(k,v));if(isAr())u.searchParams.set('lang','ar');return u.href};
  const setMsg=(el,text,bad=false)=>{el.textContent=text||'';el.className='status'+(bad?' bad':'')};
  const statusOf=s=>s.closed_at?local('Shut down','متوقف'):s.published?local('Published','منشور'):local('Draft','مسودة');
  const statusClass=s=>s.closed_at?'closed':s.published?'live':'';
  const formatDate=value=>{try{return new Intl.DateTimeFormat(isAr()?'ar-EG':'en-EG',{year:'numeric',month:'long',day:'numeric'}).format(new Date(value))}catch{return '—'}};
  const storeUrl=()=>{const u=new URL('storefront.html',location.href);u.searchParams.set('slug',state.store.slug);return u.href};
  function setLinks(){
    const q={store_id:state.store.id};
    $('#dashboard-my-stores').href=route('my-stores.html');
    $('#dashboard-back').href=route('my-stores.html');
    $('#dashboard-edit-details').href=route('store-manager.html',q);
    $('#dashboard-edit-design').href=route('store-design.html',q);
    $('#dashboard-manage-products').href=route('store-manager.html',q)+'#store-listings-section';
    $('#dashboard-create-another').href=route('store-create.html');
  }
  function render(){
    const s=state.store, url=storeUrl(),products=state.products;
    $('#dashboard-store-name').textContent=s.store_name;
    $('#dashboard-store-description').textContent=s.description||local('Manage your storefront, design and products here.','أدر متجرك وتصميمه ومنتجاته من هنا.');
    const badge=$('#dashboard-store-status');badge.textContent=statusOf(s);badge.className='store-dashboard-status '+statusClass(s);
    $('#dashboard-store-url').textContent=url;
    $('#dashboard-created-date').textContent=local('Created','تاريخ الإنشاء')+' · '+formatDate(s.created_at);
    $('#dashboard-product-count').textContent=products.length;
    $('#dashboard-live-count').textContent=products.filter(p=>p.is_published).length;
    $('#dashboard-design-status').textContent=state.hasDesign?local('Customized','مخصص'):local('Not customized','لم يتم تخصيصه');
    const view=$('#dashboard-view-store');view.href=url;view.hidden=!s.published||!!s.closed_at;
    const lifecycle=$('#dashboard-lifecycle-action');
    if(s.closed_at){$('#dashboard-lifecycle-title').textContent=local('Reactivate your store','إعادة تفعيل المتجر');$('#dashboard-lifecycle-copy').textContent=local('Your store is hidden from customers. Reactivate it when you are ready to publish it again.','متجرك مخفي عن العملاء. أعد تفعيله عندما تكون مستعدًا لنشره مرة أخرى.');lifecycle.textContent=local('Reactivate store','إعادة تفعيل المتجر');lifecycle.className='btn';}
    else if(s.published){$('#dashboard-lifecycle-title').textContent=local('Shut down your store','إيقاف المتجر');$('#dashboard-lifecycle-copy').textContent=local('Customers will no longer be able to open the storefront. Your products and design will be kept.','لن يتمكن العملاء من فتح المتجر. ستظل منتجاتك وتصميمك محفوظين.');lifecycle.textContent=local('Shut down store','إيقاف المتجر');lifecycle.className='btn danger';}
    else{$('#dashboard-lifecycle-title').textContent=local('Publish your store','نشر المتجر');$('#dashboard-lifecycle-copy').textContent=local('Your store is a draft. Publish it when your details, design and product listings are ready.','متجرك محفوظ كمسودة. انشره عندما تكون التفاصيل والتصميم والمنتجات جاهزة.');lifecycle.textContent=local('Publish store','نشر المتجر');lifecycle.className='btn';}
    setLinks();
    $('#store-dashboard-content').hidden=false;
    $('#store-dashboard-loading').hidden=true;
  }
  async function load(){
    if(!storeId){location.replace(route('my-stores.html'));return;}
    if(!IZZY.session()?.access_token){location.replace('login.html');return;}
    setMsg(msg,local('Loading store dashboard…','جارٍ تحميل لوحة المتجر…'));
    const user=await IZZY.request('/auth/v1/user');state.user=user;
    const ds=await IZZY.request('/rest/v1/dropshippers?select=id,profile_id,status&profile_id=eq.'+encodeURIComponent(user.id)+'&limit=1');
    state.dropshipper=ds?.[0]||null;
    if(!state.dropshipper||state.dropshipper.status!=='active')throw new Error(local('An active dropshipper workspace is required.','يلزم وجود مساحة عمل دروبشيبر نشطة.'));
    const stores=await IZZY.request('/rest/v1/dropshipper_stores?select=id,dropshipper_id,store_name,slug,description,published,closed_at,created_at,updated_at&id=eq.'+encodeURIComponent(storeId)+'&dropshipper_id=eq.'+encodeURIComponent(state.dropshipper.id)+'&limit=1');
    state.store=stores?.[0]||null;
    if(!state.store)throw new Error(local('This store could not be found in your account.','لم يتم العثور على هذا المتجر ضمن حسابك.'));
    state.products=await IZZY.request('/rest/v1/dropshipper_store_products?select=id,is_published&store_id=eq.'+encodeURIComponent(storeId));
    const designs=await IZZY.request('/rest/v1/dropshipper_store_designs?select=store_id&store_id=eq.'+encodeURIComponent(storeId)+'&limit=1');
    state.hasDesign=!!designs?.length;
    render();setMsg(msg,'');
  }
  async function lifecycleAction(){
    const s=state.store,closed=!!s.closed_at,published=s.published===true;
    const prompt=closed?local('Reactivate and publish this store? Customers will be able to visit it again.','هل تريد إعادة تفعيل المتجر ونشره؟ سيتمكن العملاء من زيارته مرة أخرى.')
      :published?local('Shut down this store? Its public link will stop working, but its products and design will be kept.','هل تريد إيقاف المتجر؟ سيتوقف الرابط العام عن العمل، مع الاحتفاظ بالمنتجات والتصميم.')
      :local('Publish this store now? Customers will be able to visit its public link.','هل تريد نشر المتجر الآن؟ سيتمكن العملاء من زيارة رابطه العام.');
    if(!confirm(prompt))return;
    const button=$('#dashboard-lifecycle-action');button.disabled=true;
    setMsg(actionMsg,local('Updating store status…','جارٍ تحديث حالة المتجر…'));
    try{
      const next=closed||!published
        ? {published:true,closed_at:null,updated_at:new Date().toISOString()}
        : {published:false,closed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      const rows=await IZZY.request('/rest/v1/dropshipper_stores?id=eq.'+encodeURIComponent(s.id)+'&dropshipper_id=eq.'+encodeURIComponent(state.dropshipper.id),{
        method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(next)
      });
      if(!rows?.length)throw new Error(local('The store status was not updated. Refresh and try again.','لم يتم تحديث حالة المتجر. حدّث الصفحة وحاول مرة أخرى.'));
      state.store=rows[0];render();setMsg(actionMsg,local('Store status updated.','تم تحديث حالة المتجر.'));
    }catch(error){setMsg(actionMsg,error?.message||local('Could not update this store.','تعذر تحديث المتجر.'),true);}
    finally{button.disabled=false;}
  }
  $('#dashboard-lifecycle-action').addEventListener('click',lifecycleAction);
  $('#dashboard-copy-link').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText($('#dashboard-store-url').textContent);setMsg(actionMsg,local('Store link copied.','تم نسخ رابط المتجر.'));}
    catch{setMsg(actionMsg,local('Could not copy the store link.','تعذر نسخ رابط المتجر.'),true);}
  });
  load().catch(error=>{setMsg(msg,error?.message||local('Could not load your store.','تعذر تحميل المتجر.'),true);$('#store-dashboard-loading').textContent=local('Return to My Stores and open a store from your list.','عُد إلى صفحة متاجري وافتح متجرًا من القائمة.');});
})();