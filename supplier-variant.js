(()=>{
  const $=s=>document.querySelector(s);
  const DRAFT_KEY='izzy_variant_product_draft_v1';
  const DB_NAME='izzy_product_drafts_v1';
  const STORE='files';
  const MAX_FILES=6;
  const MAX_OPTIONS=3;
  const MAX_VARIANTS=100;
  let supplier=null;
  let categories=[];
  let files=[];
  let variantState=new Map();
  let generatedSignature='';

  const status=(text,bad=false)=>{const el=$('#variant-status');if(el){el.textContent=text||'';el.className='status variant-status'+(bad?' bad':'')}};

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  async function saveDraftFiles(list){
    try{
      const db=await openDb();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(list,'variant-draft-files');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });db.close();
    }catch(e){console.warn('Could not save draft photos',e)}
  }
  async function loadDraftFiles(){
    try{
      const db=await openDb();
      const result=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get('variant-draft-files');req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)});
      db.close();return Array.isArray(result)?result:[];
    }catch(e){return []}
  }
  async function clearDraftFiles(){
    try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete('variant-draft-files');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch(e){}
  }

  function categoryOptions(){
    return '<option value="">Choose category</option>'+categories.map(c=>`<option value="${c.id}">${IZZY.esc(c.name||c.name_ar||'Category')}</option>`).join('');
  }

  function optionRows(){return [...document.querySelectorAll('[data-v-option-row]')]}
  function parseValues(raw){
    const seen=new Set();
    return String(raw||'').split(/[,;\n]+/).map(v=>v.trim()).filter(v=>{if(!v)return false;const k=v.toLowerCase();if(seen.has(k))return false;seen.add(k);return true});
  }
  function getDefinitions(strict=false){
    const rows=optionRows();
    if(strict&&!rows.length)throw Error('Add at least one option such as Color or Size.');
    if(rows.length>MAX_OPTIONS)throw Error('Use no more than 3 option types.');
    const defs=rows.map((row,i)=>({name:row.querySelector('[data-v-option-name]').value.trim(),values:parseValues(row.querySelector('[data-v-option-values]').value)}));
    if(strict){
      const names=new Set();
      defs.forEach((def,i)=>{
        if(!def.name)throw Error(`Name option ${i+1}.`);
        if(!def.values.length)throw Error(`Add at least one value for ${def.name}.`);
        const key=def.name.toLowerCase();if(names.has(key))throw Error(`Option “${def.name}” is duplicated.`);names.add(key);
      });
    }
    return defs.filter(d=>d.name||d.values.length);
  }
  function signature(defs=getDefinitions(false)){return JSON.stringify(defs.map(d=>[d.name.toLowerCase(),d.values.map(v=>v.toLowerCase())]))}
  function combinations(defs){return defs.reduce((rows,def)=>rows.flatMap(row=>def.values.map(value=>({...row,[def.name]:value}))),[{}])}
  function keyFor(options){return JSON.stringify(Object.entries(options).map(([k,v])=>[k.toLowerCase(),String(v).toLowerCase()]))}

  function captureVariantState(){
    document.querySelectorAll('[data-v-variant-row]').forEach(row=>{
      variantState.set(row.dataset.key,{
        enabled:row.querySelector('[data-v-enabled]').checked,
        stock:row.querySelector('[data-v-stock]').value,
        imageIndex:row.querySelector('[data-v-image]').value,
        cost:row.querySelector('[data-v-cost]')?.value||'',
        retail:row.querySelector('[data-v-retail]')?.value||''
      });
    });
  }

  function photoOptions(selected=''){
    return '<option value="">Use main photo</option>'+files.map((f,i)=>`<option value="${i}" ${String(selected)===String(i)?'selected':''}>Photo ${i+1}</option>`).join('');
  }
  function refreshPhotoSelects(){
    document.querySelectorAll('[data-v-image]').forEach(select=>{
      const current=select.value;select.innerHTML=photoOptions(current);if([...select.options].some(o=>o.value===current))select.value=current;
    });
  }
  function renderPhotos(){
    const grid=$('#v-photo-grid');
    if(!files.length){grid.innerHTML='<div class="variant-photo-empty">No photos yet.</div>';refreshPhotoSelects();return}
    grid.innerHTML=files.map((file,i)=>`<div class="variant-photo"><img src="${URL.createObjectURL(file)}" alt=""><div class="variant-photo-foot"><span>${i===0?'Main photo':`Photo ${i+1}`}</span><span>${i>0?`<button type="button" data-v-main-photo="${i}">Make main</button>`:''}<button type="button" data-v-remove-photo="${i}">Remove</button></span></div></div>`).join('');
    grid.querySelectorAll('[data-v-remove-photo]').forEach(btn=>btn.onclick=()=>{
      const index=Number(btn.dataset.vRemovePhoto);
      captureVariantState();
      for(const state of variantState.values()){
        if(state.imageIndex==='')continue;
        const n=Number(state.imageIndex);
        state.imageIndex=n===index?'':String(n>index?n-1:n);
      }
      files.splice(index,1);renderPhotos();renderVariantsFromCurrentState();
    });
    grid.querySelectorAll('[data-v-main-photo]').forEach(btn=>btn.onclick=()=>{
      const index=Number(btn.dataset.vMainPhoto);if(index<=0||index>=files.length)return;
      captureVariantState();
      for(const state of variantState.values()){
        if(state.imageIndex==='')continue;
        const n=Number(state.imageIndex);
        if(n===index)state.imageIndex='0';else if(n<index)state.imageIndex=String(n+1);
      }
      const [file]=files.splice(index,1);files.unshift(file);renderPhotos();renderVariantsFromCurrentState();
    });
    refreshPhotoSelects();
  }
  function addFiles(incoming){
    const list=[...(incoming||[])];if(!list.length)return;
    const bad=list.find(file=>!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024);
    if(bad){status('Photos must be JPG, PNG, or WebP and no larger than 5 MB each.',true);return}
    const merged=[...files];
    list.forEach(file=>{if(!merged.some(x=>x.name===file.name&&x.size===file.size&&x.lastModified===file.lastModified))merged.push(file)});
    if(merged.length>MAX_FILES){status('You can add up to 6 product photos.',true);return}
    files=merged;renderPhotos();status('');
  }

  function addOption(type='custom',values=[]){
    if(optionRows().length>=MAX_OPTIONS){status('You can use up to 3 option types.',true);return}
    const existing=new Set(optionRows().map(r=>r.querySelector('[data-v-option-name]').value.trim().toLowerCase()).filter(Boolean));
    if(type!=='custom'&&existing.has(type.toLowerCase()))return;
    const row=document.createElement('div');row.className='variant-option-row';row.dataset.vOptionRow='1';
    const preset=type==='custom'?'':type;
    row.innerHTML=`<div class="field"><label class="field-label">Option name</label><input data-v-option-name value="${IZZY.esc(preset)}" ${preset?'readonly':''} placeholder="e.g. Volume"></div><div class="field"><label class="field-label">Values</label><input data-v-option-values value="${IZZY.esc(values.join(', '))}" placeholder="Separate values with commas"></div><button class="variant-option-remove" type="button" aria-label="Remove option">×</button>`;
    row.querySelector('.variant-option-remove').onclick=()=>{row.remove();generatedSignature='';$('#v-variant-list').innerHTML='<div class="notice">Options changed. Build variants again.</div>';updateBuildNote()};
    row.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{generatedSignature='';updateBuildNote()}));
    $('#v-option-list').appendChild(row);updateBuildNote();row.querySelector(preset?'[data-v-option-values]':'[data-v-option-name]').focus();
  }

  function updateBuildNote(){
    const note=$('#v-build-note');
    try{
      const defs=getDefinitions(false);
      if(!defs.length||defs.some(d=>!d.name||!d.values.length)){note.textContent='Add an option and its values first.';return}
      const count=defs.reduce((n,d)=>n*d.values.length,1);
      note.textContent=count>MAX_VARIANTS?`${count} variants is too many. Keep it to ${MAX_VARIANTS} or fewer.`:`${count} variants will be created.`;
    }catch(e){note.textContent=e.message}
  }

  function renderVariantsFromCurrentState(){
    if(!generatedSignature)return;
    let defs;
    try{defs=getDefinitions(true)}catch(e){return}
    if(signature(defs)!==generatedSignature)return;
    const combos=combinations(defs),vary=$('#v-vary-prices').checked;
    const list=$('#v-variant-list');
    list.innerHTML=combos.map(combo=>{
      const key=keyFor(combo),state=variantState.get(key)||{enabled:true,stock:'0',imageIndex:'',cost:$('#v-cost').value||'',retail:$('#v-retail').value||''};
      variantState.set(key,state);
      const label=Object.values(combo).join(' / '),full=Object.entries(combo).map(([k,v])=>`${k}: ${v}`).join(' · ');
      return `<div class="variant-row ${state.enabled===false?'is-disabled':''} ${vary?'show-price':''}" data-v-variant-row data-key="${IZZY.esc(key)}"><div class="variant-row-name"><b>${IZZY.esc(label)}</b><small>${IZZY.esc(full)}</small></div><label><span>Available</span><input data-v-enabled type="checkbox" ${state.enabled===false?'':'checked'}></label><label><span>Stock</span><input data-v-stock type="number" min="0" step="1" value="${IZZY.esc(state.stock??'0')}"></label><label><span>Photo</span><select data-v-image>${photoOptions(state.imageIndex??'')}</select></label><div class="variant-pricing-fields"><label><span>Supplier price</span><input data-v-cost type="number" min="0" step="0.01" value="${IZZY.esc(state.cost||$('#v-cost').value||'')}"></label><label><span>Suggested sell</span><input data-v-retail type="number" min="0" step="0.01" value="${IZZY.esc(state.retail||$('#v-retail').value||'')}"></label></div></div>`;
    }).join('');
    list.querySelectorAll('[data-v-variant-row]').forEach(row=>{
      const enabled=row.querySelector('[data-v-enabled]');enabled.onchange=()=>{row.classList.toggle('is-disabled',!enabled.checked);captureVariantState()};
      row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',captureVariantState));
      row.querySelectorAll('select').forEach(el=>el.addEventListener('change',captureVariantState));
    });
  }

  function buildVariants(){
    try{
      captureVariantState();
      const defs=getDefinitions(true),combos=combinations(defs);
      if(combos.length>MAX_VARIANTS)throw Error(`That creates ${combos.length} variants. Keep it to ${MAX_VARIANTS} or fewer.`);
      generatedSignature=signature(defs);renderVariantsFromCurrentState();status('');
      $('#v-build-note').textContent=`${combos.length} variants built. Enter stock for each available version.`;
    }catch(err){status(err.message,true)}
  }

  function collectVariants(){
    const defs=getDefinitions(true);
    if(signature(defs)!==generatedSignature)throw Error('Build the variants again before publishing.');
    captureVariantState();
    const combos=combinations(defs),vary=$('#v-vary-prices').checked;
    const variants=combos.map(combo=>{
      const state=variantState.get(keyFor(combo))||{enabled:true,stock:'0',imageIndex:'',cost:'',retail:''};
      const enabled=state.enabled!==false,stock=Number(state.stock||0);
      if(enabled&&(!Number.isFinite(stock)||stock<0))throw Error(`Enter valid stock for ${Object.values(combo).join(' / ')}.`);
      let cost=null,retail=null;
      if(vary&&enabled){
        cost=state.cost===''?null:Number(state.cost);retail=state.retail===''?null:Number(state.retail);
        if(cost==null||!Number.isFinite(cost)||cost<0)throw Error(`Enter the supplier price for ${Object.values(combo).join(' / ')}.`);
        if(retail==null||!Number.isFinite(retail)||retail<cost)throw Error(`Enter a valid suggested selling price for ${Object.values(combo).join(' / ')}.`);
      }
      return {name:Object.values(combo).join(' / '),sku:null,stock:enabled?stock:0,cost,retail,weight_grams:null,image_index:state.imageIndex===''?null:Number(state.imageIndex),enabled,options:combo};
    });
    if(!variants.some(v=>v.enabled))throw Error('Keep at least one variant available.');
    return variants;
  }

  function sharedDraft(){
    return {name_en:$('#v-name-en').value||'',name_ar:$('#v-name-ar').value||'',description_en:$('#v-description-en').value||'',description_ar:$('#v-description-ar').value||'',category_id:$('#v-category').value||'',sku:$('#v-sku').value||'',cost:$('#v-cost').value||'',retail:$('#v-retail').value||''};
  }
  async function saveForBack(){
    try{sessionStorage.setItem(DRAFT_KEY,JSON.stringify(sharedDraft()))}catch(e){}
    await saveDraftFiles(files);
  }
  async function restoreDraft(){
    let draft=null;try{draft=JSON.parse(sessionStorage.getItem(DRAFT_KEY)||'null')}catch(e){}
    if(draft){
      $('#v-name-en').value=draft.name_en||'';$('#v-name-ar').value=draft.name_ar||'';$('#v-description-en').value=draft.description_en||'';$('#v-description-ar').value=draft.description_ar||'';$('#v-sku').value=draft.sku||'';$('#v-cost').value=draft.cost||'';$('#v-retail').value=draft.retail||'';$('#v-category').value=draft.category_id||'';
    }
    files=await loadDraftFiles();renderPhotos();
  }

  async function verify(){
    const session=IZZY.session();
    if(!session?.user?.id){location.href='login.html';return false}
    let rows=await IZZY.request(`/rest/v1/suppliers?select=id,business_name,status&profile_id=eq.${encodeURIComponent(session.user.id)}&limit=1`);
    supplier=rows?.[0];
    if(!supplier){
      const prof=await IZZY.request(`/rest/v1/profiles?select=business_name,requested_account_type&id=eq.${encodeURIComponent(session.user.id)}&limit=1`);
      if(prof?.[0]?.requested_account_type==='supplier'){
        const created=await IZZY.request('/rest/v1/suppliers',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({profile_id:session.user.id,business_name:prof[0].business_name||session.user.email,status:'pending'})});supplier=created?.[0];
      }
    }
    if(!supplier){location.href='login.html';return false}
    if(supplier.status!=='approved'){$('#variant-gate-message').textContent=supplier.status==='pending'?'Your IzzyDrop supplier application is waiting for admin approval.':`Your supplier account is ${supplier.status}.`;return false}
    categories=await IZZY.request('/rest/v1/categories?select=id,name,name_ar&order=name.asc');
    $('#v-category').innerHTML=categoryOptions();
    await restoreDraft();
    $('#variant-gate').hidden=true;$('#variant-app').hidden=false;return true;
  }

  $('#v-images').onchange=e=>{addFiles(e.target.files);e.target.value=''};
  document.querySelectorAll('[data-add-option]').forEach(btn=>btn.onclick=()=>addOption(btn.dataset.addOption));
  $('#v-build').onclick=buildVariants;
  $('#v-vary-prices').onchange=()=>{captureVariantState();renderVariantsFromCurrentState()};
  ['#v-cost','#v-retail'].forEach(sel=>$(sel).addEventListener('input',()=>{
    if(!$('#v-vary-prices').checked)return;
    captureVariantState();
    for(const state of variantState.values()){
      if(!state.cost)state.cost=$('#v-cost').value;
      if(!state.retail)state.retail=$('#v-retail').value;
    }
    renderVariantsFromCurrentState();
  }));
  $('#back-single').onclick=async()=>{await saveForBack();location.href='supplier.html?view=add&restore=1'};

  $('#variant-form').onsubmit=async e=>{
    e.preventDefault();
    const btn=$('#v-publish');
    try{
      const nameEn=$('#v-name-en').value.trim(),nameAr=$('#v-name-ar').value.trim()||null,descEn=$('#v-description-en').value.trim()||null,descAr=$('#v-description-ar').value.trim()||null;
      if(!nameEn&&!nameAr)throw Error('Enter the product name.');
      if(!$('#v-category').value)throw Error('Choose a product category.');
      if(!files.length)throw Error('Add at least one product photo.');
      const cost=Number($('#v-cost').value),retail=Number($('#v-retail').value);
      if(!Number.isFinite(cost)||cost<0)throw Error('Enter your supplier price.');
      if(!Number.isFinite(retail)||retail<cost)throw Error('Suggested selling price must be at least your supplier price.');
      const variants=collectVariants();
      btn.disabled=true;btn.textContent='Publishing…';status('Creating product…');
      const result=await IZZY.rpc('supplier_create_product_v2',{_name_en:nameEn||null,_name_ar:nameAr,_description_en:descEn,_description_ar:descAr,_source_language:nameEn?'en':'ar',_sku:$('#v-sku').value.trim()||null,_cost:cost,_retail:retail,_currency:'EGP',_variants:variants,_category_id:$('#v-category').value,_shipping_cost:0});
      const pid=result.product_id,uploadedUrls=[];
      for(let i=0;i<files.length;i++){
        btn.textContent=`Uploading photo ${i+1} of ${files.length}…`;
        const file=files[i],ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
        const path=`${supplier.id}/${pid}/${String(i+1).padStart(2,'0')}-${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`;
        const url=await IZZY.uploadProductImage(path,file);
        await IZZY.request('/rest/v1/product_images',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({product_id:pid,url,position:i})});
        uploadedUrls[i]=url;
      }
      for(const created of (result.variants||[])){
        const source=variants[Number(created.index)],url=source?.image_index==null?null:uploadedUrls[source.image_index]||null;
        if(url)await IZZY.request(`/rest/v1/product_variants?id=eq.${encodeURIComponent(created.id)}`,{method:'PATCH',body:JSON.stringify({variant_image_url:url,updated_at:new Date().toISOString()})});
      }
      sessionStorage.removeItem(DRAFT_KEY);await clearDraftFiles();
      location.href='supplier.html?view=products&created=1';
    }catch(err){status(err.message||'Could not publish product.',true);btn.disabled=false;btn.textContent='Publish variant product'}
  };

  updateBuildNote();
  verify().catch(err=>{$('#variant-gate-message').textContent=err.message||'Could not open the variant product builder.';$('#variant-gate-message').style.color='var(--bad)'});
})();
