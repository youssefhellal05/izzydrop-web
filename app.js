(()=>{
  const $=s=>document.querySelector(s);
  let PRODUCTS=[],LINKS=[],ORDERS=[],ITEMS=[],SESSION=null,DROPSHIPPER=null,ORDER_FILTER='all';

  const VIEW_COPY={
    products:['Products','Browse products and add the ones you want to sell.'],
    linked:['My products','Manage pricing, product links and the products you have chosen.'],
    orders:['Orders','Create orders and track fulfillment from your suppliers.'],
    settings:['Settings','Manage your IzzyDrop account, appearance and security.']
  };

  const productName=p=>window.IZZY_I18N?.productName(p)||p?.name||'';
  const productDescription=p=>window.IZZY_I18N?.productDescription(p)||p?.description||'';
  const ar=()=>window.IZZY_I18N?.isArabic?.()===true;

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
  }

  function productDetailsUrl(p){
    return 'product.html?slug='+encodeURIComponent(p.public_slug)+'&from=app';
  }

  function filteredProducts(){
    const q=$('#product-search').value.trim().toLowerCase();
    const category=$('#product-category').value;
    const inStock=$('#in-stock-only').checked;
    const sort=$('#product-sort').value;
    let a=PRODUCTS.filter(p=>{
      const hay=[p.name,p.name_en,p.name_ar,p.description,p.description_en,p.description_ar,p.sku,p.supplier_name,p.category_name].filter(Boolean).join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(!category||String(p.category_name||'')===category)&&(!inStock||Number(p.stock_quantity)>0);
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
            <span class="tag ${stock>0?'ok':'warn'}">${stock>0?`${stock} in stock`:'Out of stock'}</span>
            ${p.category_name?`<span class="product-category">${IZZY.esc(p.category_name)}</span>`:''}
          </div>
          <a class="product-title-link" href="${productDetailsUrl(p)}"><h3>${IZZY.esc(name)}</h3></a>
          <p class="supplier-line">Sold by <b>${IZZY.esc(p.supplier_name||'IzzyDrop supplier')}</b></p>
          <p class="product-description">${IZZY.esc(desc||(ar()?'جاهز لمتجرك.':'Ready for your store.'))}</p>
          <div class="product-price-block">
            <div><small>Suggested selling price</small><strong>${IZZY.money(p.suggested_retail_price,p.currency)}</strong></div>
            <span class="sku">${IZZY.esc(p.sku||'')}</span>
          </div>
          <div class="product-card-actions">
            <a class="btn secondary details-btn" href="${productDetailsUrl(p)}">View details</a>
            <button class="btn link-btn" data-id="${p.product_id}" data-slug="${IZZY.esc(p.public_slug)}" data-linked="${isLinked?'1':'0'}">${isLinked?'Get link':'Link to your web'}</button>
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
    const clear=$('#clear-product-filters');
    if(clear)clear.onclick=()=>{
      $('#product-search').value='';
      $('#product-category').value='';
      $('#product-sort').value='newest';
      $('#in-stock-only').checked=false;
      renderProducts();
    };
  }

  function linkedProductCard(l,p){
    const selling=Number(l.retail_price??p.suggested_retail_price??0);
    const suggested=Number(p.suggested_retail_price||0);
    const difference=selling-suggested;
    return `<article class="card linked-product-card">
      <div class="linked-product-main">
        <a class="linked-thumb" href="${p.public_slug?productDetailsUrl(p):'#'}">
          ${p.primary_image_url?`<img src="${IZZY.esc(p.primary_image_url)}" alt="">`:'IZ'}
        </a>
        <div class="linked-info">
          <div class="row linked-title-row"><div><h3>${IZZY.esc(productName(p)||'Product')}</h3><small>${IZZY.esc(p.supplier_name||'IzzyDrop supplier')} · ${Number(p.stock_quantity||0)} in stock</small></div><span class="tag ok">Linked</span></div>
          <div class="linked-price-grid">
            <div><small>Suggested</small><b>${IZZY.money(suggested,p.currency)}</b></div>
            <label><small>Your selling price</small><div class="price-editor"><input class="linked-price-input" data-link-id="${l.id}" type="number" min="0" step="0.01" value="${selling}"><span>${IZZY.esc(p.currency||'EGP')}</span></div></label>
            <div><small>Vs suggested</small><b class="${difference>=0?'positive':'negative'}">${difference===0?'—':(difference>0?'+':'')+IZZY.money(difference,p.currency)}</b></div>
          </div>
        </div>
      </div>
      <div class="linked-actions">
        <button class="btn save-linked-price" data-link-id="${l.id}">Save price</button>
        <button class="btn secondary copy-linked" data-slug="${IZZY.esc(p.public_slug||'')}">Copy link</button>
        <a class="btn secondary" href="${p.public_slug?productDetailsUrl(p):'#'}">Details</a>
        <button class="text-danger remove-linked" data-link-id="${l.id}" data-product-name="${IZZY.esc(productName(p)||(ar()?'هذا المنتج':'this product'))}">Remove</button>
      </div>
    </article>`;
  }

  function renderLinked(){
    const map=new Map(PRODUCTS.map(p=>[p.product_id,p]));
    $('#linked').innerHTML=LINKS.map(l=>linkedProductCard(l,map.get(l.supplier_product_id)||{})).join('')||`<div class="empty-state">
      <div class="empty-icon">＋</div>
      <h3>No linked products yet</h3>
      <p>Choose products you want to sell and they will appear here.</p>
      <button id="browse-products-empty" class="btn">Browse products</button>
    </div>`;

    document.querySelectorAll('.save-linked-price').forEach(b=>b.onclick=()=>saveLinkedPrice(b));
    document.querySelectorAll('.copy-linked').forEach(b=>b.onclick=()=>openLink(b.dataset.slug));
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
    if(!confirm(`Remove ${btn.dataset.productName} from My products?`))return;
    btn.disabled=true;
    try{
      await IZZY.request(`/rest/v1/dropshipper_product_links?id=eq.${encodeURIComponent(btn.dataset.linkId)}`,{method:'DELETE'});
      status('Product removed from My products.');
      await load(false);
    }catch(e){status(e.message,true);btn.disabled=false}
  }

  function orderItemsFor(id){return ITEMS.filter(i=>i.order_id===id)}

  function orderStatusClass(s){
    if(s==='fulfilled')return 'ok';
    if(s==='pending')return 'warn';
    if(s==='cancelled'||s==='refunded')return 'bad';
    return '';
  }

  function renderOrders(){
    const pm=new Map(PRODUCTS.map(p=>[p.product_id,p]));
    const list=ORDERS.filter(o=>ORDER_FILTER==='all'||o.status===ORDER_FILTER);
    $('#orders').innerHTML=list.map(o=>{
      const items=orderItemsFor(o.id);
      const addr=o.shipping_address||{};
      const productText=items.map(i=>{
        const p=pm.get(i.supplier_product_id);
        return `${IZZY.esc(p?.name||'Product')} × ${Number(i.quantity||1)}`;
      }).join(' · ')||'Order items';
      const tracking=items.map(i=>i.tracking_number?`${IZZY.esc(i.shipping_carrier||'Carrier')}: ${IZZY.esc(i.tracking_number)}`:'').filter(Boolean).join(' · ');
      return `<article class="card order-card">
        <div class="order-card-head">
          <div><span class="order-id">${IZZY.esc(o.external_order_ref||o.shopify_order_name||('Order '+String(o.id).slice(0,8)))}</span><small>${new Date(o.created_at).toLocaleString()}</small></div>
          <span class="tag ${orderStatusClass(o.status)}">${IZZY.esc(o.status)}</span>
        </div>
        <div class="order-summary-grid">
          <div><small>Customer</small><b>${IZZY.esc(o.customer_name||'—')}</b><span>${IZZY.esc(o.customer_phone||'')}</span></div>
          <div><small>Products</small><b>${productText}</b></div>
          <div><small>Total</small><b>${IZZY.money(o.total_amount,o.currency)}</b><span>${IZZY.esc(o.payment_status||'')}</span></div>
        </div>
        <details class="order-details">
          <summary>Order details</summary>
          <div class="order-details-grid">
            <div><small>Delivery address</small><p>${IZZY.esc([addr.address1,addr.city,addr.governorate].filter(Boolean).join(', ')||'—')}</p></div>
            <div><small>Tracking</small><p>${tracking||'Waiting for supplier fulfillment'}</p></div>
            <div><small>Source</small><p>${IZZY.esc(o.source||'manual')}</p></div>
          </div>
        </details>
      </article>`;
    }).join('')||`<div class="empty-state"><div class="empty-icon">□</div><h3>No ${ORDER_FILTER==='all'?'':ORDER_FILTER+' '}orders</h3><p>${ORDER_FILTER==='all'?'Create your first order when a customer buys one of your linked products.':'There are no orders with this status.'}</p></div>`;
  }

  function renderOrderProducts(){
    const map=new Map(PRODUCTS.map(p=>[p.product_id,p]));
    const el=$('#order-product');
    if(!el)return;
    const current=el.value;
    el.innerHTML='<option value="">Choose one of My products</option>'+LINKS.map(l=>{
      const p=map.get(l.supplier_product_id);
      return p?`<option value="${IZZY.esc(p.product_id)}">${IZZY.esc(p.name)}</option>`:'';
    }).join('');
    if([...el.options].some(o=>o.value===current))el.value=current;
  }

  async function loadOrderVariants(){
    const productId=$('#order-product').value,el=$('#order-variant');
    el.innerHTML='<option value="">Choose variant</option>';el.disabled=true;
    if(!productId)return;
    try{
      const vs=await IZZY.rpc('marketplace_variants',{_product_id:productId});
      el.innerHTML='<option value="">Choose variant</option>'+vs.map(v=>`<option value="${IZZY.esc(v.id)}" ${Number(v.stock_quantity)<=0?'disabled':''}>${IZZY.esc(v.variant_name||v.sku||'Default')} · ${v.stock_quantity} in stock</option>`).join('');
      el.disabled=false;
    }catch(e){$('#order-status').textContent=e.message;$('#order-status').className='status bad'}
  }

  function openLink(slug){
    if(!slug){status('This product link is not available yet.',true);return}
    const u=IZZY.productUrl(slug);
    $('#product-link').value=u;
    $('#copy-status').textContent='';
    $('#link-modal').hidden=false;
  }

  async function linkProduct(b){
    const already=b.dataset.linked==='1';
    if(already){openLink(b.dataset.slug);return}
    b.disabled=true;b.textContent='Linking…';
    try{
      await IZZY.rpc('link_product_to_web',{_product_id:b.dataset.id,_retail_price:null});
      await load(false);
      openLink(b.dataset.slug);
      status('Product added to My products.');
    }catch(e){status(e.message,true)}
    finally{b.disabled=false}
  }

  async function load(showMessage=false){
    try{
      [PRODUCTS,LINKS,ORDERS,ITEMS]=await Promise.all([
        IZZY.rpc('marketplace_catalog_v2'),
        IZZY.request('/rest/v1/dropshipper_product_links?select=*&order=created_at.desc'),
        IZZY.request('/rest/v1/orders?select=*&order=created_at.desc&limit=100'),
        IZZY.request('/rest/v1/order_items?select=id,order_id,supplier_product_id,variant_id,quantity,retail_price_at_purchase,fulfillment_status,tracking_number,shipping_carrier,created_at&order=created_at.desc&limit=200')
      ]);
      populateCategories();
      renderProducts();
      renderLinked();
      renderOrders();
      renderOrderProducts();
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
  }

  $('#product-search').oninput=renderProducts;
  $('#product-category').onchange=renderProducts;
  $('#product-sort').onchange=renderProducts;
  $('#in-stock-only').onchange=renderProducts;
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>go(b.dataset.view));
  $('#close-modal').onclick=()=>$('#link-modal').hidden=true;
  $('#link-modal').onclick=e=>{if(e.target===$('#link-modal'))$('#link-modal').hidden=true};
  $('#copy-link').onclick=async()=>{
    try{await navigator.clipboard.writeText($('#product-link').value);$('#copy-status').textContent='Copied.'}
    catch{$('#product-link').select();document.execCommand('copy');$('#copy-status').textContent='Copied.'}
  };

  $('#toggle-order-form').onclick=()=>{$('#order-create-card').hidden=false;$('#toggle-order-form').hidden=true};
  $('#close-order-form').onclick=()=>{$('#order-create-card').hidden=true;$('#toggle-order-form').hidden=false};
  document.querySelectorAll('[data-order-filter]').forEach(b=>b.onclick=()=>{
    ORDER_FILTER=b.dataset.orderFilter;
    document.querySelectorAll('[data-order-filter]').forEach(x=>x.classList.toggle('on',x===b));
    renderOrders();
  });

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