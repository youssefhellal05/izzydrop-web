(()=> {
  'use strict';
  const $=selector=>document.querySelector(selector);
  const state={loaded:false,busy:false,dropshipper:null,store:null,links:[],products:[],variantsByProduct:{},imagesByProduct:{},variantConfig:[],variantErrors:[]};
  const root=()=>$('#view-store');
  const status=(message,bad=false)=>{
    const el=$('#store-manager-status');
    if(!el)return;
    el.textContent=message||'';
    el.className='status'+(bad?' bad':'');
  };
  const esc=value=>window.IZZY?.esc?IZZY.esc(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeImageUrl=value=>{
    try{
      const url=new URL(String(value||'').trim());
      if(url.protocol!=='https:'||url.username||url.password||url.href.length>2048)return null;
      return url.href;
    }catch{return null}
  };
  const unique=values=>[...new Set((values||[]).map(safeImageUrl).filter(Boolean))];
  const slugify=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40).replace(/-+$/g,'');
  const defaultSlug=()=>{
    const name=state.dropshipper?.business_name||state.products[0]?.name||'my-store';
    const base=slugify(name)||'my-store';
    return (base.slice(0,40).replace(/-+$/g,'')+'-'+String(state.dropshipper?.id||'').replace(/-/g,'').slice(0,6)).slice(0,48).replace(/-+$/g,'');
  };
  const linkForProduct=product=>state.links.find(link=>String(link.id)===String(product.link_id)||String(link.supplier_product_id)===String(product.product_id));
  const variantsFor=product=>state.variantsByProduct[String(product.product_id)]||[];
  const sourceImagesFor=product=>{
    const fromProducts=state.imagesByProduct[String(product.product_id)]||[];
    const fromVariants=variantsFor(product).map(variant=>variant.image_url);
    return unique([...fromProducts.map(image=>image.url),...fromVariants]);
  };
  const variantPrice=(product,link,variant)=>{
    if(link?.pricing_mode==='custom'&&link.retail_price!=null&&Number.isFinite(Number(link.retail_price)))return Number(link.retail_price);
    if(variant.suggested_retail_price!=null&&Number.isFinite(Number(variant.suggested_retail_price)))return Number(variant.suggested_retail_price);
    if(product.suggested_retail_price!=null&&Number.isFinite(Number(product.suggested_retail_price)))return Number(product.suggested_retail_price);
    return 0;
  };
  const formatMoney=(value,currency='EGP')=>window.IZZY?.money?IZZY.money(value,currency):String(value);
  const variantLabel=variant=>{
    const values=Object.entries(variant?.option_values||{}).filter(([,value])=>String(value??'').trim());
    return values.length?values.map(([key,value])=>key+': '+value).join(' · '):(variant?.variant_name||variant?.name||'Standard');
  };
  const publicStoreUrl=slug=>{
    const url=new URL('store.html',location.href);
    url.searchParams.set('slug',slug);
    return url.href;
  };
  const queryIn=ids=>'in.('+ids.join(',')+')';

  function renderProfile(){
    const form=$('#store-profile-form');
    if(!form)return;
    const store=state.store;
    $('#store-name').value=store?.store_name||(state.dropshipper?.business_name||'My Store');
    $('#store-slug').value=store?.slug||defaultSlug();
    $('#store-description').value=store?.description||'';
    $('#store-published').checked=Boolean(store?.is_published);
    const badge=$('#store-publish-state');
    badge.textContent=!store?'Not saved':store.is_published?'Published':'Draft';
    badge.className='tag store-publish-state '+(!store?'':store.is_published?'ok':'warn');
    const wrap=$('#store-public-link-wrap');
    wrap.hidden=!store;
    const url=store?publicStoreUrl(store.slug):'';
    $('#store-public-link').value=url;
    $('#store-open-link').href=url||'#';
    $('#store-open-link').hidden=!store?.is_published;
    $('#store-copy-link').disabled=!store;
    if(store&&!store.is_published){
      const existing=wrap.querySelector('.store-draft-note');
      if(!existing){
        const note=document.createElement('small');
        note.className='muted store-draft-note';
        note.textContent='This link will become public after you publish your store.';
        wrap.appendChild(note);
      }
    }else{
      wrap.querySelector('.store-draft-note')?.remove();
    }
  }

  function renderImageChoice(url,selected,index){
    const safe=safeImageUrl(url);
    if(!safe)return '';
    return `<label class="store-image-choice">
      <input class="store-image-check" type="checkbox" value="${esc(safe)}" ${selected?'checked':''} aria-label="Include storefront image ${index+1}">
      <img src="${esc(safe)}" alt="" loading="lazy" referrerpolicy="no-referrer">
      <span>${index<8?'Store image '+(index+1):'Additional image'}</span>
    </label>`;
  }

  function renderProduct(product){
    const link=linkForProduct(product);
    if(!link)return '';
    const variants=variantsFor(product);
    const imageUrls=sourceImagesFor(product);
    const storedImages=Array.isArray(link.custom_image_urls)?unique(link.custom_image_urls):imageUrls;
    const allImages=unique([...imageUrls,...storedImages]);
    const variantSettings=state.variantConfig.filter(row=>String(row.link_id)===String(link.id));
    const hasExplicitVariantSettings=variantSettings.length>0;
    const title=link.custom_title||product.name_en||product.name||product.name_ar||'Product';
    const description=link.custom_description??product.description_en??product.description??product.description_ar??'';
    const selectedMainImage=imageUrls[0]||storedImages[0]||'';
    const available=product.available!==false;
    const imageMarkup=selectedMainImage
      ? `<img src="${esc(selectedMainImage)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : '<div class="store-product-placeholder">IZ</div>';
    const imageChoices=allImages.map((url,index)=>renderImageChoice(url,storedImages.includes(url),index)).join('');
    const variantMarkup=variants.length?variants.map(variant=>{
      const setting=variantSettings.find(row=>String(row.variant_id)===String(variant.id));
      const selected=hasExplicitVariantSettings?Boolean(setting?.enabled):true;
      const override=setting?.retail_price==null?'':String(setting.retail_price);
      const stock=Number(variant.stock_quantity||0);
      return `<div class="store-variant-row" data-variant-id="${esc(variant.id)}">
        <label class="store-variant-label"><input type="checkbox" class="store-variant-enabled" ${selected?'checked':''}><span>${esc(variantLabel(variant))}<small>${stock>0?stock+' in stock':'Out of stock'} · Suggested ${esc(formatMoney(variantPrice(product,link,variant),product.currency||'EGP'))}</small></span></label>
        <span class="store-variant-stock ${stock<=0?'out':''}">${stock<=0?'Unavailable':stock+' left'}</span>
        <input class="store-variant-price" type="number" min="0" step="0.01" value="${esc(override)}" placeholder="${esc(String(variantPrice(product,link,variant)))}" aria-label="Custom price for ${esc(variantLabel(variant))}">
      </div>`;
    }).join(''):'<div class="notice">No enabled supplier variants are available right now. Your supplier may need to activate the product first.</div>';
    return `<article class="store-product-editor" data-store-product="${esc(product.product_id)}" data-link-id="${esc(link.id)}">
      <div class="store-product-editor-head">${imageMarkup}<div><h4>${esc(product.name_en||product.name||'Product')}</h4><small>${available?'Linked to My Products':'Currently unavailable from supplier'} · ${variants.length} sellable variant options</small></div></div>
      <div class="store-product-editor-body">
        ${available?'':`<div class="notice bad store-unavailable-note">${esc(product.availability_reason||'This product will not appear on your public store until the supplier product is available again.')}</div>`}
        <div class="store-product-field"><label for="store-title-${esc(product.product_id)}">Your product title</label><textarea id="store-title-${esc(product.product_id)}" data-store-title rows="2" maxlength="160" placeholder="${esc(product.name_en||product.name||'Product title')}">${esc(title)}</textarea></div>
        <div class="store-product-field"><label for="store-description-${esc(product.product_id)}">Your description</label><textarea id="store-description-${esc(product.product_id)}" data-store-description rows="3" maxlength="3000" placeholder="Write a description for your customers">${esc(description)}</textarea></div>
        <section class="store-editor-section"><div class="store-editor-section-title"><span>Store photos</span><span class="muted">${allImages.length} available</span></div><p class="muted" style="font-size:11px;margin:0">Choose the images shown on your storefront, or add an HTTPS image URL. Supplier photos and listings remain unchanged.</p>
          <div class="store-image-grid" data-store-images>${imageChoices||'<div class="notice">No supplier photos found. You can add an HTTPS image URL below.</div>'}</div>
          <div class="store-add-image"><input type="url" data-extra-image-url placeholder="https://… image URL" aria-label="Additional image URL"><button class="btn secondary" type="button" data-add-store-image>Add image</button></div>
          <small class="muted">At least one selected photo is recommended. Only HTTPS image URLs are accepted.</small>
        </section>
        <section class="store-editor-section"><div class="store-editor-section-title"><span>Variants for your store</span><span class="muted">Stock is live</span></div><p class="muted" style="font-size:11px;margin:0">Uncheck variants you don't want to list. Leave a price blank to follow your general selling price or the supplier's suggested price. Out-of-stock variants cannot be purchased later.</p><div class="store-variant-list">${variantMarkup}</div></section>
      </div>
      <div class="store-product-editor-foot"><small>Edits only affect your storefront. Supplier product data is not changed.</small><button class="btn" type="button" data-save-store-product>Save product changes</button></div>
    </article>`;
  }

  function renderProducts(){
    const list=$('#store-products-list');
    if(!list)return;
    const linked=state.products.filter(product=>linkForProduct(product));
    if(!linked.length){
      list.innerHTML='<div class="store-public-empty"><h2>No products in My Products yet</h2><p>Go to Products and add items to My Products. They will appear here for storefront customization.</p></div>';
      return;
    }
    list.innerHTML=linked.map(renderProduct).join('');
    list.querySelectorAll('[data-save-store-product]').forEach(button=>{
      button.addEventListener('click',()=>saveProduct(button.closest('[data-store-product]'),button));
    });
    list.querySelectorAll('[data-add-store-image]').forEach(button=>{
      button.addEventListener('click',()=>addImage(button.closest('[data-store-product]')));
    });
  }

  function addImage(card){
    if(!card)return;
    const input=card.querySelector('[data-extra-image-url]');
    const url=safeImageUrl(input?.value);
    if(!url){
      status('Enter a valid HTTPS image URL first.',true);
      return;
    }
    const grid=card.querySelector('[data-store-images]');
    if([...grid.querySelectorAll('.store-image-check')].some(check=>check.value===url)){
      const existing=[...grid.querySelectorAll('.store-image-check')].find(check=>check.value===url);
      existing.checked=true;
      status('That image is already listed; it has been selected.');
      input.value='';
      return;
    }
    const label=document.createElement('label');
    label.className='store-image-choice';
    const check=document.createElement('input');
    check.type='checkbox';check.className='store-image-check';check.value=url;check.checked=true;
    check.setAttribute('aria-label','Include additional storefront image');
    const image=document.createElement('img');
    image.src=url;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';
    const note=document.createElement('span');note.textContent='Additional image';
    label.append(check,image,note);
    grid.appendChild(label);
    input.value='';
    status('Image added. Save this product to keep the change.');
  }

  async function saveProduct(card,button){
    if(!card)return;
    const linkId=card.dataset.linkId;
    const productId=card.dataset.storeProduct;
    const link=state.links.find(row=>String(row.id)===String(linkId));
    const product=state.products.find(row=>String(row.product_id)===String(productId));
    if(!link||!product){status('Could not find this linked product. Refresh and try again.',true);return}
    const selectedImages=unique([...card.querySelectorAll('.store-image-check:checked')].map(input=>input.value));
    const imageUrls=selectedImages.length?selectedImages:null;
    const variantRows=[...card.querySelectorAll('.store-variant-row')];
    const variants=variantsFor(product);
    const variantUpdates=[];
    for(const row of variantRows){
      const variantId=row.dataset.variantId;
      const priceInput=row.querySelector('.store-variant-price');
      const rawPrice=priceInput.value.trim();
      let price=null;
      if(rawPrice!==''){
        price=Number(rawPrice);
        if(!Number.isFinite(price)||price<0){
          status('Each custom variant price must be a valid non-negative amount.',true);
          priceInput.focus();
          return;
        }
      }
      variantUpdates.push({link_id:link.id,variant_id:variantId,enabled:row.querySelector('.store-variant-enabled').checked,retail_price:price,updated_at:new Date().toISOString()});
    }
    button.disabled=true;button.textContent='Saving…';
    try{
      await IZZY.request('/rest/v1/dropshipper_product_links?id=eq.'+encodeURIComponent(link.id),{
        method:'PATCH',
        headers:{Prefer:'return=minimal'},
        body:JSON.stringify({
          custom_title:card.querySelector('[data-store-title]').value.trim()||null,
          custom_description:card.querySelector('[data-store-description]').value.trim()||null,
          custom_image_urls:imageUrls,
          updated_at:new Date().toISOString()
        })
      });
      if(variants.length&&variantUpdates.length){
        await IZZY.request('/rest/v1/dropshipper_store_product_variants?on_conflict=link_id,variant_id',{
          method:'POST',
          headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
          body:JSON.stringify(variantUpdates)
        });
      }
      status('Product customization saved. Supplier listing and prices remain unchanged.');
      await refresh();
    }catch(error){
      status(error?.message||'Could not save product customization. Check the setup and try again.',true);
    }finally{
      button.disabled=false;button.textContent='Save product changes';
    }
  }

  async function saveProfile(event){
    event.preventDefault();
    if(!state.dropshipper){status('Your active dropshipper profile was not found.',true);return}
    const name=$('#store-name').value.trim();
    const slug=$('#store-slug').value.trim().toLowerCase();
    const description=$('#store-description').value.trim();
    const published=$('#store-published').checked;
    if(name.length<2||name.length>80){status('Store name must be between 2 and 80 characters.',true);return}
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length<3||slug.length>48){status('Use 3–48 lowercase letters, numbers, and single hyphens for the store link name.',true);return}
    if(description.length>500){status('Store description must be 500 characters or fewer.',true);return}
    const button=$('#store-profile-save');
    button.disabled=true;button.textContent='Saving…';
    const body={store_name:name,slug,description,is_published:published,updated_at:new Date().toISOString()};
    try{
      if(state.store?.id){
        await IZZY.request('/rest/v1/dropshipper_stores?id=eq.'+encodeURIComponent(state.store.id),{
          method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)
        });
      }else{
        await IZZY.request('/rest/v1/dropshipper_stores',{
          method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({...body,dropshipper_id:state.dropshipper.id})
        });
      }
      await refresh();
      status(published?'Store saved and published. Your link is ready to share.':'Store settings saved as a draft. Publish it when you are ready.');
    }catch(error){
      const message=String(error?.message||'');
      status(/duplicate|unique|slug/i.test(message)?'That store link name is already in use. Choose another one.':(message||'Could not save store settings.'),true);
    }finally{
      button.disabled=false;button.textContent='Save store settings';
    }
  }

  async function refresh(){
    if(state.busy)return;
    const session=window.IZZY?.session?.();
    if(!session?.user?.id){status('Please sign in to your dropshipper account, then reopen My Store.',true);return}
    state.busy=true;
    status('Loading your store and linked products…');
    try{
      const profileRows=await IZZY.request('/rest/v1/dropshippers?select=id,profile_id,business_name,status&profile_id=eq.'+encodeURIComponent(session.user.id)+'&limit=1');
      state.dropshipper=(profileRows||[]).find(row=>row.status==='active')||null;
      if(!state.dropshipper)throw new Error('An active dropshipper profile is required to create a store.');
      const [stores,links,catalog]=await Promise.all([
        IZZY.request('/rest/v1/dropshipper_stores?select=id,dropshipper_id,store_name,slug,description,is_published,created_at,updated_at&dropshipper_id=eq.'+encodeURIComponent(state.dropshipper.id)+'&limit=1'),
        IZZY.request('/rest/v1/dropshipper_product_links?select=id,dropshipper_id,supplier_product_id,retail_price,pricing_mode,status,custom_title,custom_description,custom_image_urls&dropshipper_id=eq.'+encodeURIComponent(state.dropshipper.id)+'&status=eq.active&order=created_at.desc'),
        IZZY.rpc('dropshipper_linked_catalog')
      ]);
      state.store=stores?.[0]||null;
      state.links=Array.isArray(links)?links:[];
      state.products=Array.isArray(catalog)?catalog:(Array.isArray(catalog?.products)?catalog.products:[]);
      const productIds=[...new Set(state.links.map(row=>row.supplier_product_id).filter(Boolean).map(String))];
      const linkIds=state.links.map(row=>row.id).filter(Boolean).map(String);
      const [imagesResult,configsResult]=await Promise.all([
        productIds.length?IZZY.request('/rest/v1/product_images?select=id,product_id,url,position&product_id='+encodeURIComponent(queryIn(productIds))+'&order=position.asc'):Promise.resolve([]),
        linkIds.length?IZZY.request('/rest/v1/dropshipper_store_product_variants?select=id,link_id,variant_id,enabled,retail_price,updated_at&link_id='+encodeURIComponent(queryIn(linkIds))):Promise.resolve([])
      ]);
      state.imagesByProduct={};
      for(const image of (imagesResult||[])){
        const id=String(image.product_id);
        if(!state.imagesByProduct[id])state.imagesByProduct[id]=[];
        if(safeImageUrl(image.url))state.imagesByProduct[id].push({url:safeImageUrl(image.url),position:Number(image.position||0)});
      }
      Object.keys(state.imagesByProduct).forEach(id=>state.imagesByProduct[id].sort((a,b)=>a.position-b.position));
      state.variantConfig=Array.isArray(configsResult)?configsResult:[];
      state.variantsByProduct={};state.variantErrors=[];
      const activeProducts=[...new Set(state.products.map(product=>String(product.product_id)).filter(Boolean))];
      const variantResults=await Promise.all(activeProducts.map(async id=>{
        try{return [id,await IZZY.rpc('marketplace_variants_v3',{_product_id:id})]}catch(error){return [id,[],error]}
      }));
      for(const [id,variants,error] of variantResults){
        state.variantsByProduct[id]=Array.isArray(variants)?variants:[];
        if(error)state.variantErrors.push(id);
        for(const variant of state.variantsByProduct[id]){
          const url=safeImageUrl(variant.image_url);
          if(url){
            if(!state.imagesByProduct[id])state.imagesByProduct[id]=[];
            if(!state.imagesByProduct[id].some(image=>image.url===url))state.imagesByProduct[id].push({url,position:999});
          }
        }
      }
      renderProfile();renderProducts();
      state.loaded=true;
      if(state.variantErrors.length)status('Your store loaded, but some variant details could not refresh. You can retry.',true);
      else if(!state.products.length)status('Store settings are ready. Add products to My Products to customize your store.');
      else status('');
    }catch(error){
      const message=String(error?.message||'');
      status(/dropshipper_stores|dropshipper_store_product_variants|schema cache|not find the table/i.test(message)
        ?'The storefront database setup is not available yet. Apply the hosted storefront v1 migration, then refresh this view.'
        :(message||'Could not load My Store. Refresh and try again.'),true);
      $('#store-products-list').innerHTML='<div class="notice bad">Your store data could not be loaded. No changes have been made.</div>';
    }finally{state.busy=false}
  }

  const profileForm=$('#store-profile-form');
  if(profileForm)profileForm.addEventListener('submit',saveProfile);
  const refreshButton=$('#store-products-refresh');
  if(refreshButton)refreshButton.addEventListener('click',()=>refresh());
  const copyButton=$('#store-copy-link');
  if(copyButton)copyButton.addEventListener('click',async()=>{
    const value=$('#store-public-link')?.value||'';
    if(!value)return;
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
      else{$('#store-public-link').focus();$('#store-public-link').select();document.execCommand('copy')}
      status(state.store?.is_published?'Public store link copied.':'Draft link copied; publish your store before sharing it.');
    }catch{status('Copy failed. Select the link and copy it manually.',true)}
  });
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-view="store"]');
    if(button){
      // Let the existing dashboard navigation reveal the panel first.
      window.setTimeout(()=>{if(root()&&!root().hidden)refresh()},0);
    }
  });
})();