(()=>{
  const $=s=>document.querySelector(s);
  let PRODUCTS=[],LINKED_PRODUCTS=[],LINKS=[],INTEGRATIONS=[],INTEGRATION_VARIANTS=[],ORDERS=[],ITEMS=[],REQUESTS=[],QUOTES=[],SAMPLES=[],ALERTS=[],COD={},SESSION=null,DROPSHIPPER=null,ORDER_FILTER='all',CURRENT_WEB_TOKEN=null;

  const VIEW_COPY={
    products:['Products','Browse products with live profit, supplier and trend intelligence.'],
    requests:['Find a product','Ask IzzyDrop suppliers to source a product you want to sell.'],
    linked:['My products','Manage pricing, availability and the products you have chosen.'],
    samples:['Samples','Track the product samples you requested from suppliers.'],
    orders:['Orders','Create orders and track shipping and COD delivery results.'],
    settings:['Settings','Manage your IzzyDrop account, appearance and security.']
  };

  const productName=p=>window.IZZY_I18N?.productName(p)||p?.name||'';
  const productDescription=p=>window.IZZY_I18N?.productDescription(p)||p?.description||'';
  const ar=()=>window.IZZY_I18N?.isArabic?.()===true;
  const local=(en,arText)=>ar()?arText:en;
  const variantLabel=v=>{
    const entries=Object.entries(v?.option_values||v?.options||{}).filter(([,value])=>String(value??'').trim());
    return entries.length?entries.map(([name,value])=>`${name}: ${value}`).join(' · '):(v?.variant_name||v?.name||v?.sku||'Default');
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
    if(sort==='price-low')a.sort((a,b)=>Number(a.suggested_retail_price||0)-Number(b.suggested_retail_price||0));
    else if(sort==='price-high')a.sort((a,b)=>Number(b.suggested_retail_price||0)-Number(a.suggested_retail_price||0));
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
    $('#product-results-meta').textContent=`${a.length} product${a.length===1?'':'s'} shown`;
    $('#products').innerHTML=a.map(p=>{
      const isLinked=linked.has(p.product_id);
      const stock=Number(p.stock_quantity||0);
      const name=productName(p),desc=productDescription(p);
      return `<article class="card product-card dropshipper-product-card">
        <a class="product-image product-open" href="${productDetailsUrl(p)}">
          ${p.primary_image_url?`<img src="${IZZY.esc(p.primary_image_url)}" alt="${IZZY.esc(name)}">`:'<span>IZ</span>'}
        </a>
        <div class="product-body">
          <div class="product-card-topline">
            <span class="tag ${stock>0?'ok':'warn'}">${stock>0?local(`${stock} in stock`,`${stock} متوفر`):local('Out of stock','نفد المخزون')}</span>
            ${p.category_name?`<span class="product-category">${IZZY.esc(p.category_name)}</span>`:''}
          </div>
          <a class="product-title-link" href="${productDetailsUrl(p)}"><h3>${IZZY.esc(name)}</h3></a>
          <p class="supplier-line">${local('Sold by','يباع بواسطة')} <b>${IZZY.esc(p.supplier_name||local('IzzyDrop supplier','مورّد IzzyDrop'))}</b></p>
          <p class="product-description">${IZZY.esc(desc||(ar()?'جاهز لمتجرك.':'Ready for your store.'))}</p>
          <div class="product-intelligence-row">
            <span class="intel-pill">${p.supplier_score==null?local('New supplier','مورّد جديد'):`IzzyScore ${Number(p.supplier_score).toFixed(1)}/10`}</span>
            ${p.trending?'<span class="intel-pill hot">🔥 '+local('Trending','رائج')+'</span>':''}
            <span class="intel-pill">${Number(p.orders_7d||0)} ${local('orders / 7d','طلبات / 7 أيام')}</span>
            <span class="intel-pill">${Number(p.active_store_count||0)} ${local('stores','متاجر')}</span>
          </div>
          <div class="profit-box" data-profit-box="${p.product_id}" data-cost="${Number(p.supplier_cost||0)}" data-shipping="${Number(p.estimated_shipping_cost||0)}">
            <div><small>${local('Supplier price','سعر المورّد')}</small><b>${IZZY.money(p.supplier_cost,p.currency)}</b></div>
            <div><small>${local('Est. shipping','الشحن التقديري')}</small><b>${IZZY.money(p.estimated_shipping_cost,p.currency)}</b></div>
            <label><small>${local('Your selling price','سعر بيعك')}</small><input class="profit-price" data-profit-id="${p.product_id}" type="number" min="0" step="1" value="${Number(p.suggested_retail_price||0)}"></label>
            <div><small>${local('Est. profit','الربح التقديري')}</small><b class="profit-value" data-profit-value="${p.product_id}">—</b><span class="profit-margin" data-profit-margin="${p.product_id}"></span></div>
          </div>
          <div class="product-price-block">
            <div><small>${local('Suggested selling price','سعر البيع المقترح')}</small><strong>${IZZY.money(p.suggested_retail_price,p.currency)}</strong></div>
            <span class="sku">${IZZY.esc(p.sku||'')}</span>
          </div>
          <div class="product-card-actions">
            <a class="btn secondary details-btn" href="${productDetailsUrl(p)}">${local('View details','عرض التفاصيل')}</a>
            <button class="btn sample-btn" data-id="${p.product_id}">${local('Request sample','طلب عينة')}</button>
            <button class="btn link-btn" data-id="${p.product_id}" data-slug="${IZZY.esc(p.public_slug)}" data-linked="${isLinked?'1':'0'}">${isLinked?local('Add to your web','أضفه إلى موقعك'):local('Add to My Products','أضف إلى منتجاتي')}</button>
          </div>
        </div>
      </article>`;
    }).join('')||`<div class="empty-state">
      <div class="empty-icon">⌕</div>
      <h3>No products match</h3>
      <p>Try changing your search or filters.</p>
      <button id="clear-product-filters" class="btn secondary">Clear filters</button>
    </div>`;

    document.querySelectorAll('.link-btn').forEach(b=>b.onclick=()=>linkProduct(b));
    document.querySelectorAll('.sample-btn').forEach(b=>b.onclick=()=>openSampleRequest(b.dataset.id));
    document.querySelectorAll('.profit-price').forEach(input=>{
      const update=()=>{
        const p=PRODUCTS.find(x=>x.product_id===input.dataset.profitId);
        if(!p)return;
        const price=Number(input.value||0),cost=Number(p.supplier_cost||0),shipping=Number(p.estimated_shipping_cost||0);
        const profit=price-cost-shipping,margin=price>0?(profit/price)*100:0;
        const value=document.querySelector(`[data-profit-value="${p.product_id}"]`);
        const pct=document.querySelector(`[data-profit-margin="${p.product_id}"]`);
        if(value){value.textContent=IZZY.money(profit,p.currency);value.classList.toggle('negative',profit<0);value.classList.toggle('positive',profit>=0)}
        if(pct)pct.textContent=`${margin.toFixed(1)}% ${local('margin','هامش')}`;
      };
      input.oninput=update;update();
    });
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
    const selling=Number(l.retail_price??p.suggested_retail_price??0);
    const suggested=Number(p.suggested_retail_price||0);
    const difference=selling-suggested;
    const integration=INTEGRATIONS.find(x=>x.link_id===l.id);
    const available=p.available!==false;
    const reason=p.availability_reason||local('This product is currently unavailable.','هذا المنتج غير متاح حاليًا.');
    const details=available&&p.public_slug?productDetailsUrl(p):null;
    return `<article class="card linked-product-card ${available?'':'is-unavailable'}">
      <div class="linked-product-main">
        <a class="linked-thumb" href="${details||'#'}">
          ${p.primary_image_url?`<img src="${IZZY.esc(p.primary_image_url)}" alt="">`:'IZ'}
        </a>
        <div class="linked-info">
          <div class="row linked-title-row"><div><h3>${IZZY.esc(productName(p)||local('Product','المنتج'))}</h3><small>${IZZY.esc(p.supplier_name||local('IzzyDrop supplier','مورّد IzzyDrop'))} · ${Number(p.stock_quantity||0)} ${local('in stock','متوفر')}</small></div><span class="tag ${available?(integration?.enabled?'ok':''):'bad'}">${available?(integration?.enabled?local('Web connected','الموقع متصل'):local('My product','منتجي')):local('Unavailable','غير متاح')}</span></div>
          ${available?'':`<div class="notice bad linked-unavailable-note"><b>${local('Unavailable','غير متاح')}</b><span>${IZZY.esc(reason)}</span></div>`}
          <div class="linked-price-grid">
            <div><small>${local('Suggested','المقترح')}</small><b>${IZZY.money(suggested,p.currency)}</b></div>
            <label><small>${local('Your selling price','سعر بيعك')}</small><div class="price-editor"><input class="linked-price-input" data-link-id="${l.id}" type="number" min="0" step="0.01" value="${selling}" ${available?'':'disabled'}><span>${IZZY.esc(p.currency||'EGP')}</span></div></label>
            <div><small>${local('Vs suggested','مقارنة بالمقترح')}</small><b class="${difference>=0?'positive':'negative'}">${difference===0?'—':(difference>0?'+':'')+IZZY.money(difference,p.currency)}</b></div>
          </div>
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
    const price=Number(input?.value);
    if(!Number.isFinite(price)||price<0){status('Enter a valid selling price.',true);return}
    btn.disabled=true;btn.textContent='Saving…';
    try{
      await IZZY.request(`/rest/v1/dropshipper_product_links?id=eq.${encodeURIComponent(btn.dataset.linkId)}`,{method:'PATCH',body:JSON.stringify({retail_price:price,updated_at:new Date().toISOString()})});
      status('Selling price saved.');
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
      let actions='';
      if(o.status==='shipped')actions=`<div class="order-delivery-actions"><button class="btn secondary delivery-status-btn" data-id="${o.id}" data-next="in_transit">${local('Mark in transit','تحديد قيد التوصيل')}</button><button class="btn delivery-status-btn" data-id="${o.id}" data-next="delivered">${local('Delivered','تم التوصيل')}</button><button class="btn secondary delivery-status-btn" data-id="${o.id}" data-next="refused">${local('Customer refused','رفض العميل')}</button></div>`;
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
          <div><small>${local('Total','الإجمالي')}</small><b>${IZZY.money(o.total_amount,o.currency)}</b><span>${IZZY.esc(window.IZZY_I18N?.status?.(o.payment_status)||o.payment_status||'')}</span></div>
        </div>
        <details class="order-details">
          <summary>${local('Order details','تفاصيل الطلب')}</summary>
          <div class="order-details-grid">
            <div><small>${local('Delivery address','عنوان التوصيل')}</small><p>${IZZY.esc([addr.address1,addr.city,addr.governorate].filter(Boolean).join(', ')||'—')}</p></div>
            <div><small>${local('Tracking','التتبع')}</small><p>${tracking||local('Waiting for supplier to ship','في انتظار شحن المورّد')}</p></div>
            <div><small>${local('Source','المصدر')}</small><p>${IZZY.esc(o.source||'manual')}</p></div>
          </div>
        </details>
        ${actions}
      </article>`;
    }).join('')||`<div class="empty-state"><div class="empty-icon">□</div><h3>${local('No orders found','لا توجد طلبات')}</h3><p>${local('Create your first order when a customer buys one of your products.','أنشئ أول طلب عندما يشتري عميل أحد منتجاتك.')}</p></div>`;

    document.querySelectorAll('.delivery-status-btn').forEach(b=>b.onclick=()=>updateDeliveryStatus(b));
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

  async function loadOrderVariants(){
    const productId=$('#order-product').value,el=$('#order-variant');
    el.innerHTML='<option value="">Choose variant</option>';el.disabled=true;
    if(!productId)return;
    try{
      const vs=await IZZY.rpc('marketplace_variants_v2',{_product_id:productId});
      el.innerHTML='<option value="">Choose variant</option>'+vs.map(v=>`<option value="${IZZY.esc(v.id)}" ${Number(v.stock_quantity)<=0?'disabled':''}>${IZZY.esc(variantLabel(v))} · ${v.stock_quantity} in stock</option>`).join('');
      el.disabled=false;
    }catch(e){$('#order-status').textContent=e.message;$('#order-status').className='status bad'}
  }

  function integrationForProduct(productId){
    const link=LINKS.find(x=>x.supplier_product_id===productId);
    if(!link)return null;
    return INTEGRATIONS.find(x=>x.link_id===link.id)||null;
  }

  function makeEmbedCode(token){
    return `<div data-izzydrop-token="${token}"></div>\n<script src="https://youssefhellal05.github.io/izzydrop-web/izzydrop-widget.js?v=20260924-finish1" async><\/script>`;
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
      const variants=await IZZY.rpc('marketplace_variants_v2',{_product_id:productId});
      const existing=integration?INTEGRATION_VARIANTS.filter(x=>x.integration_id===integration.id):[];
      const existingMap=new Map(existing.map(x=>[x.variant_id,x]));
      const defaultPrice=Number(link?.retail_price??p.suggested_retail_price??0);

      $('#web-variant-list').innerHTML=(variants||[]).map(v=>{
        const configured=existingMap.get(v.id);
        const checked=integration?!!configured:true;
        const price=Number(configured?.retail_price??defaultPrice);
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
    if(b.dataset.linked==='1'){openWebSetup(b.dataset.id);return}
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
          retail_price:Number(p.suggested_retail_price||0),
          status:'active',
          last_seen_cost:Number(p.supplier_cost||0),
          last_seen_stock:Number(p.stock_quantity||0)
        })
      });
      status('Product added to My Products. You can sell it manually or connect it to any website.');
      await load(false);
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
      const variants=await IZZY.rpc('marketplace_variants_v2',{_product_id:productId});
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
          <div><small>${local('Supplier','المورّد')}</small><b>${IZZY.esc(x.supplier_name||'—')}</b></div>
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

  function renderRequests(){
    const el=$('#product-requests');if(!el)return;
    const byRequest=new Map();
    (QUOTES||[]).forEach(q=>{if(!byRequest.has(q.request_id))byRequest.set(q.request_id,[]);byRequest.get(q.request_id).push(q)});
    el.innerHTML=(REQUESTS||[]).map(r=>{
      const quotes=byRequest.get(r.id)||[];
      const quoteHtml=quotes.map(q=>{
        const accepted=q.status==='accepted';
        const declined=q.status==='declined';
        const pname=productName({name:q.product_name,name_en:q.product_name_en,name_ar:q.product_name_ar});
        return `<div class="sourcing-quote ${accepted?'is-accepted':''} ${declined?'is-declined':''}">
          <div><b>${IZZY.esc(q.supplier_name||local('Supplier','المورّد'))}</b><small>${q.available_quantity==null?'':`${q.available_quantity} ${local('available','متاح')}`}${q.lead_time_days==null?'':` · ${q.lead_time_days} ${local('day lead time','يوم مدة تجهيز')}`}</small></div>
          <strong>${IZZY.money(q.offered_cost,'EGP')}</strong>
          ${q.message?`<p>${IZZY.esc(q.message)}</p>`:''}
          ${pname?`<small>${local('Matched product','المنتج المطابق')}: ${IZZY.esc(pname)}</small>`:''}
          <div class="sourcing-quote-actions">
            ${q.public_slug?`<a class="btn secondary" href="product.html?slug=${encodeURIComponent(q.public_slug)}&from=app">${local('View product','عرض المنتج')}</a>`:''}
            ${!accepted&&!declined&&r.status!=='accepted'?`<button class="btn accept-quote" data-id="${q.id}">${local('Accept quote','قبول العرض')}</button>`:''}
            ${accepted?`<span class="tag ok">${local('Accepted','تم القبول')}</span>`:''}
            ${declined?`<span class="tag">${local('Not selected','لم يتم اختياره')}</span>`:''}
          </div>
        </div>`;
      }).join('');
      return `<article class="card order-card">
        <div class="order-card-head"><div><span class="order-id">${IZZY.esc(r.title)}</span><small>${new Date(r.created_at).toLocaleString()}</small></div><span class="tag ${r.status==='accepted'?'ok':r.status==='matched'?'ok':'warn'}">${IZZY.esc(window.IZZY_I18N?.status?.(r.status)||r.status)}</span></div>
        <div class="order-summary-grid"><div><small>${local('Target cost','التكلفة المستهدفة')}</small><b>${r.target_cost==null?'—':IZZY.money(r.target_cost,'EGP')}</b></div><div><small>${local('Source','المصدر')}</small><b>${r.source_url?'<a href="'+IZZY.esc(r.source_url)+'" target="_blank" rel="noopener">'+local('Open link','فتح الرابط')+'</a>':'—'}</b></div><div><small>${local('Notes','ملاحظات')}</small><span>${IZZY.esc(r.notes||'—')}</span></div></div>
        <div class="sourcing-quotes">${quoteHtml||`<div class="notice">${local('No supplier quotes yet.','لا توجد عروض من المورّدين بعد.')}</div>`}</div>
      </article>`;
    }).join('')||`<div class="empty-state"><div class="empty-icon">⌕</div><h3>${local('No sourcing requests yet','لا توجد طلبات توريد بعد')}</h3><p>${local('Send a product link or description and IzzyDrop suppliers can quote it.','أرسل رابط منتج أو وصفًا وسيتمكن مورّدو IzzyDrop من تقديم عروض.')}</p></div>`;

    document.querySelectorAll('.accept-quote').forEach(btn=>btn.onclick=async()=>{
      if(!confirm(local('Accept this supplier quote? Other quotes for this request will be closed.','قبول عرض هذا المورّد؟ سيتم إغلاق باقي العروض لهذا الطلب.')))return;
      btn.disabled=true;
      try{
        await IZZY.rpc('accept_product_request_quote',{_quote_id:btn.dataset.id});
        status(local('Supplier quote accepted.','تم قبول عرض المورّد.'));
        await load(false);
      }catch(e){status(e.message,true);btn.disabled=false}
    });
  }

  function renderAlerts(){
    const el=$('#inventory-alerts');if(!el)return;
    const unread=(ALERTS||[]).filter(a=>!a.read_at);
    el.innerHTML=unread.slice(0,8).map(a=>`<div class="notice alert-notice"><b>${IZZY.esc(a.title)}</b><span>${IZZY.esc(a.message)}</span><button class="auth-text-button mark-alert" data-id="${a.id}">Mark read</button></div>`).join('');
    document.querySelectorAll('.mark-alert').forEach(b=>b.onclick=async()=>{
      await IZZY.request(`/rest/v1/dropshipper_alerts?id=eq.${encodeURIComponent(b.dataset.id)}`,{method:'PATCH',body:JSON.stringify({read_at:new Date().toISOString()})});
      await load(false);
    });
  }

  async function load(showMessage=false){
    try{
      [PRODUCTS,LINKED_PRODUCTS,LINKS,INTEGRATIONS,INTEGRATION_VARIANTS,ORDERS,ITEMS,REQUESTS,QUOTES,SAMPLES,ALERTS,COD]=await Promise.all([
        IZZY.rpc('marketplace_catalog_v3'),
        IZZY.rpc('dropshipper_linked_catalog'),
        IZZY.request('/rest/v1/dropshipper_product_links?select=*&order=created_at.desc'),
        IZZY.request('/rest/v1/storefront_integrations?select=*&order=created_at.desc'),
        IZZY.request('/rest/v1/storefront_integration_variants?select=*&order=created_at.asc'),
        IZZY.request('/rest/v1/orders?select=*&order=created_at.desc&limit=100'),
        IZZY.request('/rest/v1/order_items?select=id,order_id,supplier_product_id,variant_id,quantity,retail_price_at_purchase,fulfillment_status,tracking_number,shipping_carrier,created_at&order=created_at.desc&limit=200'),
        IZZY.request('/rest/v1/product_requests?select=*&order=created_at.desc&limit=50'),
        IZZY.rpc('dropshipper_sourcing_quotes'),
        IZZY.rpc('dropshipper_samples'),
        IZZY.request('/rest/v1/dropshipper_alerts?select=*&order=created_at.desc&limit=50'),
        IZZY.rpc('dropshipper_cod_metrics')
      ]);
      populateCategories();
      renderProducts();
      renderLinked();
      renderOrders();
      renderOrderProducts();
      renderCod();
      renderRequests();
      renderSamples();
      renderAlerts();
      if(showMessage)status('Everything is up to date.');
    }catch(e){status(e.message,true)}
  }

  async function showDash(){
    SESSION=IZZY.session();
    if(!SESSION?.access_token){location.href='login.html';return}
    const rows=await IZZY.request(`/rest/v1/dropshippers?select=id,status,business_name&profile_id=eq.${encodeURIComponent(SESSION.user.id)}&limit=1`);
    if(!rows?.length){location.href='login.html';return}
    DROPSHIPPER=rows[0];
    $('#gate').hidden=true;
    $('#dashboard').hidden=false;
    $('#user-email').textContent=SESSION?.user?.email||'Signed in';
    setLoading();
    go('products');
    await load();
    const addProduct=new URLSearchParams(location.search).get('add');
    if(addProduct&&PRODUCTS.some(p=>p.product_id===addProduct)){
      history.replaceState({},document.title,location.pathname);
      openWebSetup(addProduct);
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

  $('#product-request-form').onsubmit=async e=>{
    e.preventDefault();
    const btn=$('#request-submit'),st=$('#request-status');
    btn.disabled=true;btn.textContent='Sending…';st.textContent='Sending request…';st.className='status';
    try{
      const id=await IZZY.rpc('create_product_request',{
        _title:$('#request-title').value.trim(),
        _source_url:$('#request-url').value.trim()||null,
        _image_url:$('#request-image').value.trim()||null,
        _notes:$('#request-notes').value.trim()||null,
        _target_cost:$('#request-target-cost').value===''?null:Number($('#request-target-cost').value)
      });
      st.textContent='Sourcing request sent ✓ '+String(id).slice(0,8);
      e.target.reset();await load(false);
    }catch(err){st.textContent=err.message;st.className='status bad'}
    finally{btn.disabled=false;btn.textContent='Send sourcing request'}
  };

  $('#order-product').onchange=loadOrderVariants;
  $('#order-form').onsubmit=async e=>{
    e.preventDefault();
    const s=$('#order-status'),btn=$('#order-submit');
    btn.disabled=true;btn.textContent='Sending…';s.textContent='Creating order…';s.className='status';
    try{
      const orderId=await IZZY.rpc('create_dropshipper_order',{
        _product_id:$('#order-product').value,
        _variant_id:$('#order-variant').value,
        _quantity:Number($('#order-qty').value||1),
        _customer_name:$('#order-customer-name').value.trim(),
        _customer_phone:$('#order-customer-phone').value.trim(),
        _customer_email:$('#order-customer-email').value.trim()||null,
        _shipping_address:{address1:$('#order-address1').value.trim(),city:$('#order-city').value.trim(),governorate:$('#order-governorate').value.trim()},
        _external_order_ref:$('#order-ref').value.trim()||null
      });
      s.textContent='Order created ✓ '+String(orderId).slice(0,8);
      $('#order-form').reset();
      $('#order-variant').innerHTML='<option value="">Choose variant</option>';
      $('#order-variant').disabled=true;
      $('#order-create-card').hidden=true;
      $('#toggle-order-form').hidden=false;
      await load();
    }catch(err){s.textContent=err.message;s.className='status bad'}
    finally{btn.disabled=false;btn.textContent='Send order to IzzyDrop'}
  };

  showDash().catch(e=>{
    const g=$('#gate-message');
    if(g){g.textContent=e.message;g.style.color='var(--bad)'}
  });
})();