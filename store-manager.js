(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const statusEl = $('#store-manager-status');
  const state = { session: IZZY.session(), dropshipper: null, store: null, links: [], linked: [], catalog: [], storeProducts: [], storeVariants: [], editing: null };
  const clean = v => String(v ?? '').trim();
  const esc = IZZY.esc;
  const slugify = v => clean(v).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/g, '');
  const safeUrl = v => { try { const u = new URL(String(v || '')); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
  const money = (v, c) => IZZY.money(Number(v || 0), c || 'EGP');
  const titleOf = p => clean(p && (p.name_en || p.name || p.title)) || 'Product';
  const descOf = p => clean(p && (p.description_en || p.description)) || '';
  const setStatus = (m, bad = false) => { statusEl.textContent = m || ''; statusEl.className = 'status' + (bad ? ' bad' : ''); };
  const setEditStatus = (m, bad = false) => { const e = $('#store-product-edit-status'); if (e) { e.textContent = m || ''; e.className = 'status' + (bad ? ' bad' : ''); } };
  const storeUrl = slug => { if (!slug) return ''; const u = new URL('storefront.html', location.href); u.searchParams.set('slug', slug); return u.href; };
  const imageMarkup = (url, alt) => safeUrl(url) ? "<img class='store-manager-product-image' src='" + esc(safeUrl(url)) + "' alt='" + esc(alt || '') + "' loading='lazy'>" : "<div class='store-manager-image-placeholder' aria-hidden='true'>IZ</div>";

  function renderProfile() {
    if (!state.store) {
      const u = state.session && state.session.user || {};
      const name = (u.user_metadata && (u.user_metadata.business_name || u.user_metadata.full_name)) || (u.email || '').split('@')[0] || 'My Store';
      $('#store-name').value = name;
      $('#store-slug').value = slugify(name) || 'my-store';
      $('#store-description').value = '';
      $('#store-published').checked = false;
      $('#store-published-badge').textContent = 'Not published';
      $('#store-published-badge').className = 'tag';
      $('#store-link-preview').hidden = true;
      $('#open-public-store').hidden = true;
      $('#copy-store-link').disabled = true;
      return;
    }
    $('#store-name').value = state.store.store_name || '';
    $('#store-slug').value = state.store.slug || '';
    $('#store-description').value = state.store.description || '';
    $('#store-published').checked = state.store.published === true;
    $('#store-published-badge').textContent = state.store.published ? 'Published' : 'Not published';
    $('#store-published-badge').className = state.store.published ? 'tag ok' : 'tag';
    const url = storeUrl(state.store.slug);
    $('#store-link-value').textContent = url;
    $('#store-link-preview').hidden = !url;
    $('#open-public-store').href = url || '#';
    $('#open-public-store').hidden = !url;
    $('#copy-store-link').disabled = !url;
  }

  function renderCatalog() {
    const root = $('#store-catalog-results');
    if (!state.store) { root.innerHTML = "<div class='store-manager-empty'>Save your store details first. Then choose products to add.</div>"; return; }
    const q = clean($('#store-catalog-search').value).toLowerCase();
    const sort = $('#store-catalog-sort').value;
    const linkByProduct = new Map(state.links.map(l => [l.supplier_product_id, l]));
    const listed = new Set(state.storeProducts.map(x => x.product_link_id));
    let items = state.catalog.filter(p => Number(p.stock_quantity || 0) > 0 && !listed.has(linkByProduct.get(p.product_id)?.id) &&
      (!q || titleOf(p).toLowerCase().includes(q) || descOf(p).toLowerCase().includes(q) || String(p.category_name || '').toLowerCase().includes(q)));
    if (sort === 'price-low') items.sort((a,b) => Number(a.suggested_retail_price||0)-Number(b.suggested_retail_price||0));
    if (sort === 'price-high') items.sort((a,b) => Number(b.suggested_retail_price||0)-Number(a.suggested_retail_price||0));
    if (!items.length) { root.innerHTML = "<div class='store-manager-empty'>No matching products are available to add. Try another search.</div>"; return; }
    root.innerHTML = items.map(p => "<article class='store-manager-product'>" +
      imageMarkup(p.primary_image_url, titleOf(p)) +
      "<div class='store-manager-product-body'><h3>" + esc(titleOf(p)) + "</h3><p class='store-card-description'>" + esc(descOf(p) || 'No description provided yet.') + "</p>" +
      "<div class='store-manager-price-details'><div><small>Supplier price</small><b>" + money(p.supplier_cost,p.currency) + "</b></div><div><small>Suggested retail</small><b>" + money(p.suggested_retail_price,p.currency) + "</b></div></div>" +
      "<div class='store-manager-product-actions'><button class='btn add-store-product' data-product-id='" + esc(p.product_id) + "'>Add to my store</button></div></div></article>").join('');
    $$('.add-store-product', root).forEach(b => b.addEventListener('click', () => addProduct(b.dataset.productId, b)));
  }

  function renderListings() {
    const root = $('#store-listings');
    const linkedByLink = new Map(state.linked.map(p => [p.link_id, p]));
    const linkById = new Map(state.links.map(l => [l.id,l]));
    $('#store-listing-count').textContent = state.storeProducts.length + ' product' + (state.storeProducts.length === 1 ? '' : 's');
    if (!state.storeProducts.length) { root.innerHTML = "<div class='store-manager-empty'>Your store is empty. Add a product from the IzzyDrop marketplace above.</div>"; return; }
    root.innerHTML = state.storeProducts.map(sp => {
      const link = linkById.get(sp.product_link_id);
      const p = linkedByLink.get(sp.product_link_id) || state.catalog.find(x => x.product_id === (link && link.supplier_product_id)) || {};
      const title = clean(sp.title_override) || titleOf(p);
      const photos = [...(Array.isArray(sp.selected_image_urls) ? sp.selected_image_urls : []), ...(Array.isArray(sp.custom_image_urls) ? sp.custom_image_urls : [])];
      const img = photos.map(safeUrl).find(Boolean) || p.primary_image_url;
      const enabledCount = state.storeVariants.filter(v => v.store_product_id === sp.id && v.enabled).length;
      const available = p.available !== false && Number(p.stock_quantity || 0) > 0;
      return "<article class='store-manager-product'>" + imageMarkup(img,title) +
        "<div class='store-manager-product-body'><span class='store-product-status " + (sp.is_published ? "" : "off") + "'>" + (sp.is_published ? "Visible in store" : "Hidden from store") + "</span>" +
        "<h3>" + esc(title) + "</h3><p class='store-card-description'>" + esc(clean(sp.description_override) || descOf(p) || 'No description provided yet.') + "</p>" +
        "<div class='store-manager-price-details'><div><small>Supplier price</small><b>" + money(p.supplier_price ?? p.supplier_cost,p.currency) + "</b></div><div><small>Variants enabled</small><b>" + enabledCount + "</b></div></div>" +
        (available ? "" : "<p class='store-card-description'>Supplier availability needs attention. The listing will not be shown while its source product is unavailable.</p>") +
        "<div class='store-manager-product-actions'><button class='btn secondary edit-store-product' data-id='" + esc(sp.id) + "'>Customize</button>" +
        "<button class='btn secondary toggle-store-product' data-id='" + esc(sp.id) + "' data-published='" + (sp.is_published ? "1" : "0") + "'>" + (sp.is_published ? "Hide" : "Show") + "</button>" +
        "<button class='text-danger remove-store-product' data-id='" + esc(sp.id) + "'>Remove</button></div></div></article>";
    }).join('');
    $$('.edit-store-product',root).forEach(b => b.addEventListener('click',()=>openEditor(b.dataset.id)));
    $$('.toggle-store-product',root).forEach(b => b.addEventListener('click',()=>toggleProduct(b.dataset.id,b.dataset.published!=='1')));
    $$('.remove-store-product',root).forEach(b => b.addEventListener('click',()=>removeProduct(b.dataset.id)));
  }

  async function loadData() {
    setStatus('Loading your store and marketplace…');
    const user = await IZZY.request('/auth/v1/user');
    if (!user || !user.id) throw new Error('Please sign in again to manage your store.');
    const ds = await IZZY.request('/rest/v1/dropshippers?select=id,profile_id,business_name,status&profile_id=eq.' + encodeURIComponent(user.id) + '&limit=1');
    state.dropshipper = ds && ds[0] || null;
    if (!state.dropshipper) throw new Error('This account does not have a dropshipper workspace yet.');
    if (state.dropshipper.status !== 'active') throw new Error('Your dropshipper account must be active before you can publish a store.');
    const results = await Promise.all([
      IZZY.request('/rest/v1/dropshipper_stores?select=*&dropshipper_id=eq.' + encodeURIComponent(state.dropshipper.id) + '&limit=1'),
      IZZY.request('/rest/v1/dropshipper_product_links?select=id,dropshipper_id,supplier_product_id,retail_price,pricing_mode,status&dropshipper_id=eq.' + encodeURIComponent(state.dropshipper.id) + '&status=eq.active'),
      IZZY.rpc('dropshipper_linked_catalog'),
      IZZY.rpc('marketplace_catalog_v3')
    ]);
    state.store = results[0] && results[0][0] || null;
    state.links = Array.isArray(results[1]) ? results[1] : [];
    state.linked = Array.isArray(results[2]) ? results[2] : [];
    state.catalog = Array.isArray(results[3]) ? results[3] : [];
    state.storeProducts = [];
    state.storeVariants = [];
    if (state.store) {
      state.storeProducts = await IZZY.request('/rest/v1/dropshipper_store_products?select=*&store_id=eq.' + encodeURIComponent(state.store.id) + '&order=created_at.desc');
      if (state.storeProducts.length) {
        const ids = state.storeProducts.map(x=>encodeURIComponent(x.id)).join(',');
        state.storeVariants = await IZZY.request('/rest/v1/dropshipper_store_product_variants?select=*&store_product_id=in.(' + ids + ')');
      }
    }
    renderProfile(); renderCatalog(); renderListings(); setStatus('');
  }

  async function saveProfile(e) {
    e.preventDefault();
    const name = clean($('#store-name').value);
    const slug = slugify($('#store-slug').value);
    const description = $('#store-description').value.trim();
    const published = $('#store-published').checked;
    const reserved = /^(admin|app|api|assets|auth|login|logout|products|product|settings|store|storefront|store-manager|supplier|suppliers|checkout|orders|help|about)$/;
    if (name.length < 2) return setStatus('Enter a store name with at least 2 characters.',true);
    if (slug.length < 2 || reserved.test(slug)) return setStatus('Choose a different store link. Use lowercase letters, numbers and hyphens.',true);
    $('#save-store-profile').disabled = true;
    setStatus('Saving store details…');
    const payload = { dropshipper_id: state.dropshipper.id, store_name: name, slug, description, published };
    try {
      const result = state.store
        ? await IZZY.request('/rest/v1/dropshipper_stores?id=eq.' + encodeURIComponent(state.store.id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)})
        : await IZZY.request('/rest/v1/dropshipper_stores',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
      state.store = Array.isArray(result) ? result[0] : result;
      if (!state.store || !state.store.id) {
        const rows = await IZZY.request('/rest/v1/dropshipper_stores?select=*&dropshipper_id=eq.' + encodeURIComponent(state.dropshipper.id) + '&limit=1');
        state.store = rows && rows[0] || null;
      }
      renderProfile(); renderCatalog(); setStatus('Store details saved.');
    } catch (error) { setStatus(error.message || 'Could not save your store details.',true); }
    finally { $('#save-store-profile').disabled = false; }
  }

  async function ensureLink(p) {
    let link = state.links.find(l=>l.supplier_product_id===p.product_id);
    if (link) return link;
    try {
      const result = await IZZY.request('/rest/v1/dropshipper_product_links',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({
        dropshipper_id:state.dropshipper.id,supplier_product_id:p.product_id,retail_price:null,pricing_mode:'follow_suggestions',status:'active',
        last_seen_cost:Number(p.supplier_cost||0),last_seen_stock:Number(p.stock_quantity||0)
      })});
      link = Array.isArray(result) ? result[0] : result;
    } catch (error) {
      const existing = await IZZY.request('/rest/v1/dropshipper_product_links?select=id,dropshipper_id,supplier_product_id,retail_price,pricing_mode,status&dropshipper_id=eq.' +
        encodeURIComponent(state.dropshipper.id) + '&supplier_product_id=eq.' + encodeURIComponent(p.product_id) + '&status=eq.active&limit=1').catch(()=>[]);
      link = existing && existing[0];
      if (!link) throw error;
    }
    if (!link || !link.id) throw new Error('Could not link this product to My Products.');
    state.links = [...state.links.filter(l=>l.id!==link.id),link];
    return link;
  }

  async function sourceImages(productId, variants) {
    const rows = await IZZY.request('/rest/v1/product_images?select=url,position&product_id=eq.' + encodeURIComponent(productId) + '&order=position.asc');
    const urls = (rows||[]).map(x=>safeUrl(x.url)).filter(Boolean);
    (variants||[]).forEach(v=>{const u=safeUrl(v.image_url);if(u)urls.push(u)});
    const unique=[...new Set(urls)].slice(0,20);
    if (!unique.length) {
      const p=state.catalog.find(x=>x.product_id===productId)||state.linked.find(x=>x.product_id===productId);
      const u=safeUrl(p&&p.primary_image_url);if(u)unique.push(u);
    }
    return unique;
  }

  async function addProduct(productId,button) {
    if (!state.store || !state.store.id) return setStatus('Save your store details first, then add products.',true);
    const p=state.catalog.find(x=>x.product_id===productId);
    if (!p || Number(p.stock_quantity||0)<1) return setStatus('This product is no longer available to add.',true);
    if (button) {button.disabled=true;button.textContent='Adding…';}
    setStatus('Adding the product and preparing its variants…');
    let createdId=null;
    try {
      const variants=await IZZY.rpc('marketplace_variants_v3',{_product_id:productId});
      if (!Array.isArray(variants)||!variants.length) throw new Error('No enabled variants are available for this product.');
      const images=await sourceImages(productId,variants);
      const link=await ensureLink(p);
      const data=await IZZY.request('/rest/v1/dropshipper_store_products',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({
        store_id:state.store.id,product_link_id:link.id,is_published:true,selected_image_urls:images,custom_image_urls:[]
      })});
      const sp=Array.isArray(data)?data[0]:data;
      if(!sp||!sp.id)throw new Error('The store listing could not be created.');
      createdId=sp.id;
      await IZZY.request('/rest/v1/dropshipper_store_product_variants?on_conflict=store_product_id,variant_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(variants.map(v=>({
        store_product_id:sp.id,variant_id:v.id,retail_price:Math.max(0,Number(v.suggested_retail_price??p.suggested_retail_price??0)),enabled:true
      })))});
      setStatus('Product added. Customize its title, description, photos, and selling prices below.');
      await loadData();
    } catch(error) {
      if(createdId) await IZZY.request('/rest/v1/dropshipper_store_products?id=eq.'+encodeURIComponent(createdId),{method:'DELETE'}).catch(()=>{});
      setStatus(error.message||'Could not add this product.',true);
      if(button){button.disabled=false;button.textContent='Add to my store';}
    }
  }

  function contextFor(id) {
    const sp=state.storeProducts.find(x=>x.id===id);if(!sp)return null;
    const link=state.links.find(x=>x.id===sp.product_link_id);
    const p=state.linked.find(x=>x.link_id===sp.product_link_id)||state.catalog.find(x=>x.product_id===(link&&link.supplier_product_id))||{};
    return {sp,link,p,productId:link&&link.supplier_product_id};
  }

  async function openEditor(id) {
    const c=contextFor(id);if(!c||!c.productId)return setStatus('Could not load this listing. Refresh and try again.',true);
    $('#store-edit-title').textContent=clean(c.sp.title_override)||titleOf(c.p);
    $('#store-edit-cost-note').textContent='Supplier price shown only in your workspace: '+money(c.p.supplier_price??c.p.supplier_cost,c.p.currency)+'. Customers will see only your selling price.';
    $('#edit-product-title').value=clean(c.sp.title_override)||titleOf(c.p);
    $('#edit-product-description').value=clean(c.sp.description_override)||descOf(c.p);
    $('#edit-source-photos').innerHTML="<div class='store-manager-empty'>Loading photos…</div>";
    $('#edit-custom-photos').innerHTML='';
    $('#edit-product-variants').innerHTML="<div class='store-manager-empty'>Loading variants…</div>";
    $('#store-product-edit-status').textContent='';
    state.editing={id:id,productId:c.productId,sp:c.sp,p:c.p,images:[],custom:[...(c.sp.custom_image_urls||[])],variants:[],settings:[],selected:new Set()};
    $('#store-edit-modal').hidden=false;
    try {
      const result=await Promise.all([
        IZZY.rpc('marketplace_variants_v3',{_product_id:c.productId}),
        IZZY.request('/rest/v1/product_images?select=url,position&product_id=eq.'+encodeURIComponent(c.productId)+'&order=position.asc'),
        IZZY.request('/rest/v1/dropshipper_store_product_variants?select=*&store_product_id=eq.'+encodeURIComponent(id))
      ]);
      if(!state.editing||state.editing.id!==id)return;
      const vs=Array.isArray(result[0])?result[0]:[];
      const imgs=(result[1]||[]).map(x=>safeUrl(x.url)).filter(Boolean);
      vs.forEach(v=>{const u=safeUrl(v.image_url);if(u)imgs.push(u)});
      const unique=[...new Set(imgs)].slice(0,20);
      if(!unique.length){const u=safeUrl(c.p.primary_image_url);if(u)unique.push(u);}
      state.editing.images=unique;
      state.editing.variants=vs;
      state.editing.settings=Array.isArray(result[2])?result[2]:[];
      state.editing.selected=new Set(Array.isArray(c.sp.selected_image_urls)&&c.sp.selected_image_urls.length?c.sp.selected_image_urls:unique);
      renderPhotos();renderVariants();
    } catch(error) {setEditStatus(error.message||'Could not load product details.',true);}
  }

  function renderPhotos() {
    const e=state.editing;if(!e)return;
    const source=$('#edit-source-photos'),custom=$('#edit-custom-photos');
    source.innerHTML=e.images.length?e.images.map((url,i)=>"<label class='store-photo-choice'><input class='source-photo-check' type='checkbox' data-photo-url='"+esc(url)+"' "+(e.selected.has(url)?'checked':'')+" aria-label='Show photo "+(i+1)+"'><img src='"+esc(url)+"' alt='' loading='lazy'><span>Supplier photo "+(i+1)+"</span></label>").join(''):"<div class='store-manager-empty'>No supplier photos are available. Upload at least one photo to publish the listing.</div>";
    custom.innerHTML=e.custom.map((url,i)=>"<div class='store-photo-choice store-custom-photo'><img src='"+esc(safeUrl(url))+"' alt='Your uploaded photo' loading='lazy'><span>Your photo "+(i+1)+"</span><button type='button' class='store-remove-photo' data-remove-custom='"+i+"' aria-label='Remove uploaded photo'>×</button></div>").join('');
    $$('.source-photo-check',source).forEach(x=>x.addEventListener('change',()=>{if(x.checked)e.selected.add(x.dataset.photoUrl);else e.selected.delete(x.dataset.photoUrl);}));
    $$('.store-remove-photo',custom).forEach(x=>x.addEventListener('click',()=>{e.custom.splice(Number(x.dataset.removeCustom),1);renderPhotos();}));
  }

  function renderVariants() {
    const e=state.editing;if(!e)return;
    const root=$('#edit-product-variants');
    if(!e.variants.length){root.innerHTML="<div class='store-manager-empty'>No currently enabled variants can be edited. Check product availability.</div>";return;}
    const saved=new Map(e.settings.map(v=>[v.variant_id,v]));
    root.innerHTML=e.variants.map(v=>{
      const row=saved.get(v.id);const price=row?Number(row.retail_price):Number(v.suggested_retail_price??e.p.suggested_retail_price??0);
      const enabled=row?row.enabled===true:true;
      const options=Object.entries(v.option_values||{}).filter(([,val])=>clean(val)).map(([k,val])=>k+': '+val).join(' · ');
      const label=options||clean(v.variant_name)||clean(v.sku)||'Default option';
      return "<div class='store-variant-row' data-variant-id='"+esc(v.id)+"'><div class='store-variant-details'><b>"+esc(label)+"</b><small>Stock: "+Number(v.stock_quantity||0)+(v.sku?' · SKU '+esc(v.sku):'')+"</small><span class='store-variant-cost'>Your supplier price: "+money(v.supplier_cost??e.p.supplier_cost,e.p.currency)+"</span></div><label class='store-variant-enable'><input type='checkbox' class='variant-enabled' "+(enabled?'checked':'')+">Show variant</label><label class='store-variant-price'>Your selling price<input type='number' class='variant-price' min='0' max='100000000' step='0.01' value='"+(Number.isFinite(price)?price:0)+"' required></label></div>";
    }).join('');
  }

  async function saveListing(e) {
    e.preventDefault();const edit=state.editing;if(!edit)return;
    const title=clean($('#edit-product-title').value),description=$('#edit-product-description').value.trim();
    if(title.length<2||title.length>200)return setEditStatus('Enter a title between 2 and 200 characters.',true);
    if(description.length>5000)return setEditStatus('The description must be 5,000 characters or fewer.',true);
    const selected=$$('.source-photo-check:checked').map(x=>safeUrl(x.dataset.photoUrl)).filter(Boolean);
    const custom=edit.custom.map(safeUrl).filter(Boolean);
    if(!selected.length&&!custom.length)return setEditStatus('Keep at least one photo or upload your own.',true);
    const variants=$$('.store-variant-row').map(row=>({store_product_id:edit.id,variant_id:row.dataset.variantId,retail_price:Number($('.variant-price',row).value),enabled:$('.variant-enabled',row).checked}));
    if(variants.some(v=>!Number.isFinite(v.retail_price)||v.retail_price<0||v.retail_price>100000000))return setEditStatus('Enter a valid non-negative selling price for every variant.',true);
    $('#save-store-product').disabled=true;setEditStatus('Saving your custom listing…');
    try {
      await IZZY.request('/rest/v1/dropshipper_store_products?id=eq.'+encodeURIComponent(edit.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({
        title_override:title===titleOf(edit.p)?null:title,description_override:description===descOf(edit.p)?null:description,selected_image_urls:selected,custom_image_urls:custom
      })});
      await IZZY.request('/rest/v1/dropshipper_store_product_variants?on_conflict=store_product_id,variant_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(variants)});
      $('#store-edit-modal').hidden=true;state.editing=null;setStatus('Listing saved. The supplier’s original product remains unchanged.');await loadData();
    } catch(error) {setEditStatus(error.message||'Could not save your listing.',true);}
    finally {$('#save-store-product').disabled=false;}
  }

  async function toggleProduct(id,published) {
    try {await IZZY.request('/rest/v1/dropshipper_store_products?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({is_published:published})});await loadData();setStatus(published?'Product is now visible in your store.':'Product is hidden from your store.');}
    catch(error){setStatus(error.message||'Could not update product visibility.',true);}
  }
  async function removeProduct(id) {
    if(!confirm('Remove this product from your store? It will remain in My Products.'))return;
    try {await IZZY.request('/rest/v1/dropshipper_store_products?id=eq.'+encodeURIComponent(id),{method:'DELETE'});await loadData();setStatus('Product removed from your store. It remains in My Products.');}
    catch(error){setStatus(error.message||'Could not remove this listing.',true);}
  }

  async function uploadPhotos(event) {
    const e=state.editing,files=[...(event.target.files||[])];event.target.value='';
    if(!e||!files.length)return;
    if(e.custom.length+files.length>12)return setEditStatus('A listing can have up to 12 of your own uploaded photos.',true);
    for(const f of files){if(!/^image\/(jpeg|png|webp|avif)$/.test(f.type))return setEditStatus('Use a JPG, PNG, WebP or AVIF image.',true);if(f.size>5242880)return setEditStatus('Each photo must be 5 MB or smaller.',true);}
    const session=IZZY.session();if(!session||!session.user||!session.user.id)return setEditStatus('Please sign in again to upload photos.',true);
    $('#edit-upload-photos').disabled=true;setEditStatus('Uploading your photos…');
    try {
      for(const f of files){
        const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'}[f.type];
        const path=session.user.id+'/'+state.store.id+'/'+e.id+'/'+crypto.randomUUID()+'.'+ext;
        const encoded=path.split('/').map(encodeURIComponent).join('/');
        await IZZY.request('/storage/v1/object/storefront-images/'+encoded,{method:'POST',headers:{'Content-Type':f.type,'x-upsert':'false'},body:f});
        e.custom.push(IZZY.config.supabaseUrl+'/storage/v1/object/public/storefront-images/'+encoded);
      }
      renderPhotos();setEditStatus('Photos uploaded. Save the listing to publish them.');
    } catch(error){setEditStatus(error.message||'Could not upload a photo.',true);}
    finally{$('#edit-upload-photos').disabled=false;}
  }

  async function copyLink() {
    const url=storeUrl(state.store&&state.store.slug);if(!url)return;
    try{await navigator.clipboard.writeText(url);setStatus('Store link copied.');}
    catch{setStatus('Copy this store link: '+url);}
  }
  function closeEditor(){ $('#store-edit-modal').hidden=true;state.editing=null; }
  function wire() {
    $('#store-profile-form').addEventListener('submit',saveProfile);
    $('#store-catalog-search').addEventListener('input',renderCatalog);
    $('#store-catalog-sort').addEventListener('change',renderCatalog);
    $('#copy-store-link').addEventListener('click',copyLink);
    $('#store-product-edit-form').addEventListener('submit',saveListing);
    $('#edit-upload-photos').addEventListener('change',uploadPhotos);
    $$('[data-close-editor]').forEach(b=>b.addEventListener('click',closeEditor));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#store-edit-modal').hidden)closeEditor();});
    $('#store-sign-out').addEventListener('click',()=>{IZZY.logout();location.href='login.html';});
    $('#store-name').addEventListener('input',()=>{if(!state.store)$('#store-slug').value=slugify($('#store-name').value);});
    $('#store-slug').addEventListener('input',()=>{$('#store-slug').value=slugify($('#store-slug').value);});
  }
  async function init() {
    if(!state.session||!state.session.access_token){location.replace('login.html');return;}
    wire();
    try{await loadData();}
    catch(error){setStatus(error.message||'Could not open My Store.',true);$('#store-catalog-results').innerHTML="<div class='store-manager-empty'>My Store could not load. Sign in with an active dropshipper account, then refresh.</div>";$('#store-listings').innerHTML='';}
  }
  init();
})();