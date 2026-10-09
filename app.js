(()=>{
  const $=s=>document.querySelector(s);
  let PRODUCTS=[],LINKED_PRODUCTS=[],LINKS=[],INTEGRATIONS=[],INTEGRATION_VARIANTS=[],ORDERS=[],ITEMS=[],SOURCING_BOARD={},SAMPLES=[],ALERTS=[],SETTLEMENTS=[],COD={},SHIPPING={},PRICE_RANGES=[],ORDER_VARIANTS=[],SESSION=null,DROPSHIPPER=null,ORDER_FILTER='all',CURRENT_WEB_TOKEN=null,ORDER_HAS_MORE=false,ALERT_HAS_MORE=false,ALERT_METRICS={};
  const ORDER_PAGE_SIZE=50;
  const ALERT_PAGE_SIZE=25;

  const VIEW_COPY={
    products:['Products','Find products to sell.'],
    linked:['My products','Products you chose to sell.'],
    orders:['Orders','Create and track customer orders.'],
    money:['Money','Track actual COD profit and payout status.'],
    requests:['Sourcing requests','Products the community wants suppliers to find.'],
    sourced:['Sourced products','Real published products linked to community sourcing requests.'],
    samples:['Samples','Track product samples.'],
    settings:['Settings','Account and preferences.']
  };

  const productName=p=>window.IZZY_I18N?.productName(p)||p?.name||'';
  const productDescription=p=>window.IZZY_I18N?.productDescription(p)||p?.description||'';
  const ar=()=>window.IZZY_I18N?.isArabic?.()===true;
  const local=(en,arText)=>ar()?arText:en;
  const localizeStaticDropshipperFields=()=>{
    const productSearch=$('#product-search');
    if(productSearch)productSearch.placeholder=local('Search products','ابحث عن المنتجات');
  };
  localizeStaticDropshipperFields();
  const publicSupplierName=name=>{
    const value=String(name||'').trim();
    const looksLikeEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return !value||looksLikeEmail?local('IzzyDrop Supplier','مورّد IzzyDrop'):value;
  };
  const variantLabel=v=>{
    const entries=Object.entries(v?.option_values||v?.options||{}).filter(([,value])=>String(value??'').trim());
    return entries.length?entries.map(([name,value])=>`${name}: ${value}`).join(' · '):(v?.variant_name||v?.name||v?.sku||'Default');
  };
  const priceRangeFor=id=>PRICE_RANGES.find(x=>String(x.product_id)===String(id))||null;
  const rangeMoney=(min,max,currency='EGP')=>{
    const a=Number(min),b=Number(max);
    if(!Number.isFinite(a)&&!Number.isFinite(b))return '—';
    if(!Number.isFinite(b)||a===b)return IZZY.money(Number.isFinite(a)?a:b,currency);
    return `${IZZY.money(a,currency)} – ${IZZY.money(b,currency)}`;
  };

  const status=(t,b=false)=>{
    const e=$('#dash-status');
    if(!e)return;
    e.textContent=t||'';
    e.className='status'+(b?' bad':'');
  };

  function go(v){
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===v));
    document.querySelectorAll('.view').forEach(x=>x.hidden=true);
    const panel=$('#view-'+v);
    if(panel)panel.hidden=false;
    const copy=VIEW_COPY[v]||VIEW_COPY.products;
    $('#page-title').textContent=copy[0];
    $('#page-subtitle').textContent=copy[1];
    const more=document.querySelector('.dropshipper-more');
    if(more){
      more.classList.toggle('has-active',['samples','settings'].includes(v));
      if(!['samples','settings'].includes(v))more.open=false;
    }
    status('');
  }

  function skeletonCards(count=6){
    return Array.from({length:count},()=>'<div class="card skeleton-card"><div class="skeleton skeleton-image"></div><div class="skeleton-body"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line medium"></div><div class="skeleton skeleton-button"></div></div></div>').join('');
  }

  function setLoading(){
    $('#products').innerHTML=skeletonCards(6);
    $('#linked').innerHTML=skeletonCards(3);
    $('#orders').innerHTML=skeletonCards(3);
    if($('#dropshipper-samples'))$('#dropshipper-samples').innerHTML=skeletonCards(2);
  }

  function productDetailsUrl(p){
    return 'product.html?slug='+encodeURIComponent(p.public_slug)+'&from=app';
  }

  function filteredProducts(){
    const q=$('#product-search').value.trim().toLowerCase();
    const category=$('#product-category').value;
    const inStock=$('#in-stock-only').checked;
    const trending=$('#trending-only')?.checked;
    const sort=$('#product-sort').value;
    let a=PRODUCTS.filter(p=>{
      const hay=[p.name,p.name_en,p.name_ar,p.description,p.description_en,p.description_ar,p.sku,p.supplier_name,p.category_name].filter(Boolean).join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(!category||String(p.category_name||'')===category)&&(!inStock||Number(p.stock_quantity)>0)&&(!trending||p.trending===true);
    });
    if(sort==='price-low')a.sort((a,b)=>Number(priceRangeFor(a.product_id)?.retail_min??a.suggested_retail_price??0)-Number(priceRangeFor(b.product_id)?.retail_min??b.suggested_retail_price??0));
    else if(sort==='price-high')a.sort((a,b)=>Number(priceRangeFor(b.product_id)?.retail_max??b.suggested_retail_price??0)-Number(priceRangeFor(a.product_id)?.retail_max??a.suggested_retail_price??0));
    else if(sort==='stock-high')a.sort((a,b)=>Number(b.stock_quantity||0)-Number(a.stock_quantity||0));
    else a.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    return a;
  }

  function populateCategories(){
    const el=$('#product-category');
    const current=el.value;
    const cats=[...new Set(PRODUCTS.map(p=>p.category_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    el.innerHTML='<option value="">All categories</option>'+cats.map(c=>`<option value="${IZZY.esc(c)}">${IZZY.esc(c)}</option>`).join('');
    if(cats.includes(current))el.value=current;
  }

  function renderProducts(){
    const a=filteredProducts();
    const linked=new Set(LINKS.map(x=>x.supplier_product_id));
    $('#product-results-meta').textContent=local(
      `${a.length} product${a.length===1?'':'s'}`,
      `${a.length} منتج`
    );
    $('#products').innerHTML=a.map(p=>{
      const isLinked=linked.has(p.product_id);
      const stock=Number(p.stock_quantity||0);
      const name=productName(p);
      const range=priceRangeFor(p.product_id);
      const supplierPrice=Number(p.supplier_cost||0);
      const suggested=Number(p.suggested_retail_price||0);
      const supplierDisplay=range?rangeMoney(range.supplier_min,range.supplier_max,p.currency):IZZY.money(supplierPrice,p.currency);
      const suggestedDisplay=range?rangeMoney(range.retail_min,range.retail_max,p.currency):IZZY.money(suggested,p.currency);
      const profitMin=range?Number(range.margin_min)-Number(range.supplier_max)*0.04:suggested-supplierPrice*1.04;
      const profitMax=range?Number(range.margin_max)-Number(range.supplier_min)*0.04:suggested-supplierPrice*1.04;
      const profitDisplay=range?rangeMoney(profitMin,profitMax,p.currency):IZZY.money(profitMin,p.currency);
      const delivery=Number(SHIPPING?.delivery_fee);
      const shippingReady=SHIPPING?.available===true&&Number.isFinite(delivery);
      return `<article class="card product-card dropshipper-product-card simple-product-card">
        <a class="product-image product-open" href="${productDetailsUrl(p)}">
          ${p.primary_image_url?`<img src="${IZZY.esc(p.primary_image_url)}" alt="${IZZY.esc(name)}">`:'<span>IZ</span>'}
        </a>
        <div class="product-body">
          <div class="product-card-topline">
            <span class="tag ${stock>0?'ok':'warn'}">${stock>0?local(`${stock} in stock`,`${stock} متوفر`):local('Out of stock','نفد المخزون')}</span>
            ${p.category_name?`<span class="product-category">${IZZY.esc(p.category_name)}</span>`:''}
          </div>
          <a class="product-title-link" href="${productDetailsUrl(p)}"><h3>${IZZY.esc(name)}</h3></a>
          <p class="supplier-line">${local('Sold by','يباع بواسطة')} <b>${IZZY.esc(publicSupplierName(p.supplier_name))}</b></p>

          <div class="simple-product-prices">
            <div><small>${local('Supplier price','سعر المورّد')}</small><b>${supplierDisplay}</b></div>
            <div><small>${local('Suggested sell','سعر البيع المقترح')}</small><b>${suggestedDisplay}</b></div>
            <div><small>${local('Your total product cost','إجمالي تكلفة المنتج')}</small><b>${range?rangeMoney(Number(range.supplier_min)*1.04,Number(range.supplier_max)*1.04,p.currency):IZZY.money(supplierPrice*1.04,p.currency)}</b><span class="price-note">${local('supplier price + your 4% IzzyDrop fee','سعر المورد + رسوم IzzyDrop الخاصة بك 4٪')}</span></div><div><small>${local('Estimated net profit','الربح الصافي المتوقع')}</small><b class="${profitMin>=0?'positive':'negative'}">${profitDisplay}</b><span class="price-note">${local('after your fee, excluding delivery','بعد الرسوم، دون التوصيل')}</span></div>
            <div><small>${local('Cairo delivery','توصيل القاهرة')}</small><b>${shippingReady?IZZY.money(delivery,SHIPPING.currency||p.currency):local('Setup pending','قيد الإعداد')}</b><span class="price-note">${local('paid separately by customer','يدفعه العميل بشكل منفصل')}</span></div>
          </div>

          <div class="product-card-actions simple-product-actions">
            <a class="btn secondary details-btn" href="${productDetailsUrl(p)}">${local('Details','التفاصيل')}</a>
            <button class="btn link-btn" data-id="${p.product_id}" data-linked="${isLinked?'1':'0'}" ${stock>0?'':'disabled'}>${isLinked?local('My Products','منتجاتي'):local('Add to My Products','أضف إلى منتجاتي')}</button>
          </div>
        </div>
      </article>`;
    }).join('')||`<div class="empty-state">
      <div class="empty-icon">⌕</div>
      <h3>${local('No products match','لا توجد منتجات مطابقة')}</h3>
      <p>${local('Try changing your search or filters.','جرّب تغيير البحث أو الفلاتر.')}</p>
      <button id="clear-product-filters" class="btn secondary">${local('Clear filters','مسح الفلاتر')}</button>
    </div>`;

    document.querySelectorAll('.link-btn').forEach(b=>b.onclick=()=>linkProduct(b));
    const clear=$('#clear-product-filters');
    if(clear)clear.onclick=()=>{
      $('#product-search').value='';
      $('#product-category').value='';
      $('#product-sort').value='newest';
      $('#in-stock-only').checked=false;
      if($('#trending-only'))$('#trending-only').checked=false;
      renderProducts();
    };
  }

  function linkedProductCard(l,p){
    const range=priceRangeFor(p.product_id);
    const hasCustomSelling=l.pricing_mode==='custom' && l.retail_price!=null;
    const selling=hasCustomSelling?Number(l.retail_price):null;
    const suggested=Number(p.suggested_retail_price||0);
    const sourcedVariant=p.sourced_variant_id?variantLabel({option_values:p.sourced_variant_options,variant_name:p.sourced_variant_name,sku:p.sourced_variant_sku}):'';
    const sourcedSuggested=p.sourced_variant_id&&p.sourced_quote_suggested_retail!=null?Number(p.sourced_quote_suggested_retail):null;
    const suggestedDisplay=sourcedSuggested!=null
      ? IZZY.money(sourcedSuggested,p.currency)
      : range?rangeMoney(range.retail_min,range.retail_max,p.currency):IZZY.money(suggested,p.currency);
    const fullRangeDisplay=sourcedSuggested!=null&&range
      ? rangeMoney(range.retail_min,range.retail_max,p.currency)
      : null;
    const signedMoney=value=>{
      const n=Number(value);
      if(!Number.isFinite(n))return '—';
      if(n===0)return IZZY.money(0,p.currency);
      return `${n>0?'+':''}${IZZY.money(n,p.currency)}`;
    };
    let differenceLabel=local('Vs suggested','مقارنة بالمقترح');
    let differenceDisplay;
    let differenceClassValue=0;
    if(!hasCustomSelling){
      differenceLabel=local('Pricing','التسعير');
      differenceDisplay=sourcedSuggested!=null
        ? local('Sourced suggestion','اقتراح الخيار المورّد')
        : local('Variant suggestions','اقتراحات كل خيار');
    }else if(sourcedSuggested!=null){
      const difference=selling-sourcedSuggested;
      differenceLabel=local('Vs sourced suggestion','مقارنة باقتراح الخيار المورّد');
      differenceDisplay=signedMoney(difference);
      differenceClassValue=difference;
    }else if(range&&Number.isFinite(Number(range.retail_min))&&Number.isFinite(Number(range.retail_max))){
      const diffLow=selling-Number(range.retail_max);
      const diffHigh=selling-Number(range.retail_min);
      differenceLabel=local('Vs suggested range','مقارنة بنطاق السعر المقترح');
      differenceDisplay=diffLow===diffHigh?signedMoney(diffLow):`${signedMoney(diffLow)} – ${signedMoney(diffHigh)}`;
      differenceClassValue=diffLow<0&&diffHigh<0?-1:diffLow>0&&diffHigh>0?1:0;
    }else{
      const difference=selling-suggested;
      differenceDisplay=signedMoney(difference);
      differenceClassValue=difference;
    }
    const delivery=Number(SHIPPING?.delivery_fee);
    const shippingReady=SHIPPING?.available===true&&Number.isFinite(delivery);
    const integration=INTEGRATIONS.find(x=>x.link_id===l.id);
    const available=p.available!==false;
    const reason=p.availability_reason||local('This product is currently unavailable.','هذا المنتج غير متاح حاليًا.');
    const details=available&&p.public_slug?productDetailsUrl(p):null;
    return `<article class="card linked-product-card ${available?'':'is-unavailable'}" data-linked-product-id="${IZZY.esc(p.product_id||l.supplier_product_id||'')}">
      <div class="linked-product-main">
        <a class="linked-thumb" href="${details||'#'}">
          ${p.primary_image_url?`<img src="${IZZY.esc(p.primary_image_url)}" alt="">`:'IZ'}
        </a>
        <div class="linked-info">
          <div class="row linked-title-row"><div><h3>${IZZY.esc(productName(p)||local('Product','المنتج'))}</h3><small>${IZZY.esc(publicSupplierName(p.supplier_name))} · ${Number(p.stock_quantity||0)} ${local('in stock','متوفر')}</small></div><span class="tag ${available?(integration?.enabled?'ok':''):'bad'}">${available?(integration?.enabled?local('Web connected','الموقع متصل'):local('My product','منتجي')):local('Unavailable','غير متاح')}</span></div>
          ${available?'':`<div class="notice bad linked-unavailable-note"><b>${local('Unavailable','غير متاح')}</b><span>${IZZY.esc(reason)}</span></div>`}
          ${sourcedVariant?`<div class="notice"><b>${local('Sourced match','الاختيار المورّد')}: ${IZZY.esc(sourcedVariant)}</b><span>${local('Supplier price','سعر المورّد')} ${IZZY.money(p.sourced_quote_cost||0,p.currency||'EGP')} · ${local('Suggested retail','السعر المقترح')} ${IZZY.money(p.sourced_quote_suggested_retail||0,p.currency||'EGP')} · ${local('suggestion only','اقتراح فقط')}</span></div>`:''}
          <div class="linked-price-grid">
            <div><small>${sourcedSuggested!=null?local('Sourced suggestion','اقتراح الخيار المورّد'):local('Suggested','المقترح')}</small><b>${suggestedDisplay}</b>${sourcedVariant?`<span class="price-note">${IZZY.esc(sourcedVariant)}${fullRangeDisplay?` · ${local('full product range','نطاق المنتج الكامل')} ${fullRangeDisplay}`:''}</span>`:''}</div>
            <label><small>${local('General selling price','سعر البيع العام')}</small><div class="price-editor"><input class="linked-price-input" data-link-id="${l.id}" type="number" min="0" step="0.01" value="${hasCustomSelling?selling:''}" placeholder="${local('Follow supplier suggestions','اتبع اقتراحات المورد')}" ${available?'':'disabled'}><span>${IZZY.esc(p.currency||'EGP')}</span></div><span class="price-note">${hasCustomSelling?local('Custom price','سعر مخصص'):local('Follow variant suggestions','اتبع اقتراح كل خيار')}</span></label>
            <div><small>${differenceLabel}</small><b class="${differenceClassValue>0?'positive':differenceClassValue<0?'negative':''}">${differenceDisplay}</b></div>
            <div><small>${local('Cairo delivery','توصيل القاهرة')}</small><b>${shippingReady?IZZY.money(delivery,SHIPPING.currency||p.currency):local('Setup pending','قيد الإعداد')}</b></div>
          </div><p class="muted">${local('Your total cost includes a 4% IzzyDrop fee on the supplier price.','إجمالي تكلفتك يشمل رسوم IzzyDrop بنسبة 4٪ على سعر المورد.')}</p>
        </div>
      </div>
      <div class="linked-actions">
        <button class="btn save-linked-price" data-link-id="${l.id}" ${available?'':'disabled'}>${local('Save price','حفظ السعر')}</button>
        <button class="btn secondary web-setup-linked" data-id="${IZZY.esc(p.product_id||'')}" ${available?'':'disabled'}>${local('Add to your web','أضفه إلى موقعك')}</button>
        ${details?`<a class="btn secondary" href="${details}">${local('Details','التفاصيل')}</a>`:''}
        <button class="text-danger remove-linked" data-link-id="${l.id}" data-product-name="${IZZY.esc(productName(p)||(ar()?'هذا المنتج':'this product'))}">${local('Remove','إزالة')}</button>
      </div>
    </article>`;
  }

  function renderLinked(){
    const map=new Map(LINKED_PRODUCTS.map(p=>[p.product_id,p]));
    $('#linked').innerHTML=LINKS.map(l=>linkedProductCard(l,map.get(l.supplier_product_id)||{})).join('')||`<div class="empty-state">
      <div class="empty-icon">＋</div>
      <h3>No linked products yet</h3>
      <p>Choose products you want to sell and they will appear here.</p>
      <button id="browse-products-empty" class="btn">Browse products</button>
    </div>`;

    document.querySelectorAll('.save-linked-price').forEach(b=>b.onclick=()=>saveLinkedPrice(b));
    document.querySelectorAll('.web-setup-linked').forEach(b=>b.onclick=()=>openWebSetup(b.dataset.id));
    document.querySelectorAll('.remove-linked').forEach(b=>b.onclick=()=>removeLinked(b));
    const browse=$('#browse-products-empty');
    if(browse)browse.onclick=()=>go('products');
  }

  async function saveLinkedPrice(btn){
    const input=document.querySelector(`.linked-price-input[data-link-id="${btn.dataset.linkId}"]`);
    const raw=input?.value?.trim()||'';
    const follow=raw==='';
    const price=follow?null:Number(raw);
    if(!follow&&(!Number.isFinite(price)||price<0)){status('Enter a valid selling price or leave it blank to follow suggestions.',true);return}
    btn.disabled=true;btn.textContent='Saving…';
    try{
      await IZZY.request(`/rest/v1/dropshipper_product_links?id=eq.${encodeURIComponent(btn.dataset.linkId)}`,{method:'PATCH',body:JSON.stringify({retail_price:price,pricing_mode:follow?'follow_suggestions':'custom',updated_at:new Date().toISOString()})});
      status(follow?'Following supplier suggestions.':'Custom selling price saved.');
      await load(false);
    }catch(e){status(e.message,true)}
    finally{btn.disabled=false;btn.textContent='Save price'}
  }

  async function removeLinked(btn){
    if(!confirm(local(`Remove ${btn.dataset.productName} from My products? Any website connection for it will also be removed.`,`إزالة ${btn.dataset.productName} من منتجاتي؟ سيتم أيضًا حذف ربط الموقع الخاص به.`)))return;
    btn.disabled=true;
    try{
      await IZZY.request(`/rest/v1/dropshipper_product_links?id=eq.${encodeURIComponent(btn.dataset.linkId)}`,{method:'DELETE'});
      status('Product removed from My products.');
      await load(false);
    }catch(e){status(e.message,true);btn.disabled=false}
  }

  function orderItemsFor(id){return ITEMS.filter(i=>i.order_id===id)}

  async function fetchItemsForOrders(rows){
    if(!rows?.length)return [];
    const ids=rows.map(o=>o.id).filter(Boolean);
    if(!ids.length)return [];
    return IZZY.request(`/rest/v1/order_items?select=id,order_id,supplier_product_id,variant_id,quantity,retail_price_at_purchase,fulfillment_status,tracking_number,shipping_carrier,created_at&order_id=in.(${ids.join(',')})&order=created_at.desc`);
  }

  function updateOrderPager(){
    const btn=$('#load-more-orders');
    if(!btn)return;
    btn.hidden=!ORDER_HAS_MORE;
    btn.disabled=false;
    btn.textContent=local('Load older orders','تحميل طلبات أقدم');
  }

  async function loadMoreOrders(){
    const btn=$('#load-more-orders');
    if(btn){btn.disabled=true;btn.textContent=local('Loading…','جارٍ التحميل…');}
    try{
      const page=await IZZY.request(`/rest/v1/orders?select=*&order=created_at.desc&limit=${ORDER_PAGE_SIZE}&offset=${ORDERS.length}`);
      const pageItems=await fetchItemsForOrders(page||[]);
      ORDERS=[...ORDERS,...(page||[])];
      ITEMS=[...ITEMS,...(pageItems||[])];
      ORDER_HAS_MORE=(page||[]).length===ORDER_PAGE_SIZE;
      renderOrders();
      updateOrderPager();
    }catch(e){
      status(e.message,true);
      if(btn){btn.disabled=false;btn.textContent=local('Load older orders','تحميل طلبات أقدم');}
    }
  }

  function orderStatusClass(s){
    if(['delivered','shipped','in_transit'].includes(s))return 'ok';
    if(['pending','processing'].includes(s))return 'warn';
    if(['cancelled','refunded','refused','returned'].includes(s))return 'bad';
    return '';
  }

  function renderOrders(){
    const pm=new Map([...LINKED_PRODUCTS,...PRODUCTS].map(p=>[p.product_id,p]));
    const list=ORDERS.filter(o=>ORDER_FILTER==='all'||o.status===ORDER_FILTER);
    $('#orders').innerHTML=list.map(o=>{
      const items=orderItemsFor(o.id);
      const addr=o.shipping_address||{};
      const productText=items.map(i=>{
        const p=pm.get(i.supplier_product_id);
        return `${IZZY.esc(productName(p)||local('Product','المنتج'))} × ${Number(i.quantity||1)}`;
      }).join(' · ')||local('Order items','عناصر الطلب');
      const tracking=items.map(i=>i.tracking_number?`${IZZY.esc(i.shipping_carrier||local('Carrier','شركة الشحن'))}: ${IZZY.esc(i.tracking_number)}`:'').filter(Boolean).join(' · ');
      const settlement=SETTLEMENTS.find(x=>String(x.order_id)===String(o.id))||null;
      const payoutStatus=settlement?.payout_status||'';
      const payoutLabel=payoutStatus==='paid'
        ? local('Paid','تم الدفع')
        : payoutStatus==='pending'
          ? local('Ready for payout','جاهز للدفع')
          : payoutStatus==='not_ready'&&settlement?.settlement_status==='ready'
            ? local('Awaiting courier remittance','في انتظار تحويل شركة الشحن')
            : ['blocked','reversal_required'].includes(payoutStatus)
              ? local('Not payable','غير مستحق للدفع')
              : payoutStatus
                ? (window.IZZY_I18N?.status?.(payoutStatus)||payoutStatus)
                : local('Not ready','غير جاهز');
      let actions='';
      if(['pending','processing'].includes(o.status))actions=`<div class="order-delivery-actions"><button class="btn secondary cancel-order-btn" data-id="${o.id}">${local('Cancel order','إلغاء الطلب')}</button></div>`;
      else if(o.status==='shipped')actions=`<div class="order-delivery-actions"><button class="btn secondary delivery-status-btn" data-id="${o.id}" data-next="in_transit">${local('Mark in transit','تحديد قيد التوصيل')}</button><button class="btn delivery-status-btn" data-id="${o.id}" data-next="delivered">${local('Delivered','تم التوصيل')}</button><button class="btn secondary delivery-status-btn" data-id="${o.id}" data-next="refused">${local('Customer refused','رفض العميل')}</button></div>`;
      else if(o.status==='in_transit')actions=`<div class="order-delivery-actions"><button class="btn delivery-status-btn" data-id="${o.id}" data-next="delivered">${local('Delivered','تم التوصيل')}</button><button class="btn secondary delivery-status-btn" data-id="${o.id}" data-next="refused">${local('Customer refused','رفض العميل')}</button><button class="btn secondary delivery-status-btn" data-id="${o.id}" data-next="returned">${local('Returned','مرتجع')}</button></div>`;
      else if(['delivered','refused'].includes(o.status))actions=`<div class="order-delivery-actions"><button class="auth-text-button delivery-status-btn" data-id="${o.id}" data-next="returned">${local('Mark returned','تحديد كمرتجع')}</button></div>`;

      return `<article class="card order-card">
        <div class="order-card-head">
          <div><span class="order-id">${IZZY.esc(o.external_order_ref||o.shopify_order_name||('Order '+String(o.id).slice(0,8)))}</span><small>${new Date(o.created_at).toLocaleString()}</small></div>
          <span class="tag ${orderStatusClass(o.status)}">${IZZY.esc(window.IZZY_I18N?.status?.(o.status)||o.status)}</span>
        </div>
        <div class="order-summary-grid">
          <div><small>${local('Customer','العميل')}</small><b>${IZZY.esc(o.customer_name||'—')}</b><span>${IZZY.esc(o.customer_phone||'')}</span></div>
          <div><small>${local('Products','المنتجات')}</small><b>${productText}</b></div>
          <div><small>${local('Product subtotal','إجمالي المنتجات')}</small><b>${IZZY.money(o.product_subtotal_amount??Math.max(0,Number(o.total_amount||0)-Number(o.shipping_fee_at_purchase||0)),o.currency)}</b></div>
          <div><small>${local('Delivery','التوصيل')}</small><b>${IZZY.money(o.shipping_fee_at_purchase||0,o.currency)}</b><span>${local('Cairo','القاهرة')}</span></div>
          <div><small>${local('Customer total','إجمالي العميل')}</small><b>${IZZY.money(o.total_amount,o.currency)}</b><span>${IZZY.esc(window.IZZY_I18N?.status?.(o.payment_status)||o.payment_status||'')}</span></div>
        </div>
        <details class="order-details">
          <summary>${local('Order details','تفاصيل الطلب')}</summary>
          <div class="order-details-grid">
            <div><small>${local('Delivery address','عنوان التوصيل')}</small><p>${IZZY.esc([addr.address1,addr.city,addr.governorate].filter(Boolean).join(', ')||'—')}</p></div>
            <div><small>${local('Tracking','التتبع')}</small><p>${tracking||local('Waiting for supplier to ship','في انتظار شحن المورّد')}</p></div>
            <div><small>${local('Source','المصدر')}</small><p>${IZZY.esc(o.source||'manual')}</p></div>
            <div><small>${local('Your profit','ربحك')}</small><p>${settlement?IZZY.money(settlement.dropshipper_profit_amount||0,settlement.currency||o.currency||'EGP'):'—'}</p></div>
            <div><small>${local('Payout status','حالة الدفع')}</small><p>${settlement?IZZY.esc(payoutLabel):local('Not available yet','غير متاح بعد')}</p></div>
          </div>
        </details>
        ${actions}
      </article>`;
    }).join('')||`<div class="empty-state"><div class="empty-icon">□</div><h3>${local('No orders found','لا توجد طلبات')}</h3><p>${local('Create your first order when a customer buys one of your products.','أنشئ أول طلب عندما يشتري عميل أحد منتجاتك.')}</p></div>`;

    document.querySelectorAll('.delivery-status-btn').forEach(b=>b.onclick=()=>updateDeliveryStatus(b));
    document.querySelectorAll('.cancel-order-btn').forEach(b=>b.onclick=()=>cancelOrder(b));
  }

  async function cancelOrder(btn){
    if(!confirm(local('Cancel this order? Reserved stock will be returned to inventory.','إلغاء هذا الطلب؟ سيتم إرجاع المخزون المحجوز إلى المخزون المتاح.')))return;
    btn.disabled=true;
    try{
      await IZZY.rpc('dropshipper_cancel_order',{_order_id:btn.dataset.id});
      status(local('Order cancelled and stock restored.','تم إلغاء الطلب وإرجاع المخزون.'));
      await load(false);
    }catch(e){status(e.message,true);btn.disabled=false}
  }

  async function updateDeliveryStatus(btn){
    const next=btn.dataset.next;
    const label={in_transit:local('in transit','قيد التوصيل'),delivered:local('delivered','تم التوصيل'),refused:local('refused','مرفوض'),returned:local('returned','مرتجع')}[next]||next;
    if(['refused','returned'].includes(next)&&!confirm(local(`Mark this order as ${label}?`,`تحديد هذا الطلب كـ ${label}؟`)))return;
    btn.disabled=true;
    try{
      await IZZY.rpc('dropshipper_update_delivery_status',{_order_id:btn.dataset.id,_status:next});
      status(local('Delivery status updated.','تم تحديث حالة التوصيل.'));
      await load(false);
    }catch(e){status(e.message,true);btn.disabled=false}
  }

  function renderOrderProducts(){
    const map=new Map(LINKED_PRODUCTS.map(p=>[p.product_id,p]));
    const el=$('#order-product');
    if(!el)return;
    const current=el.value;
    el.innerHTML='<option value="">'+local('Choose one of My products','اختر منتجًا من منتجاتي')+'</option>'+LINKS.map(l=>{
      const p=map.get(l.supplier_product_id);
      if(!p)return '';
      return `<option value="${IZZY.esc(p.product_id)}" ${p.available&&Number(p.stock_quantity||0)>0?'':'disabled'}>${IZZY.esc(productName(p))}${p.available?'':` · ${local('Unavailable','غير متاح')}`}</option>`;
    }).join('');
    if([...el.options].some(o=>o.value===current))el.value=current;
  }

  function orderSellingPrice(productId,v){
    const p=LINKED_PRODUCTS.find(x=>x.product_id===productId)||PRODUCTS.find(x=>x.product_id===productId)||{};
    const link=LINKS.find(x=>x.supplier_product_id===productId);
    const linkPrice=link?.retail_price==null?null:Number(link.retail_price);
    const productSuggested=p.suggested_retail_price==null?null:Number(p.suggested_retail_price);
    const variantSuggested=v?.suggested_retail_price==null?null:Number(v.suggested_retail_price);
    if(link?.pricing_mode==='custom' && linkPrice!=null)return linkPrice;
    return variantSuggested??productSuggested??0;
  }

  function renderOrderPreview(){
    const box=$('#order-price-preview'),note=$('#order-shipping-note'),btn=$('#order-submit');
    if(!box||!note||!btn)return;
    const delivery=Number(SHIPPING?.delivery_fee);
    const shippingReady=SHIPPING?.available===true&&Number.isFinite(delivery);
    if(!shippingReady){
      box.innerHTML='';
      note.innerHTML=`<b>${local('Cairo delivery is not configured yet.','توصيل القاهرة لم يتم إعداده بعد.')}</b><span>${local('An admin needs to set the delivery fee before orders can be created.','يجب على المشرف تحديد سعر التوصيل قبل إنشاء الطلبات.')}</span>`;
      note.className='notice bad span-2';
      btn.disabled=true;
      return;
    }

    note.innerHTML=`<b>${local('Cairo only','القاهرة فقط')}</b><span>${local('IzzyDrop delivery','توصيل IzzyDrop')}: ${IZZY.money(delivery,SHIPPING.currency||'EGP')} · ${local('paid separately by the customer','يدفعه العميل بشكل منفصل')}</span>`;
    note.className='notice span-2';
    btn.disabled=false;

    const productId=$('#order-product')?.value;
    const variantId=$('#order-variant')?.value;
    const qty=Math.max(1,Number($('#order-qty')?.value||1));
    const v=ORDER_VARIANTS.find(x=>String(x.id)===String(variantId));
    if(!productId||!v){
      box.innerHTML=`<div><small>${local('Delivery','التوصيل')}</small><b>${IZZY.money(delivery,SHIPPING.currency||'EGP')}</b></div><div><small>${local('Customer total','إجمالي العميل')}</small><b>—</b><span>${local('Choose a variant','اختر خيارًا')}</span></div>`;
      return;
    }

    const supplier=Number(v.supplier_cost||0);
    const selling=orderSellingPrice(productId,v);
    const subtotal=selling*qty;
    const supplierTotal=supplier*qty;
    const dropshipperFee=Math.round(supplierTotal*4)/100;
    const margin=subtotal-supplierTotal-dropshipperFee;
    box.innerHTML=`
      <div><small>${local('Supplier price','سعر المورّد')}</small><b>${IZZY.money(supplierTotal,'EGP')}</b><span>${qty>1?qty+' × '+IZZY.money(supplier,'EGP'):local('for this variant','لهذا الخيار')}</span></div>
      <div><small>${local('Your IzzyDrop fee (4%)','رسوم IzzyDrop الخاصة بك (4٪)')}</small><b>${IZZY.money(dropshipperFee,'EGP')}</b></div>
      <div><small>${local('Your total product cost','إجمالي تكلفة المنتج')}</small><b>${IZZY.money(supplierTotal+dropshipperFee,'EGP')}</b></div>
      <div><small>${local('Product price','سعر المنتج')}</small><b>${IZZY.money(subtotal,'EGP')}</b><span>${qty>1?qty+' × '+IZZY.money(selling,'EGP'):local('customer product price','سعر المنتج للعميل')}</span></div>
      <div><small>${local('Cairo delivery','توصيل القاهرة')}</small><b>${IZZY.money(delivery,SHIPPING.currency||'EGP')}</b><span>${local('separate from product price','منفصل عن سعر المنتج')}</span></div>
      <div><small>${local('Customer COD total','إجمالي الدفع عند الاستلام')}</small><b>${IZZY.money(subtotal+delivery,'EGP')}</b><span class="${margin>=0?'positive':'negative'}">${local('Your estimated net profit','الربح الصافي المتوقع')}: ${IZZY.money(margin,'EGP')} · ${local('after your IzzyDrop fee','بعد رسوم IzzyDrop الخاصة بك')}</span></div>
    `;
  }

  async function loadOrderVariants(){
    const productId=$('#order-product').value,el=$('#order-variant');
    ORDER_VARIANTS=[];
    el.innerHTML='<option value="">Choose variant</option>';el.disabled=true;
    renderOrderPreview();
    if(!productId)return;
    try{
      const vs=await IZZY.rpc('marketplace_variants_v3',{_product_id:productId});
      ORDER_VARIANTS=vs||[];
      el.innerHTML='<option value="">Choose variant</option>'+ORDER_VARIANTS.map(v=>`<option value="${IZZY.esc(v.id)}" ${Number(v.stock_quantity)<=0?'disabled':''}>${IZZY.esc(variantLabel(v))} · ${IZZY.money(orderSellingPrice(productId,v),'EGP')} · ${v.stock_quantity} in stock</option>`).join('');
      el.disabled=false;
      renderOrderPreview();
    }catch(e){$('#order-status').textContent=e.message;$('#order-status').className='status bad'}
  }

  function integrationForProduct(productId){
    const link=LINKS.find(x=>x.supplier_product_id===productId);
    if(!link)return null;
    return INTEGRATIONS.find(x=>x.link_id===link.id)||null;
  }

  function makeEmbedCode(token){
    return `<div data-izzydrop-token="${token}"></div>\n<script src="https://youssefhellal05.github.io/izzydrop-web/izzydrop-widget.js?v=20261003-refresh-retry1" async><\/script>`;
  }

  async function openWebSetup(productId){
    const p=PRODUCTS.find(x=>x.product_id===productId)||LINKED_PRODUCTS.find(x=>x.product_id===productId);
    if(!p||p.available===false){status(p?.availability_reason||local('This product is not available.','هذا المنتج غير متاح.'),true);return}
    const link=LINKS.find(x=>x.supplier_product_id===productId);
    const integration=link?INTEGRATIONS.find(x=>x.link_id===link.id):null;

    $('#web-product-id').value=productId;
    $('#web-url').value=integration?.website_url||'';
    $('#copy-status').textContent='';
    $('#copy-status').className='status';
    $('#web-variant-list').innerHTML='<div class="notice">Loading variants…</div>';

    CURRENT_WEB_TOKEN=integration?.public_token||null;
    if(CURRENT_WEB_TOKEN){
      $('#web-embed-code').value=makeEmbedCode(CURRENT_WEB_TOKEN);
      $('#web-code-section').hidden=false;
      $('#open-test-store').hidden=false;
      $('#web-setup-submit').textContent='Update web setup';
    }else{
      $('#web-embed-code').value='';
      $('#web-code-section').hidden=true;
      $('#open-test-store').hidden=true;
      $('#web-setup-submit').textContent='Create automatic web setup';
    }

    $('#link-modal').hidden=false;

    try{
      const variants=await IZZY.rpc('marketplace_variants_v3',{_product_id:productId});
      const existing=integration?INTEGRATION_VARIANTS.filter(x=>x.integration_id===integration.id):[];
      const existingMap=new Map(existing.map(x=>[x.variant_id,x]));
      const defaultPrice=Number(link?.retail_price??p.suggested_retail_price??0);

      $('#web-variant-list').innerHTML=(variants||[]).map(v=>{
        const configured=existingMap.get(v.id);
        const checked=integration?!!configured:true;
        const price=Number(configured?.retail_price??v.suggested_retail_price??defaultPrice);
        return `<label class="web-variant-row" data-web-variant-row="${v.id}">
          <span><input class="web-variant-check" type="checkbox" data-web-variant-id="${v.id}" ${checked?'checked':''}></span>
          <span class="web-variant-name"><b>${IZZY.esc(variantLabel(v))}</b><small>${IZZY.esc(v.sku||'')}</small></span>
          <span class="${Number(v.stock_quantity||0)<=0?'stock-low':''}">${Number(v.stock_quantity||0)}</span>
          <span><input class="web-variant-price" data-web-variant-price="${v.id}" type="number" min="0" step="0.01" value="${price}" aria-label="Selling price"></span>
        </label>`;
      }).join('')||'<div class="notice">No variants are available for this product.</div>';
    }catch(err){
      $('#web-variant-list').innerHTML=`<div class="notice bad">${IZZY.esc(err.message)}</div>`;
    }
  }

  async function linkProduct(b){
    if(b.dataset.linked==='1'){go('linked');return}
    const p=PRODUCTS.find(x=>x.product_id===b.dataset.id);
    if(!p)return;
    b.disabled=true;b.textContent='Adding…';
    try{
      await IZZY.request('/rest/v1/dropshipper_product_links',{
        method:'POST',
        headers:{Prefer:'return=minimal'},
        body:JSON.stringify({
          dropshipper_id:DROPSHIPPER.id,
          supplier_product_id:p.product_id,
          retail_price:null,
          pricing_mode:'follow_suggestions',
          status:'active',
          last_seen_cost:Number(p.supplier_cost||0),
          last_seen_stock:Number(p.stock_quantity||0)
        })
      });
      status(local('Product added to My Products.','تمت إضافة المنتج إلى منتجاتي.'));
      await load(false);
      go('linked');
    }catch(e){status(e.message,true);b.disabled=false;b.textContent='Add to My Products'}
  }

  async function openSampleRequest(productId){
    const p=PRODUCTS.find(x=>x.product_id===productId);
    if(!p)return;
    const st=$('#sample-status');
    st.textContent='';st.className='status';
    $('#sample-product-id').value=productId;
    $('#sample-variant').innerHTML='<option value="">'+local('Loading variants…','جارٍ تحميل الخيارات…')+'</option>';
    $('#sample-modal').hidden=false;
    try{
      const variants=await IZZY.rpc('marketplace_variants_v3',{_product_id:productId});
      const available=(variants||[]).filter(v=>Number(v.stock_quantity)>0);
      $('#sample-variant').innerHTML='<option value="">'+local('Choose variant','اختر الخيار')+'</option>'+
        available.map(v=>`<option value="${v.id}">${IZZY.esc(variantLabel(v))} · ${v.stock_quantity} ${local('in stock','متوفر')}</option>`).join('');
      if(available.length===1)$('#sample-variant').value=available[0].id;
      if(!available.length){
        st.textContent=local('No in-stock variant is available for a sample.','لا يوجد خيار متوفر لطلب عينة.');
        st.className='status bad';
      }
    }catch(e){st.textContent=e.message;st.className='status bad'}
  }

  function renderSamples(){
    const el=$('#dropshipper-samples');if(!el)return;
    el.innerHTML=(SAMPLES||[]).map(x=>{
      const addr=x.shipping_address||{};
      const name=productName({name:x.product_name,name_en:x.product_name_en,name_ar:x.product_name_ar})||local('Product','المنتج');
      const options=Object.entries(x.variant_options||{}).map(([k,v])=>`${k}: ${v}`).join(' · ');
      const tracking=[x.shipping_carrier,x.tracking_number].filter(Boolean).join(' · ');
      return `<article class="card sample-card">
        <div class="order-card-head"><div><span class="order-id">${IZZY.esc(name)}</span><small>${IZZY.esc(options||x.variant_name||'')} · ${new Date(x.created_at).toLocaleString()}</small></div><span class="tag ${x.status==='delivered'?'ok':x.status==='rejected'?'bad':x.status==='requested'?'warn':''}">${IZZY.esc(window.IZZY_I18N?.status?.(x.status)||x.status)}</span></div>
        <div class="order-summary-grid">
          <div><small>${local('Supplier','المورّد')}</small><b>${IZZY.esc(publicSupplierName(x.supplier_name))}</b></div>
          <div><small>${local('Delivery address','عنوان التوصيل')}</small><b>${IZZY.esc([addr.address1,addr.city,addr.governorate].filter(Boolean).join(', ')||'—')}</b></div>
          <div><small>${local('Tracking','التتبع')}</small><span>${IZZY.esc(tracking||'—')}</span></div>
        </div>
        ${x.status==='shipped'?`<div class="sample-actions"><button class="btn sample-received" data-id="${x.id}">${local('I received it','استلمت العينة')}</button></div>`:''}
      </article>`;
    }).join('')||`<div class="empty-state"><div class="empty-icon">□</div><h3>${local('No sample requests yet','لا توجد طلبات عينات بعد')}</h3><p>${local('Request a sample from any marketplace product to test it first.','اطلب عينة من أي منتج في السوق لتجربته أولًا.')}</p></div>`;

    document.querySelectorAll('.sample-received').forEach(btn=>btn.onclick=async()=>{
      btn.disabled=true;
      try{
        await IZZY.rpc('dropshipper_mark_sample_delivered',{_sample_id:btn.dataset.id});
        status(local('Sample marked delivered.','تم تحديد العينة كمُسلّمة.'));
        await load(false);
      }catch(e){status(e.message,true);btn.disabled=false}
    });
  }

  function renderCod(){
    const el=$('#cod-summary');if(!el)return;
    el.innerHTML=[
      [local('COD orders','طلبات الدفع عند الاستلام'),COD.total||0],
      [local('Delivered','تم التوصيل'),COD.delivered||0],
      [local('In progress','قيد التنفيذ'),Number(COD.processing||0)+Number(COD.pending||0)+Number(COD.shipped||0)+Number(COD.in_transit||0)],
      [local('Failed delivery','فشل التوصيل'),Number(COD.refused||0)+Number(COD.returned||0)],
      [local('Delivery success','نجاح التوصيل'),`${Number(COD.success_rate||0).toFixed(1)}%`],
      [local('Collected COD','قيمة COD المحصلة'),IZZY.money(COD.delivered_value||0,'EGP')]
    ].map(([k,v])=>`<div class="card cod-stat"><small>${k}</small><strong>${v}</strong></div>`).join('');
  }

  function renderMoney(){
    const summary=$('#money-summary'),list=$('#money-list');
    if(!summary||!list)return;
    const rows=Array.isArray(SETTLEMENTS)?SETTLEMENTS:[];
    const pending=rows.filter(x=>x.payout_status==='pending').reduce((n,x)=>n+Number(x.dropshipper_profit_amount||0),0);
    const awaiting=rows.filter(x=>x.payout_status==='not_ready'&&x.settlement_status==='ready').reduce((n,x)=>n+Number(x.dropshipper_profit_amount||0),0);
    const paid=rows.filter(x=>x.payout_status==='paid').reduce((n,x)=>n+Number(x.dropshipper_profit_amount||0),0);
    const blocked=rows.filter(x=>['blocked','reversal_required'].includes(x.payout_status)).reduce((n,x)=>n+Number(x.dropshipper_profit_amount||0),0);
    summary.innerHTML=[
      [local('Awaiting courier remittance','في انتظار تحويل شركة الشحن'),IZZY.money(awaiting,'EGP')],
      [local('Pending payout','مستحق قيد الدفع'),IZZY.money(pending,'EGP')],
      [local('Paid out','تم دفعه'),IZZY.money(paid,'EGP')],
      [local('Not payable','غير مستحق للدفع'),IZZY.money(blocked,'EGP')]
    ].map(([k,v])=>`<div class="card cod-stat"><small>${k}</small><strong>${v}</strong></div>`).join('');

    list.innerHTML=rows.map(x=>{
      const tagClass=x.payout_status==='paid'?'ok':x.payout_status==='pending'?'warn':['blocked','reversal_required'].includes(x.payout_status)?'bad':'';
      const payoutLabel=x.payout_status==='not_ready'&&x.settlement_status==='ready'?local('Awaiting courier remittance','في انتظار تحويل شركة الشحن'):x.payout_status;
      return `<article class="card order-card">
        <div class="order-card-head">
          <div><span class="order-id">${IZZY.esc(x.external_order_ref||String(x.order_id).slice(0,8))}</span><small>${new Date(x.created_at).toLocaleString()}</small></div>
          <span class="tag ${tagClass}">${IZZY.esc(payoutLabel||x.settlement_status||'')}</span>
        </div>
        <div class="order-summary-grid">
          <div><small>${local('Actual selling amount','قيمة البيع الفعلية')}</small><b>${IZZY.money(x.retail_amount||0,x.currency||'EGP')}</b></div>
          <div><small>${local('Supplier price','سعر المورّد')}</small><b>${IZZY.money(x.supplier_gross_amount||0,x.currency||'EGP')}</b></div>
          <div><small>${local('Your IzzyDrop fee','رسوم IzzyDrop الخاصة بك')}</small><b>${IZZY.money(x.dropshipper_fee_amount||0,x.currency||'EGP')}</b><span>${Number(x.dropshipper_fee_rate||0).toFixed(2)}%</span></div>
          <div><small>${local('Your profit','ربحك')}</small><b>${IZZY.money(x.dropshipper_profit_amount||0,x.currency||'EGP')}</b></div>
          <div><small>${local('Order status','حالة الطلب')}</small><b>${IZZY.esc(window.IZZY_I18N?.status?.(x.order_status)||x.order_status||'')}</b><span>${IZZY.esc(window.IZZY_I18N?.status?.(x.payment_status)||x.payment_status||'')}</span></div>
        </div>
      </article>`;
    }).join('')||`<div class="empty-state"><div class="empty-icon">EGP</div><h3>${local('No payout records yet','لا توجد سجلات أرباح بعد')}</h3><p>${local('Delivered COD orders will appear here automatically.','ستظهر طلبات الدفع عند الاستلام التي تم توصيلها هنا تلقائيًا.')}</p></div>`;
  }

  function renderRequests(){
    window.IZZY_SOURCING.renderDropshipper(SOURCING_BOARD,()=>load(false));
  }

  function alertIcon(type){
    if(type==='price_change')return 'EGP';
    if(type==='out_of_stock')return '0';
    if(type==='low_stock')return '!';
    if(String(type||'').startsWith('sourcing'))return '↗';
    return '•';
  }

  function alertDestination(a){
    if(a?.sourcing_response_id)return {kind:'sourced',id:a.sourcing_response_id};
    if(['price_change','low_stock','out_of_stock'].includes(a?.alert_type)){
      return {kind:'linked',productId:a?.supplier_product_id||a?.metadata?.product_id||null};
    }
    return null;
  }

  function focusLinkedProduct(productId){
    if(!productId)return;
    requestAnimationFrame(()=>{
      const card=document.querySelector(`.linked-product-card[data-linked-product-id="${CSS.escape(String(productId))}"]`);
      if(!card)return;
      card.classList.add('is-alert-target');
      card.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>card.classList.remove('is-alert-target'),3500);
    });
  }

  async function markAlertRead(id){
    const alert=ALERTS.find(a=>String(a.id)===String(id));
    if(!alert||alert.read_at)return;
    await IZZY.request(`/rest/v1/dropshipper_alerts?id=eq.${encodeURIComponent(id)}`,{
      method:'PATCH',
      body:JSON.stringify({read_at:new Date().toISOString()})
    });
    alert.read_at=new Date().toISOString();
    ALERT_METRICS.unread_count=Math.max(0,Number(ALERT_METRICS.unread_count||0)-1);
  }

  async function openAlert(id){
    const a=ALERTS.find(x=>String(x.id)===String(id));
    if(!a)return;
    try{
      await markAlertRead(a.id);
      renderAlerts();
    }catch(e){
      status(e.message,true);
    }
    const dest=alertDestination(a);
    if(dest?.kind==='sourced'){
      location.href='app.html?sourced='+encodeURIComponent(dest.id);
      return;
    }
    if(dest?.kind==='linked'){
      go('linked');
      focusLinkedProduct(dest.productId);
    }
  }

  async function loadOlderAlerts(){
    const btn=$('#dropshipper-load-more-alerts');
    if(btn){btn.disabled=true;btn.textContent=local('Loading…','جارٍ التحميل…');}
    try{
      const older=await IZZY.request(`/rest/v1/dropshipper_alerts?select=*&order=created_at.desc&limit=${ALERT_PAGE_SIZE}&offset=${ALERTS.length}`);
      ALERTS=[...ALERTS,...(older||[])];
      ALERT_HAS_MORE=Number(ALERT_METRICS.total_count||0)>ALERTS.length || ((older||[]).length===ALERT_PAGE_SIZE&&!ALERT_METRICS.total_count);
      renderAlerts();
    }catch(e){
      status(e.message,true);
      if(btn){btn.disabled=false;btn.textContent=local('Load older notifications','تحميل إشعارات أقدم');}
    }
  }

  async function markAllAlertsRead(){
    const btn=$('#dropshipper-mark-all-read');
    if(btn){btn.disabled=true;btn.textContent=local('Marking…','جارٍ التحديث…');}
    try{
      await IZZY.request('/rest/v1/dropshipper_alerts?read_at=is.null',{
        method:'PATCH',
        body:JSON.stringify({read_at:new Date().toISOString()})
      });
      const now=new Date().toISOString();
      ALERTS.forEach(a=>{if(!a.read_at)a.read_at=now});
      ALERT_METRICS.unread_count=0;
      renderAlerts();
    }catch(e){
      status(e.message,true);
      if(btn){btn.disabled=false;btn.textContent=local('Mark all read','تحديد الكل كمقروء');}
    }
  }

  function renderAlerts(){
    const unread=(ALERTS||[]).filter(a=>!a.read_at);
    const unreadCount=Number(ALERT_METRICS.unread_count??unread.length);
    const totalCount=Number(ALERT_METRICS.total_count??ALERTS.length);
    ALERT_HAS_MORE=totalCount>ALERTS.length || (!ALERT_METRICS.total_count&&ALERTS.length===ALERT_PAGE_SIZE);

    const inlineHtml=rows=>rows.map(a=>`<div class="notice alert-notice"><b>${IZZY.esc(a.title)}</b><span>${IZZY.esc(a.message)}</span>${a.sourcing_response_id?`<a class="btn secondary" href="app.html?sourced=${encodeURIComponent(a.sourcing_response_id)}">${local('Open sourced product','فتح المنتج المورّد')}</a>`:''}<button class="auth-text-button mark-alert" data-id="${a.id}">${local('Mark read','تحديد كمقروء')}</button></div>`).join('');
    const inventory=$('#inventory-alerts');if(inventory)inventory.innerHTML=inlineHtml(unread.slice(0,8));
    document.querySelectorAll('.sourcing-alert-stack').forEach(el=>el.innerHTML=inlineHtml(unread.filter(a=>a.sourcing_response_id).slice(0,8)));

    const count=$('#dropshipper-notification-count');
    if(count){
      count.textContent=unreadCount>99?'99+':String(unreadCount);
      count.hidden=unreadCount===0;
    }
    const summary=$('#dropshipper-notification-summary');
    if(summary)summary.textContent=unreadCount
      ? local(`${unreadCount} unread`,`${unreadCount} غير مقروء`)
      : local('You are all caught up','لا توجد إشعارات غير مقروءة');

    const markAll=$('#dropshipper-mark-all-read');
    if(markAll){
      markAll.hidden=unreadCount===0;
      markAll.disabled=false;
      markAll.textContent=local('Mark all read','تحديد الكل كمقروء');
    }

    const panelList=$('#dropshipper-notification-list');
    if(panelList){
      panelList.innerHTML=(ALERTS||[]).map(a=>`<button class="notification-item dropshipper-notification-item ${a.read_at?'':'is-unread'}" type="button" data-open-alert="${a.id}">
        <span class="notification-item-icon">${IZZY.esc(alertIcon(a.alert_type))}</span>
        <span><b>${IZZY.esc(a.title||local('Notification','إشعار'))}</b><small>${IZZY.esc(a.message||'')}</small><small class="notification-time">${new Date(a.created_at).toLocaleString()}</small></span>
      </button>`).join('')||`<div class="empty-mini"><b>${local('No notifications yet','لا توجد إشعارات بعد')}</b><span>${local('Price, stock and sourcing updates will appear here.','ستظهر هنا تحديثات الأسعار والمخزون والتوريد.')}</span></div>`;
    }

    const loadMore=$('#dropshipper-load-more-alerts');
    if(loadMore){
      loadMore.hidden=!ALERT_HAS_MORE;
      loadMore.disabled=false;
      loadMore.textContent=local('Load older notifications','تحميل إشعارات أقدم');
    }

    document.querySelectorAll('.mark-alert').forEach(b=>b.onclick=async()=>{
      b.disabled=true;
      try{await markAlertRead(b.dataset.id);renderAlerts()}catch(e){status(e.message,true);b.disabled=false}
    });
    document.querySelectorAll('[data-open-alert]').forEach(b=>b.onclick=()=>openAlert(b.dataset.openAlert));
  }

  async function load(showMessage=false){
    const sectionError=(selector,label)=>{
      const el=$(selector);
      if(!el)return;
      el.innerHTML=`<div class="notice bad"><b>${IZZY.esc(label)} could not refresh.</b><span>Your other workspace sections are still available.</span><button class="btn secondary section-retry" type="button">Retry</button></div>`;
      const retry=el.querySelector('.section-retry');
      if(retry)retry.onclick=()=>load(false);
    };

    try{
      const results=await Promise.allSettled([
        IZZY.rpc('marketplace_catalog_v3'),
        IZZY.rpc('dropshipper_linked_catalog'),
        IZZY.request('/rest/v1/dropshipper_product_links?select=*&order=created_at.desc'),
        IZZY.request('/rest/v1/storefront_integrations?select=*&order=created_at.desc'),
        IZZY.request('/rest/v1/storefront_integration_variants?select=*&order=created_at.asc'),
        IZZY.request(`/rest/v1/orders?select=*&order=created_at.desc&limit=${ORDER_PAGE_SIZE}`),
        IZZY.rpc('sourcing_board'),
        IZZY.rpc('dropshipper_samples'),
        IZZY.request(`/rest/v1/dropshipper_alerts?select=*&order=created_at.desc&limit=${ALERT_PAGE_SIZE}`),
        IZZY.rpc('dropshipper_alert_metrics'),
        IZZY.rpc('dropshipper_cod_metrics'),
        IZZY.rpc('marketplace_shipping_quote',{},false),
        IZZY.rpc('marketplace_variant_price_ranges'),
        IZZY.rpc('dropshipper_settlements_v2')
      ]);

      const [
        rProducts,rLinkedProducts,rLinks,rIntegrations,rIntegrationVariants,rOrders,
        rSourcing,rSamples,rAlerts,rAlertMetrics,rCod,rShipping,rPriceRanges,rSettlements
      ]=results;
      const failures=[];
      const take=(r,current,label)=>{
        if(r.status==='fulfilled')return r.value;
        failures.push(label);
        return current;
      };

      PRODUCTS=take(rProducts,PRODUCTS,'Products')||[];
      LINKED_PRODUCTS=take(rLinkedProducts,LINKED_PRODUCTS,'My Products')||[];
      LINKS=take(rLinks,LINKS,'product links')||[];
      INTEGRATIONS=take(rIntegrations,INTEGRATIONS,'web connections')||[];
      INTEGRATION_VARIANTS=take(rIntegrationVariants,INTEGRATION_VARIANTS,'web variants')||[];
      SOURCING_BOARD=take(rSourcing,SOURCING_BOARD,'Sourcing')||{};
      SAMPLES=take(rSamples,SAMPLES,'Samples')||[];
      ALERTS=take(rAlerts,ALERTS,'Alerts')||[];
      ALERT_METRICS=take(rAlertMetrics,ALERT_METRICS,'notification count')||{};
      ALERT_HAS_MORE=Number(ALERT_METRICS.total_count||0)>ALERTS.length || (!ALERT_METRICS.total_count&&ALERTS.length===ALERT_PAGE_SIZE);
      COD=take(rCod,COD,'COD summary')||{};
      SHIPPING=take(rShipping,SHIPPING,'Shipping')||{};
      PRICE_RANGES=take(rPriceRanges,PRICE_RANGES,'price ranges')||[];
      SETTLEMENTS=take(rSettlements,SETTLEMENTS,'Money')||[];

      if(rOrders.status==='fulfilled'){
        ORDERS=rOrders.value||[];
        try{
          ITEMS=await fetchItemsForOrders(ORDERS);
          ORDER_HAS_MORE=ORDERS.length===ORDER_PAGE_SIZE;
          updateOrderPager();
        }catch(e){
          failures.push('order items');
          if(!ITEMS.length)sectionError('#orders',local('Orders','الطلبات'));
        }
      }else{
        failures.push('Orders');
        if(!ORDERS.length)sectionError('#orders',local('Orders','الطلبات'));
      }

      if(rProducts.status==='rejected'&&!PRODUCTS.length)sectionError('#products',local('Products','المنتجات'));
      if(rSourcing.status==='rejected'&&!Object.keys(SOURCING_BOARD||{}).length){
        sectionError('#product-requests',local('Sourcing requests','طلبات التوريد'));
        sectionError('#sourced-products',local('Sourced products','المنتجات التي تم توريدها'));
      }
      if(rSamples.status==='rejected'&&!SAMPLES.length)sectionError('#dropshipper-samples',local('Samples','العينات'));
      if(rSettlements.status==='rejected'&&!SETTLEMENTS.length)sectionError('#money-list',local('Money','الأموال'));

      populateCategories();
      if(!(rProducts.status==='rejected'&&!PRODUCTS.length))renderProducts();
      renderLinked();
      if(!(rOrders.status==='rejected'&&!ORDERS.length))renderOrders();
      renderOrderProducts();
      renderOrderPreview();
      renderCod();
      if(!(rSettlements.status==='rejected'&&!SETTLEMENTS.length))renderMoney();
      if(!(rSourcing.status==='rejected'&&!Object.keys(SOURCING_BOARD||{}).length))renderRequests();
      if(!(rSamples.status==='rejected'&&!SAMPLES.length))renderSamples();
      renderAlerts();

      if(failures.length){
        status(local(
          `Some sections could not refresh: ${[...new Set(failures)].join(', ')}. Working sections are still available.`,
          `تعذر تحديث بعض الأقسام: ${[...new Set(failures)].join('، ')}. باقي الأقسام ما زالت متاحة.`
        ),true);
      }else if(showMessage){
        status('Everything is up to date.');
      }
    }catch(e){
      status(e.message,true);
    }
  }

  async function showDash(){
    SESSION=IZZY.session();
    if(!SESSION?.access_token){location.href='login.html';return}
    const rows=await IZZY.request(`/rest/v1/dropshippers?select=id,status,business_name&profile_id=eq.${encodeURIComponent(SESSION.user.id)}&limit=1`);
    if(!rows?.length){location.href='login.html';return}
    DROPSHIPPER=rows[0];
    if(DROPSHIPPER.status!=='active'){
      const g=$('#gate-message');
      if(g)g.textContent=local('Your IzzyDrop dropshipper account is '+DROPSHIPPER.status+'.','حساب الدروبشيبر الخاص بك حالته '+DROPSHIPPER.status+'.');
      return;
    }
    $('#gate').hidden=true;
    $('#dashboard').hidden=false;
    $('#user-email').textContent=SESSION?.user?.email||'Signed in';
    setLoading();
    go('products');
    await load();
    const params=new URLSearchParams(location.search);
    const requestId=params.get('request');
    if(requestId){go('requests');const card=document.getElementById('request-'+requestId);if(card){card.classList.add('is-highlighted');card.scrollIntoView({block:'center'});}}
    const sourcedOffer=params.get('sourced');
    if(sourcedOffer){go('sourced');const card=document.getElementById('sourced-'+sourcedOffer);if(card){card.classList.add('is-highlighted');card.scrollIntoView({block:'center'});}else status('This sourced offer is no longer available.',true);}
    const addProduct=params.get('add');
    const sampleProduct=params.get('sample');
    if(addProduct){
      history.replaceState({},document.title,location.pathname);
      const existing=LINKS.find(l=>l.supplier_product_id===addProduct);
      const p=PRODUCTS.find(x=>x.product_id===addProduct)||LINKED_PRODUCTS.find(x=>x.product_id===addProduct);
      if(existing){
        go('linked');
        status(local('Product is already in My Products.','المنتج موجود بالفعل في منتجاتي.'));
      }else if(p&&p.available!==false){
        try{
          await IZZY.request('/rest/v1/dropshipper_product_links',{
            method:'POST',
            headers:{Prefer:'return=minimal'},
            body:JSON.stringify({
              dropshipper_id:DROPSHIPPER.id,
              supplier_product_id:addProduct,
              retail_price:Number(p.suggested_retail_price||0),
              status:'active',
              last_seen_cost:Number(p.supplier_cost||p.supplier_price||0),
              last_seen_stock:Number(p.stock_quantity||0)
            })
          });
          await load(false);
          go('linked');
          status(local('Product added to My Products.','تمت إضافة المنتج إلى منتجاتي.'));
        }catch(e){status(e.message,true)}
      }else if(p){
        go('linked');
        status(p.availability_reason||local('This product is not available.','هذا المنتج غير متاح.'),true);
      }
    }
    if(sampleProduct){
      history.replaceState({},document.title,location.pathname);
      const p=PRODUCTS.find(x=>x.product_id===sampleProduct);
      if(p)await openSampleRequest(sampleProduct);
    }
  }

  $('#product-search').oninput=renderProducts;
  $('#product-category').onchange=renderProducts;
  $('#product-sort').onchange=renderProducts;
  $('#in-stock-only').onchange=renderProducts;
  $('#trending-only').onchange=renderProducts;
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>go(b.dataset.view));
  $('#close-modal').onclick=()=>$('#link-modal').hidden=true;
  $('#link-modal').onclick=e=>{if(e.target===$('#link-modal'))$('#link-modal').hidden=true};
  $('#close-sample-modal').onclick=()=>$('#sample-modal').hidden=true;
  $('#sample-modal').onclick=e=>{if(e.target===$('#sample-modal'))$('#sample-modal').hidden=true};

  $('#web-setup-form').onsubmit=async e=>{
    e.preventDefault();
    const btn=$('#web-setup-submit'),st=$('#copy-status');
    const productId=$('#web-product-id').value;
    const rawUrl=$('#web-url').value.trim();

    try{
      const u=new URL(rawUrl);
      if(!['http:','https:'].includes(u.protocol))throw Error('Website URL must begin with http:// or https://');
    }catch{
      st.textContent='Enter a valid website URL, for example https://yourstore.com';
      st.className='status bad';
      return;
    }

    const selected=[...document.querySelectorAll('.web-variant-check:checked')].map(check=>{
      const id=check.dataset.webVariantId;
      const price=Number(document.querySelector(`[data-web-variant-price="${id}"]`)?.value);
      return {variant_id:id,retail_price:price};
    });

    if(!selected.length){
      st.textContent='Choose at least one variant to add to your website.';
      st.className='status bad';
      return;
    }

    if(selected.some(v=>!Number.isFinite(v.retail_price)||v.retail_price<0)){
      st.textContent='Enter a valid selling price for every selected variant.';
      st.className='status bad';
      return;
    }

    btn.disabled=true;btn.textContent='Connecting website…';
    st.textContent='Creating automatic order connection…';st.className='status';
    try{
      const result=await IZZY.rpc('configure_storefront_integration_v2',{
        _product_id:productId,
        _website_url:rawUrl,
        _variants:selected
      });
      CURRENT_WEB_TOKEN=result.public_token;
      $('#web-embed-code').value=makeEmbedCode(CURRENT_WEB_TOKEN);
      $('#web-code-section').hidden=false;
      $('#open-test-store').hidden=false;
      st.textContent='Website connection ready. Paste the embed code once on your product page.';
      st.className='status ok';
      await load(false);
      btn.textContent='Update web setup';
    }catch(err){
      st.textContent=err.message;
      st.className='status bad';
    }finally{
      btn.disabled=false;
      if(btn.textContent==='Connecting website…')btn.textContent='Create automatic web setup';
    }
  };

  $('#use-test-store').onclick=()=>{
    const url=new URL('test-store.html',location.href);
    $('#web-url').value=url.href;
    $('#copy-status').textContent='Test store selected. Choose variants and prices, then create the setup.';
    $('#copy-status').className='status';
  };

  $('#open-test-store').onclick=()=>{
    if(!CURRENT_WEB_TOKEN)return;
    const url=new URL('test-store.html',location.href);
    url.searchParams.set('token',CURRENT_WEB_TOKEN);
    window.open(url.href,'_blank','noopener');
  };

  $('#select-all-web-variants').onclick=()=>{
    const checks=[...document.querySelectorAll('.web-variant-check')];
    const shouldCheck=checks.some(x=>!x.checked);
    checks.forEach(x=>x.checked=shouldCheck);
    $('#select-all-web-variants').textContent=shouldCheck?'Clear all':'Select all';
  };

  $('#copy-web-code').onclick=async()=>{
    const code=$('#web-embed-code').value;
    const st=$('#copy-status');
    try{
      await navigator.clipboard.writeText(code);
      st.textContent='Embed code copied. Paste it on the product page of your website.';
      st.className='status ok';
    }catch{
      $('#web-embed-code').select();
      document.execCommand('copy');
      st.textContent='Embed code copied.';
      st.className='status ok';
    }
  };

  $('#sample-form').onsubmit=async e=>{
    e.preventDefault();
    const btn=$('#sample-submit'),st=$('#sample-status');
    const productId=$('#sample-product-id').value,variantId=$('#sample-variant').value;
    if(!variantId){st.textContent=local('Choose a variant.','اختر أحد الخيارات.');st.className='status bad';return}
    btn.disabled=true;btn.textContent=local('Sending…','جارٍ الإرسال…');st.textContent='';
    try{
      const id=await IZZY.rpc('order_product_sample',{
        _product_id:productId,
        _variant_id:variantId,
        _shipping_address:{
          address1:$('#sample-address').value.trim(),
          city:$('#sample-city').value.trim(),
          governorate:$('#sample-governorate').value.trim()
        }
      });
      st.textContent=local('Sample request sent ✓ ','تم إرسال طلب العينة ✓ ')+String(id).slice(0,8);
      st.className='status ok';
      e.target.reset();
      setTimeout(()=>{$('#sample-modal').hidden=true;go('samples')},500);
      await load(false);
    }catch(err){st.textContent=err.message;st.className='status bad'}
    finally{btn.disabled=false;btn.textContent=local('Send sample request','إرسال طلب العينة')}
  };

  $('#toggle-order-form').onclick=()=>{$('#order-create-card').hidden=false;$('#toggle-order-form').hidden=true};
  $('#close-order-form').onclick=()=>{$('#order-create-card').hidden=true;$('#toggle-order-form').hidden=false};
  document.querySelectorAll('[data-order-filter]').forEach(b=>b.onclick=()=>{
    ORDER_FILTER=b.dataset.orderFilter;
    document.querySelectorAll('[data-order-filter]').forEach(x=>x.classList.toggle('on',x===b));
    renderOrders();
  });
  if($('#load-more-orders'))$('#load-more-orders').onclick=loadMoreOrders;

  $('#product-request-form').onsubmit=async e=>{
    e.preventDefault();
    const btn=$('#request-submit'),st=$('#request-status');
    btn.disabled=true;btn.textContent='Sending…';st.textContent='Sending request…';st.className='status';
    try{
      const id=await IZZY.rpc('sourcing_create_request',{_data:{
        title:$('#request-title').value.trim(),
        description:$('#request-description').value.trim(),
        source_url:$('#request-url').value.trim()||null,
        image_url:$('#request-image').value.trim()||null,
        notes:$('#request-notes').value.trim()||null,
        expected_quantity:$('#request-quantity').value===''?null:Number($('#request-quantity').value),
        target_cost:$('#request-target-cost').value===''?null:Number($('#request-target-cost').value)
      }});
      st.textContent='Sourcing request sent ✓ '+String(id).slice(0,8);
      e.target.reset();await load(false);
    }catch(err){st.textContent=err.message;st.className='status bad'}
    finally{btn.disabled=false;btn.textContent='Send sourcing request'}
  };

  $('#order-product').onchange=loadOrderVariants;
  $('#order-variant').onchange=renderOrderPreview;
  $('#order-qty').oninput=renderOrderPreview;

  let fallbackManualOrderAttempt=null;
  const manualOrderAttemptStorageKey=()=>`izzydrop:manual-order-attempt:v1:${SESSION?.user?.id||'session'}`;
  const hashAttemptPayload=async payload=>{
    const text=JSON.stringify(payload);
    if(globalThis.crypto?.subtle&&globalThis.TextEncoder){
      const bytes=new TextEncoder().encode(text);
      const digest=await crypto.subtle.digest('SHA-256',bytes);
      return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
    }
    let h1=2166136261,h2=2246822519;
    for(let i=0;i<text.length;i++){
      h1=Math.imul(h1^text.charCodeAt(i),16777619);
      h2=Math.imul(h2^text.charCodeAt(i),3266489917);
    }
    return `${(h1>>>0).toString(16)}${(h2>>>0).toString(16)}`;
  };
  const readManualOrderAttempt=()=>{
    try{return JSON.parse(sessionStorage.getItem(manualOrderAttemptStorageKey())||'null')||fallbackManualOrderAttempt}catch(e){return fallbackManualOrderAttempt}
  };
  const writeManualOrderAttempt=attempt=>{
    fallbackManualOrderAttempt=attempt;
    try{sessionStorage.setItem(manualOrderAttemptStorageKey(),JSON.stringify(attempt))}catch(e){}
  };
  const clearManualOrderAttempt=()=>{
    fallbackManualOrderAttempt=null;
    try{sessionStorage.removeItem(manualOrderAttemptStorageKey())}catch(e){}
  };

  $('#order-form').onsubmit=async e=>{
    e.preventDefault();
    const s=$('#order-status'),btn=$('#order-submit');
    btn.disabled=true;btn.textContent='Sending…';s.textContent='Creating order…';s.className='status';
    try{
      const request={
        _product_id:$('#order-product').value,
        _variant_id:$('#order-variant').value,
        _quantity:Number($('#order-qty').value||1),
        _customer_name:$('#order-customer-name').value.trim(),
        _customer_phone:$('#order-customer-phone').value.trim(),
        _customer_email:$('#order-customer-email').value.trim()||null,
        _shipping_address:{address1:$('#order-address1').value.trim(),city:$('#order-city').value.trim(),governorate:$('#order-governorate').value.trim()},
        _external_order_ref:$('#order-ref').value.trim()||null
      };
      const fingerprint=await hashAttemptPayload(request);
      let attempt=readManualOrderAttempt();
      if(!attempt||attempt.fingerprint!==fingerprint){
        attempt={key:crypto.randomUUID(),fingerprint};
        writeManualOrderAttempt(attempt);
      }
      const orderId=await IZZY.rpc('create_dropshipper_order',{
        ...request,
        _idempotency_key:attempt.key
      });
      clearManualOrderAttempt();
      s.textContent='Order created ✓ '+String(orderId).slice(0,8);
      $('#order-form').reset();
      $('#order-variant').innerHTML='<option value="">Choose variant</option>';
      $('#order-variant').disabled=true;
      $('#order-create-card').hidden=true;
      $('#toggle-order-form').hidden=false;
      await load();
    }catch(err){s.textContent=err.message;s.className='status bad';/* keep the persisted attempt so refresh/retry uses the same key */}
    finally{btn.disabled=SHIPPING?.available!==true;btn.textContent='Send order to IzzyDrop';renderOrderPreview()}
  };

  const notificationBell=$('#dropshipper-notification-bell');
  const notificationPanel=$('#dropshipper-notification-panel');
  if(notificationBell&&notificationPanel){
    notificationBell.onclick=e=>{
      e.stopPropagation();
      const next=notificationPanel.hidden;
      notificationPanel.hidden=!next;
      notificationBell.setAttribute('aria-expanded',next?'true':'false');
    };
    notificationPanel.onclick=e=>e.stopPropagation();
    document.addEventListener('click',()=>{
      notificationPanel.hidden=true;
      notificationBell.setAttribute('aria-expanded','false');
    });
  }
  if($('#dropshipper-mark-all-read'))$('#dropshipper-mark-all-read').onclick=markAllAlertsRead;
  if($('#dropshipper-load-more-alerts'))$('#dropshipper-load-more-alerts').onclick=loadOlderAlerts;

  showDash().catch(e=>{
    const g=$('#gate-message');
    if(g){g.textContent=e.message;g.style.color='var(--bad)'}
  });
})();
