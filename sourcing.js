// Community sourcing keeps its own request/history layer. Marking an offer Sourced publishes a catalog product, but never creates customer orders or adds it to My Products automatically.
(()=>{
  const esc=v=>IZZY.esc(v), money=v=>v==null?'Not specified':IZZY.money(v,'EGP');
  const safeUrl=v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
  const image=url=>safeUrl(url)?'<img class="sourcing-image" src="'+esc(safeUrl(url))+'" alt="Requested product" loading="lazy">':'';
  const state=s=>({open:'Open request',sourcing:'Suppliers sourcing',sourced:'Sourced',closed:'Closed',archived:'Archived',withdrawn:'Withdrawn'}[s]||s);
  const tag=s=>'<span class="tag '+(s==='sourced'?'ok':'warn')+'">'+esc(state(s))+'</span>';
  const empty=t=>'<div class="empty-state"><div class="empty-icon">⌕</div><h3>'+esc(t)+'</h3></div>';
  const sourceLink=url=>safeUrl(url)?'<a href="'+esc(safeUrl(url))+'" target="_blank" rel="noopener noreferrer">Product reference ↗</a>':'';
  const details=r=>`<p class="sourcing-description">${esc(r.description||r.notes||'')}</p>
    <div class="sourcing-facts"><span>Target supplier cost: <b>${money(r.target_cost)}</b></span>
    <span>Expected demand: <b>${r.expected_quantity==null?'Not specified':esc(r.expected_quantity)+' units'}</b></span>
    <span><b>${Number(r.interest_count||0)}</b> interested dropshippers</span></div>
    ${sourceLink(r.source_url)}${r.notes&&r.notes!==r.description?'<p class="muted">'+esc(r.notes)+'</p>':''}`;
  const offerDetails=(o,r)=>`<div class="sourcing-facts sourcing-commercial">
    <span>Supplier price <b>${money(o.supplier_price)}</b></span>
    <span>Recommended retail <b>${money(o.recommended_retail)}</b><small>Guidance only — you choose your selling price.</small></span>
    <span>Estimated margin <b>${money(o.estimated_margin)}</b><small>Before shipping, fees and other costs.</small></span>
    <span>Available quantity <b>${o.available_quantity==null?'Not confirmed':esc(o.available_quantity)}</b><small>Supplier availability, not reserved stock.</small></span>
    <span>MOQ <b>${o.moq==null?'Not specified':esc(o.moq)}</b></span>
    <span>Lead time <b>${o.lead_time_days==null?'Not confirmed':esc(o.lead_time_days)+' days'}</b></span>
    <span>Origin <b>${esc(o.origin_country||'Not specified')}</b></span>
    <span>Community demand <b>${Number(r?.interest_count||0)} interested</b><small>${Number(o.interest_count||0)} requested this supplier offer</small></span>
    </div><p class="sourcing-description">${esc(o.supplier_notes||'')}</p>
    ${o.sourcing_details?'<p class="muted">'+esc(o.sourcing_details)+'</p>':''}`;
  const offerPreview=(o,r)=>`<div class="sourcing-progress"><b>${esc(o.supplier_name||'IzzyDrop Supplier')}</b> ${tag(o.status)}
    ${o.status==='sourced'?'<span>'+money(o.supplier_price)+' · '+esc(o.lead_time_days)+' day lead time</span><a class="auth-text-button" href="app.html?sourced='+encodeURIComponent(o.id)+'">Open sourced offer →</a>':'<span>Researching supply options. Estimates are not a confirmed offer.</span>'}</div>`;
  async function action(button,fn,refresh){
    const label=button.textContent;button.disabled=true;button.textContent='Saving…';
    const card=button.closest('article')||button.parentElement;
    let status=card.querySelector('.sourcing-action-status');
    if(!status){status=document.createElement('p');status.className='status sourcing-action-status';status.setAttribute('role','status');card.append(status)}
    try{await fn();await refresh()}catch(e){status.textContent=e.message;status.className='status bad sourcing-action-status';button.disabled=false;button.textContent=label}
  }
  function bindDemand(root,refresh){
    root.querySelectorAll('[data-interest-request]').forEach(b=>b.onclick=()=>action(b,()=>IZZY.rpc('sourcing_interest',{_request_id:b.dataset.interestRequest}),refresh));
    root.querySelectorAll('[data-interest-offer]').forEach(b=>b.onclick=()=>action(b,()=>IZZY.rpc('sourcing_interest',{_response_id:b.dataset.interestOffer}),refresh));
    root.querySelectorAll('.sourcing-comment-form').forEach(f=>f.onsubmit=e=>{e.preventDefault();return action(f.querySelector('button'),()=>IZZY.rpc('sourcing_comment',{_request_id:f.dataset.requestId,_body:f.elements.body.value.trim(),_comment_id:f.dataset.commentId||null}),refresh)});
    root.querySelectorAll('[data-close-request]').forEach(b=>b.onclick=()=>{if(confirm('Close this request? Existing sourced offers remain visible; new comments and demand will stop.'))return action(b,()=>IZZY.rpc('sourcing_close_request',{_request_id:b.dataset.closeRequest}),refresh)});
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
        <div class="sourcing-post-actions"><button class="btn secondary" data-interest-request="${r.id}" ${r.interested||closed?'disabled':''}>${r.interested?'Interested ✓':"I'm interested"}</button>
        ${r.is_mine&&!closed?'<button class="auth-text-button" data-close-request="'+r.id+'">Close request</button>':''}</div>
        <div class="sourcing-progress-list">${responses.filter(o=>o.request_id===r.id).map(o=>offerPreview(o,r)).join('')||'<p class="muted">Suppliers can start sourcing this product independently.</p>'}</div>
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
      sourced.innerHTML=responses.filter(o=>o.status==='sourced').map(o=>{
        const r=requests.find(r=>r.id===o.request_id)||{};
        const closed=['closed','archived'].includes(r.status);
        return `<article class="card order-card sourcing-post" id="sourced-${o.id}">
          <div class="order-card-head"><div><h3>${esc(r.title||'Sourced product')}</h3><small>${esc(o.supplier_name||'IzzyDrop Supplier')}</small></div>${tag('sourced')}</div>
          ${image(o.image_url)}<div class="notice">Found by a supplier. ${o.catalog_slug?'Published in Products and kept here with its sourcing history.':'Legacy sourced offer: no catalog product is linked yet.'} Showing interest records demand only; adding it to My Products is still your choice.</div>
          ${offerDetails(o,r)}
          <div class="sourcing-post-actions"><button class="btn" data-interest-offer="${o.id}" ${o.interested||closed?'disabled':''}>${o.interested?'Requested ✓':closed?'Request closed':'Request this product'}</button>
          ${o.catalog_slug?'<a class="btn secondary" href="product.html?slug='+encodeURIComponent(o.catalog_slug)+'&from=app">View published product</a>':''}</div>
        </article>`;
      }).join('')||empty('No sourced products yet');
      bindDemand(sourced,refresh);
    }
  }
  const input=(name,label,value,type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value??'')}" ${extra}></label>`;
  function renderSupplier(board,products,refresh){
    const root=document.querySelector('#supplier-requests');if(!root)return;
    root.innerHTML=(board?.requests||[]).filter(r=>!['closed','archived'].includes(r.status)||(board.responses||[]).some(o=>o.request_id===r.id&&o.is_mine)).map(r=>{
      const o=(board.responses||[]).find(o=>o.request_id===r.id&&o.is_mine),closed=['closed','archived'].includes(r.status);
      return `<article class="card order-card sourcing-post"><div class="order-card-head"><h3>${esc(r.title)}</h3>${tag(r.status)}</div>
        ${image(r.image_url)}${details(r)}
        <details class="sourcing-discussion"><summary>Community discussion</summary>${(board.comments||[]).filter(c=>c.request_id===r.id).map(c=>'<div class="sourcing-comment"><p>'+esc(c.body)+'</p></div>').join('')||'<p class="muted">No comments yet.</p>'}</details>
        <div class="sourcing-progress-list">${(board.responses||[]).filter(x=>x.request_id===r.id&&!x.is_mine).map(x=>'<div class="sourcing-progress"><b>'+esc(x.supplier_name)+'</b> '+tag(x.status)+'</div>').join('')}</div>
        ${!o?(closed?'':`<button class="btn" data-start-sourcing="${r.id}">Start sourcing</button><p class="muted">Find this product from a manufacturer, distributor or another source. No catalog match required.</p>`):
          `<div class="notice"><b>Your sourcing response: ${esc(state(o.status))}</b><span>${Number(o.interest_count||0)} dropshippers requested this offer.</span></div>
          ${closed?offerDetails(o,r):`<details ${o.status==='sourcing'?'open':''}><summary>${o.status==='sourced'?'Review / update sourcing information':'Research and commercial information'}</summary>
          <form class="form sourcing-response-form" data-response-id="${o.id}" data-sourced="${o.status==='sourced'}">
            ${input('supplier_price','Supplier / source price (EGP)',o.supplier_price,'number','min="0" step="0.01" data-final')}
            ${input('recommended_retail','Recommended retail (EGP) — guidance only',o.recommended_retail,'number','min="0" step="0.01" data-final')}
            <p class="notice span-2 sourcing-margin-preview">Estimated margin: ${money(o.estimated_margin)} · before shipping, fees and other costs.</p>
            ${input('available_quantity','Available quantity (optional)',o.available_quantity,'number','min="0" step="1"')}
            ${input('moq','MOQ (optional)',o.moq,'number','min="1" step="1"')}
            ${input('lead_time_days','Lead time (days)',o.lead_time_days,'number','min="0" step="1" data-final')}
            ${input('origin_country','Source country / origin (optional)',o.origin_country,'text','maxlength="120"')}
            ${input('image_url','Product image URL',o.image_url,'url','data-final')}
            <label>Or upload a product image<input name="image_file" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG or WebP · max 5 MB</small></label>
            <label class="span-2">Supplier notes<textarea name="supplier_notes" maxlength="5000" data-final>${esc(o.supplier_notes||'')}</textarea></label>
            <label class="span-2">Additional sourcing information (optional)<textarea name="sourcing_details" maxlength="5000">${esc(o.sourcing_details||'')}</textarea></label>
            <p class="muted span-2">Save estimates while researching. Mark Sourced only when you can supply this item. Marking Sourced publishes it to Products automatically with a default variant using the sourced price, recommended retail and available quantity. It does not create an order or add it to anyone's My Products.</p>
            <button class="btn secondary" name="save" type="submit">Save ${o.status==='sourced'?'information':'estimates'}</button>
            ${o.status==='sourcing'?'<button class="btn" name="complete" type="submit">Mark Sourced</button>':''}
          </form></details>`}
          ${o.status==='sourced'?`<div class="notice ${o.catalog_slug?'ok':''}">${o.catalog_slug?'Published in Products automatically. The sourcing history stays here, and dropshippers still choose whether to add it to My Products.':'This legacy sourced offer was created before automatic catalog publishing.'}</div>`:''}`}
        </article>`;
    }).join('')||empty('No sourcing opportunities yet');
    root.querySelectorAll('[data-start-sourcing]').forEach(b=>b.onclick=()=>action(b,()=>IZZY.rpc('sourcing_start',{_request_id:b.dataset.startSourcing}),refresh));
    root.querySelectorAll('.sourcing-response-form').forEach(f=>{
      const margin=()=>{const cost=f.elements.supplier_price.value,retail=f.elements.recommended_retail.value;f.querySelector('.sourcing-margin-preview').textContent='Estimated margin: '+(cost===''||retail===''?'Not specified':money(Number(retail)-Number(cost)))+' · before shipping, fees and other costs.'};
      f.elements.supplier_price.oninput=margin;f.elements.recommended_retail.oninput=margin;
      f.querySelectorAll('button[type="submit"]').forEach(b=>b.onclick=()=>{const final=b.name==='complete'||f.dataset.sourced==='true';f.querySelectorAll('[data-final]').forEach(i=>i.required=final&&!(i.name==='image_url'&&f.elements.image_file.files.length))});
      f.onsubmit=e=>{
        e.preventDefault();const b=e.submitter||f.querySelector('button'),complete=b.name==='complete';
        const final=complete||f.dataset.sourced==='true';
        return action(b,async()=>{
          const data={};['supplier_price','recommended_retail','available_quantity','moq','lead_time_days','origin_country','image_url','supplier_notes','sourcing_details'].forEach(n=>data[n]=f.elements[n].value.trim()||null);
          const file=f.elements.image_file.files?.[0];
          if(file){if(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Use a JPG, PNG or WebP image, max 5 MB.');
            const uid=IZZY.session()?.user?.id;if(!uid)throw Error('Please log in.');
            const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
            data.image_url=await IZZY.uploadProductImage(uid+'/sourcing-'+crypto.randomUUID()+'.'+ext,file);
          }
          if(final&&['supplier_price','recommended_retail','lead_time_days','image_url','supplier_notes'].some(n=>data[n]==null))throw Error('Enter final prices, lead time, product image and supplier notes before marking Sourced.');
          await IZZY.rpc('sourcing_save_response',{_response_id:f.dataset.responseId,_data:data,_mark_sourced:complete});
        },refresh);
      };
    });
  }
  window.IZZY_SOURCING={renderDropshipper,renderSupplier};
})();
