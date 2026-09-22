(()=>{
  const $=s=>document.querySelector(s);
  let SUP=null,PRODUCTS=[],VARIANTS=[],IMAGES=[],ORDERS=[],ITEMS=[],SELECTED_IMAGES=[],ORDER_FILTER='all';

  const VIEW_COPY={
    overview:['Overview','See what needs your attention today.'],
    products:['Products','Manage prices, inventory, variants and marketplace status.'],
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
  function imagesFor(id){return IMAGES.filter(i=>i.product_id===id).sort((a,b)=>Number(a.position)-Number(b.position))}
  function totalStock(id){return variantsFor(id).reduce((n,v)=>n+Number(v.stock_quantity||0),0)}
  function threshold(){return Number(SUP?.low_stock_threshold??5)}
  function lowStockProduct(p){const vs=variantsFor(p.id);return vs.length>0&&vs.some(v=>Number(v.stock_quantity||0)<=threshold())}
  function supplierOrderState(item){
    if(item.fulfillment_status==='fulfilled')return 'fulfilled';
    if(item.fulfillment_status==='cancelled')return 'cancelled';
    const o=orderFor(item.order_id);
    return o.status==='processing'?'processing':'new';
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
    addDefaultVariant();
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
        text:`${p.name||'Product'} × ${Number(i.quantity||1)} for ${o.customer_name||'customer'}`,
        view:'orders',
        filter:'new'
      });
    });
    PRODUCTS.filter(lowStockProduct).slice(0,6).forEach(p=>{
      notes.push({
        kind:'stock',
        title:'Low stock',
        text:`${p.name} has ${totalStock(p.id)} total units left`,
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
      const hay=[p.name,p.sku,p.description].filter(Boolean).join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(!status||p.status===status);
    });
  }

  function renderProducts(){
    const products=filteredProducts();
    $('#supplier-products-meta').textContent=`${products.length} product${products.length===1?'':'s'} shown`;
    $('#products').innerHTML=products.map(p=>{
      const img=imagesFor(p.id)[0];
      const stock=totalStock(p.id);
      const low=lowStockProduct(p);
      return `<div class="supplier-product-table supplier-product-table-row">
        <div class="supplier-table-product">
          <div class="supplier-product-thumb">${img?.url?`<img src="${IZZY.esc(img.url)}" alt="">`:'IZ'}</div>
          <div><b>${IZZY.esc(p.name)}</b><small>${variantsFor(p.id).length} variant${variantsFor(p.id).length===1?'':'s'} · ${imagesFor(p.id).length} photo${imagesFor(p.id).length===1?'':'s'}</small></div>
        </div>
        <span class="supplier-table-cell" data-label="SKU">${IZZY.esc(p.sku||'—')}</span>
        <span class="supplier-table-cell ${low?'stock-low':''}" data-label="Stock">${stock}${low?' · Low':''}</span>
        <span class="supplier-table-cell" data-label="Your cost">${IZZY.money(p.cost_price,p.currency)}</span>
        <span class="supplier-table-cell" data-label="Suggested retail">${IZZY.money(p.suggested_retail_price,p.currency)}</span>
        <span class="supplier-table-cell" data-label="Status"><span class="tag ${p.status==='active'?'ok':p.status==='inactive'?'warn':''}">${p.status==='inactive'?'paused':IZZY.esc(p.status)}</span></span>
        <div class="supplier-table-actions">
          <button class="btn secondary edit-product-btn" data-id="${p.id}">Edit</button>
          <button class="btn secondary toggle-product-btn" data-id="${p.id}" data-next="${p.status==='active'?'inactive':'active'}">${p.status==='active'?'Pause':'Activate'}</button>
        </div>
      </div>`;
    }).join('')||'<div class="empty-state supplier-table-empty"><div class="empty-icon">□</div><h3>No products found</h3><p>Add your first product or change the current filters.</p><button class="btn" data-jump="add">Add product</button></div>';

    document.querySelectorAll('.edit-product-btn').forEach(b=>b.onclick=()=>openEditProduct(b.dataset.id));
    document.querySelectorAll('.toggle-product-btn').forEach(b=>b.onclick=()=>toggleProduct(b));
    document.querySelectorAll('#products [data-jump]').forEach(b=>b.onclick=()=>go(b.dataset.jump));
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
            <div class="supplier-order-title"><b>${IZZY.esc(p.name||'Product')} × ${Number(i.quantity||1)}</b>${state==='new'?'<span class="new-pill">NEW</span>':''}</div>
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

  async function load(showMessage=false){
    const [supplierRows,products,variants,orders,items]=await Promise.all([
      IZZY.request(`/rest/v1/suppliers?select=id,business_name,status,low_stock_threshold,notification_preferences&id=eq.${encodeURIComponent(SUP.id)}&limit=1`),
      IZZY.request(`/rest/v1/supplier_products?select=*&supplier_id=eq.${encodeURIComponent(SUP.id)}&order=created_at.desc`),
      IZZY.request('/rest/v1/product_variants?select=*&order=created_at.asc'),
      IZZY.request('/rest/v1/orders?select=*&order=created_at.desc&limit=150'),
      IZZY.request(`/rest/v1/order_items?select=*&supplier_id=eq.${encodeURIComponent(SUP.id)}&order=created_at.desc&limit=250`)
    ]);

    if(supplierRows?.[0]){
      SUP={...SUP,...supplierRows[0]};
      $('#business').textContent=SUP.business_name||'Supplier';
    }
    PRODUCTS=products||[];
    VARIANTS=variants||[];
    ORDERS=orders||[];
    ITEMS=items||[];

    if(PRODUCTS.length){
      const ids=PRODUCTS.map(p=>p.id).join(',');
      IMAGES=await IZZY.request(`/rest/v1/product_images?select=*&product_id=in.(${ids})&order=position.asc`);
    }else IMAGES=[];

    renderOverview();
    renderNotifications();
    renderProducts();
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
    $('#edit-product-name').value=p.name||'';
    $('#edit-product-sku').value=p.sku||'';
    $('#edit-product-description').value=p.description||'';
    $('#edit-product-cost').value=p.cost_price??0;
    $('#edit-product-retail').value=p.suggested_retail_price??'';

    const vs=variantsFor(id);
    $('#edit-variant-list').innerHTML=vs.map(v=>`<div class="edit-variant-row" data-variant-id="${v.id}">
      <input data-edit-variant-name value="${IZZY.esc(v.variant_name||'Default')}" placeholder="Variant">
      <input data-edit-variant-sku value="${IZZY.esc(v.sku||'')}" placeholder="SKU">
      <input data-edit-variant-stock type="number" min="0" step="1" value="${Number(v.stock_quantity||0)}" placeholder="Stock">
      <input data-edit-variant-cost type="number" min="0" step="0.01" value="${v.cost_price??''}" placeholder="Cost">
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
        body:JSON.stringify({
          name:$('#edit-product-name').value.trim(),
          sku:$('#edit-product-sku').value.trim(),
          description:$('#edit-product-description').value.trim()||null,
          cost_price:Number($('#edit-product-cost').value),
          suggested_retail_price:$('#edit-product-retail').value===''?null:Number($('#edit-product-retail').value),
          updated_at:new Date().toISOString()
        })
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

  function addDefaultVariant(){
    if($('#variant-rows').children.length)return;
    addVariantRow('Default');
  }

  function addVariantRow(name=''){
    const row=document.createElement('div');
    row.className='variant-editor-row';
    row.innerHTML=`
      <input data-variant-name placeholder="e.g. Black / Large" value="${IZZY.esc(name)}" required>
      <input data-variant-sku placeholder="Auto if blank">
      <input data-variant-stock type="number" min="0" step="1" value="0" required>
      <input data-variant-cost type="number" min="0" step="0.01" placeholder="Use product cost">
      <input data-variant-weight type="number" min="0" step="1" placeholder="Optional">
      <button class="variant-remove" type="button" aria-label="Remove variant">×</button>
    `;
    row.querySelector('.variant-remove').onclick=()=>{
      if($('#variant-rows').children.length===1){
        row.querySelector('[data-variant-name]').value='Default';
        row.querySelector('[data-variant-sku]').value='';
        row.querySelector('[data-variant-stock]').value='0';
        row.querySelector('[data-variant-cost]').value='';
        row.querySelector('[data-variant-weight]').value='';
        return;
      }
      row.remove();
    };
    $('#variant-rows').appendChild(row);
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
      const variantRows=[...document.querySelectorAll('#variant-rows .variant-editor-row')];
      const variants=variantRows.map(row=>({
        name:row.querySelector('[data-variant-name]').value.trim()||'Default',
        sku:row.querySelector('[data-variant-sku]').value.trim()||null,
        stock:Number(row.querySelector('[data-variant-stock]').value||0),
        cost:row.querySelector('[data-variant-cost]').value===''?null:Number(row.querySelector('[data-variant-cost]').value),
        weight_grams:row.querySelector('[data-variant-weight]').value===''?null:Number(row.querySelector('[data-variant-weight]').value)
      }));

      const result=await IZZY.rpc('supplier_create_product',{
        _name:$('#p-name').value.trim(),
        _sku:$('#p-sku').value.trim()||null,
        _description:$('#p-description').value.trim()||null,
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
      SELECTED_IMAGES=[];renderSelectedImages();
      $('#variant-rows').innerHTML='';addDefaultVariant();
      await load(false);
      go('products');
      msg(`Product added · SKU ${result.sku}${uploaded? ` · ${uploaded} photo${uploaded===1?'':'s'}`:''}.`);
    }catch(err){msg(err.message,true)}
    finally{btn.disabled=false;btn.textContent='Add product'}
  };

  $('#add-variant-row').onclick=()=>addVariantRow('');
  $('#supplier-product-search').oninput=renderProducts;
  $('#supplier-product-status').onchange=renderProducts;

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