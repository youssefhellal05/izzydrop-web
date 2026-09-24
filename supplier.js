(()=>{
  const $=s=>document.querySelector(s);
  let SUP=null,PRODUCTS=[],VARIANTS=[],IMAGES=[],ORDERS=[],ITEMS=[],REQUESTS=[],QUOTES=[],SELECTED_IMAGES=[],ORDER_FILTER='all',NEW_CONTENT_LANG='en',NEW_SOURCE_LANGUAGE='en',EDIT_CONTENT_LANG='en',VARIANT_MODE='single';
  const SELECTED_PRODUCT_IDS=new Set();
  const VARIANT_COMBO_STATE=new Map();

  const VIEW_COPY={
    overview:['Overview','See what needs your attention today.'],
    products:['My Products','View and edit every product you have listed on IzzyDrop.'],
    requests:['Sourcing requests','Quote products dropshippers are actively looking for.'],
    orders:['Orders','Fulfill customer orders and add tracking when they ship.'],
    add:['Add product','Create a complete product listing for dropshippers.'],
    settings:['Settings','Manage your supplier account, notifications, appearance and security.']
  };

  const msg=(t,b=false)=>{
    const e=$('#status');
    if(e){e.textContent=t||'';e.className='status'+(b?' bad':'')}
  };

  function go(v){
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===v));
    document.querySelectorAll('.view').forEach(x=>x.hidden=true);
    const panel=$('#view-'+v);
    if(panel)panel.hidden=false;
    const copy=VIEW_COPY[v]||VIEW_COPY.overview;
    $('#supplier-page-title').textContent=copy[0];
    $('#supplier-page-subtitle').textContent=copy[1];
    msg('');
  }

  function orderFor(id){return ORDERS.find(o=>o.id===id)||{}}
  function productFor(id){return PRODUCTS.find(p=>p.id===id)||{}}
  function variantsFor(id){return VARIANTS.filter(v=>v.product_id===id)}
  function enabledVariantsFor(id){return variantsFor(id).filter(v=>v.is_enabled!==false)}
  function imagesFor(id){return IMAGES.filter(i=>i.product_id===id).sort((a,b)=>Number(a.position)-Number(b.position))}
  function totalStock(id){return enabledVariantsFor(id).reduce((n,v)=>n+Number(v.stock_quantity||0),0)}
  function threshold(){return Number(SUP?.low_stock_threshold??5)}
  function lowStockProduct(p){const vs=enabledVariantsFor(p.id);return vs.length>0&&vs.some(v=>Number(v.stock_quantity||0)<=threshold())}
  function supplierOrderState(item){
    if(item.fulfillment_status==='fulfilled')return 'fulfilled';
    if(item.fulfillment_status==='cancelled')return 'cancelled';
    const o=orderFor(item.order_id);
    return o.status==='processing'?'processing':'new';
  }
  const productName=p=>window.IZZY_I18N?.productName(p)||p?.name||'';
  const productDescription=p=>window.IZZY_I18N?.productDescription(p)||p?.description||'';
  const local=(en,ar)=>window.IZZY_I18N?.isArabic?.()?ar:en;

  const FIELD_HELP={
    sku:{
      en:'SKU means Stock Keeping Unit. It is a unique code you use to identify this product in your inventory. Enter your own code, or leave it blank and IzzyDrop will create one automatically.',
      ar:'SKU هو رمز فريد تستخدمه لتمييز المنتج داخل مخزونك. يمكنك كتابة رمزك الخاص، أو تركه فارغًا وسيقوم IzzyDrop بإنشائه تلقائيًا.'
    },
    cost:{
      en:'This is the price a dropshipper pays you for one unit of the product. IzzyDrop uses it when showing the dropshipper their estimated profit.',
      ar:'هذا هو السعر الذي يدفعه لك الدروبشيبر مقابل وحدة واحدة من المنتج. يستخدمه IzzyDrop لحساب الربح التقديري للدروبشيبر.'
    },
    retail:{
      en:'This is the selling price you recommend the dropshipper charges the final customer. It is only a suggestion — the dropshipper can choose a different selling price.',
      ar:'هذا هو سعر البيع الذي تقترحه على الدروبشيبر للعميل النهائي. هو سعر مقترح فقط، ويمكن للدروبشيبر اختيار سعر بيع مختلف.'
    }
  };

  function variantLabel(v){
    const opts=v?.option_values||v?.options||{};
    const entries=Object.entries(opts||{}).filter(([,value])=>String(value??'').trim());
    return entries.length?entries.map(([name,value])=>`${name}: ${value}`).join(' · '):(v?.variant_name||v?.name||v?.sku||'Default');
  }

  function setNewContentLang(lang,userAction=true){
    NEW_CONTENT_LANG=lang;
    if(userAction){
      const enHas=!!$('#p-name-en')?.value?.trim();
      const arHas=!!$('#p-name-ar')?.value?.trim();
      if(!enHas&&!arHas)NEW_SOURCE_LANGUAGE=lang;
      else if(lang==='en'&&enHas&&!arHas)NEW_SOURCE_LANGUAGE='en';
      else if(lang==='ar'&&arHas&&!enHas)NEW_SOURCE_LANGUAGE='ar';
    }
    document.querySelectorAll('[data-new-content-lang]').forEach(b=>b.classList.toggle('on',b.dataset.newContentLang===lang));
    document.querySelectorAll('[data-new-content-panel]').forEach(p=>p.hidden=p.dataset.newContentPanel!==lang);
    const btn=$('#p-translate-btn');
    if(btn)btn.textContent=lang==='en'?'Generate Arabic translation':'Generate English translation';
  }

  function setEditContentLang(lang){
    EDIT_CONTENT_LANG=lang;
    document.querySelectorAll('[data-edit-content-lang]').forEach(b=>b.classList.toggle('on',b.dataset.editContentLang===lang));
    document.querySelectorAll('[data-edit-content-panel]').forEach(p=>p.hidden=p.dataset.editContentPanel!==lang);
    const btn=$('#edit-translate-btn');
    if(btn)btn.textContent=lang==='en'?'Generate Arabic translation':'Generate English translation';
  }

  async function translateText(text,from,to){
    if(!String(text||'').trim())return '';
    const data=await IZZY.request('/functions/v1/translate-product',{
      method:'POST',
      body:JSON.stringify({text:String(text).trim(),from,to})
    });
    return data?.translated_text||'';
  }

  async function translateNewContent(){
    const from=NEW_CONTENT_LANG,to=from==='en'?'ar':'en';
    const sourceName=$('#p-name-'+from).value.trim();
    const sourceDescription=$('#p-description-'+from).value.trim();
    const st=$('#p-translation-status'),btn=$('#p-translate-btn');
    const targetHas=$('#p-name-'+to).value.trim()||$('#p-description-'+to).value.trim();
    if(targetHas&&!confirm(to==='ar'?'Replace the existing Arabic translation?':'Replace the existing English translation?'))return;
    if(!sourceName){st.textContent=from==='en'?'Enter the English product name first.':'أدخل اسم المنتج بالعربية أولًا.';st.className='status bad';return}
    btn.disabled=true;
    btn.textContent=from==='en'?'Translating to Arabic…':'Translating to English…';
    st.textContent='Generating a draft translation…';st.className='status';
    try{
      const [name,description]=await Promise.all([
        translateText(sourceName,from,to),
        sourceDescription?translateText(sourceDescription,from,to):Promise.resolve('')
      ]);
      $('#p-name-'+to).value=name;
      $('#p-description-'+to).value=description;
      setNewContentLang(to,false);
      st.textContent=to==='ar'?'تم إنشاء الترجمة العربية. راجعها وعدّلها قبل حفظ المنتج.':'English translation generated. Review and edit it before saving.';
    }catch(e){st.textContent=e.message||'Translation failed.';st.className='status bad'}
    finally{btn.disabled=false;btn.textContent=NEW_CONTENT_LANG==='en'?'Generate Arabic translation':'Generate English translation'}
  }

  async function translateEditContent(){
    const from=EDIT_CONTENT_LANG,to=from==='en'?'ar':'en';
    const sourceName=$('#edit-product-name-'+from).value.trim();
    const sourceDescription=$('#edit-product-description-'+from).value.trim();
    const st=$('#edit-translation-status'),btn=$('#edit-translate-btn');
    const targetHas=$('#edit-product-name-'+to).value.trim()||$('#edit-product-description-'+to).value.trim();
    if(targetHas&&!confirm(to==='ar'?'Replace the existing Arabic translation?':'Replace the existing English translation?'))return;
    if(!sourceName){st.textContent=from==='en'?'Enter the English product name first.':'أدخل اسم المنتج بالعربية أولًا.';st.className='status bad';return}
    btn.disabled=true;
    btn.textContent=from==='en'?'Translating to Arabic…':'Translating to English…';
    st.textContent='Generating a draft translation…';st.className='status';
    try{
      const [name,description]=await Promise.all([
        translateText(sourceName,from,to),
        sourceDescription?translateText(sourceDescription,from,to):Promise.resolve('')
      ]);
      $('#edit-product-name-'+to).value=name;
      $('#edit-product-description-'+to).value=description;
      setEditContentLang(to);
      st.textContent=to==='ar'?'تم إنشاء الترجمة العربية. راجعها وعدّلها قبل الحفظ.':'English translation generated. Review and edit it before saving.';
    }catch(e){st.textContent=e.message||'Translation failed.';st.className='status bad'}
    finally{btn.disabled=false;btn.textContent=EDIT_CONTENT_LANG==='en'?'Generate Arabic translation':'Generate English translation'}
  }

  function setLoading(){
    $('#attention-list').innerHTML='<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line medium" style="margin-top:10px"></div><div class="skeleton skeleton-line short" style="margin-top:10px"></div>';
    $('#today-summary').innerHTML='<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div>';
    $('#products').innerHTML=Array.from({length:4},()=>'<div class="supplier-product-table supplier-product-table-row"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-button"></div></div>').join('');
    $('#orders').innerHTML=Array.from({length:3},()=>'<div class="card supplier-order-card"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line" style="margin-top:12px"></div><div class="skeleton skeleton-line medium" style="margin-top:10px"></div></div>').join('');
  }

  async function verify(){
    const s=IZZY.session();
    if(!s?.user?.id){location.href='login.html';return false}

    let rows=await IZZY.request(`/rest/v1/suppliers?select=id,business_name,status,low_stock_threshold,notification_preferences&profile_id=eq.${encodeURIComponent(s.user.id)}&limit=1`);
    SUP=rows?.[0];

    if(!SUP){
      const prof=await IZZY.request(`/rest/v1/profiles?select=business_name,requested_account_type&id=eq.${encodeURIComponent(s.user.id)}&limit=1`);
      if(prof?.[0]?.requested_account_type==='supplier'){
        const created=await IZZY.request('/rest/v1/suppliers',{
          method:'POST',
          headers:{Prefer:'return=representation'},
          body:JSON.stringify({profile_id:s.user.id,business_name:prof[0].business_name||s.user.email,status:'pending'})
        });
        SUP=created?.[0];
      }
    }

    if(!SUP){location.href='login.html';return false}
    if(SUP.status!=='approved'){
      const g=$('#gate-message');
      g.textContent=SUP.status==='pending'?'Your IzzyDrop supplier application is waiting for admin approval.':'Your IzzyDrop supplier account is '+SUP.status+'.';
      return false;
    }

    $('#gate').hidden=true;
    $('#supplier').hidden=false;
    $('#business').textContent=SUP.business_name||'Supplier';
    $('#supplier-email').textContent=s.user.email||'';
    resetVariantBuilder();
    setLoading();
    await load();
    return true;
  }

  function renderOverview(){
    const newItems=ITEMS.filter(i=>supplierOrderState(i)==='new');
    const openItems=ITEMS.filter(i=>!['fulfilled','cancelled'].includes(i.fulfillment_status));
    const lowProducts=PRODUCTS.filter(lowStockProduct);
    const active=PRODUCTS.filter(p=>p.status==='active');

    $('#new-order-count').textContent=newItems.length;
    $('#open-order-count').textContent=openItems.length;
    $('#low-stock-count').textContent=lowProducts.length;
    $('#active-product-count').textContent=active.length;
    $('#total-product-label').textContent=`${PRODUCTS.length} total product${PRODUCTS.length===1?'':'s'}`;

    const attention=[];
    if(newItems.length)attention.push({
      type:'order',
      title:`${newItems.length} new order${newItems.length===1?'':'s'} waiting`,
      text:'Review customer details and prepare fulfillment.',
      action:'View orders',
      view:'orders',
      filter:'new'
    });
    if(lowProducts.length)attention.push({
      type:'stock',
      title:`${lowProducts.length} product${lowProducts.length===1?'':'s'} low on stock`,
      text:`At or below your warning level of ${threshold()} units.`,
      action:'Update stock',
      view:'products'
    });
    const inactive=PRODUCTS.filter(p=>p.status==='inactive');
    if(inactive.length)attention.push({
      type:'product',
      title:`${inactive.length} paused product${inactive.length===1?'':'s'}`,
      text:'Paused products are hidden from dropshippers.',
      action:'Manage products',
      view:'products'
    });

    $('#attention-list').innerHTML=attention.map(a=>`<div class="attention-row">
      <span class="attention-icon">${a.type==='order'?'↗':a.type==='stock'?'!':'•'}</span>
      <div><b>${IZZY.esc(a.title)}</b><small>${IZZY.esc(a.text)}</small></div>
      <button class="btn secondary attention-action" data-attention-view="${a.view}" ${a.filter?`data-attention-filter="${a.filter}"`:''}>${a.action}</button>
    </div>`).join('')||'<div class="empty-mini"><b>Everything looks good.</b><span>No urgent supplier tasks right now.</span></div>';

    document.querySelectorAll('.attention-action').forEach(b=>b.onclick=()=>{
      if(b.dataset.attentionFilter)setOrderFilter(b.dataset.attentionFilter);
      go(b.dataset.attentionView);
    });

    const today=new Date().toDateString();
    const todayOrders=ORDERS.filter(o=>new Date(o.created_at).toDateString()===today);
    const fulfilledToday=ITEMS.filter(i=>i.fulfillment_status==='fulfilled'&&new Date(i.updated_at||i.created_at).toDateString()===today);
    const unitsToday=ITEMS.filter(i=>new Date(i.created_at).toDateString()===today).reduce((n,i)=>n+Number(i.quantity||0),0);
    $('#today-summary').innerHTML=`
      <div><small>Orders received</small><strong>${todayOrders.length}</strong></div>
      <div><small>Units ordered</small><strong>${unitsToday}</strong></div>
      <div><small>Items fulfilled</small><strong>${fulfilledToday.length}</strong></div>
    `;
  }

  function renderNotifications(){
    const notes=[];
    ITEMS.filter(i=>supplierOrderState(i)==='new').slice(0,6).forEach(i=>{
      const o=orderFor(i.order_id),p=productFor(i.supplier_product_id);
      notes.push({
        kind:'order',
        title:'New order',
        text:`${productName(p)||'Product'} × ${Number(i.quantity||1)} for ${o.customer_name||'customer'}`,
        view:'orders',
        filter:'new'
      });
    });
    PRODUCTS.filter(lowStockProduct).slice(0,6).forEach(p=>{
      notes.push({
        kind:'stock',
        title:'Low stock',
        text:`${productName(p)} has ${totalStock(p.id)} total units left`,
        view:'products'
      });
    });

    $('#notification-count').textContent=notes.length;
    $('#notification-count').hidden=notes.length===0;
    $('#notification-list').innerHTML=notes.map(n=>`<button class="notification-item" data-note-view="${n.view}" ${n.filter?`data-note-filter="${n.filter}"`:''}>
      <span class="notification-item-icon">${n.kind==='order'?'↗':'!'}</span>
      <span><b>${IZZY.esc(n.title)}</b><small>${IZZY.esc(n.text)}</small></span>
    </button>`).join('')||'<div class="empty-mini"><b>You are all caught up.</b><span>No supplier alerts right now.</span></div>';

    document.querySelectorAll('.notification-item').forEach(b=>b.onclick=()=>{
      if(b.dataset.noteFilter)setOrderFilter(b.dataset.noteFilter);
      go(b.dataset.noteView);
      $('#notification-panel').hidden=true;
    });
  }

  function filteredProducts(){
    const q=$('#supplier-product-search').value.trim().toLowerCase();
    const status=$('#supplier-product-status').value;
    return PRODUCTS.filter(p=>{
      const hay=[p.name,p.name_en,p.name_ar,p.sku,p.description,p.description_en,p.description_ar].filter(Boolean).join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(!status||p.status===status);
    });
  }

  function updateBulkProductUi(){
    const shown=filteredProducts().map(p=>p.id);
    const selectedShown=shown.filter(id=>SELECTED_PRODUCT_IDS.has(id));
    const count=SELECTED_PRODUCT_IDS.size;
    const all=$('#select-all-products');
    if(all){
      all.checked=shown.length>0&&selectedShown.length===shown.length;
      all.indeterminate=selectedShown.length>0&&selectedShown.length<shown.length;
    }
    const label=$('#bulk-selection-count');
    if(label)label.textContent=`${count} selected`;
    ['#bulk-activate-products','#bulk-pause-products','#bulk-clear-products'].forEach(sel=>{
      const el=$(sel);if(el)el.disabled=count===0;
    });
  }

  async function bulkSetProductStatus(nextStatus){
    const ids=[...SELECTED_PRODUCT_IDS];
    if(!ids.length)return;
    const verb=nextStatus==='active'?'activate':'pause';
    if(!confirm(`${verb[0].toUpperCase()+verb.slice(1)} ${ids.length} selected product${ids.length===1?'':'s'}?`))return;
    const a=$('#bulk-activate-products'),p=$('#bulk-pause-products');
    if(a)a.disabled=true;if(p)p.disabled=true;
    msg(`${nextStatus==='active'?'Activating':'Pausing'} selected products…`);
    try{
      await IZZY.request(`/rest/v1/supplier_products?id=in.(${ids.map(encodeURIComponent).join(',')})&supplier_id=eq.${encodeURIComponent(SUP.id)}`,{
        method:'PATCH',
        body:JSON.stringify({status:nextStatus,updated_at:new Date().toISOString()})
      });
      SELECTED_PRODUCT_IDS.clear();
      await load(false);
      msg(`${ids.length} product${ids.length===1?'':'s'} ${nextStatus==='active'?'activated':'paused'}.`);
    }catch(e){msg(e.message,true);updateBulkProductUi()}
  }

  function renderProducts(){
    const products=filteredProducts();
    $('#supplier-products-meta').textContent=`${products.length} product${products.length===1?'':'s'} shown`;
    $('#products').innerHTML=products.map(p=>{
      const img=imagesFor(p.id)[0];
      const stock=totalStock(p.id);
      const low=lowStockProduct(p);
      return `<div class="supplier-product-table supplier-product-table-row ${SELECTED_PRODUCT_IDS.has(p.id)?'is-selected':''}">
        <label class="supplier-product-select" aria-label="Select ${IZZY.esc(productName(p))}">
          <input class="product-select-checkbox" type="checkbox" data-id="${p.id}" ${SELECTED_PRODUCT_IDS.has(p.id)?'checked':''}>
        </label>
        <div class="supplier-table-product">
          <div class="supplier-product-thumb">${img?.url?`<img src="${IZZY.esc(img.url)}" alt="">`:'IZ'}</div>
          <div><b>${IZZY.esc(productName(p))}</b><small>${enabledVariantsFor(p.id).length} active variant${enabledVariantsFor(p.id).length===1?'':'s'}${variantsFor(p.id).length!==enabledVariantsFor(p.id).length?` · ${variantsFor(p.id).length-enabledVariantsFor(p.id).length} off`:''} · ${imagesFor(p.id).length} photo${imagesFor(p.id).length===1?'':'s'}</small></div>
        </div>
        <span class="supplier-table-cell" data-label="SKU">${IZZY.esc(p.sku||'—')}</span>
        <span class="supplier-table-cell ${low?'stock-low':''}" data-label="Stock">${stock}${low?' · Low':''}</span>
        <span class="supplier-table-cell" data-label="Your cost">${IZZY.money(p.cost_price,p.currency)}</span>
        <span class="supplier-table-cell" data-label="Suggested retail">${IZZY.money(p.suggested_retail_price,p.currency)}</span>
        <span class="supplier-table-cell" data-label="Status"><span class="tag ${p.status==='active'?'ok':p.status==='inactive'?'warn':''}">${p.status==='inactive'?'paused':IZZY.esc(p.status)}</span></span>
        <div class="supplier-table-actions">
          ${p.public_slug?'<a class="btn secondary" href="product.html?slug='+encodeURIComponent(p.public_slug)+'" target="_blank" rel="noopener">View</a>':''}
          <button class="btn secondary edit-product-btn" data-id="${p.id}">Edit</button>
          <button class="btn secondary toggle-product-btn" data-id="${p.id}" data-next="${p.status==='active'?'inactive':'active'}">${p.status==='active'?'Pause':'Activate'}</button>
        </div>
      </div>`;
    }).join('')||'<div class="empty-state supplier-table-empty"><div class="empty-icon">□</div><h3>No products found</h3><p>Add your first product or change the current filters.</p><button class="btn" data-jump="add">Add product</button></div>';

    document.querySelectorAll('.product-select-checkbox').forEach(c=>c.onchange=()=>{
      if(c.checked)SELECTED_PRODUCT_IDS.add(c.dataset.id);else SELECTED_PRODUCT_IDS.delete(c.dataset.id);
      c.closest('.supplier-product-table-row')?.classList.toggle('is-selected',c.checked);
      updateBulkProductUi();
    });
    document.querySelectorAll('.edit-product-btn').forEach(b=>b.onclick=()=>openEditProduct(b.dataset.id));
    document.querySelectorAll('.toggle-product-btn').forEach(b=>b.onclick=()=>toggleProduct(b));
    document.querySelectorAll('#products [data-jump]').forEach(b=>b.onclick=()=>go(b.dataset.jump));
    updateBulkProductUi();
  }

  function setOrderFilter(filter){
    ORDER_FILTER=filter||'all';
    document.querySelectorAll('[data-supplier-order-filter]').forEach(b=>b.classList.toggle('on',b.dataset.supplierOrderFilter===ORDER_FILTER));
    renderOrders();
  }

  function renderOrders(){
    const list=ITEMS.filter(i=>ORDER_FILTER==='all'||supplierOrderState(i)===ORDER_FILTER);
    $('#orders').innerHTML=list.map(i=>{
      const o=orderFor(i.order_id),p=productFor(i.supplier_product_id),addr=o.shipping_address||{},state=supplierOrderState(i);
      const fulfilled=state==='fulfilled',cancelled=state==='cancelled';
      return `<article class="card supplier-order-card ${state==='new'?'is-new':''}">
        <div class="supplier-order-head">
          <div>
            <div class="supplier-order-title"><b>${IZZY.esc(productName(p)||'Product')} × ${Number(i.quantity||1)}</b>${state==='new'?'<span class="new-pill">NEW</span>':''}</div>
            <small>${IZZY.esc(o.external_order_ref||o.shopify_order_name||('Order '+String(o.id||'').slice(0,8)))} · ${new Date(o.created_at).toLocaleString()}</small>
          </div>
          <span class="tag ${fulfilled?'ok':state==='new'?'warn':cancelled?'bad':''}">${state}</span>
        </div>

        <div class="supplier-order-grid">
          <div><small>Customer</small><b>${IZZY.esc(o.customer_name||'—')}</b><span>${IZZY.esc(o.customer_phone||'—')}</span></div>
          <div><small>Delivery address</small><b>${IZZY.esc([addr.address1,addr.city,addr.governorate].filter(Boolean).join(', ')||'—')}</b></div>
          <div><small>Quantity</small><b>${Number(i.quantity||1)}</b><span>${IZZY.money(i.retail_price_at_purchase,o.currency||'EGP')} each</span></div>
        </div>

        ${fulfilled?`<div class="fulfilled-strip"><span>Fulfilled</span><b>${IZZY.esc(i.shipping_carrier||'Carrier')} ${IZZY.esc(i.tracking_number||'')}</b></div>`:
          cancelled?'<div class="notice">This order item was cancelled.</div>':
          `<div class="fulfillment-box">
            <div><b>Fulfillment</b><small>Add shipping details when the order leaves you.</small></div>
            <div class="fulfillment-fields">
              <input data-carrier="${i.id}" placeholder="Shipping carrier">
              <input data-tracking="${i.id}" placeholder="Tracking number">
              <button class="btn fulfill-btn" data-id="${i.id}">Mark fulfilled</button>
            </div>
          </div>`}
      </article>`;
    }).join('')||`<div class="empty-state"><div class="empty-icon">□</div><h3>No ${ORDER_FILTER==='all'?'':ORDER_FILTER+' '}orders</h3><p>${ORDER_FILTER==='all'?'Orders will appear here when dropshippers sell your products.':'There are no orders in this status.'}</p></div>`;

    document.querySelectorAll('.fulfill-btn').forEach(b=>b.onclick=()=>fulfill(b));
  }

  async function fulfill(btn){
    const id=btn.dataset.id;
    const carrier=document.querySelector(`[data-carrier="${id}"]`)?.value?.trim()||null;
    const tracking=document.querySelector(`[data-tracking="${id}"]`)?.value?.trim()||null;
    btn.disabled=true;btn.textContent='Updating…';
    try{
      await IZZY.rpc('supplier_fulfill_order_item',{_order_item_id:id,_tracking_number:tracking,_shipping_carrier:carrier});
      msg('Order item marked fulfilled.');
      await load(false);
    }catch(e){msg(e.message,true);btn.disabled=false;btn.textContent='Mark fulfilled'}
  }

  function renderSourcingRequests(){
    const el=$('#supplier-requests');if(!el)return;
    const myQuoteByRequest=new Map((QUOTES||[]).map(q=>[q.request_id,q]));
    const productOptions='<option value="">No linked product yet</option>'+(PRODUCTS||[]).map(p=>`<option value="${p.id}">${IZZY.esc(p.name||p.sku||'Product')}</option>`).join('');
    el.innerHTML=(REQUESTS||[]).map(r=>{
      const q=myQuoteByRequest.get(r.id);
      return `<article class="card order-card">
        <div class="order-card-head"><div><span class="order-id">${IZZY.esc(r.title)}</span><small>${new Date(r.created_at).toLocaleString()}</small></div><span class="tag ${r.status==='matched'?'ok':'warn'}">${IZZY.esc(r.status)}</span></div>
        <div class="order-summary-grid">
          <div><small>Target cost</small><b>${r.target_cost==null?'—':IZZY.money(r.target_cost,'EGP')}</b></div>
          <div><small>Source</small><b>${r.source_url?'<a href="'+IZZY.esc(r.source_url)+'" target="_blank" rel="noopener">Open link</a>':'—'}</b></div>
          <div><small>Notes</small><span>${IZZY.esc(r.notes||'—')}</span></div>
        </div>
        ${q?`<div class="notice ok"><b>Your quote: ${IZZY.money(q.offered_cost,'EGP')}</b><span>${IZZY.esc(q.message||'')}</span></div>`:
        `<form class="form quote-form" data-request-id="${r.id}">
          <input name="offered_cost" type="number" min="0" step="0.01" placeholder="Your cost EGP" required>
          <input name="available_quantity" type="number" min="0" step="1" placeholder="Available quantity">
          <input name="lead_time_days" type="number" min="0" step="1" placeholder="Lead time days">
          <select name="product_id">${productOptions}</select>
          <input name="message" class="span-2" placeholder="Message / MOQ / notes">
          <button class="btn span-2" type="submit">Submit quote</button>
        </form>`}
      </article>`;
    }).join('')||'<div class="empty-state"><div class="empty-icon">⌕</div><h3>No sourcing requests right now</h3><p>New requests from dropshippers will appear here.</p></div>';

    document.querySelectorAll('.quote-form').forEach(form=>form.onsubmit=async e=>{
      e.preventDefault();
      const btn=form.querySelector('button[type="submit"]');
      btn.disabled=true;btn.textContent='Sending…';
      const fd=new FormData(form);
      try{
        await IZZY.rpc('submit_product_request_quote',{
          _request_id:form.dataset.requestId,
          _offered_cost:Number(fd.get('offered_cost')),
          _available_quantity:fd.get('available_quantity')===''?null:Number(fd.get('available_quantity')),
          _lead_time_days:fd.get('lead_time_days')===''?null:Number(fd.get('lead_time_days')),
          _message:String(fd.get('message')||'').trim()||null,
          _product_id:String(fd.get('product_id')||'').trim()||null
        });
        msg('Quote sent to the dropshipper.');
        await load(false);
      }catch(err){msg(err.message,true);btn.disabled=false;btn.textContent='Submit quote'}
    });
  }

  async function load(showMessage=false){
    const [supplierRows,products,variants,orders,items,requests,quotes]=await Promise.all([
      IZZY.request(`/rest/v1/suppliers?select=id,business_name,status,low_stock_threshold,notification_preferences&id=eq.${encodeURIComponent(SUP.id)}&limit=1`),
      IZZY.request(`/rest/v1/supplier_products?select=*&supplier_id=eq.${encodeURIComponent(SUP.id)}&order=created_at.desc`),
      IZZY.request('/rest/v1/product_variants?select=*&order=created_at.asc'),
      IZZY.request('/rest/v1/orders?select=*&order=created_at.desc&limit=150'),
      IZZY.request(`/rest/v1/order_items?select=*&supplier_id=eq.${encodeURIComponent(SUP.id)}&order=created_at.desc&limit=250`),
      IZZY.request('/rest/v1/product_requests?select=*&status=in.(open,matched)&order=created_at.desc&limit=100'),
      IZZY.request(`/rest/v1/product_request_quotes?select=*&supplier_id=eq.${encodeURIComponent(SUP.id)}&order=created_at.desc&limit=100`)
    ]);

    if(supplierRows?.[0]){
      SUP={...SUP,...supplierRows[0]};
      $('#business').textContent=SUP.business_name||'Supplier';
    }
    PRODUCTS=products||[];
    VARIANTS=variants||[];
    ORDERS=orders||[];
    ITEMS=items||[];
    REQUESTS=requests||[];
    QUOTES=quotes||[];

    if(PRODUCTS.length){
      const ids=PRODUCTS.map(p=>p.id).join(',');
      IMAGES=await IZZY.request(`/rest/v1/product_images?select=*&product_id=in.(${ids})&order=position.asc`);
    }else IMAGES=[];

    renderOverview();
    renderNotifications();
    renderProducts();
    renderSourcingRequests();
    renderOrders();
    if(showMessage)msg('Supplier workspace updated.');
  }

  async function toggleProduct(btn){
    const p=productFor(btn.dataset.id);
    const next=btn.dataset.next;
    if(!p)return;
    btn.disabled=true;btn.textContent=next==='inactive'?'Pausing…':'Activating…';
    try{
      await IZZY.request(`/rest/v1/supplier_products?id=eq.${encodeURIComponent(p.id)}`,{
        method:'PATCH',
        body:JSON.stringify({status:next,updated_at:new Date().toISOString()})
      });
      msg(next==='inactive'?'Product paused.':'Product activated.');
      await load(false);
    }catch(e){msg(e.message,true);btn.disabled=false}
  }

  function openEditProduct(id){
    const p=productFor(id);
    if(!p)return;
    $('#edit-product-id').value=p.id;
    $('#edit-product-name-en').value=p.name_en||p.name||'';
    $('#edit-product-name-ar').value=p.name_ar||'';
    $('#edit-product-description-en').value=p.description_en||p.description||'';
    $('#edit-product-description-ar').value=p.description_ar||'';
    $('#edit-product-sku').value=p.sku||'';
    $('#edit-product-cost').value=p.cost_price??0;
    $('#edit-product-shipping').value=p.estimated_shipping_cost??0;
    $('#edit-product-market-status').value=p.status||'active';
    setEditContentLang(p.content_source_language==='ar'?'ar':'en');
    $('#edit-product-retail').value=p.suggested_retail_price??'';

    const vs=variantsFor(id);
    $('#edit-variant-list').innerHTML=vs.map(v=>`<div class="edit-variant-row" data-variant-id="${v.id}">
      <label class="edit-variant-enabled"><input data-edit-variant-enabled type="checkbox" ${v.is_enabled!==false?'checked':''}><span>${local('Available','متاح')}</span></label>
      <div class="edit-variant-name-cell">
        <input data-edit-variant-name value="${IZZY.esc(v.variant_name||'Default')}" placeholder="${local('Variant','الخيار')}">
        <small>${IZZY.esc(variantLabel(v))}</small>
      </div>
      <input data-edit-variant-sku value="${IZZY.esc(v.sku||'')}" placeholder="SKU">
      <input data-edit-variant-stock type="number" min="0" step="1" value="${Number(v.stock_quantity||0)}" placeholder="${local('Stock','المخزون')}">
      <input data-edit-variant-cost type="number" min="0" step="0.01" value="${v.cost_price??''}" placeholder="${local('Supplier price','سعر المورّد')}">
      <input data-edit-variant-weight type="number" min="0" step="1" value="${v.weight_grams??''}" placeholder="${local('Weight (g)','الوزن (جم)')}">
    </div>`).join('')||'<div class="notice">No variants found.</div>';

    $('#edit-product-status').textContent='';
    $('#product-edit-modal').hidden=false;
  }

  $('#edit-product-form').onsubmit=async e=>{
    e.preventDefault();
    const id=$('#edit-product-id').value,p=productFor(id),btn=$('#save-product-edit');
    if(!p)return;
    btn.disabled=true;btn.textContent='Saving…';
    const st=$('#edit-product-status');st.textContent='Saving product…';st.className='status';
    try{
      await IZZY.request(`/rest/v1/supplier_products?id=eq.${encodeURIComponent(id)}`,{
        method:'PATCH',
        body:JSON.stringify((()=>{
          const nameEn=$('#edit-product-name-en').value.trim()||null;
          const nameAr=$('#edit-product-name-ar').value.trim()||null;
          const descEn=$('#edit-product-description-en').value.trim()||null;
          const descAr=$('#edit-product-description-ar').value.trim()||null;
          const source=p.content_source_language==='ar'?'ar':'en';
          return {
            name_en:nameEn,
            name_ar:nameAr,
            description_en:descEn,
            description_ar:descAr,
            content_source_language:source,
            name:(source==='ar'?(nameAr||nameEn):(nameEn||nameAr)),
            description:(source==='ar'?(descAr||descEn):(descEn||descAr)),
            sku:$('#edit-product-sku').value.trim(),
            cost_price:Number($('#edit-product-cost').value),
            estimated_shipping_cost:Number($('#edit-product-shipping').value||0),
            suggested_retail_price:$('#edit-product-retail').value===''?null:Number($('#edit-product-retail').value),
            status:$('#edit-product-market-status').value,
            updated_at:new Date().toISOString()
          };
        })())
      });

      const rows=[...document.querySelectorAll('.edit-variant-row[data-variant-id]')];
      for(const row of rows){
        const vid=row.dataset.variantId;
        await IZZY.request(`/rest/v1/product_variants?id=eq.${encodeURIComponent(vid)}`,{
          method:'PATCH',
          body:JSON.stringify({
            variant_name:row.querySelector('[data-edit-variant-name]').value.trim()||'Default',
            sku:row.querySelector('[data-edit-variant-sku]').value.trim()||null,
            stock_quantity:Number(row.querySelector('[data-edit-variant-stock]').value||0),
            cost_price:row.querySelector('[data-edit-variant-cost]').value===''?null:Number(row.querySelector('[data-edit-variant-cost]').value),
            weight_grams:row.querySelector('[data-edit-variant-weight]').value===''?null:Number(row.querySelector('[data-edit-variant-weight]').value),
            is_enabled:row.querySelector('[data-edit-variant-enabled]').checked,
            updated_at:new Date().toISOString()
          })
        });
      }
      st.textContent='Product updated.';
      await load(false);
      setTimeout(()=>{$('#product-edit-modal').hidden=true},400);
    }catch(err){st.textContent=err.message;st.className='status bad'}
    finally{btn.disabled=false;btn.textContent='Save changes'}
  };

  function setVariantMode(mode){
    VARIANT_MODE=mode==='options'?'options':'single';
    document.querySelectorAll('[data-variant-mode]').forEach(b=>b.classList.toggle('on',b.dataset.variantMode===VARIANT_MODE));
    $('#single-variant-panel').hidden=VARIANT_MODE!=='single';
    $('#variant-options-panel').hidden=VARIANT_MODE!=='options';
    if(VARIANT_MODE==='options')renderVariantCombinations();
  }

  function addVariantOptionRow(name='',values=''){
    const box=$('#variant-option-rows');
    if(!box||box.children.length>=3)return;
    const row=document.createElement('div');
    row.className='variant-option-row';
    row.innerHTML=`
      <input data-option-name placeholder="${local('Option name, e.g. Color','اسم الخيار، مثال: اللون')}" value="${IZZY.esc(name)}">
      <input data-option-values placeholder="${local('Values separated by commas, e.g. Black, White','القيم مفصولة بفواصل، مثال: أسود، أبيض')}" value="${IZZY.esc(values)}">
      <button class="variant-option-remove" type="button" aria-label="${local('Remove option','حذف الخيار')}">×</button>
    `;
    row.querySelectorAll('input').forEach(input=>input.addEventListener('input',renderVariantCombinations));
    row.querySelector('.variant-option-remove').onclick=()=>{
      row.remove();
      if(!box.children.length)addVariantOptionRow(local('Color','اللون'),'');
      renderVariantCombinations();
    };
    box.appendChild(row);
    const add=$('#add-variant-option');if(add)add.disabled=box.children.length>=3;
  }

  function variantOptionDefinitions(){
    return [...document.querySelectorAll('#variant-option-rows .variant-option-row')].map((row,index)=>{
      const name=row.querySelector('[data-option-name]').value.trim()||local(`Option ${index+1}`,`الخيار ${index+1}`);
      const values=[...new Set(row.querySelector('[data-option-values]').value.split(/[,،]/).map(v=>v.trim()).filter(Boolean))];
      return {name,values};
    }).filter(o=>o.values.length);
  }

  function snapshotVariantCombinations(){
    document.querySelectorAll('#variant-combination-rows .variant-combination-row[data-combo]').forEach(row=>{
      VARIANT_COMBO_STATE.set(row.dataset.combo,{
        enabled:row.querySelector('[data-combo-enabled]').checked,
        sku:row.querySelector('[data-combo-sku]').value,
        stock:row.querySelector('[data-combo-stock]').value,
        cost:row.querySelector('[data-combo-cost]').value,
        weight:row.querySelector('[data-combo-weight]').value
      });
    });
  }

  function buildCombinations(defs,index=0,current={}){
    if(index>=defs.length)return [current];
    const out=[];
    const def=defs[index];
    def.values.forEach(value=>out.push(...buildCombinations(defs,index+1,{...current,[def.name]:value})));
    return out;
  }

  function updateVariantCombinationCount(){
    const rows=[...document.querySelectorAll('#variant-combination-rows .variant-combination-row[data-combo]')];
    const available=rows.filter(r=>r.querySelector('[data-combo-enabled]')?.checked).length;
    const count=$('#variant-combination-count');
    if(count)count.textContent=local(
      `${rows.length} combination${rows.length===1?'':'s'} · ${available} available`,
      `${rows.length} تركيبة · ${available} متاحة`
    );
  }

  function renderVariantCombinations(){
    if(VARIANT_MODE!=='options')return;
    snapshotVariantCombinations();
    const defs=variantOptionDefinitions();
    const box=$('#variant-combination-rows');
    if(!box)return;
    const combos=defs.length?buildCombinations(defs):[];
    if(!combos.length){
      box.innerHTML=`<div class="variant-combination-empty">${local('Add option values to create combinations.','أضف قيم الخيارات لإنشاء التركيبات.')}</div>`;
      updateVariantCombinationCount();
      return;
    }
    box.innerHTML='';
    combos.forEach(options=>{
      const key=JSON.stringify(options);
      const previous=VARIANT_COMBO_STATE.get(key)||{enabled:true,sku:'',stock:'0',cost:'',weight:''};
      const name=Object.values(options).join(' / ');
      const row=document.createElement('div');
      row.className='variant-combination-row';
      row.dataset.combo=key;
      row._izzyOptions=options;
      row.innerHTML=`
        <label class="combo-toggle"><input data-combo-enabled type="checkbox" ${previous.enabled?'checked':''}><span></span></label>
        <div class="combo-name"><b>${IZZY.esc(name)}</b><small>${IZZY.esc(Object.entries(options).map(([k,v])=>`${k}: ${v}`).join(' · '))}</small></div>
        <input data-combo-sku placeholder="${local('Auto','تلقائي')}" value="${IZZY.esc(previous.sku||'')}">
        <input data-combo-stock type="number" min="0" step="1" value="${IZZY.esc(previous.stock??'0')}">
        <input data-combo-cost type="number" min="0" step="0.01" placeholder="${local('Use product price','استخدم سعر المنتج')}" value="${IZZY.esc(previous.cost||'')}">
        <input data-combo-weight type="number" min="0" step="1" placeholder="${local('Optional','اختياري')}" value="${IZZY.esc(previous.weight||'')}">
      `;
      const enabled=row.querySelector('[data-combo-enabled]');
      const sync=()=>{row.classList.toggle('is-disabled',!enabled.checked);updateVariantCombinationCount()};
      enabled.onchange=sync;sync();
      box.appendChild(row);
    });
    updateVariantCombinationCount();
  }

  function collectVariants(){
    if(VARIANT_MODE==='single'){
      return [{
        name:'Default',
        sku:$('#single-variant-sku').value.trim()||null,
        stock:Number($('#single-variant-stock').value||0),
        cost:$('#single-variant-cost').value===''?null:Number($('#single-variant-cost').value),
        weight_grams:$('#single-variant-weight').value===''?null:Number($('#single-variant-weight').value),
        enabled:true,
        options:{}
      }];
    }

    const rows=[...document.querySelectorAll('#variant-combination-rows .variant-combination-row[data-combo]')];
    if(!rows.length)throw Error(local('Add at least one option value to create variants.','أضف قيمة خيار واحدة على الأقل لإنشاء الخيارات.'));
    const variants=rows.map(row=>{
      const options=row._izzyOptions||JSON.parse(row.dataset.combo||'{}');
      return {
        name:Object.values(options).join(' / ')||'Default',
        sku:row.querySelector('[data-combo-sku]').value.trim()||null,
        stock:Number(row.querySelector('[data-combo-stock]').value||0),
        cost:row.querySelector('[data-combo-cost]').value===''?null:Number(row.querySelector('[data-combo-cost]').value),
        weight_grams:row.querySelector('[data-combo-weight]').value===''?null:Number(row.querySelector('[data-combo-weight]').value),
        enabled:row.querySelector('[data-combo-enabled]').checked,
        options
      };
    });
    if(!variants.some(v=>v.enabled))throw Error(local('Keep at least one variant available.','يجب أن تترك خيارًا واحدًا متاحًا على الأقل.'));
    return variants;
  }

  function resetVariantBuilder(){
    VARIANT_COMBO_STATE.clear();
    VARIANT_MODE='single';
    if($('#single-variant-sku'))$('#single-variant-sku').value='';
    if($('#single-variant-stock'))$('#single-variant-stock').value='0';
    if($('#single-variant-cost'))$('#single-variant-cost').value='';
    if($('#single-variant-weight'))$('#single-variant-weight').value='';
    const box=$('#variant-option-rows');
    if(box){
      box.innerHTML='';
      addVariantOptionRow(local('Color','اللون'),'');
      addVariantOptionRow(local('Size','المقاس'),'');
    }
    setVariantMode('single');
    renderVariantCombinations();
  }

  function renderSelectedImages(){
    const box=$('#p-image-preview');
    if(!SELECTED_IMAGES.length){box.innerHTML='<div class="photo-empty">No photos selected yet.</div>';return}
    box.innerHTML=SELECTED_IMAGES.map((f,i)=>`<div class="photo-preview"><img src="${URL.createObjectURL(f)}" alt=""><span>${i===0?'Main photo':`Photo ${i+1}`}</span></div>`).join('');
  }

  $('#p-images').onchange=e=>{
    const files=[...e.target.files];
    const allowed=['image/jpeg','image/png','image/webp'];
    if(files.length>6){msg('Choose up to 6 product photos.',true);e.target.value='';SELECTED_IMAGES=[];renderSelectedImages();return}
    const bad=files.find(f=>!allowed.includes(f.type)||f.size>5*1024*1024);
    if(bad){msg('Photos must be JPG, PNG, or WebP and no larger than 5 MB each.',true);e.target.value='';SELECTED_IMAGES=[];renderSelectedImages();return}
    SELECTED_IMAGES=files;
    renderSelectedImages();
    msg(files.length?`${files.length} product photo${files.length===1?'':'s'} ready.`:'');
  };

  $('#add-form').onsubmit=async e=>{
    e.preventDefault();
    const btn=$('#add-product-btn');btn.disabled=true;btn.textContent='Creating product…';
    try{
      const cost=Number($('#p-cost').value);
      const variants=collectVariants();

      const nameEn=$('#p-name-en').value.trim()||null;
      const nameAr=$('#p-name-ar').value.trim()||null;
      const descEn=$('#p-description-en').value.trim()||null;
      const descAr=$('#p-description-ar').value.trim()||null;
      if(!nameEn&&!nameAr)throw Error('Enter the product name in English or Arabic.');
      if(!nameEn||!nameAr)throw Error('Add both English and Arabic product names. Use Generate translation if you need it.');
      if((descEn&&!descAr)||(descAr&&!descEn))throw Error('Add both English and Arabic descriptions, or leave both descriptions empty.');

      const result=await IZZY.rpc('supplier_create_product_v2',{
        _name_en:nameEn,
        _name_ar:nameAr,
        _description_en:descEn,
        _description_ar:descAr,
        _source_language:NEW_SOURCE_LANGUAGE,
        _sku:$('#p-sku').value.trim()||null,
        _cost:cost,
        _retail:Number($('#p-retail').value),
        _currency:'EGP',
        _variants:variants
      });

      const pid=result.product_id;
      let uploaded=0;
      for(let i=0;i<SELECTED_IMAGES.length;i++){
        btn.textContent=`Uploading photo ${i+1} of ${SELECTED_IMAGES.length}…`;
        const file=SELECTED_IMAGES[i],ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
        const path=`${SUP.id}/${pid}/${String(i+1).padStart(2,'0')}-${Date.now()}.${ext}`;
        try{
          const url=await IZZY.uploadProductImage(path,file);
          await IZZY.request('/rest/v1/product_images',{
            method:'POST',
            headers:{Prefer:'return=representation'},
            body:JSON.stringify({product_id:pid,url,position:i})
          });
          uploaded++;
        }catch(photoError){
          console.warn(photoError);
          msg(`Product created, but only ${uploaded} of ${SELECTED_IMAGES.length} photos uploaded.`,true);
          break;
        }
      }

      e.target.reset();
      const resetLang=window.IZZY_I18N?.isArabic?.()?'ar':'en';NEW_SOURCE_LANGUAGE=resetLang;setNewContentLang(resetLang,false);
      $('#p-translation-status').textContent='';
      SELECTED_IMAGES=[];renderSelectedImages();
      resetVariantBuilder();
      await load(false);
      go('products');
      msg(`Product added · SKU ${result.sku}${uploaded? ` · ${uploaded} photo${uploaded===1?'':'s'}`:''}.`);
    }catch(err){msg(err.message,true)}
    finally{btn.disabled=false;btn.textContent='Add product'}
  };

  document.querySelectorAll('[data-variant-mode]').forEach(b=>b.onclick=()=>setVariantMode(b.dataset.variantMode));
  $('#add-variant-option').onclick=()=>{
    addVariantOptionRow('', '');
    renderVariantCombinations();
  };
  document.querySelectorAll('.field-info-btn').forEach(btn=>btn.onclick=e=>{
    e.preventDefault();
    e.stopPropagation();
    const key=btn.dataset.fieldHelp;
    const scope=btn.closest('.field')||btn.closest('form');
    const panel=scope?.querySelector(`[data-field-help-panel="${key}"]`);
    document.querySelectorAll('.field-help-panel').forEach(p=>{if(p!==panel)p.hidden=true});
    if(!panel)return;
    panel.textContent=FIELD_HELP[key]?.[window.IZZY_I18N?.isArabic?.()?'ar':'en']||'';
    panel.hidden=!panel.hidden;
    btn.setAttribute('aria-expanded',panel.hidden?'false':'true');
  });
  document.querySelectorAll('[data-new-content-lang]').forEach(b=>b.onclick=()=>setNewContentLang(b.dataset.newContentLang,true));
  document.querySelectorAll('[data-edit-content-lang]').forEach(b=>b.onclick=()=>setEditContentLang(b.dataset.editContentLang));
  $('#p-translate-btn').onclick=translateNewContent;
  $('#edit-translate-btn').onclick=translateEditContent;
  const initialContentLang=window.IZZY_I18N?.isArabic?.()?'ar':'en';NEW_SOURCE_LANGUAGE=initialContentLang;setNewContentLang(initialContentLang,false);
  $('#supplier-product-search').oninput=renderProducts;
  $('#supplier-product-status').onchange=renderProducts;
  $('#select-all-products').onchange=e=>{
    filteredProducts().forEach(p=>e.target.checked?SELECTED_PRODUCT_IDS.add(p.id):SELECTED_PRODUCT_IDS.delete(p.id));
    renderProducts();
  };
  $('#bulk-clear-products').onclick=()=>{SELECTED_PRODUCT_IDS.clear();renderProducts()};
  $('#bulk-activate-products').onclick=()=>bulkSetProductStatus('active');
  $('#bulk-pause-products').onclick=()=>bulkSetProductStatus('inactive');

  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>go(b.dataset.view));
  document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{
    if(b.dataset.filter)setOrderFilter(b.dataset.filter);
    go(b.dataset.jump);
  });
  document.querySelectorAll('[data-supplier-order-filter]').forEach(b=>b.onclick=()=>setOrderFilter(b.dataset.supplierOrderFilter));

  $('#notification-bell').onclick=e=>{
    e.stopPropagation();
    $('#notification-panel').hidden=!$('#notification-panel').hidden;
  };
  $('#notification-panel').onclick=e=>e.stopPropagation();
  document.addEventListener('click',()=>{$('#notification-panel').hidden=true});

  $('#close-product-edit').onclick=()=>$('#product-edit-modal').hidden=true;
  $('#product-edit-modal').onclick=e=>{if(e.target===$('#product-edit-modal'))$('#product-edit-modal').hidden=true};

  (async()=>{
    try{await verify()}
    catch(e){
      const g=$('#gate-message');
      if(g){g.textContent=e.message;g.style.color='var(--bad)'}
    }
  })();
})();