(()=>{
  const $=s=>document.querySelector(s);
  let SUPPLIERS=[],PROFILES=[],PRODUCTS=[],VARIANTS=[],IMAGES=[],ORDERS=[],ITEMS=[],DROPSHIPPERS=[],AUDIT=[],ADMINS=[],DEFAULT_COMMISSION=0,SELECTED_SUPPLIER=null,SESSION=null;

  const VIEW_COPY={
    overview:['Overview','Monitor the marketplace and handle what needs attention.'],
    suppliers:['Suppliers','Review applications and manage supplier access.'],
    products:['Products','Inspect and moderate products across the marketplace.'],
    orders:['Orders','Inspect marketplace orders, fulfillment and tracking.'],
    commissions:['Commissions','Control marketplace, supplier, and product commission rules.'],
    admins:['Admins','Invite trusted people and review Control Center access.'],
    settings:['Settings','Manage your IzzyDrop account, appearance, and security.']
  };

  const msg=(t,b=false)=>{
    const e=$('#status');
    if(!e)return;
    e.textContent=t||'';
    e.className='status'+(b?' bad':'');
  };

  function go(v){
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===v));
    document.querySelectorAll('.view').forEach(x=>x.hidden=true);
    const panel=$('#view-'+v);
    if(panel)panel.hidden=false;
    const copy=VIEW_COPY[v]||VIEW_COPY.overview;
    $('#admin-page-title').textContent=copy[0];
    $('#admin-page-subtitle').textContent=copy[1];
    if(v==='commissions')renderCommissions();
    msg('');
  }

  function profileFor(id){return PROFILES.find(p=>p.id===id)||{}}
  function supplierFor(id){return SUPPLIERS.find(s=>s.id===id)||{}}
  function productFor(id){return PRODUCTS.find(p=>p.id===id)||{}}
  function itemsForOrder(id){return ITEMS.filter(i=>i.order_id===id)}
  function variantsForProduct(id){return VARIANTS.filter(v=>v.product_id===id)}
  function totalStock(id){return variantsForProduct(id).reduce((n,v)=>n+Number(v.stock_quantity||0),0)}
  function imageFor(id){return IMAGES.filter(i=>i.product_id===id).sort((a,b)=>Number(a.position)-Number(b.position))[0]}
  function productCountForSupplier(id){return PRODUCTS.filter(p=>p.supplier_id===id).length}
  function fmtDate(v){return v?new Date(v).toLocaleDateString():'—'}
  function fmtDateTime(v){return v?new Date(v).toLocaleString():'—'}

  async function verifyAdmin(){
    SESSION=IZZY.session();
    if(!SESSION?.user?.id)throw Error('Please log in.');
    const roles=await IZZY.request(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(SESSION.user.id)}`);
    if(!roles.some(r=>r.role==='admin'))throw Error('Admin access required.');
    const me=await IZZY.request(`/rest/v1/profiles?select=id,full_name&id=eq.${encodeURIComponent(SESSION.user.id)}&limit=1`);
    $('#admin-name').textContent=me?.[0]?.full_name||'Admin';
    $('#admin-email').textContent=SESSION.user.email||'';
    $('#admin-gate').hidden=true;
    $('#admin-dashboard').hidden=false;
  }

  function setLoading(){
    $('#admin-attention-list').innerHTML='<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line medium" style="margin-top:10px"></div><div class="skeleton skeleton-line short" style="margin-top:10px"></div>';
    $('#marketplace-snapshot').innerHTML='<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div>';
    $('#audit-activity').innerHTML='<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line medium" style="margin-top:10px"></div>';
  }

  function supplierLowStockCount(supplierId){
    const s=supplierFor(supplierId);
    const limit=Number(s.low_stock_threshold??5);
    return PRODUCTS.filter(p=>p.supplier_id===supplierId).filter(p=>{
      const vs=variantsForProduct(p.id);
      return vs.length&&vs.some(v=>Number(v.stock_quantity||0)<=limit);
    }).length;
  }

  function lowStockProducts(){
    return PRODUCTS.filter(p=>{
      const s=supplierFor(p.supplier_id);
      const limit=Number(s.low_stock_threshold??5);
      const vs=variantsForProduct(p.id);
      return vs.length&&vs.some(v=>Number(v.stock_quantity||0)<=limit);
    });
  }

  function renderOverview(){
    const pending=SUPPLIERS.filter(s=>s.status==='pending').length;
    const approved=SUPPLIERS.filter(s=>s.status==='approved').length;
    const activeProducts=PRODUCTS.filter(p=>p.status==='active').length;
    const openOrders=ORDERS.filter(o=>['pending','processing'].includes(o.status)).length;
    const low=lowStockProducts();

    $('#stat-pending-suppliers').textContent=pending;
    $('#stat-active-suppliers').textContent=approved;
    $('#stat-active-products').textContent=activeProducts;
    $('#stat-open-orders').textContent=openOrders;

    const attention=[];
    if(pending)attention.push({type:'supplier',title:`${pending} supplier application${pending===1?'':'s'} waiting`,text:'Review applications before suppliers enter the marketplace.',view:'suppliers',supplierFilter:'pending',action:'Review'});
    if(openOrders)attention.push({type:'order',title:`${openOrders} open order${openOrders===1?'':'s'}`,text:'Pending or processing orders are still moving through fulfillment.',view:'orders',orderFilter:'open',action:'Inspect'});
    if(low.length)attention.push({type:'stock',title:`${low.length} low-stock product${low.length===1?'':'s'}`,text:'Suppliers may need to replenish inventory soon.',view:'products',action:'View products'});
    const suspended=SUPPLIERS.filter(s=>s.status==='suspended').length;
    if(suspended)attention.push({type:'supplier',title:`${suspended} suspended supplier${suspended===1?'':'s'}`,text:'Suspended suppliers are blocked from marketplace activity.',view:'suppliers',supplierFilter:'suspended',action:'Inspect'});

    $('#admin-attention-list').innerHTML=attention.map(a=>`<div class="attention-row">
      <span class="attention-icon">${a.type==='supplier'?'S':a.type==='order'?'↗':'!'}</span>
      <div><b>${IZZY.esc(a.title)}</b><small>${IZZY.esc(a.text)}</small></div>
      <button class="btn secondary admin-attention-action" data-view-target="${a.view}" ${a.supplierFilter?`data-supplier-filter="${a.supplierFilter}"`:''} ${a.orderFilter?`data-order-filter="${a.orderFilter}"`:''}>${a.action}</button>
    </div>`).join('')||'<div class="empty-mini"><b>Marketplace looks clear.</b><span>No urgent admin tasks right now.</span></div>';

    document.querySelectorAll('.admin-attention-action').forEach(b=>b.onclick=()=>{
      if(b.dataset.supplierFilter){
        $('#supplier-status-filter').value=b.dataset.supplierFilter;
        renderSuppliers();
      }
      if(b.dataset.orderFilter){
        $('#admin-order-status').value=b.dataset.orderFilter==='open'?'':b.dataset.orderFilter;
        renderOrders(b.dataset.orderFilter);
      }
      go(b.dataset.viewTarget);
    });

    const totalStock=VARIANTS.reduce((n,v)=>n+Number(v.stock_quantity||0),0);
    const fulfilled=ORDERS.filter(o=>o.status==='fulfilled').length;
    $('#marketplace-snapshot').innerHTML=`
      <div><small>Total products</small><strong>${PRODUCTS.length}</strong></div>
      <div><small>Total stock units</small><strong>${totalStock}</strong></div>
      <div><small>Fulfilled orders</small><strong>${fulfilled}</strong></div>
      <div><small>Marketplace commission</small><strong>${Number(DEFAULT_COMMISSION).toFixed(2).replace(/\.00$/,'')}%</strong></div>
    `;

    renderAudit();
  }

  function humanAudit(a){
    const d=a.details||{};
    const map={
      supplier_status_changed:()=>`${d.supplier_name||'Supplier'} changed from ${d.from||'—'} to ${d.to||'—'}`,
      global_commission_changed:()=>`Marketplace commission changed from ${d.from??'—'}% to ${d.to??'—'}%`,
      supplier_commission_changed:()=>`${d.supplier_name||'Supplier'} commission changed from ${d.from??'inherit'} to ${d.to??'inherit'}`,
      product_commission_changed:()=>`${d.product_name||'Product'} commission changed from ${d.from??'inherit'} to ${d.to??'inherit'}`,
      product_status_changed:()=>`${d.product_name||'Product'} changed from ${d.from||'—'} to ${d.to||'—'}`,
      admin_access_revoked:()=>`Admin access revoked for ${d.target_name||'user'}`
    };
    return map[a.action]?map[a.action]():String(a.action||'Admin action').replaceAll('_',' ');
  }

  function renderAudit(){
    $('#audit-activity').innerHTML=AUDIT.slice(0,10).map(a=>{
      const actor=profileFor(a.actor_id);
      return `<div class="audit-row"><span class="audit-dot"></span><div><b>${IZZY.esc(humanAudit(a))}</b><small>${IZZY.esc(actor.full_name||'Admin')} · ${fmtDateTime(a.created_at)}</small></div></div>`;
    }).join('')||'<div class="empty-mini"><b>No admin activity recorded yet.</b><span>New supplier, commission, product moderation, and access changes will appear here.</span></div>';
  }

  function renderNotifications(){
    const notes=[];
    SUPPLIERS.filter(s=>s.status==='pending').slice(0,5).forEach(s=>notes.push({kind:'supplier',title:'Supplier application',text:`${s.business_name} is waiting for review`,view:'suppliers',supplierFilter:'pending'}));
    ORDERS.filter(o=>['pending','processing'].includes(o.status)).slice(0,5).forEach(o=>notes.push({kind:'order',title:'Open order',text:`${o.external_order_ref||o.shopify_order_name||'Order '+String(o.id).slice(0,8)} · ${o.status}`,view:'orders'}));
    lowStockProducts().slice(0,5).forEach(p=>notes.push({kind:'stock',title:'Low stock',text:`${p.name} · ${supplierFor(p.supplier_id).business_name||'Supplier'}`,view:'products'}));

    $('#admin-notification-count').textContent=notes.length;
    $('#admin-notification-count').hidden=!notes.length;
    $('#admin-notification-list').innerHTML=notes.map(n=>`<button class="notification-item" data-note-view="${n.view}" ${n.supplierFilter?`data-note-supplier-filter="${n.supplierFilter}"`:''}>
      <span class="notification-item-icon">${n.kind==='supplier'?'S':n.kind==='order'?'↗':'!'}</span>
      <span><b>${IZZY.esc(n.title)}</b><small>${IZZY.esc(n.text)}</small></span>
    </button>`).join('')||'<div class="empty-mini"><b>You are all caught up.</b><span>No Control Center alerts right now.</span></div>';

    document.querySelectorAll('#admin-notification-list .notification-item').forEach(b=>b.onclick=()=>{
      if(b.dataset.noteSupplierFilter){$('#supplier-status-filter').value=b.dataset.noteSupplierFilter;renderSuppliers()}
      go(b.dataset.noteView);
      $('#admin-notification-panel').hidden=true;
    });
  }

  function filteredSuppliers(){
    const q=$('#supplier-search').value.trim().toLowerCase();
    const status=$('#supplier-status-filter').value;
    return SUPPLIERS.filter(s=>{
      const p=profileFor(s.profile_id);
      const hay=[s.business_name,p.full_name,p.phone,s.business_registration_number].filter(Boolean).join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(!status||s.status===status);
    });
  }

  function renderSuppliers(){
    const rows=filteredSuppliers();
    $('#supplier-results-meta').textContent=`${rows.length} supplier${rows.length===1?'':'s'} shown`;
    $('#suppliers').innerHTML=rows.map(s=>{
      const p=profileFor(s.profile_id);
      const commission=s.commission_rate_override==null?`Inherit ${DEFAULT_COMMISSION}%`:`${s.commission_rate_override}%`;
      const actions=s.status==='pending'
        ?`<button class="btn review-btn" data-id="${s.id}" data-decision="approve">Approve</button><button class="btn secondary review-btn" data-id="${s.id}" data-decision="reject">Reject</button>`
        :s.status==='approved'
          ?`<button class="btn secondary review-btn" data-id="${s.id}" data-decision="suspend">Suspend</button>`
          :`<button class="btn secondary review-btn" data-id="${s.id}" data-decision="approve">Approve</button>`;
      return `<div class="admin-supplier-table admin-table-row ${s.status==='pending'?'needs-review':''}">
        <div class="admin-entity-cell"><span class="entity-avatar">${IZZY.esc((s.business_name||'S')[0].toUpperCase())}</span><div><b>${IZZY.esc(s.business_name||'Supplier')}</b><small>${IZZY.esc(p.full_name||'')} ${p.phone?'· '+IZZY.esc(p.phone):''}</small></div></div>
        <span data-label="Joined">${fmtDate(s.created_at)}</span>
        <span data-label="Products">${productCountForSupplier(s.id)} <small>${supplierLowStockCount(s.id)?'· '+supplierLowStockCount(s.id)+' low':''}</small></span>
        <span data-label="Commission">${IZZY.esc(commission)}</span>
        <span data-label="Status"><span class="tag ${s.status==='approved'?'ok':s.status==='pending'?'warn':s.status==='suspended'?'bad':''}">${IZZY.esc(s.status)}</span></span>
        <div class="admin-row-actions">${actions}</div>
      </div>`;
    }).join('')||'<div class="empty-state admin-table-empty"><div class="empty-icon">S</div><h3>No suppliers found</h3><p>Try changing the current search or status filter.</p></div>';

    document.querySelectorAll('.review-btn').forEach(b=>b.onclick=()=>reviewSupplier(b));
  }

  async function reviewSupplier(btn){
    const decision=btn.dataset.decision;
    const label=decision==='approve'?'approve':decision==='reject'?'reject':'suspend';
    if((decision==='reject'||decision==='suspend')&&!confirm(`Are you sure you want to ${label} this supplier?`))return;
    btn.disabled=true;
    try{
      await IZZY.rpc('admin_review_supplier',{_supplier_id:btn.dataset.id,_decision:decision});
      msg('Supplier updated.');
      await load(false);
    }catch(e){msg(e.message,true);btn.disabled=false}
  }

  function populateSupplierFilters(){
    const productCurrent=$('#admin-product-supplier').value;
    const orderCurrent=$('#admin-order-supplier').value;
    const options=SUPPLIERS.map(s=>`<option value="${s.id}">${IZZY.esc(s.business_name||'Supplier')}</option>`).join('');
    $('#admin-product-supplier').innerHTML='<option value="">All suppliers</option>'+options;
    $('#admin-order-supplier').innerHTML='<option value="">All suppliers</option>'+options;
    if(SUPPLIERS.some(s=>s.id===productCurrent))$('#admin-product-supplier').value=productCurrent;
    if(SUPPLIERS.some(s=>s.id===orderCurrent))$('#admin-order-supplier').value=orderCurrent;
  }

  function filteredProducts(){
    const q=$('#admin-product-search').value.trim().toLowerCase();
    const status=$('#admin-product-status').value;
    const sid=$('#admin-product-supplier').value;
    return PRODUCTS.filter(p=>{
      const s=supplierFor(p.supplier_id);
      const hay=[p.name,p.sku,p.description,s.business_name].filter(Boolean).join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(!status||p.status===status)&&(!sid||p.supplier_id===sid);
    });
  }

  function renderProducts(){
    const rows=filteredProducts();
    $('#admin-product-results-meta').textContent=`${rows.length} product${rows.length===1?'':'s'} shown`;
    $('#products').innerHTML=rows.map(p=>{
      const s=supplierFor(p.supplier_id),img=imageFor(p.id),stock=totalStock(p.id);
      const canModerate=['active','inactive'].includes(p.status);
      const action=canModerate?`<button class="btn secondary moderate-product" data-id="${p.id}" data-next="${p.status==='active'?'inactive':'active'}">${p.status==='active'?'Deactivate':'Activate'}</button>`:'';
      return `<div class="admin-product-table admin-table-row">
        <div class="admin-product-cell"><div class="admin-product-thumb">${img?.url?`<img src="${IZZY.esc(img.url)}" alt="">`:'IZ'}</div><div><b>${IZZY.esc(p.name)}</b><small>${IZZY.esc(p.sku||'')}</small></div></div>
        <span data-label="Supplier">${IZZY.esc(s.business_name||'—')}</span>
        <span data-label="Stock" class="${stock===0?'stock-low':''}">${stock}</span>
        <span data-label="Price">${IZZY.money(p.suggested_retail_price,p.currency)}</span>
        <span data-label="Status"><span class="tag ${p.status==='active'?'ok':p.status==='inactive'?'warn':''}">${IZZY.esc(p.status)}</span></span>
        <span data-label="Added">${fmtDate(p.created_at)}</span>
        <div class="admin-row-actions"><a class="btn secondary" href="product.html?slug=${encodeURIComponent(p.public_slug||'')}" target="_blank" rel="noopener">Inspect</a>${action}</div>
      </div>`;
    }).join('')||'<div class="empty-state admin-table-empty"><div class="empty-icon">□</div><h3>No products found</h3><p>Try changing the product filters.</p></div>';

    document.querySelectorAll('.moderate-product').forEach(b=>b.onclick=()=>moderateProduct(b));
  }

  async function moderateProduct(btn){
    const next=btn.dataset.next;
    if(next==='inactive'&&!confirm('Deactivate this product and hide it from dropshippers?'))return;
    btn.disabled=true;btn.textContent=next==='inactive'?'Deactivating…':'Activating…';
    try{
      await IZZY.rpc('admin_set_product_status',{_product_id:btn.dataset.id,_status:next});
      msg(next==='inactive'?'Product deactivated.':'Product activated.');
      await load(false);
    }catch(e){msg(e.message,true);btn.disabled=false}
  }

  function orderSupplierIds(orderId){return [...new Set(itemsForOrder(orderId).map(i=>i.supplier_id).filter(Boolean))]}

  function filteredOrders(openOverride=null){
    const q=$('#admin-order-search').value.trim().toLowerCase();
    const status=$('#admin-order-status').value;
    const sid=$('#admin-order-supplier').value;
    return ORDERS.filter(o=>{
      const items=itemsForOrder(o.id);
      const productNames=items.map(i=>productFor(i.supplier_product_id).name).join(' ');
      const supplierNames=items.map(i=>supplierFor(i.supplier_id).business_name).join(' ');
      const hay=[o.external_order_ref,o.shopify_order_name,o.customer_name,o.customer_phone,productNames,supplierNames].filter(Boolean).join(' ').toLowerCase();
      const statusOk=openOverride==='open'?['pending','processing'].includes(o.status):(!status||o.status===status);
      const supplierOk=!sid||items.some(i=>i.supplier_id===sid);
      return (!q||hay.includes(q))&&statusOk&&supplierOk;
    });
  }

  function renderOrders(openOverride=null){
    const rows=filteredOrders(openOverride);
    $('#admin-order-results-meta').textContent=`${rows.length} order${rows.length===1?'':'s'} shown`;
    $('#orders').innerHTML=rows.map(o=>{
      const items=itemsForOrder(o.id);
      const d=DROPSHIPPERS.find(x=>x.id===o.dropshipper_id);
      const dp=profileFor(d?.profile_id);
      const itemHtml=items.map(i=>{
        const p=productFor(i.supplier_product_id),s=supplierFor(i.supplier_id);
        return `<div class="admin-order-item"><div><b>${IZZY.esc(p.name||'Product')} × ${Number(i.quantity||1)}</b><small>${IZZY.esc(s.business_name||'Supplier')}</small></div><div><span class="tag ${i.fulfillment_status==='fulfilled'?'ok':i.fulfillment_status==='cancelled'?'bad':''}">${IZZY.esc(i.fulfillment_status)}</span>${i.tracking_number?`<small>${IZZY.esc(i.shipping_carrier||'Carrier')} · ${IZZY.esc(i.tracking_number)}</small>`:''}</div></div>`;
      }).join('')||'<div class="notice">No order items found.</div>';

      return `<article class="card admin-order-card">
        <div class="admin-order-head">
          <div><b>${IZZY.esc(o.external_order_ref||o.shopify_order_name||('Order '+String(o.id).slice(0,8)))}</b><small>${fmtDateTime(o.created_at)} · ${IZZY.esc(o.source||'manual')}</small></div>
          <div class="admin-order-statuses"><span class="tag ${o.status==='fulfilled'?'ok':o.status==='pending'?'warn':o.status==='cancelled'||o.status==='refunded'?'bad':''}">${IZZY.esc(o.status)}</span><span class="tag">${IZZY.esc(o.payment_status||'')}</span></div>
        </div>
        <div class="admin-order-summary">
          <div><small>Customer</small><b>${IZZY.esc(o.customer_name||'—')}</b><span>${IZZY.esc(o.customer_phone||'')}</span></div>
          <div><small>Dropshipper</small><b>${IZZY.esc(d?.business_name||dp.full_name||'—')}</b></div>
          <div><small>Suppliers</small><b>${IZZY.esc(orderSupplierIds(o.id).map(id=>supplierFor(id).business_name||'Supplier').join(', ')||'—')}</b></div>
          <div><small>Total</small><b>${IZZY.money(o.total_amount,o.currency)}</b></div>
        </div>
        <details class="order-details"><summary>View order items</summary><div class="admin-order-items">${itemHtml}</div></details>
      </article>`;
    }).join('')||'<div class="empty-state"><div class="empty-icon">□</div><h3>No orders found</h3><p>Try changing the order filters.</p></div>';
  }

  function effectiveRate(p,s){return p?.commission_rate_override??s?.commission_rate_override??DEFAULT_COMMISSION}

  function renderCommissions(){
    const select=$('#commission-supplier');
    $('#global-commission').textContent=Number(DEFAULT_COMMISSION).toFixed(2).replace(/\.00$/,'')+'%';
    $('#global-commission-input').value=DEFAULT_COMMISSION;

    if(!SUPPLIERS.length){
      select.innerHTML='<option>No suppliers yet</option>';
      $('#commission-products').innerHTML='<div class="notice">No suppliers available.</div>';
      $('#supplier-effective-commission').innerHTML='';
      return;
    }

    const current=SELECTED_SUPPLIER||select.value||SUPPLIERS[0].id;
    select.innerHTML=SUPPLIERS.map(s=>`<option value="${s.id}">${IZZY.esc(s.business_name)} · ${IZZY.esc(s.status)}</option>`).join('');
    if(SUPPLIERS.some(s=>s.id===current))select.value=current;
    SELECTED_SUPPLIER=select.value;

    const supplier=supplierFor(SELECTED_SUPPLIER);
    $('#supplier-commission').value=supplier?.commission_rate_override??'';
    $('#supplier-commission').placeholder=`Inherit ${DEFAULT_COMMISSION}%`;
    const supplierEffective=supplier?.commission_rate_override??DEFAULT_COMMISSION;
    $('#supplier-effective-commission').innerHTML=`<span>Effective supplier rate</span><strong>${supplierEffective}%</strong><small>${supplier?.commission_rate_override==null?'Inherited from marketplace default':'Supplier override'}</small>`;

    const products=PRODUCTS.filter(p=>p.supplier_id===SELECTED_SUPPLIER);
    $('#commission-products').innerHTML=products.map(p=>{
      const inherited=supplier?.commission_rate_override??DEFAULT_COMMISSION;
      const effective=effectiveRate(p,supplier);
      const source=p.commission_rate_override!=null?'Product override':supplier?.commission_rate_override!=null?'Supplier override':'Marketplace default';
      return `<div class="card commission-product-card">
        <div class="commission-product-head"><div><b>${IZZY.esc(p.name)}</b><small>${IZZY.esc(p.sku||'')}</small></div><span class="tag ${p.commission_rate_override!=null?'ok':''}">${IZZY.esc(source)}</span></div>
        <div class="commission-effective-row"><span>Effective commission</span><strong>${effective}%</strong></div>
        <div class="inline-control"><input class="product-commission-input" data-id="${p.id}" type="number" min="0" max="100" step="0.01" value="${p.commission_rate_override??''}" placeholder="Inherit ${inherited}%"><button class="btn secondary product-commission-save" data-id="${p.id}">Save</button></div>
      </div>`;
    }).join('')||'<div class="notice">This supplier has no products yet.</div>';

    document.querySelectorAll('.product-commission-save').forEach(b=>b.onclick=()=>saveProductCommission(b));
  }

  async function saveProductCommission(btn){
    const input=document.querySelector(`.product-commission-input[data-id="${btn.dataset.id}"]`);
    const raw=input.value.trim(),rate=raw===''?null:Number(raw);
    if(rate!==null&&(Number.isNaN(rate)||rate<0||rate>100)){msg('Commission must be between 0 and 100.',true);return}
    btn.disabled=true;btn.textContent='Saving…';
    try{
      await IZZY.rpc('admin_set_product_commission',{_product_id:btn.dataset.id,_rate:rate});
      msg('Product commission updated.');
      await load(false);renderCommissions();
    }catch(e){msg(e.message,true)}
    finally{btn.disabled=false;btn.textContent='Save'}
  }

  function renderAdmins(){
    $('#admin-accounts').innerHTML=ADMINS.map(a=>{
      const self=a.user_id===SESSION?.user?.id;
      return `<div class="admin-account-row">
        <span class="entity-avatar">${IZZY.esc((a.full_name||a.email||'A')[0].toUpperCase())}</span>
        <div><b>${IZZY.esc(a.full_name||a.email||'Admin')}</b><small>${IZZY.esc(a.email||'')} · Added ${fmtDate(a.granted_at||a.created_at)}</small>${a.last_sign_in_at?`<small>Last sign in ${fmtDateTime(a.last_sign_in_at)}</small>`:''}</div>
        ${self?'<span class="tag ok">You</span>':`<button class="text-danger revoke-admin" data-id="${a.user_id}" data-name="${IZZY.esc(a.full_name||a.email||'this admin')}">Revoke</button>`}
      </div>`;
    }).join('')||'<div class="empty-mini"><b>No admin accounts found.</b><span>Invite a trusted person to add another admin.</span></div>';
    document.querySelectorAll('.revoke-admin').forEach(b=>b.onclick=()=>revokeAdmin(b));
  }

  async function revokeAdmin(btn){
    if(!confirm(`Revoke admin access for ${btn.dataset.name}?`))return;
    btn.disabled=true;
    try{
      await IZZY.rpc('admin_revoke_admin',{_user_id:btn.dataset.id});
      msg('Admin access revoked.');
      await load(false);
    }catch(e){msg(e.message,true);btn.disabled=false}
  }

  async function load(showMessage=true){
    const [suppliers,profiles,products,variants,orders,items,dropshippers,settings,audit,admins]=await Promise.all([
      IZZY.request('/rest/v1/suppliers?select=*&order=created_at.desc'),
      IZZY.request('/rest/v1/profiles?select=id,full_name,phone,business_name,created_at'),
      IZZY.request('/rest/v1/supplier_products?select=*&order=created_at.desc'),
      IZZY.request('/rest/v1/product_variants?select=*&order=created_at.desc'),
      IZZY.request('/rest/v1/orders?select=*&order=created_at.desc&limit=250'),
      IZZY.request('/rest/v1/order_items?select=*&order=created_at.desc&limit=500'),
      IZZY.request('/rest/v1/dropshippers?select=id,profile_id,business_name,status,created_at'),
      IZZY.request('/rest/v1/marketplace_settings?select=default_commission_rate&id=eq.true&limit=1'),
      IZZY.request('/rest/v1/audit_log?select=*&order=created_at.desc&limit=50'),
      IZZY.rpc('admin_list_accounts')
    ]);

    SUPPLIERS=suppliers||[];
    PROFILES=profiles||[];
    PRODUCTS=products||[];
    VARIANTS=variants||[];
    ORDERS=orders||[];
    ITEMS=items||[];
    DROPSHIPPERS=dropshippers||[];
    DEFAULT_COMMISSION=Number(settings?.[0]?.default_commission_rate??0);
    AUDIT=audit||[];
    ADMINS=Array.isArray(admins)?admins:[];

    if(PRODUCTS.length){
      const ids=PRODUCTS.map(p=>p.id).join(',');
      IMAGES=await IZZY.request(`/rest/v1/product_images?select=*&product_id=in.(${ids})&order=position.asc`);
    }else IMAGES=[];

    populateSupplierFilters();
    renderOverview();
    renderNotifications();
    renderSuppliers();
    renderProducts();
    renderOrders();
    renderCommissions();
    renderAdmins();
    if(showMessage)msg('');
  }

  $('#supplier-search').oninput=renderSuppliers;
  $('#supplier-status-filter').onchange=renderSuppliers;
  $('#admin-product-search').oninput=renderProducts;
  $('#admin-product-status').onchange=renderProducts;
  $('#admin-product-supplier').onchange=renderProducts;
  $('#admin-order-search').oninput=()=>renderOrders();
  $('#admin-order-status').onchange=()=>renderOrders();
  $('#admin-order-supplier').onchange=()=>renderOrders();

  $('#commission-supplier').onchange=e=>{SELECTED_SUPPLIER=e.target.value;renderCommissions()};

  $('#global-commission-form').onsubmit=async e=>{
    e.preventDefault();
    const rate=Number($('#global-commission-input').value);
    if(!Number.isFinite(rate)||rate<0||rate>100){msg('Commission must be between 0 and 100.',true);return}
    try{
      await IZZY.rpc('admin_set_global_commission',{_rate:rate});
      msg('Marketplace default commission updated.');
      await load(false);renderCommissions();
    }catch(err){msg(err.message,true)}
  };

  $('#supplier-commission-form').onsubmit=async e=>{
    e.preventDefault();
    const raw=$('#supplier-commission').value.trim(),rate=raw===''?null:Number(raw);
    if(rate!==null&&(Number.isNaN(rate)||rate<0||rate>100)){msg('Commission must be between 0 and 100.',true);return}
    try{
      await IZZY.rpc('admin_set_supplier_commission',{_supplier_id:$('#commission-supplier').value,_rate:rate});
      msg('Supplier commission updated.');
      await load(false);renderCommissions();
    }catch(err){msg(err.message,true)}
  };

  $('#admin-invite-form').onsubmit=async e=>{
    e.preventDefault();
    const st=$('#admin-invite-status'),btn=$('#admin-invite-btn'),email=$('#admin-email-input').value.trim();
    st.textContent='Sending IzzyDrop admin invite…';st.className='status';btn.disabled=true;
    try{
      await IZZY.request('/functions/v1/admin-invite',{method:'POST',body:JSON.stringify({email})});
      st.textContent='Admin invitation sent. They can open the email and create their password.';
      e.target.reset();
      setTimeout(()=>load(false).catch(()=>{}),1000);
    }catch(err){st.textContent=err.message;st.className='status bad'}
    finally{btn.disabled=false}
  };

  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>go(b.dataset.view));
  document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{
    if(b.dataset.supplierFilter){$('#supplier-status-filter').value=b.dataset.supplierFilter;renderSuppliers()}
    if(b.dataset.productFilter){$('#admin-product-status').value=b.dataset.productFilter;renderProducts()}
    if(b.dataset.orderFilter){renderOrders(b.dataset.orderFilter)}
    go(b.dataset.jump);
  });

  $('#admin-notification-bell').onclick=e=>{
    e.stopPropagation();
    $('#admin-notification-panel').hidden=!$('#admin-notification-panel').hidden;
  };
  $('#admin-notification-panel').onclick=e=>e.stopPropagation();
  document.addEventListener('click',()=>{$('#admin-notification-panel').hidden=true});

  (async()=>{
    try{
      await verifyAdmin();
      setLoading();
      await load(false);
      go('overview');
    }catch(e){
      const g=$('#admin-gate-message');
      if(g){g.textContent=e.message;g.style.color='var(--bad)'}
      msg(e.message,true);
      setTimeout(()=>location.href='login.html',1400);
    }
  })();
})();