(() => {
'use strict';
const $=s=>document.querySelector(s), esc=IZZY.esc, clean=v=>String(v??'').trim();
const id=new URLSearchParams(location.search).get('store_id');
const status=$('#dashboard-status'), isArabic=()=>window.IZZY_STORE_I18N?.isArabic?.()===true;
const t=(en,ar)=>isArabic()?ar:en;
const state={store:null,products:[],design:null};
function setStatus(m,bad=false){status.textContent=m||'';status.className='status'+(bad?' bad':'');}
function link(page){const u=new URL(page,location.href);u.searchParams.set('store_id',id);return u.href;}
function publicUrl(){const u=new URL('storefront.html',location.href);u.searchParams.set('slug',state.store.slug);return u.href;}
function render(){
 const s=state.store, closed=!!s.closed_at, published=!!s.published&&!closed;
 const productCount=state.products.length, liveCount=state.products.filter(p=>p.is_published).length;
 $('#dashboard-root').innerHTML="<div class='store-manager-heading'><div><div class='store-manager-eyebrow'>STORE DASHBOARD</div><h1>"+esc(s.store_name)+"</h1><p class='muted'>"+esc(s.description||t('Manage everything about this storefront from here.','أدر كل ما يتعلق بهذا المتجر من هنا.'))+"</p></div><span class='tag "+(closed?'off':published?'ok':'')+"'>"+(closed?t('Closed','مغلق'):published?t('Published','منشور'):t('Draft','مسودة'))+"</span></div>"+
"<div class='store-dashboard-grid'>"+
"<article class='card store-dashboard-info'><h2>"+t('Store information','معلومات المتجر')+"</h2><dl><div><dt>"+t('Store name','اسم المتجر')+"</dt><dd>"+esc(s.store_name)+"</dd></div><div><dt>"+t('Store link','رابط المتجر')+"</dt><dd><code>/"+esc(s.slug)+"</code></dd></div><div><dt>"+t('Products','المنتجات')+"</dt><dd>"+productCount+"</dd></div><div><dt>"+t('Visible products','المنتجات الظاهرة')+"</dt><dd>"+liveCount+"</dd></div><div><dt>"+t('Created','تاريخ الإنشاء')+"</dt><dd>"+new Date(s.created_at).toLocaleDateString(isArabic()?'ar-EG':'en-EG')+"</dd></div></dl></article>"+
"<article class='card store-dashboard-actions'><h2>"+t('Manage store','إدارة المتجر')+"</h2><div class='dashboard-action-list'><a class='btn' href='"+link('store-design.html')+"'>"+t('Edit store design','تعديل تصميم المتجر')+"</a><a class='btn secondary' href='"+link('store-manager.html')+"'>"+t('Manage products','إدارة المنتجات')+"</a><a class='btn secondary' href='"+publicUrl()+"' target='_blank' rel='noopener'>"+t('Preview storefront','معاينة المتجر')+" ↗</a></div></article>"+
"</div><div class='card store-dashboard-danger'><h2>"+t('Store status','حالة المتجر')+"</h2><p class='muted'>"+(closed?t('This store is closed. Its products and design are preserved. You can reactivate it at any time.','هذا المتجر مغلق. تم الاحتفاظ بمنتجاته وتصميمه ويمكنك إعادة تفعيله في أي وقت.'):t('Closing a store unpublishes it but does not delete its products or design.','إغلاق المتجر يلغي نشره لكنه لا يحذف المنتجات أو التصميم.'))+"</p><div class='store-profile-actions'>"+(closed?"<button class='btn' id='reactivate-store'>"+t('Reactivate store','إعادة تفعيل المتجر')+"</button>":"<button class='btn secondary' id='close-store'>"+t('Shut down store','إغلاق المتجر')+"</button>")+"<a class='btn secondary' href='my-stores.html'>"+t('Create or manage another store','إنشاء أو إدارة متجر آخر')+"</a></div></div>";
 $('#close-store')?.addEventListener('click',()=>setClosed(true));$('#reactivate-store')?.addEventListener('click',()=>setClosed(false));
}
async function setClosed(closed){
 const msg=closed?t('Shut down this store? Customers will no longer see it, but your products and design will remain saved.','إغلاق هذا المتجر؟ لن يراه العملاء، لكن سيتم الاحتفاظ بمنتجاتك وتصميمك.'):t('Reactivate this store?','إعادة تفعيل هذا المتجر؟');
 if(!confirm(msg))return;
 try{
  const payload=closed?{published:false,closed_at:new Date().toISOString()}:{closed_at:null,published:true};
  await IZZY.request('/rest/v1/dropshipper_stores?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(payload)});
  state.store={...state.store,...payload};render();setStatus(closed?t('Store shut down.','تم إغلاق المتجر.'):t('Store reactivated.','تمت إعادة تفعيل المتجر.'));
 }catch(e){setStatus(e.message||t('Could not update the store status.','تعذر تحديث حالة المتجر.'),true);}
}
async function load(){
 try{
  if(!id){location.replace('my-stores.html');return;}
  const user=await IZZY.request('/auth/v1/user');if(!user?.id)throw Error(t('Please sign in again.','يرجى تسجيل الدخول مرة أخرى.'));
  const ds=await IZZY.request('/rest/v1/dropshippers?select=id,status&profile_id=eq.'+encodeURIComponent(user.id)+'&limit=1');const d=ds?.[0];if(!d)throw Error(t('Dropshipper workspace not found.','لم يتم العثور على مساحة عمل dropshipper.'));
  const rows=await IZZY.request('/rest/v1/dropshipper_stores?select=*&id=eq.'+encodeURIComponent(id)+'&dropshipper_id=eq.'+encodeURIComponent(d.id)+'&limit=1');state.store=rows?.[0];if(!state.store)throw Error(t('Store not found.','لم يتم العثور على المتجر.'));
  state.products=await IZZY.request('/rest/v1/dropshipper_store_products?select=id,is_published&store_id=eq.'+encodeURIComponent(id));
  render();setStatus('');
 }catch(e){setStatus(e.message||t('Could not load this store.','تعذر تحميل هذا المتجر.'),true);}
}
load();
})();