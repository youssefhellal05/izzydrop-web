(()=> {
  'use strict';
  const main=document.getElementById('store-public-main');
  const config=window.IZZY_CONFIG||{};
  const base=String(config.supabaseUrl||'').replace(/\/+$/,'');
  const endpoint=base+'/functions/v1/public-storefront';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeImageUrl=value=>{
    try{const url=new URL(String(value||''));return url.protocol==='https:'&&!url.username&&!url.password&&url.href.length<=2048?url.href:null}catch{return null}
  };
  const money=(value,currency='EGP')=>{try{return new Intl.NumberFormat('en-EG',{style:'currency',currency:currency||'EGP'}).format(Number(value||0))}catch{return String(Number(value||0))+' '+(currency||'EGP')}};
  const status=(title,description)=>{
    document.title='Store unavailable — IzzyDrop';
    main.innerHTML=`<div class="store-public-status"><div class="store-public-placeholder">IZ</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>`;
  };
  const variantLabel=variant=>{
    const values=Object.entries(variant?.options||{}).filter(([,value])=>String(value??'').trim());
    return values.length?values.map(([key,value])=>key+': '+value).join(' · '):(variant?.label||'Standard');
  };
  const productCard=(product,index)=>{
    const images=(Array.isArray(product.images)?product.images:[]).map(safeImageUrl).filter(Boolean);
    const variants=Array.isArray(product.variants)?product.variants:[];
    const firstAvailable=variants.find(variant=>Number(variant.stock_quantity)>0)||variants[0]||null;
    const imageUrl=safeImageUrl(firstAvailable?.image_url)||images[0]||null;
    const price=firstAvailable?Number(firstAvailable.retail_price||0):Number(product.price_min||0);
    const stock=firstAvailable?Number(firstAvailable.stock_quantity||0):0;
    const img=imageUrl?`<img class="store-public-product-image" src="${esc(imageUrl)}" alt="${esc(product.title||'Product')}" loading="lazy" referrerpolicy="no-referrer">`:'<span>IZ</span>';
    const options=variants.map((variant,variantIndex)=>{
      const price=Number(variant.retail_price||0),stock=Number(variant.stock_quantity||0);
      return `<option value="${variantIndex}" data-price="${price}" data-stock="${stock}" data-image="${esc(safeImageUrl(variant.image_url)||images[0]||'')}" ${stock<=0?'disabled':''} ${variant===firstAvailable?'selected':''}>${esc(variantLabel(variant))} · ${esc(money(price,product.currency))} · ${stock>0?stock+' in stock':'Out of stock'}</option>`;
    }).join('');
    const minPrice=variants.length?Math.min(...variants.map(variant=>Number(variant.retail_price||0))):price;
    const maxPrice=variants.length?Math.max(...variants.map(variant=>Number(variant.retail_price||0))):price;
    const priceText=variants.length>1&&minPrice!==maxPrice?'From '+money(minPrice,product.currency):money(price,product.currency);
    const card=`<article class="store-public-card" data-public-product="${index}">
      <div class="store-public-image">${img}</div>
      <div class="store-public-card-body">
        <h2>${esc(product.title||'Product')}</h2>
        ${product.description?`<p class="store-public-description">${esc(product.description)}</p>`:''}
        ${variants.length? `<div class="store-public-variant-wrap"><label for="store-variant-${index}">Choose a variant</label><select class="store-public-variant-select" id="store-variant-${index}">${options}</select></div>`:'<p class="store-public-description">This product is currently unavailable.</p>'}
        <div class="store-public-price-stock"><strong class="store-public-price">${esc(priceText)}</strong><span class="store-public-stock ${stock<=0?'out':''}">${stock>0?stock+' in stock':'Out of stock'}</span></div>
      </div>
    </article>`;
    return card;
  };
  async function load(){
    const params=new URLSearchParams(location.search);
    const slug=String(params.get('slug')||'').trim().toLowerCase();
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length<3||slug.length>48){
      status('Store link not found','Check the link or return to the IzzyDrop marketplace.');
      return;
    }
    if(!base){status('Store is unavailable','The storefront service is not configured.');return}
    try{
      const response=await fetch(endpoint+'?slug='+encodeURIComponent(slug),{method:'GET',headers:{Accept:'application/json'},cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.error||'This store is not available yet.');
      const storeName=String(data.store_name||'IzzyDrop Store');
      const description=String(data.description||'Browse products selected for this store.');
      const products=Array.isArray(data.products)?data.products:[];
      document.title=storeName+' — IzzyDrop';
      main.innerHTML=`<section class="store-public-hero"><div class="eyebrow">Independent store · Powered by IzzyDrop</div><h1>${esc(storeName)}</h1><p>${esc(description)}</p><div class="store-public-meta"><span>${products.length} ${products.length===1?'product':'products'}</span><span>Products and stock update from IzzyDrop</span></div></section>
        <div class="store-public-phase-note">Browsing only for now. Secure online checkout and customer orders are planned for Phase 2.</div>
        <section class="store-public-grid" aria-label="Store products">${products.length?products.map(productCard).join(''):'<div class="store-public-empty"><h2>This store is getting ready</h2><p>There are no available products to show at the moment. Please check back later.</p></div>'}</section>`;
      main.querySelectorAll('.store-public-variant-select').forEach(select=>{
        select.addEventListener('change',()=>{
          const card=select.closest('[data-public-product]');
          const product=products[Number(card?.dataset.publicProduct)];
          const variant=product?.variants?.[Number(select.value)];
          if(!variant)return;
          const priceEl=card.querySelector('.store-public-price');
          const stockEl=card.querySelector('.store-public-stock');
          const imageEl=card.querySelector('.store-public-product-image');
          if(priceEl)priceEl.textContent=money(variant.retail_price,product.currency);
          if(stockEl){
            const stock=Number(variant.stock_quantity||0);
            stockEl.textContent=stock>0?stock+' in stock':'Out of stock';
            stockEl.classList.toggle('out',stock<=0);
          }
          if(imageEl){
            const image=safeImageUrl(variant.image_url)||safeImageUrl(product.images?.[0]);
            if(image)imageEl.src=image;
          }
        });
      });
      main.querySelectorAll('.store-public-variant-select').forEach(select=>{
        const selected=select.selectedOptions?.[0];
        if(selected&&!selected.disabled)select.dispatchEvent(new Event('change',{bubbles:false}));
      });
    }catch(error){
      status('Store unavailable',String(error?.message||'This store is not available yet.'));
    }
  }
  load();
})();