(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const esc=IZZY.esc;
  const q=new URLSearchParams(location.search);
  const isAr=()=>window.IZZY_STORE_I18N?.isArabic?.()===true;
  const local=(en,ar)=>isAr()?ar:en;
  const status=$('#my-stores-status');
  const root=$('#my-stores-list');
  const state={user:null,dropshipper:null,stores:[],products:[]};
  const route=(file,extra={})=>{
    const u=new URL(file,location.href);
    Object.entries(extra).forEach(([k,v])=>u.searchParams.set(k,v));
    if(isAr())u.searchParams.set('lang','ar');
    return u.href;
  };
  const say=(message,bad=false)=>{status.textContent=message||'';status.className='status'+(bad?' bad':'')};
  const dateLabel=value=>{
    if(!value)return '—';
    try{return new Intl.DateTimeFormat(isAr()?'ar-EG':'en-EG',{year:'numeric',month:'short',day:'numeric'}).format(new Date(value));}
    catch{return '—';}
  };
  const storeStatus=s=>s.closed_at?local('Shut down','متوقف'):s.published?local('Published','منشور'):local('Draft','مسودة');
  const storeStatusClass=s=>s.closed_at?'closed':s.published?'live':'';
  function render(){
    $('#create-store-link').href=route('store-create.html');
    if(!state.stores.length){
      root.innerHTML="<div class='store-hub-empty'><div class='store-hub-empty-icon'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.7'><path d='M3 10h18l-2-6H5zM5 10v10h14V10M9 20v-6h6v6'/></svg></div><h2>"+local('Your first store starts here','متجرك الأول يبدأ من هنا')+"</h2><p>"+local('Create a storefront for a niche or brand. You can run multiple independent stores from this same account.','أنشئ متجرًا لعلامة أو مجال مختلف. يمكنك إدارة عدة متاجر مستقلة من الحساب نفسه.')+"</p><a class='btn' href='"+esc(route('store-create.html'))+"'>"+local('Create your first store','أنشئ متجرك الأول')+"</a></div>";
      return;
    }
    root.innerHTML=state.stores.map(s=>{
      const products=state.products.filter(p=>p.store_id===s.id);
      const live=products.filter(p=>p.is_published).length;
      return "<article class='store-hub-card'>"+
        "<div class='store-hub-card-top'><div class='store-hub-card-identity'><div class='store-hub-icon'><svg viewBox='0 0 24 24'><path d='M3 10h18l-2-6H5zM5 10v10h14V10M9 20v-6h6v6'/></svg></div><div><h2>"+esc(s.store_name)+"</h2><div class='store-hub-slug'>"+esc(s.slug)+"</div></div></div><span class='store-hub-status "+storeStatusClass(s)+"'>"+storeStatus(s)+"</span></div>"+
        "<p class='store-hub-description'>"+esc(s.description||local('No store description yet.','لا يوجد وصف للمتجر بعد.'))+"</p>"+
        "<div class='store-hub-stats'><div class='store-hub-stat'><strong>"+products.length+"</strong><span>"+local('Products added','منتجات مضافة')+"</span></div><div class='store-hub-stat'><strong>"+live+"</strong><span>"+local('Listings published','قوائم منشورة')+"</span></div></div>"+
        "<div class='store-hub-card-actions'><a class='btn' href='"+esc(route('store-dashboard.html',{store_id:s.id}))+"'>"+local('Open store dashboard','افتح لوحة المتجر')+"</a><span class='store-hub-card-date'>"+local('Created','تاريخ الإنشاء')+" · "+dateLabel(s.created_at)+"</span></div>"+
      "</article>";
    }).join('');
  }
  async function init(){
    if(!IZZY.session()?.access_token){location.replace('login.html');return;}
    $('#create-store-link').href=route('store-create.html');
    say(local('Loading your stores…','جارٍ تحميل متاجرك…'));
    const user=await IZZY.request('/auth/v1/user');
    state.user=user;
    const ds=await IZZY.request('/rest/v1/dropshippers?select=id,profile_id,status&profile_id=eq.'+encodeURIComponent(user.id)+'&limit=1');
    state.dropshipper=ds?.[0]||null;
    if(!state.dropshipper)throw new Error(local('This account does not have a dropshipper workspace.','هذا الحساب لا يحتوي على مساحة عمل دروبشيبر.'));
    if(state.dropshipper.status!=='active')throw new Error(local('Your dropshipper account must be active to manage stores.','يجب أن يكون حساب الدروبشيبر نشطًا لإدارة المتاجر.'));
    const stores=await IZZY.request('/rest/v1/dropshipper_stores?select=id,store_name,slug,description,published,closed_at,created_at&dropshipper_id=eq.'+encodeURIComponent(state.dropshipper.id)+'&order=created_at.desc');
    state.stores=Array.isArray(stores)?stores:[];
    if(state.stores.length){
      const ids=state.stores.map(s=>encodeURIComponent(s.id)).join(',');
      state.products=await IZZY.request('/rest/v1/dropshipper_store_products?select=id,store_id,is_published&store_id=in.('+ids+')');
    }
    render();say('');
  }
  init().catch(error=>say(local('Could not load your stores. Please refresh and try again.','تعذر تحميل متاجرك. حدّث الصفحة وحاول مرة أخرى.')+' '+(error?.message||''),true));
})();