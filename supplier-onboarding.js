(()=>{
  const $=s=>document.querySelector(s);
  const esc=v=>IZZY.esc(v??'');
  const endpoint='/rest/v1/supplier_onboarding_drafts';
  const cash=v=>Number(v||0).toFixed(2);
  let supplierId=null,editingDraftId=null;
  const byId=id=>document.getElementById(id);
  const banner=(id,message,bad=false)=>{const node=byId(id);if(node){node.textContent=message;node.className='status'+(bad?' bad':'')}};
  async function uploadPilotDocument(file,kind,id){
    const mime={ 'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png' };
    const extension=mime[file.type];
    if(!extension||file.size>5*1024*1024||file.size===0){
      throw Error('Documents must be PDF, JPG or PNG, and no larger than 5 MB each.');
    }
    const uuid=crypto.randomUUID();
    const path=id+'/'+kind+'-'+uuid+'.'+extension;
    const session=IZZY.session();
    if(!session?.access_token)throw Error('Please log in to upload a document.');
    const response=await fetch(IZZY.config.supabaseUrl+'/storage/v1/object/supplier-documents/'+
      path.split('/').map(encodeURIComponent).join('/'),{
      method:'POST',headers:{
        apikey:IZZY.config.supabaseKey,Authorization:'Bearer '+session.access_token,
        'Content-Type':file.type,'x-upsert':'false'
      },body:file
    });
    if(!response.ok){
      let data;try{data=await response.json()}catch{}
      throw Error(data?.message||data?.error||'Document upload failed');
    }
    return path;
  }
  async function fetchApplication(id){
    const data=await IZZY.request('/rest/v1/supplier_verification_applications?select=*&supplier_id=eq.'+encodeURIComponent(id)+'&limit=1');
    return data?.[0]||null;
  }
  async function fetchDrafts(id){
    return IZZY.request(endpoint+'?select=*&supplier_id=eq.'+encodeURIComponent(id)+'&order=created_at.desc&limit=50');
  }
  function draftFields(row={}){
    return {
      name:row.name||'',description:row.description||'',sku:row.sku||'',
      cost_price:row.cost_price??'',suggested_retail_price:row.suggested_retail_price??'',
      stock_quantity:row.stock_quantity??0
    };
  }
  function draftFormMarkup(){
    return `<form id="pilot-draft-form" class="form pilot-form">
      <h3 id="pilot-draft-form-title">Save product draft</h3>
      <label>Product name<input name="name" maxlength="150" minlength="2" required></label>
      <label>Description<textarea name="description" rows="3" maxlength="3000"></textarea></label>
      <div class="pilot-form-grid">
        <label>Supplier price (EGP)<input name="cost_price" type="number" min="0" step="0.01" required></label>
        <label>Suggested retail (EGP)<input name="suggested_retail_price" type="number" min="0" step="0.01"></label>
        <label>Stock to prepare<input name="stock_quantity" type="number" min="0" step="1" value="0" required></label>
        <label>SKU (optional)<input name="sku" maxlength="100"></label>
      </div>
      <button class="btn" type="submit">Save private draft</button>
      <button class="btn secondary" id="pilot-draft-reset" type="button">New draft</button>
      <div class="status" id="pilot-draft-status" aria-live="polite"></div>
    </form>`;
  }
  function verificationMarkup(){
    return `<form id="pilot-verification-form" class="form pilot-form">
      <h3>Supplier verification</h3>
      <p class="muted">Only IzzyDrop administrators can review this information. No national ID photo is required for this pilot.</p>
      <div id="pilot-review-state" class="notice"></div>
      <label>Business / warehouse address<textarea name="business_address" minlength="8" maxlength="400" rows="2" required></textarea></label>
      <label>Business contact number<input name="business_phone" type="tel" minlength="7" maxlength="40" required></label>
      <label>Business registration status<select name="registration_status" required>
        <option value="">Choose one</option><option value="registered">Registered</option>
        <option value="in_progress">Registration in progress</option>
        <option value="not_registered">Not yet registered</option></select></label>
      <div class="pilot-form-grid">
        <label>Commercial registration number<input name="registration_number" maxlength="100"></label>
        <label>Tax registration number<input name="tax_registration_number" maxlength="100"></label>
      </div>
      <div class="pilot-form-grid">
        <label>Commercial registration (PDF/JPG/PNG, up to 5 MB)
          <input name="registration_file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png">
          <small id="pilot-registration-uploaded" class="muted"></small></label>
        <label>Tax card (PDF/JPG/PNG, up to 5 MB)
          <input name="tax_file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png">
          <small id="pilot-tax-uploaded" class="muted"></small></label>
      </div>
      <input name="registration_document_path" type="hidden">
      <input name="tax_document_path" type="hidden">
      <label>Notes for IzzyDrop (optional)<textarea name="supplier_notes" maxlength="1500" rows="2"></textarea></label>
      <button type="submit" class="btn">Submit verification</button>
      <p class="muted">Registered suppliers must provide complete commercial and tax details before approval. Request changes will keep your account pending.</p>
      <div class="status" id="pilot-verification-status" aria-live="polite"></div>
    </form>`;
  }
  async function refreshVerification(id){
    const app=await fetchApplication(id);
    const f=byId('pilot-verification-form');
    if(!f)return;
    const state=byId('pilot-review-state');
    const status=app?.review_status||'not submitted';
    state.innerHTML='<b>Status: '+esc(status.replaceAll('_',' '))+'</b>'+
      (app?.review_reason?'<p>'+esc(app.review_reason)+'</p>':'')+
      (app?.reviewed_at?'<small>Last reviewed '+esc(new Date(app.reviewed_at).toLocaleDateString())+'</small>':'');
    if(!app)return;
    for(const name of ['business_address','business_phone','registration_status','registration_number','tax_registration_number','supplier_notes']){
      if(f.elements.namedItem(name))f.elements.namedItem(name).value=app[name]||'';
    }
    f.elements.registration_document_path.value=app.registration_document_path||'';
    f.elements.tax_document_path.value=app.tax_document_path||'';
    byId('pilot-registration-uploaded').textContent=app.registration_document_path?'Existing registration document saved privately.':'';
    byId('pilot-tax-uploaded').textContent=app.tax_document_path?'Existing tax document saved privately.':'';
    const locked=status==='approved';
    f.querySelectorAll('input,select,textarea,button[type="submit"]').forEach(el=>el.disabled=locked);
  }
  function fillDraft(form,row){
    for(const [key,val] of Object.entries(draftFields(row))){
      const el=form.elements.namedItem(key);
      if(el)el.value=String(val);
    }
  }
  async function refreshDraftList(id){
    const rows=await fetchDrafts(id);
    const list=byId('pilot-draft-list');
    if(!list)return;
    list.innerHTML=rows?.length?rows.map(x=>`<div class="pilot-draft-row">
      <div><b>${esc(x.name)}</b><small>${esc(x.sku||'No SKU')} · ${esc(x.stock_quantity)} units · EGP ${esc(cash(x.cost_price))}</small></div>
      <button type="button" class="btn secondary" data-pilot-edit="${esc(x.id)}">Edit</button>
      <button type="button" class="btn secondary" data-pilot-delete="${esc(x.id)}">Delete</button>
      </div>`).join(''):'<p class="muted">No drafts yet. Save the first product below.</p>';
    list.querySelectorAll('[data-pilot-edit]').forEach(b=>b.onclick=()=>{
      const row=rows.find(x=>x.id===b.dataset.pilotEdit);
      if(!row)return;
      editingDraftId=row.id;
      fillDraft(byId('pilot-draft-form'),row);
      byId('pilot-draft-form-title').textContent='Edit private draft';
      byId('pilot-draft-form').scrollIntoView({behavior:'smooth',block:'center'});
    });
    list.querySelectorAll('[data-pilot-delete]').forEach(b=>b.onclick=async()=>{
      if(!confirm('Delete this private draft?'))return;
      b.disabled=true;
      try{
        await IZZY.request(endpoint+'?id=eq.'+encodeURIComponent(b.dataset.pilotDelete)+'&supplier_id=eq.'+encodeURIComponent(id),{method:'DELETE'});
        if(editingDraftId===b.dataset.pilotDelete)resetDraft();
        await refreshDraftList(id);
      }catch(e){banner('pilot-draft-status',e.message,true);b.disabled=false}
    });
  }
  function resetDraft(){
    editingDraftId=null;
    const form=byId('pilot-draft-form');
    if(form){form.reset();byId('pilot-draft-form-title').textContent='Save product draft'}
  }
  async function initPending(detail){
    if(detail.status!=='pending')return;
    supplierId=detail.supplierId;
    const gate=byId('gate'),card=gate?.querySelector('.auth-card');
    if(!card)return;
    gate.classList.add('pilot-gate');
    card.classList.add('pilot-onboarding-card');
    const section=document.createElement('div');
    section.id='pilot-onboarding';
    section.innerHTML=`<div class="pilot-onboarding-heading"><h2>Prepare for your IzzyDrop pilot</h2>
      <p class="muted">Submit business details for manual review and prepare unpublished product drafts. Orders, public listings and payouts stay locked until approval.</p></div>
      <div class="pilot-grid">
        <section class="card pilot-panel">${verificationMarkup()}</section>
        <section class="card pilot-panel"><h3>Your private product drafts</h3>
          <p class="muted">These drafts are private preparation notes, not live marketplace products. After approval you can import one into the normal product form to add photos, variants and publish.</p>
          <div id="pilot-draft-list" class="pilot-draft-list"></div>${draftFormMarkup()}</section>
      </div>`;
    card.appendChild(section);
    byId('pilot-verification-form').onsubmit=async ev=>{
      ev.preventDefault();
      const f=ev.currentTarget,button=f.querySelector('button[type="submit"]');
      button.disabled=true;
      try{
        const regFile=f.elements.registration_file.files?.[0];
        const taxFile=f.elements.tax_file.files?.[0];
        let regPath=f.elements.registration_document_path.value||null;
        let taxPath=f.elements.tax_document_path.value||null;
        if(regFile){
          banner('pilot-verification-status','Uploading commercial registration securely…');
          regPath=await uploadPilotDocument(regFile,'registration',supplierId);
          f.elements.registration_document_path.value=regPath;
        }
        if(taxFile){
          banner('pilot-verification-status','Uploading tax card securely…');
          taxPath=await uploadPilotDocument(taxFile,'tax',supplierId);
          f.elements.tax_document_path.value=taxPath;
        }
        banner('pilot-verification-status','Submitting verification…');
        await IZZY.rpc('supplier_submit_verification',{
          _business_address:f.elements.business_address.value.trim(),
          _business_phone:f.elements.business_phone.value.trim(),
          _registration_status:f.elements.registration_status.value,
          _registration_number:f.elements.registration_number.value.trim()||null,
          _tax_registration_number:f.elements.tax_registration_number.value.trim()||null,
          _registration_document_path:regPath,
          _tax_document_path:taxPath,
          _supplier_notes:f.elements.supplier_notes.value.trim()||null
        });
        banner('pilot-verification-status','Verification submitted. IzzyDrop will review your details.');
        await refreshVerification(supplierId);
      }catch(e){banner('pilot-verification-status',e.message,true)}
      finally{button.disabled=false}
    };
    byId('pilot-draft-reset').onclick=resetDraft;
    byId('pilot-draft-form').onsubmit=async ev=>{
      ev.preventDefault();
      const f=ev.currentTarget,button=f.querySelector('[type="submit"]');
      const raw=Object.fromEntries(new FormData(f));
      const payload={
        supplier_id:supplierId,name:String(raw.name).trim(),
        description:String(raw.description||'').trim(),
        sku:String(raw.sku||'').trim()||null,
        cost_price:Number(raw.cost_price),suggested_retail_price:raw.suggested_retail_price===''?null:Number(raw.suggested_retail_price),
        stock_quantity:Number(raw.stock_quantity)
      };
      if(!Number.isFinite(payload.cost_price)||!Number.isInteger(payload.stock_quantity)){banner('pilot-draft-status','Enter valid numbers.',true);return}
      button.disabled=true;
      try{
        if(editingDraftId){
          await IZZY.request(endpoint+'?id=eq.'+encodeURIComponent(editingDraftId)+'&supplier_id=eq.'+encodeURIComponent(supplierId),{
            method:'PATCH',body:JSON.stringify(payload)
          });
        }else{
          await IZZY.request(endpoint,{method:'POST',body:JSON.stringify(payload)});
        }
        resetDraft();
        banner('pilot-draft-status','Saved privately. Nothing has been published.');
        await refreshDraftList(supplierId);
      }catch(e){banner('pilot-draft-status',e.message,true)}
      finally{button.disabled=false}
    };
    const loaded=await Promise.allSettled([refreshVerification(supplierId),refreshDraftList(supplierId)]);
    if(loaded.some(x=>x.status==='rejected')){
      banner('pilot-verification-status','Onboarding cannot load until the pilot database migration has been deployed. Existing accounts are unaffected.',true);
    }
  }
  async function showApprovedDrafts(detail){
    const panel=byId('view-add');
    if(!panel||byId('pilot-import-card'))return;
    const rows=await fetchDrafts(detail.supplierId).catch(()=>[]);
    if(!rows?.length)return;
    const card=document.createElement('div');
    card.id='pilot-import-card';
    card.className='card pilot-import-card';
    card.innerHTML='<h3>Prepared pilot drafts</h3><p class="muted">Choose a saved draft to prefill this form. Add a category, photos and any variants before publishing.</p>'+
      rows.map((r,i)=>'<button type="button" class="btn secondary" data-pilot-import="'+i+'">'+esc(r.name)+'</button>').join(' ');
    panel.insertBefore(card,byId('add-form'));
    card.querySelectorAll('[data-pilot-import]').forEach(b=>b.onclick=()=>{
      const row=rows[Number(b.dataset.pilotImport)];
      if(!row)return;
      const setters={
        'p-name-en':row.name,'p-description-en':row.description,'p-cost':row.cost_price,
        'p-retail':row.suggested_retail_price,'p-sku':row.sku
      };
      for(const [id,value] of Object.entries(setters)){
        const input=byId(id);
        if(input){input.value=value??'';input.dispatchEvent(new Event('input',{bubbles:true}))}
      }
      card.querySelector('p').textContent='Draft loaded. Complete the required category and photos, then review pricing and inventory before creating the real product.';
      panel.scrollIntoView({behavior:'smooth',block:'start'});
    });
  }
  window.addEventListener('izzy:supplier-pending',event=>initPending(event.detail).catch(e=>console.warn('Pilot onboarding unavailable',e)));
  window.addEventListener('izzy:supplier-ready',event=>showApprovedDrafts(event.detail).catch(e=>console.warn('Pilot drafts unavailable',e)));
})();