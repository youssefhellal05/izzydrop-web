(async()=>{
  const slug=new URLSearchParams(location.search).get('slug');
  const from=new URLSearchParams(location.search).get('from');
  const box=document.getElementById('product'),st=document.getElementById('status');
  if(!slug){st.textContent='Product link is missing.';st.className='status bad';return}

  async function loadAdminProduct(){
    const session=IZZY.session();
    if(!session?.user?.id)throw Error('Admin access required.');
    const roles=await IZZY.request(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(session.user.id)}`);
    if(!roles.some(r=>r.role==='admin'))throw Error('Admin access required.');

    const rows=await IZZY.request(`/rest/v1/supplier_products?select=*&public_slug=eq.${encodeURIComponent(slug)}&limit=1`);
    const product=rows?.[0];
    if(!product)return null;

    const [suppliers,categories,variants,images]=await Promise.all([
      IZZY.request(`/rest/v1/suppliers?select=id,business_name,status&id=eq.${encodeURIComponent(product.supplier_id)}&limit=1`),
      product.category_id?IZZY.request(`/rest/v1/categories?select=id,name,name_ar&id=eq.${encodeURIComponent(product.category_id)}&limit=1`):Promise.resolve([]),
      IZZY.request(`/rest/v1/product_variants?select=*&product_id=eq.${encodeURIComponent(product.id)}&order=created_at.asc`),
      IZZY.request(`/rest/v1/product_images?select=*&product_id=eq.${encodeURIComponent(product.id)}&order=position.asc`)
    ]);
    const supplier=suppliers?.[0]||{},category=categories?.[0]||{};
    return {
      product_id:product.id,
      name:product.name,name_en:product.name_en,name_ar:product.name_ar,
      description:product.description,description_en:product.description_en,description_ar:product.description_ar,
      sku:product.sku,currency:product.currency,
      suggested_retail_price:product.suggested_retail_price,
      supplier:supplier.business_name,
      supplier_status:supplier.status,
      product_status:product.status,
      category:category.name,category_ar:category.name_ar,
      images:images||[],
      variants:(variants||[]).map(v=>({
        id:v.id,sku:v.sku,name:v.variant_name||v.name,
        options:v.option_values||{},
        image_url:v.variant_image_url||null,
        stock_quantity:v.stock_quantity,
        is_enabled:v.is_enabled
      }))
    };
  }

  try{
    const adminView=from==='admin';
    const p=adminView?await loadAdminProduct():await IZZY.rpc('public_product',{_slug:slug},false);
    if(!p){st.textContent=adminView?'Product not found.':'This product is not available.';st.className='status bad';return}
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
    if(!adminView&&session?.user?.id){
      try{
        const d=await IZZY.request(`/rest/v1/dropshippers?select=id&profile_id=eq.${encodeURIComponent(session.user.id)}&limit=1`);
        isDropshipper=!!d?.length;
        if(isDropshipper){
          const l=await IZZY.request(`/rest/v1/dropshipper_product_links?select=id&supplier_product_id=eq.${encodeURIComponent(p.product_id)}&limit=1`);
          alreadyLinked=!!l?.length;
        }
      }catch{}
    }

    const main=images[0]?.url||(p.variants||[]).find(v=>v.image_url)?.image_url||null;
    const categoryLabel=isAr?(p.category_ar||p.category||'غير مصنف'):(p.category||p.category_ar||'Uncategorized');
    const variantHtml=(p.variants||[]).map(v=>`<button type="button" class="variant product-variant-choice" data-variant-image="${IZZY.esc(v.image_url||main||'')}"><div><b>${IZZY.esc(variantLabel(v))}</b><small>${IZZY.esc(v.sku||'')}</small></div><span class="tag ${Number(v.stock_quantity)>0?'ok':'warn'}">${Number(v.stock_quantity||0)} ${isAr?'متوفر':'in stock'}</span></button>`).join('') || `<div class="notice">${isAr?'لا توجد خيارات متاحة.':'No variants listed.'}</div>`;
    box.innerHTML=`
      ${from==='app'?`<a class="product-back" href="app.html">${isAr?'العودة إلى المنتجات →':'← Back to products'}</a>`:from==='admin'?'<a class="product-back" href="admin.html">← Back to Admin</a>':''}
      <div class="product-detail product-detail-polished">
        <div class="product-gallery-wrap">
          <div class="gallery product-main-gallery" id="main-gallery">
            ${main?`<img id="main-product-image" src="${IZZY.esc(main)}" alt="${IZZY.esc(displayName)}">`:'<div class="brand" style="font-size:56px;color:#9ba3ad">IZ</div>'}
          </div>
          ${images.length>1?`<div class="product-thumbnails">${images.map((img,i)=>`<button class="product-thumb ${i===0?'on':''}" data-image="${IZZY.esc(img.url)}"><img src="${IZZY.esc(img.url)}" alt=""></button>`).join('')}</div>`:''}
        </div>
        <section class="detail product-detail-copy">
          <div class="product-detail-badges">${adminView?`<span class="tag">Admin inspection</span><span class="tag ${p.product_status==='active'?'ok':'warn'}">${IZZY.esc(p.product_status||'')}</span>`:'<span class="tag ok">IzzyDrop Verified Supplier</span>'}<span class="tag ${totalStock>0?'ok':'warn'}">${totalStock>0?`${totalStock} in stock`:'Out of stock'}</span></div>
          <h1>${IZZY.esc(displayName)}</h1>
          <p class="product-supplier-name">Sold by <b>${IZZY.esc(p.supplier||'IzzyDrop supplier')}</b></p>
          <div class="price product-detail-price">${IZZY.money(p.suggested_retail_price,p.currency)}</div>
          <small class="muted">Suggested selling price</small>
          <p class="muted product-detail-description">${IZZY.esc(displayDescription||(isAr?'لا يوجد وصف للمنتج بعد.':'No product description has been added yet.'))}</p>

          <div class="product-facts">
            <div><small>SKU</small><b>${IZZY.esc(p.sku||'—')}</b></div>
            <div><small>${isAr?'الفئة':'Category'}</small><b>${IZZY.esc(categoryLabel)}</b></div>
            <div><small>Available stock</small><b>${totalStock}</b></div>
          </div>

          <div class="variant-section">
            <h3>${isAr?'الخيارات':'Variants'}</h3>
            <div class="variant-list">${variantHtml}</div>
          </div>

          <div class="product-detail-actions">
            ${adminView?'<a class="btn" href="admin.html">Back to Admin</a>':isDropshipper?`<button id="use-product" class="btn" ${totalStock<=0?'disabled':''}>${alreadyLinked?(isAr?'عرض في منتجاتي':'View in My Products'):(isAr?'أضف إلى منتجاتي':'Add to My Products')}</button><button id="request-sample" class="btn secondary" ${totalStock<=0?'disabled':''}>${isAr?'طلب عينة':'Request sample'}</button>`:`<a class="btn" href="login.html?type=dropshipper">${isAr?'سجّل الدخول لإضافته إلى منتجاتك':'Log in to add to My Products'}</a>`}
          </div>
          <div id="product-action-status" class="status"></div>
        </section>
      </div>`;

    const setMainImage=url=>{
      const img=document.getElementById('main-product-image');
      if(img&&url)img.src=url;
      document.querySelectorAll('.product-thumb').forEach(x=>x.classList.toggle('on',x.dataset.image===url));
    };
    document.querySelectorAll('.product-thumb').forEach(btn=>btn.onclick=()=>setMainImage(btn.dataset.image));
    document.querySelectorAll('.product-variant-choice').forEach(btn=>btn.onclick=()=>{
      setMainImage(btn.dataset.variantImage);
      document.querySelectorAll('.product-variant-choice').forEach(x=>x.classList.toggle('on',x===btn));
    });

    const use=document.getElementById('use-product');
    if(use)use.onclick=()=>{
      location.href='app.html?add='+encodeURIComponent(p.product_id);
    };
    const sample=document.getElementById('request-sample');
    if(sample)sample.onclick=()=>{
      location.href='app.html?sample='+encodeURIComponent(p.product_id);
    };
  }catch(e){st.textContent=e.message;st.className='status bad'}
})();