(async()=>{
  const slug=new URLSearchParams(location.search).get('slug');
  const from=new URLSearchParams(location.search).get('from');
  const box=document.getElementById('product'),st=document.getElementById('status');
  if(!slug){st.textContent='Product link is missing.';st.className='status bad';return}

  try{
    const p=await IZZY.rpc('public_product',{_slug:slug},false);
    if(!p){st.textContent='This product is not available.';st.className='status bad';return}
    const displayName=window.IZZY_I18N?.productName(p)||p.name||'';
    const displayDescription=window.IZZY_I18N?.productDescription(p)||p.description||'';
    const isAr=window.IZZY_I18N?.isArabic?.()===true;
    const variantLabel=v=>{
      const entries=Object.entries(v?.options||{}).filter(([,value])=>String(value??'').trim());
      return entries.length?entries.map(([name,value])=>`${name}: ${value}`).join(' · '):(v?.name||v?.sku||'Default');
    };
    document.title=`${displayName} · IzzyDrop`;
    st.textContent='';

    const images=(p.images||[]).filter(x=>x?.url);
    const totalStock=(p.variants||[]).reduce((n,v)=>n+Number(v.stock_quantity||0),0);
    const session=IZZY.session();
    let isDropshipper=false,alreadyLinked=false;
    if(session?.user?.id){
      try{
        const d=await IZZY.request(`/rest/v1/dropshippers?select=id&profile_id=eq.${encodeURIComponent(session.user.id)}&limit=1`);
        isDropshipper=!!d?.length;
        if(isDropshipper){
          const l=await IZZY.request(`/rest/v1/dropshipper_product_links?select=id&supplier_product_id=eq.${encodeURIComponent(p.product_id)}&limit=1`);
          alreadyLinked=!!l?.length;
        }
      }catch{}
    }

    const main=images[0]?.url;
    box.innerHTML=`
      ${from==='app'?`<a class="product-back" href="app.html">${isAr?'العودة إلى المنتجات →':'← Back to products'}</a>`:''}
      <div class="product-detail product-detail-polished">
        <div class="product-gallery-wrap">
          <div class="gallery product-main-gallery" id="main-gallery">
            ${main?`<img id="main-product-image" src="${IZZY.esc(main)}" alt="${IZZY.esc(displayName)}">`:'<div class="brand" style="font-size:56px;color:#9ba3ad">IZ</div>'}
          </div>
          ${images.length>1?`<div class="product-thumbnails">${images.map((img,i)=>`<button class="product-thumb ${i===0?'on':''}" data-image="${IZZY.esc(img.url)}"><img src="${IZZY.esc(img.url)}" alt=""></button>`).join('')}</div>`:''}
        </div>
        <section class="detail product-detail-copy">
          <div class="product-detail-badges"><span class="tag ok">IzzyDrop Verified Supplier</span><span class="tag ${totalStock>0?'ok':'warn'}">${totalStock>0?`${totalStock} in stock`:'Out of stock'}</span></div>
          <h1>${IZZY.esc(displayName)}</h1>
          <p class="product-supplier-name">Sold by <b>${IZZY.esc(p.supplier||'IzzyDrop supplier')}</b></p>
          <div class="price product-detail-price">${IZZY.money(p.suggested_retail_price,p.currency)}</div>
          <small class="muted">Suggested selling price</small>
          <p class="muted product-detail-description">${IZZY.esc(displayDescription||(isAr?'لا يوجد وصف للمنتج بعد.':'No product description has been added yet.'))}</p>

          <div class="product-facts">
            <div><small>SKU</small><b>${IZZY.esc(p.sku||'—')}</b></div>
            <div><small>Category</small><b>${IZZY.esc(p.category||'Uncategorized')}</b></div>
            <div><small>Available stock</small><b>${totalStock}</b></div>
          </div>

          <div class="variant-section">
            <h3>Variants</h3>
            <div class="variant-list">${(p.variants||[]).map(v=>`<div class="variant"><div><b>${IZZY.esc(variantLabel(v))}</b><small>${IZZY.esc(v.sku||'')}</small></div><span class="tag ${Number(v.stock_quantity)>0?'ok':'warn'}">${Number(v.stock_quantity||0)} in stock</span></div>`).join('')||'<div class="notice">No variants listed.</div>'}</div>
          </div>

          <div class="product-detail-actions">
            ${isDropshipper?`<button id="use-product" class="btn" ${totalStock<=0?'disabled':''}>Add to your web</button>`:'<a class="btn" href="login.html?type=dropshipper">Log in to add to your web</a>'}
          </div>
          <div id="product-action-status" class="status"></div>
        </section>
      </div>`;

    document.querySelectorAll('.product-thumb').forEach(btn=>btn.onclick=()=>{
      const img=document.getElementById('main-product-image');
      if(img)img.src=btn.dataset.image;
      document.querySelectorAll('.product-thumb').forEach(x=>x.classList.toggle('on',x===btn));
    });

    const use=document.getElementById('use-product');
    if(use)use.onclick=()=>{
      location.href='app.html?add='+encodeURIComponent(p.product_id);
    };
  }catch(e){st.textContent=e.message;st.className='status bad'}
})();