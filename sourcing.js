// Community sourcing tracks discovery; products are created only through the normal supplier product flow.
(()=>{
  const ar=()=>window.IZZY_I18N?.isArabic?.()===true;
  const local=(en,arText)=>ar()?arText:en;
  const esc=v=>IZZY.esc(v), money=v=>v==null?local('Not specified','غير محدد'):IZZY.money(v,'EGP');
  const safeUrl=v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
  const image=url=>safeUrl(url)?'<img class="sourcing-image" src="'+esc(safeUrl(url))+'" alt="'+esc(local('Requested product','المنتج المطلوب'))+'" loading="lazy">':'';
  const state=s=>({open:'Open request',sourcing:'Suppliers sourcing',sourced:'Sourced',closed:'Closed',archived:'Archived',withdrawn:'Withdrawn'}[s]||s);
  const tag=s=>'<span class="tag '+(s==='sourced'?'ok':'warn')+'">'+esc(state(s))+'</span>';
  const empty=t=>'<div class="empty-state"><div class="empty-icon">⌕</div><h3>'+esc(t)+'</h3></div>';
  const sourceLink=url=>safeUrl(url)?'<a href="'+esc(safeUrl(url))+'" target="_blank" rel="noopener noreferrer">Product reference ↗</a>':'';
  const details=r=>`<p class="sourcing-description">${esc(r.description||r.notes||'')}</p>
    <div class="sourcing-facts"><span>Target supplier cost: <b>${money(r.target_cost)}</b></span>
    <span>Expected demand: <b>${r.expected_quantity==null?'Not specified':esc(r.expected_quantity)+' units'}</b></span>
    <span><b>${Number(r.interest_count||0)}</b> interested dropshippers</span></div>
    ${sourceLink(r.source_url)}${r.notes&&r.notes!==r.description?'<p class="muted">'+esc(r.notes)+'</p>':''}`;
  const productLink=(p,from='app',requestId=null)=>{
    if(!p?.public_slug)return '';
    const params=new URLSearchParams({slug:p.public_slug,from});
    if(requestId)params.set('request',requestId);
    return 'product.html?'+params.toString();
  };
  const range=(p,key)=>{const values=(p.variants||[]).map(v=>v[key]).filter(v=>v!=null).map(Number);if(!values.length)return 'Not specified';const lo=Math.min(...values),hi=Math.max(...values);return IZZY.money(lo,p.currency||'EGP')+(hi!==lo?' – '+IZZY.money(hi,p.currency||'EGP'):'')};
  const responseTag=o=>o.status==='sourced'&&!o.catalog_product?'<span class="tag warn">'+(o.catalog_product_id?'Linked product unavailable':'Awaiting published product')+'</span>':tag(o.status);
  const offerDetails=(o,r)=>{
    const p=o.catalog_product;if(!p)return '<p class="muted">No eligible published product is linked. Create the product normally, then link it here.</p>';
    return '<h4>'+esc(p.name)+'</h4><div class="sourcing-facts sourcing-commercial">'+
      '<span>Supplier price <b>'+range(p,'supplier_price')+'</b></span>'+
      '<span>Suggested retail <b>'+range(p,'suggested_retail')+'</b><small>Guidance only — you choose your selling price.</small></span>'+
      '<span>Current stock <b>'+(p.variants||[]).reduce((n,v)=>n+Number(v.stock||0),0)+'</b><small>Across enabled variants. No stock is reserved by interest.</small></span>'+
      '<span>Community demand <b>'+Number(r?.interest_count||0)+' interested</b></span></div>'+
      '<details class="sourcing-variants"><summary>Variants ('+(p.variants||[]).length+')</summary>'+
      (p.variants||[]).map(v=>'<div class="sourcing-progress"><b>'+esc(v.name)+'</b><span>Supplier: '+IZZY.money(v.supplier_price,p.currency||'EGP')+'</span><span>Suggested: '+(v.suggested_retail==null?'Not specified':IZZY.money(v.suggested_retail,p.currency||'EGP'))+'</span><span>Stock: '+Number(v.stock||0)+'</span></div>').join('')+'</details>';
  };
  const offerPreview=(o,r,context='dropshipper')=>{
    const link=o.catalog_product
      ? (context==='supplier'?productLink(o.catalog_product,'supplier',r.id):'app.html?sourced='+encodeURIComponent(o.id))
      : '';
    return '<div class="sourcing-progress"><b>'+esc(o.supplier_name||'IzzyDrop Supplier')+'</b> '+responseTag(o)+
      (o.catalog_product?'<span>'+esc(o.catalog_product.name)+' · '+range(o.catalog_product,'supplier_price')+'</span><a class="auth-text-button" href="'+esc(link)+'">'+(context==='supplier'?'View published product →':'View sourced product →')+'</a>':'<span>'+(o.status==='sourced'?'Published catalog link needed.':'Finding this product. Commercial information comes from the published product.')+'</span>')+'</div>';
  };
  async function action(button,fn,refresh){
    const label=button.textContent;button.disabled=true;button.textContent=local('Saving…','جارٍ الحفظ…');
    const card=button.closest('article')||button.parentElement;
    let status=card.querySelector('.sourcing-action-status');
    if(!status){status=document.createElement('p');status.className='status sourcing-action-status';status.setAttribute('role','status');card.append(status)}
    try{await fn();await refresh()}catch(e){status.textContent=e.message;status.className='status bad sourcing-action-status';button.disabled=false;button.textContent=label}
  }
  function bindDemand(root,refresh){
    root.querySelectorAll('[data-interest-request]').forEach(b=>b.onclick=()=>{
      const currentlyInterested=b.dataset.interested==='1';
      if(currentlyInterested&&!confirm(local('Withdraw interest from this request? This also clears your interest in sourced offers for this request.','إلغاء اهتمامك بهذا الطلب؟ سيؤدي ذلك أيضًا إلى إزالة اهتمامك بأي عروض مورّدة مرتبطة بهذا الطلب.')))return;
      return action(b,()=>IZZY.rpc('sourcing_set_interest',{
        _request_id:b.dataset.interestRequest,
        _response_id:null,
        _interested:!currentlyInterested
      }),refresh);
    });
    root.querySelectorAll('[data-interest-offer]').forEach(b=>b.onclick=()=>{
      const currentlyInterested=b.dataset.interested==='1';
      return action(b,()=>IZZY.rpc('sourcing_set_interest',{
        _request_id:null,
        _response_id:b.dataset.interestOffer,
        _interested:!currentlyInterested
      }),refresh);
    });
    root.querySelectorAll('.sourcing-comment-form').forEach(f=>f.onsubmit=e=>{e.preventDefault();return action(f.querySelector('button'),()=>IZZY.rpc('sourcing_comment',{_request_id:f.dataset.requestId,_body:f.elements.body.value.trim(),_comment_id:f.dataset.commentId||null}),refresh)});
    root.querySelectorAll('[data-close-request]').forEach(b=>b.onclick=()=>{if(confirm(local('Close this request? Existing sourced offers remain visible; new comments and demand will stop.','إغلاق هذا الطلب؟ ستظل العروض المورّدة الحالية ظاهرة، لكن سيتوقف استقبال التعليقات والاهتمام الجديد.')))return action(b,()=>IZZY.rpc('sourcing_close_request',{_request_id:b.dataset.closeRequest}),refresh)});
  }
  let boardFilter='all',boardSearch='';
  function renderDropshipper(board,refresh){
    const root=document.querySelector('#product-requests');if(!root)return;
    const requests=board?.requests||[],responses=board?.responses||[],comments=board?.comments||[];
    const visible=requests.filter(r=>(boardFilter!=='mine'||r.is_mine)&&(boardFilter!=='open'||!['closed','archived'].includes(r.status))&&String(r.title+' '+(r.description||'')).toLowerCase().includes(boardSearch.toLowerCase()));
    root.innerHTML=visible.map(r=>{
      const closed=['closed','archived'].includes(r.status);
      const discussion=comments.filter(c=>c.request_id===r.id);
      return `<article class="card order-card sourcing-post" id="request-${r.id}">
        <div class="order-card-head"><div><h3>${esc(r.title)}</h3><small>${r.is_mine?'Your request · ':''}${new Date(r.created_at).toLocaleDateString()}</small></div>${tag(r.status)}</div>
        ${image(r.image_url)}${details(r)}
        <div class="sourcing-post-actions"><button class="btn secondary" data-interest-request="${r.id}" data-interested="${r.interested?'1':'0'}" ${closed&&!r.interested?'disabled':''}>${r.interested?'Withdraw interest':closed?'Request closed':"I'm interested"}</button>
        ${r.is_mine&&!closed?'<button class="auth-text-button" data-close-request="'+r.id+'">Close request</button>':''}</div>
        <div class="sourcing-progress-list">${responses.filter(o=>o.request_id===r.id).map(o=>offerPreview(o,r,'dropshipper')).join('')||'<p class="muted">Suppliers can start sourcing this product independently.</p>'}</div>
        <details class="sourcing-discussion"><summary>Community discussion (${discussion.length})</summary>
          ${discussion.map(c=>`<div class="sourcing-comment"><small>${c.is_mine?'You':'Dropshipper'} · ${new Date(c.created_at).toLocaleString()}</small><p>${esc(c.body)}</p>
          ${c.is_mine&&!closed?`<details><summary>Edit your comment</summary><form class="sourcing-comment-form" data-request-id="${r.id}" data-comment-id="${c.id}"><textarea name="body" required maxlength="2000" aria-label="Edit comment">${esc(c.body)}</textarea><button class="btn secondary">Save comment</button></form></details>`:''}</div>`).join('')||'<p class="muted">No comments yet. Share the features or demand you need.</p>'}
          ${!closed?`<form class="sourcing-comment-form" data-request-id="${r.id}"><label>Comment<textarea name="body" required maxlength="2000" placeholder="What would make this product useful for your store?"></textarea></label><button class="btn secondary">Post comment</button></form>`:''}
        </details></article>`;
    }).join('')||empty('No sourcing requests in this view');
    bindDemand(root,refresh);
    const filter=document.querySelector('#sourcing-filter'),search=document.querySelector('#sourcing-search');
    if(filter)filter.onchange=()=>{boardFilter=filter.value;renderDropshipper(board,refresh)};
    if(search)search.oninput=()=>{boardSearch=search.value;renderDropshipper(board,refresh)};
    const sourced=document.querySelector('#sourced-products');
    if(sourced){
      sourced.innerHTML=responses.filter(o=>o.status==='sourced'&&o.catalog_product).map(o=>{
        const r=requests.find(r=>r.id===o.request_id)||{};
        const closed=['closed','archived'].includes(r.status);
        return `<article class="card order-card sourcing-post" id="sourced-${o.id}">
          <div class="order-card-head"><div><h3>${esc(r.title||'Sourced product')}</h3><small>${esc(o.supplier_name||'IzzyDrop Supplier')}</small></div>${tag('sourced')}</div>
          ${image(o.catalog_product.image_url)}<div class="notice">Published through the normal Products flow. Prices, variants and stock below come from the catalog. Adding to My Products is your choice.</div>
          ${offerDetails(o,r)}
          <a class="auth-text-button" href="app.html?request=${encodeURIComponent(r.id)}">Open original community request →</a>
          <div class="sourcing-post-actions"><button class="btn ${o.interested?'secondary':''}" data-interest-offer="${o.id}" data-interested="${o.interested?'1':'0'}" ${closed&&!o.interested?'disabled':''}>${o.interested?'Withdraw interest':closed?'Request closed':"I'm interested"}</button>
          ${o.catalog_slug?'<a class="btn secondary" href="product.html?slug='+encodeURIComponent(o.catalog_slug)+'&from=app">View published product</a>':''}</div>
        </article>`;
      }).join('')||empty('No sourced products yet');
      bindDemand(sourced,refresh);
    }
  }
  function renderSupplier(board,products,refresh,createProduct){
    const root=document.querySelector('#supplier-requests');if(!root)return;
    const eligible=board?.eligible_products||[];
    const productOptions=(selectedId='')=>'<option value="">Choose a product</option>'+
      eligible.map(p=>'<option value="'+esc(p.id)+'" '+(String(p.id)===String(selectedId)?'selected':'')+'>'+esc(p.name)+' · '+esc(range(p,'supplier_price'))+' · '+p.variants.length+' variants</option>').join('');

    const correctionForm=(o,r)=>{
      const unavailable=o.catalog_product_id&&!o.catalog_product;
      return '<details class="sourcing-relink" '+(unavailable?'open':'')+'><summary>'+(unavailable?'Fix linked product':'Linked the wrong product?')+'</summary>'+
        '<p class="muted">'+(unavailable?'Choose another active published product from your catalog.':'You can replace the linked product. Interested dropshippers will be notified again so they do not keep using the wrong offer.')+'</p>'+
        '<form class="sourcing-catalog-form" data-relink="1" data-response-id="'+o.id+'" data-request-id="'+r.id+'" data-current-product="'+esc(o.catalog_product_id||'')+'">'+
        '<label>Correct published product<select name="product_id" required>'+productOptions(o.catalog_product_id||'')+'</select></label>'+
        (eligible.length?'':'<p class="muted">No eligible active products are available. Publish or reactivate a product with an enabled variant first.</p>')+
        '<button class="btn secondary" type="submit" '+(!eligible.length?'disabled':'')+'>Update linked product</button>'+
        '<small>This changes only this sourcing link. It does not alter the product, stock, orders or My Products.</small></form></details>';
    };

    root.innerHTML=(board?.requests||[]).filter(r=>!['closed','archived'].includes(r.status)||(board.responses||[]).some(o=>o.request_id===r.id&&o.is_mine)).map(r=>{
      const o=(board.responses||[]).find(o=>o.request_id===r.id&&o.is_mine),closed=['closed','archived'].includes(r.status);
      return '<article class="card order-card sourcing-post" id="supplier-request-'+r.id+'"><div class="order-card-head"><h3>'+esc(r.title)+'</h3>'+tag(r.status)+'</div>'+
        image(r.image_url)+details(r)+
        '<details class="sourcing-discussion"><summary>Community discussion</summary>'+(board.comments||[]).filter(c=>c.request_id===r.id).map(c=>'<div class="sourcing-comment"><p>'+esc(c.body)+'</p></div>').join('')+'</details>'+
        '<div class="sourcing-progress-list">'+(board.responses||[]).filter(x=>x.request_id===r.id&&!x.is_mine).map(x=>offerPreview(x,r,'supplier')).join('')+'</div>'+
        (!o?(closed?'':'<button class="btn" data-start-sourcing="'+r.id+'">Start sourcing</button><p class="muted">Let the community know you are working on finding this product.</p>'):
        '<div class="notice"><b>Your progress</b> '+responseTag(o)+'</div>'+
        (o.catalog_product?image(o.catalog_product.image_url)+offerDetails(o,r)+
          '<div class="sourcing-post-actions"><a class="btn secondary" href="'+esc(productLink(o.catalog_product,'supplier',r.id))+'">Open published product</a></div>'+
          correctionForm(o,r):
         o.catalog_product_id?'<p class="muted">Your linked product is currently unavailable. You can repair the link below or manage its publication in Products.</p><div class="sourcing-post-actions"><button class="btn secondary" data-manage-products>Manage products</button></div>'+correctionForm(o,r):
         closed?'<p class="muted">This request was closed by its owner.</p>':
         '<p class="notice">Start sourcing → Find / obtain product → Create product normally → Link published product → Sourced</p>'+
         '<p>When you have this product ready, create it in Products. IzzyDrop will bring you back to this request and preselect the product for you to review before linking.</p>'+
         '<div class="sourcing-post-actions"><button class="btn secondary" data-create-product data-request-id="'+r.id+'" data-response-id="'+o.id+'" data-request-title="'+esc(r.title)+'">Create product in Products</button><button class="auth-text-button" data-refresh-sourcing>Refresh published products</button></div>'+
         '<form class="sourcing-catalog-form" data-response-id="'+o.id+'" data-request-id="'+r.id+'"><label>Your published product<select name="product_id" required>'+productOptions()+
         '</select></label>'+(eligible.length?'':'<p class="muted">No eligible products yet. Publish a product with at least one enabled variant, then refresh.</p>')+
         '<button class="btn" type="submit" '+(!eligible.length?'disabled':'')+'>Link sourced product</button><small>Notifies interested dropshippers. The community request stays open to other suppliers.</small></form>'))+'</article>';
    }).join('')||empty('No sourcing opportunities yet');

    root.querySelectorAll('[data-start-sourcing]').forEach(b=>b.onclick=()=>action(b,()=>IZZY.rpc('sourcing_start',{_request_id:b.dataset.startSourcing}),refresh));
    root.querySelectorAll('[data-create-product]').forEach(b=>b.onclick=()=>createProduct?createProduct({
      requestId:b.dataset.requestId,
      responseId:b.dataset.responseId,
      title:b.dataset.requestTitle||''
    }):document.querySelector('.supplier-add-nav').click());
    root.querySelectorAll('[data-manage-products]').forEach(b=>b.onclick=()=>document.querySelector('button[data-view="products"]').click());
    root.querySelectorAll('[data-refresh-sourcing]').forEach(b=>b.onclick=()=>action(b,async()=>{},refresh));
    root.querySelectorAll('.sourcing-catalog-form').forEach(f=>f.onsubmit=e=>{
      e.preventDefault();
      const next=f.elements.product_id.value;
      const current=f.dataset.currentProduct||'';
      if(f.dataset.relink==='1'&&current&&next!==current&&!confirm(local('Replace the linked sourced product? Interested dropshippers will be alerted to the corrected product.','استبدال المنتج المورّد المرتبط؟ سيتم تنبيه الدروبشيبرز المهتمين بالمنتج الصحيح.')))return;
      return action(e.submitter||f.querySelector('button'),()=>IZZY.rpc('sourcing_link_catalog',{_response_id:f.dataset.responseId,_product_id:next}),refresh);
    });
  }
  window.IZZY_SOURCING={renderDropshipper,renderSupplier};
})();
