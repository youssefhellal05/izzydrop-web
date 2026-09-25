(()=>{
  const $=s=>document.querySelector(s);
  const DRAFT_KEY='izzy_variant_product_draft_v1';
  const DB_NAME='izzy_product_drafts_v1';
  const STORE='files';
  let trackedFiles=[];
  let editSupplierId=null;
  let replaceImage=null;

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  async function saveDraftFiles(files){
    try{
      const db=await openDb();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).put(files,'variant-draft-files');
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });
      db.close();
    }catch(e){console.warn('Draft photo cache unavailable',e)}
  }
  async function loadDraftFiles(){
    try{
      const db=await openDb();
      const files=await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readonly');
        const req=tx.objectStore(STORE).get('variant-draft-files');
        req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);
      });
      db.close();
      return Array.isArray(files)?files:[];
    }catch(e){return []}
  }

  function collectSharedDraft(){
    return {
      name_en:$('#p-name-en')?.value||'',
      name_ar:$('#p-name-ar')?.value||'',
      description_en:$('#p-description-en')?.value||'',
      description_ar:$('#p-description-ar')?.value||'',
      category_id:$('#p-category')?.value||'',
      sku:$('#p-sku')?.value||'',
      cost:$('#p-cost')?.value||'',
      retail:$('#p-retail')?.value||''
    };
  }
  async function saveSharedDraft(){
    try{sessionStorage.setItem(DRAFT_KEY,JSON.stringify(collectSharedDraft()))}catch(e){}
    await saveDraftFiles(trackedFiles);
  }

  function syncTrackedFilesFromPicker(files){
    const incoming=[...(files||[])];
    if(!incoming.length)return;
    const merged=[...trackedFiles];
    incoming.forEach(file=>{
      const duplicate=merged.some(x=>x.name===file.name&&x.size===file.size&&x.lastModified===file.lastModified);
      if(!duplicate)merged.push(file);
    });
    trackedFiles=merged.slice(0,6);
  }

  function installPhotoTracking(){
    const picker=$('#p-images');
    if(picker)picker.addEventListener('change',e=>syncTrackedFilesFromPicker(e.target.files),true);
    const drop=$('#photo-drop-zone');
    if(drop)drop.addEventListener('drop',e=>syncTrackedFilesFromPicker(e.dataTransfer?.files),true);
    document.addEventListener('click',e=>{
      const remove=e.target.closest?.('[data-remove-image]');
      if(remove){
        const index=Number(remove.dataset.removeImage);
        if(Number.isInteger(index))trackedFiles.splice(index,1);
      }
      const main=e.target.closest?.('[data-main-image]');
      if(main){
        const index=Number(main.dataset.mainImage);
        if(Number.isInteger(index)&&index>0&&index<trackedFiles.length){
          const [file]=trackedFiles.splice(index,1);trackedFiles.unshift(file);
        }
      }
    },true);
  }

  function stripVariantUiAndRoute(){
    $('#variant-builder-card')?.remove();
    $('#variant-choice-card')?.remove();
    document.querySelectorAll('[data-product-version-mode="options"]').forEach(btn=>{
      btn.classList.remove('on');
      btn.removeAttribute('aria-pressed');
      btn.textContent='Create variant product';
      btn.onclick=async()=>{
        btn.disabled=true;
        btn.textContent='Opening variant product…';
        await saveSharedDraft();
        location.href='supplier-variant.html';
      };
    });
    const inventoryTitle=$('#add-inventory-section .form-section-title h3');
    const inventoryCopy=$('#add-inventory-section .form-section-title p');
    if(inventoryTitle)inventoryTitle.textContent='Inventory';
    if(inventoryCopy)inventoryCopy.textContent='Enter the stock available for this single-version product.';
    const entry=$('#simple-product-stock-field .variant-flow-entry');
    if(entry){
      const b=entry.querySelector('b'),s=entry.querySelector('small');
      if(b)b.textContent='Need colors, sizes, or other options?';
      if(s)s.textContent='Variant products use their own dedicated creation page.';
    }
  }

  async function restoreSingleDraftIfNeeded(){
    const params=new URLSearchParams(location.search);
    const view=params.get('view');
    if(!view)return;
    const openView=()=>{
      const btn=document.querySelector(`[data-view="${CSS.escape(view)}"]`);
      if(btn)btn.click();
      else document.querySelector(`[data-jump="${CSS.escape(view)}"]`)?.click();
    };
    const waitForSupplier=()=>new Promise(resolve=>{
      const start=Date.now();
      const tick=()=>{
        if(!$('#supplier')?.hidden)return resolve();
        if(Date.now()-start>10000)return resolve();
        setTimeout(tick,100);
      };tick();
    });
    await waitForSupplier();
    openView();
    if(view!=='add'||params.get('restore')!=='1')return;
    let draft=null;
    try{draft=JSON.parse(sessionStorage.getItem(DRAFT_KEY)||'null')}catch(e){}
    if(draft){
      const map={
        '#p-name-en':'name_en','#p-name-ar':'name_ar','#p-description-en':'description_en','#p-description-ar':'description_ar',
        '#p-sku':'sku','#p-cost':'cost','#p-retail':'retail'
      };
      Object.entries(map).forEach(([sel,key])=>{const el=$(sel);if(el&&draft[key]!=null){el.value=draft[key];el.dispatchEvent(new Event('input',{bubbles:true}))}});
      if($('#p-category')&&draft.category_id){$('#p-category').value=draft.category_id;$('#p-category').dispatchEvent(new Event('change',{bubbles:true}))}
    }
    trackedFiles=await loadDraftFiles();
    if(trackedFiles.length&&$('#p-images')){
      try{
        const dt=new DataTransfer();trackedFiles.forEach(file=>dt.items.add(file));
        $('#p-images').files=dt.files;
        $('#p-images').dispatchEvent(new Event('change',{bubbles:true}));
      }catch(e){console.warn('Could not restore draft photos',e)}
    }
  }

  function storagePathFromUrl(url){
    try{
      const marker='/storage/v1/object/public/product-images/';
      const pathname=new URL(url,location.href).pathname;
      const i=pathname.indexOf(marker);
      return i>=0?pathname.slice(i+marker.length).split('/').map(decodeURIComponent).join('/'):'';
    }catch(e){return ''}
  }
  function validImage(file){return file&&['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size<=5*1024*1024}
  function editPhotoStatus(text,bad=false){
    const el=$('#edit-photo-status');if(!el)return;el.textContent=text||'';el.className='status'+(bad?' bad':'');
  }
  async function getEditSupplierId(){
    if(editSupplierId)return editSupplierId;
    const uid=IZZY.session()?.user?.id;if(!uid)return null;
    const rows=await IZZY.request(`/rest/v1/suppliers?select=id&profile_id=eq.${encodeURIComponent(uid)}&limit=1`);
    editSupplierId=rows?.[0]?.id||null;return editSupplierId;
  }
  async function getProductImages(productId){
    return await IZZY.request(`/rest/v1/product_images?select=id,product_id,url,position&product_id=eq.${encodeURIComponent(productId)}&order=position.asc`);
  }
  async function syncVariantImageUrls(productId,oldUrl,newUrl){
    const rows=await IZZY.request(`/rest/v1/product_variants?select=id,variant_image_url&product_id=eq.${encodeURIComponent(productId)}`);
    for(const row of rows||[]){
      if(row.variant_image_url===oldUrl){
        await IZZY.request(`/rest/v1/product_variants?id=eq.${encodeURIComponent(row.id)}`,{method:'PATCH',body:JSON.stringify({variant_image_url:newUrl||null,updated_at:new Date().toISOString()})});
      }
    }
  }
  function refreshEditVariantPhotoSelects(images){
    document.querySelectorAll('#edit-variant-list [data-edit-variant-image]').forEach(select=>{
      const current=select.value;
      select.innerHTML='<option value="">Use main photo</option>'+images.map((img,i)=>`<option value="${IZZY.esc(img.url)}">Photo ${i+1}</option>`).join('');
      if([...select.options].some(o=>o.value===current))select.value=current;
    });
  }
  async function renderEditPhotos(){
    const productId=$('#edit-product-id')?.value;
    const grid=$('#edit-photo-grid');if(!productId||!grid)return;
    const images=await getProductImages(productId);
    grid.innerHTML=(images||[]).map((img,i)=>`<div class="edit-photo-item" data-edit-photo-id="${img.id}">
      <img src="${IZZY.esc(img.url)}" alt="Product photo ${i+1}">
      <div><span>${i===0?'Main photo':`Photo ${i+1}`}</span><span class="edit-photo-actions"><button type="button" data-replace-edit-photo="${img.id}">Replace</button><button type="button" data-remove-edit-photo="${img.id}">Remove</button></span></div>
    </div>`).join('')||'<div class="notice">No photos saved for this product yet.</div>';
    refreshEditVariantPhotoSelects(images||[]);
    grid.querySelectorAll('[data-replace-edit-photo]').forEach(btn=>btn.onclick=()=>{
      replaceImage=(images||[]).find(x=>String(x.id)===String(btn.dataset.replaceEditPhoto))||null;
      $('#edit-photo-replace-input').click();
    });
    grid.querySelectorAll('[data-remove-edit-photo]').forEach(btn=>btn.onclick=async()=>{
      const img=(images||[]).find(x=>String(x.id)===String(btn.dataset.removeEditPhoto));if(!img)return;
      if(!confirm('Remove this product photo?'))return;
      btn.disabled=true;editPhotoStatus('Removing photo…');
      try{
        await syncVariantImageUrls(productId,img.url,null);
        await IZZY.request(`/rest/v1/product_images?id=eq.${encodeURIComponent(img.id)}`,{method:'DELETE'});
        const path=storagePathFromUrl(img.url);if(path)await IZZY.deleteProductImage(path);
        const remaining=(await getProductImages(productId))||[];
        for(let i=0;i<remaining.length;i++)if(Number(remaining[i].position)!==i)await IZZY.request(`/rest/v1/product_images?id=eq.${encodeURIComponent(remaining[i].id)}`,{method:'PATCH',body:JSON.stringify({position:i})});
        editPhotoStatus('Photo removed.');await renderEditPhotos();
      }catch(err){editPhotoStatus(err.message,true);btn.disabled=false}
    });
  }
  async function uploadEditPhoto(file,replace=null){
    if(!validImage(file))throw Error('Use a JPG, PNG, or WebP image up to 5 MB.');
    const productId=$('#edit-product-id')?.value;if(!productId)throw Error('Open a product first.');
    const supplierId=await getEditSupplierId();if(!supplierId)throw Error('Supplier account not found.');
    const images=await getProductImages(productId);
    if(!replace&&(images?.length||0)>=6)throw Error('A product can have up to 6 photos.');
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
    const path=`${supplierId}/${productId}/edit-${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`;
    const url=await IZZY.uploadProductImage(path,file);
    if(replace){
      await IZZY.request(`/rest/v1/product_images?id=eq.${encodeURIComponent(replace.id)}`,{method:'PATCH',body:JSON.stringify({url})});
      await syncVariantImageUrls(productId,replace.url,url);
      const oldPath=storagePathFromUrl(replace.url);if(oldPath)await IZZY.deleteProductImage(oldPath);
      editPhotoStatus('Photo replaced.');
    }else{
      await IZZY.request('/rest/v1/product_images',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({product_id:productId,url,position:(images||[]).length})});
      editPhotoStatus('Photo added.');
    }
    await renderEditPhotos();
  }

  function installSimpleEditPhotos(){
    const variants=$('.edit-variants-section');if(!variants||$('#edit-photo-simple'))return;
    const section=document.createElement('div');
    section.id='edit-photo-simple';section.className='edit-simple-photos';
    section.innerHTML=`<div class="row"><div><b>Product photos</b><small>Add, replace, or remove photos here.</small></div><label class="btn secondary" for="edit-photo-add-input">Add photo</label></div>
      <input id="edit-photo-add-input" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>
      <input id="edit-photo-replace-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>
      <div id="edit-photo-grid" class="edit-photo-grid"></div><div id="edit-photo-status" class="status"></div>`;
    variants.parentNode.insertBefore(section,variants);
    const style=document.createElement('style');
    style.textContent=`.edit-simple-photos{display:grid;gap:12px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--soft)}.edit-simple-photos>.row{align-items:center}.edit-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}.edit-photo-item{overflow:hidden;border:1px solid var(--line);border-radius:12px;background:var(--card)}.edit-photo-item img{width:100%;height:110px;object-fit:cover;display:block}.edit-photo-item>div{display:grid;gap:6px;padding:8px}.edit-photo-item span{font-size:10px;font-weight:800}.edit-photo-actions{display:flex;gap:8px}.edit-photo-actions button{padding:0;border:0;background:none;color:var(--muted);font:inherit;font-size:9px;font-weight:850;cursor:pointer}.edit-photo-actions button:hover{color:var(--text)}@media(max-width:520px){.edit-photo-grid{grid-template-columns:1fr 1fr}}`;
    document.head.appendChild(style);
    $('#edit-photo-add-input').onchange=async e=>{
      const files=[...e.target.files];e.target.value='';if(!files.length)return;
      editPhotoStatus('Adding photo…');
      try{for(const file of files)await uploadEditPhoto(file,null)}catch(err){editPhotoStatus(err.message,true)}
    };
    $('#edit-photo-replace-input').onchange=async e=>{
      const file=e.target.files?.[0];e.target.value='';if(!file||!replaceImage)return;
      const target=replaceImage;replaceImage=null;editPhotoStatus('Replacing photo…');
      try{await uploadEditPhoto(file,target)}catch(err){editPhotoStatus(err.message,true)}
    };
    const modal=$('#product-edit-modal');
    if(modal){
      new MutationObserver(()=>{if(!modal.hidden)setTimeout(()=>renderEditPhotos().catch(err=>editPhotoStatus(err.message,true)),0)}).observe(modal,{attributes:true,attributeFilter:['hidden']});
    }
    document.addEventListener('click',e=>{if(e.target.closest?.('.edit-product-btn'))setTimeout(()=>renderEditPhotos().catch(err=>editPhotoStatus(err.message,true)),0)},true);
  }

  installPhotoTracking();
  stripVariantUiAndRoute();
  installSimpleEditPhotos();
  restoreSingleDraftIfNeeded().catch(console.warn);
})();
