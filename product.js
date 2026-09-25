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
        suggested_retail_price:v.suggested_retail_price,
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

    const shipping=await IZZY.rpc('marketplace_shipping_quote',{},false).catch(()=>({service_area:'Cairo',available:false,delivery_fee:null,currency:'EGP'}));
    if(isDropshipper){
      try{
        const marketplaceVariants=await IZZY.rpc('marketplace_variants_v3',{_product_id:p.product_id});
        const byId=new Map((marketplaceVariants||[]).map(v=>[String(v.id),v]));
        p.variants=(p.variants||[]).map(v=>{
          const live=byId.get(String(v.id));
          return live?{...v,supplier_cost:live.supplier_cost,suggested_retail_price:live.suggested_retail_price,stock_quantity:live.stock_quantity}:v;
        });
      }catch{}
    }

    const main=images[0]?.url||(p.variants||[]).find(v=>v.image_url)?.image_url||null;
    const categoryLabel=isAr?(p.category_ar||p.category||'غير مصنف'):(p.category||p.category_ar||'Uncategorized');
    const delivery=Number(shipping?.delivery_fee);
    const shippingReady=shipping?.available===true&&Number.isFinite(delivery);
    const variantPrices=(p.variants||[]).map(v=>Number(v.suggested_retail_price)).filter(Number.isFinite);
    const uniqueVariantPrices=[...new Set(variantPrices)];
    const startingRetail=variantPrices.length?Math.min(...variantPrices):Number(p.suggested_retail_price||0);
    const pricePrefix=uniqueVariantPrices.length>1?(isAr?'ابتداءً من ':'From '):'';
    const singleVariant=(p.variants||[]).length===1?(p.variants||[])[0]:null;
    const singleSupplier=singleVariant?.supplier_cost==null?null:Number(singleVariant.supplier_cost);
    const singleRetail=singleVariant?.suggested_retail_price==null?null:Number(singleVariant.suggested_retail_price);
    const singleMargin=singleSupplier!=null&&Number.isFinite(singleRetail)?singleRetail-singleSupplier:null;
    const initialCustomerTotal=shippingReady?startingRetail+delivery:null;
    const variantHtml=(p.variants||[]).map(v=>{
      const vp=Number(v.suggested_retail_price);
      const sp=v.supplier_cost==null?null:Number(v.supplier_cost);
      const priceText=Number.isFinite(vp)?` · ${isAr?'بيع مقترح':'Suggested'} ${IZZY.money(vp,p.currency)}`:'';
      return `<button type="button" class="variant product-variant-choice" data-variant-image="${IZZY.esc(v.image_url||main||'')}" data-variant-price="${Number.isFinite(vp)?vp:''}" data-variant-supplier="${Number.isFinite(sp)?sp:''}"><div><b>${IZZY.esc(variantLabel(v))}</b><small>${IZZY.esc(v.sku||'')}${priceText}</small></div><span class="tag ${Number(v.stock_quantity)>0?'ok':'warn'}">${Number(v.stock_quantity||0)} ${isAr?'متوفر':'in stock'}</span></button>`;
    }).join('') || `<div class="notice">${isAr?'لا توجد خيارات متاحة.':'No variants listed.'}</div>`;
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
          <div id="product-detail-price" class="price product-detail-price">${pricePrefix}${IZZY.money(startingRetail,p.currency)}</div>
          <small class="muted">${isAr?'سعر البيع المقترح':'Suggested selling price'}</small>
          <div class="simple-product-prices product-detail-pricing">
            ${isDropshipper?`<div><small>${isAr?'سعر المورّد':'Supplier price'}</small><b id="product-supplier-price">${singleSupplier!=null?IZZY.money(singleSupplier,p.currency):(isAr?'اختر خيارًا':'Select a variant')}</b></div>`:''}
            <div><small>${isAr?'سعر البيع المقترح':'Suggested sell'}</small><b id="product-suggested-price">${pricePrefix}${IZZY.money(startingRetail,p.currency)}</b></div>
            ${isDropshipper?`<div><small>${isAr?'هامش المنتج':'Product margin'}</small><b id="product-margin" class="${singleMargin==null?'':singleMargin>=0?'positive':'negative'}">${singleMargin==null?(isAr?'اختر خيارًا':'Select a variant'):IZZY.money(singleMargin,p.currency)}</b><span class="price-note">${isAr?'قبل رسوم IzzyDrop':'before IzzyDrop fee'}</span></div>`:''}
            <div><small>${isAr?'توصيل القاهرة':'Cairo delivery'}</small><b id="product-delivery-price">${shippingReady?IZZY.money(delivery,shipping.currency||p.currency):(isAr?'قيد الإعداد':'Setup pending')}</b><span class="price-note">${isAr?'يدفعه العميل بشكل منفصل':'paid separately by customer'}</span></div>
            <div><small>${isAr?'إجمالي العميل':'Customer total'}</small><b id="product-customer-total">${initialCustomerTotal==null?'—':pricePrefix+IZZY.money(initialCustomerTotal,p.currency)}</b><span class="price-note">${isAr?'المنتج + التوصيل':'product + delivery'}</span></div>
          </div>
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
      const price=Number(btn.dataset.variantPrice);
      const supplier=Number(btn.dataset.variantSupplier);
      const priceEl=document.getElementById('product-detail-price');
      const suggestedEl=document.getElementById('product-suggested-price');
      const supplierEl=document.getElementById('product-supplier-price');
      const marginEl=document.getElementById('product-margin');
      const totalEl=document.getElementById('product-customer-total');
      if(priceEl&&Number.isFinite(price))priceEl.textContent=IZZY.money(price,p.currency);
      if(suggestedEl&&Number.isFinite(price))suggestedEl.textContent=IZZY.money(price,p.currency);
      if(supplierEl&&Number.isFinite(supplier))supplierEl.textContent=IZZY.money(supplier,p.currency);
      if(marginEl&&Number.isFinite(price)&&Number.isFinite(supplier)){
        const margin=price-supplier;
        marginEl.textContent=IZZY.money(margin,p.currency);
        marginEl.className=margin>=0?'positive':'negative';
      }
      if(totalEl)totalEl.textContent=shippingReady&&Number.isFinite(price)?IZZY.money(price+delivery,p.currency):'—';
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