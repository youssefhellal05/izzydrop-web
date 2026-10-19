(()=> {
  'use strict';
  const $=s=>document.querySelector(s);
  const esc=v=>window.IZZY?.esc?IZZY.esc(v??''):String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let role=window.IZZY_SETTINGS_ROLE;
  let accountId=null, application=null;
  const tr=value=>window.IZZY_I18N?.t(value)||value;
  const status=(node,message,bad=false)=>{if(node){node.textContent=tr(message||'');node.className='status'+(bad?' bad':'')}};
  const localReviewStatus=value=>({
    'not submitted':'لم يتم الإرسال',approved:'تمت الموافقة',pending:'قيد المراجعة',
    pending_review:'قيد المراجعة',in_review:'قيد المراجعة',rejected:'مرفوض',
    changes_requested:'مطلوب إجراء تعديلات',needs_changes:'مطلوب إجراء تعديلات'
  }[String(value||'not submitted').toLowerCase()]||String(value||'not submitted').replaceAll('_',' '));
  const allowedMime={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'};
  async function upload(file,bucket,folder,kind){
    const ext=allowedMime[file?.type];
    if(!file||!ext||file.size<1||file.size>5*1024*1024)throw Error('Choose a PDF, JPG or PNG file up to 5 MB.');
    const session=IZZY.session();
    if(!session?.access_token)throw Error('Please sign in again.');
    const path=folder+'/'+kind+'-'+crypto.randomUUID()+'.'+ext;
    const response=await fetch(IZZY.config.supabaseUrl+'/storage/v1/object/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/'),{
      method:'POST',headers:{apikey:IZZY.config.supabaseKey,Authorization:'Bearer '+session.access_token,'Content-Type':file.type,'x-upsert':'false'},body:file
    });
    if(!response.ok){let data;try{data=await response.json()}catch{};throw Error(data?.message||data?.error||'Secure upload failed.');}
    return path;
  }
  function addPanel(){
    const root=$('#settings-root');
    if(!root||root.dataset.verificationAdded==='true')return false;
    const appearanceTab=root.querySelector('[data-settings-tab="appearance"]');
    const appearancePanel=root.querySelector('[data-settings-panel="appearance"]');
    if(!appearanceTab||!appearancePanel)return false;
    root.dataset.verificationAdded='true';
    appearanceTab.insertAdjacentHTML('beforebegin','<button type="button" data-settings-tab="verification">Verification</button>');
    let content='';
    if(role==='supplier'){
      content=`<section class="settings-panel" data-settings-panel="verification" hidden>
        <div class="card settings-card">
          <div class="settings-title"><div><h3>Supplier verification</h3><p class="muted">Submit your business details when you're ready. You can explore IzzyDrop first. Documents stay private and are reviewed by authorized administrators.</p></div></div>
          <div id="verify-supplier-state" class="notice">Loading verification status…</div>
          <form id="verify-supplier-form" class="form">
            <label class="field-label" for="verify-business-address">Business / warehouse address</label>
            <textarea id="verify-business-address" minlength="8" maxlength="400" rows="2" required></textarea>
            <div class="verification-map-tools">
              <label class="field-label" for="verify-map-search">Find a place on the map (optional)</label>
              <div class="form-two-col"><input id="verify-map-search" type="search" placeholder="Search business, street or landmark"><button class="btn secondary" id="verify-map-search-btn" type="button">Search map</button></div>
              <div class="form-two-col"><button class="btn secondary" id="verify-map-location-btn" type="button">Use my location</button><button class="btn secondary" id="verify-map-clear-btn" type="button">Clear map pin</button></div>
              <div id="verify-location-map" role="application" aria-label="Choose business location on map" style="height:300px;min-height:260px;border-radius:12px;overflow:hidden;background:var(--surface-2,#f3f4f6);display:none"></div>
              <small id="verify-map-hint" class="muted">Search for a place such as Buffalo Burger, or tap/drag the pin to your exact entrance. You can still type the address manually.</small>
              <small id="verify-map-coordinates" class="muted"></small>
            </div>
            <label class="field-label" for="verify-business-phone">Business contact number</label><input id="verify-business-phone" type="tel" minlength="7" maxlength="40" required>
            <label class="field-label" for="verify-registration-status">Business registration status</label><select id="verify-registration-status" required><option value="">Choose one</option><option value="registered">Registered</option><option value="in_progress">Registration in progress</option><option value="not_registered">Not yet registered</option></select>
            <div class="form-two-col"><div><label class="field-label" for="verify-registration-number">Commercial registration number</label><input id="verify-registration-number" maxlength="100"></div><div><label class="field-label" for="verify-tax-number">Tax registration number</label><input id="verify-tax-number" maxlength="100"></div></div>
            <div class="form-two-col"><div><label class="field-label" for="verify-registration-file">Commercial registration document (PDF/JPG/PNG, max 5 MB)</label><input id="verify-registration-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"><small id="verify-registration-saved" class="muted"></small></div>
            <div><label class="field-label" for="verify-tax-file">Tax card (PDF/JPG/PNG, max 5 MB)</label><input id="verify-tax-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"><small id="verify-tax-saved" class="muted"></small></div></div>
            <label class="field-label" for="verify-supplier-notes">Notes for IzzyDrop (optional)</label><textarea id="verify-supplier-notes" maxlength="1500" rows="2"></textarea>
            <button class="btn" type="submit">Submit verification</button><div id="verify-supplier-status" class="status" role="status" aria-live="polite"></div>
            <small class="muted">Registered businesses need complete commercial and tax details and documents before approval. New product publishing stays locked until verification is approved.</small>
          </form>
        </div>
      </section>`;
    } else if(role==='dropshipper'){
      content=`<section class="settings-panel" data-settings-panel="verification" hidden>
        <div class="card settings-card">
          <div class="settings-title"><div><h3>Identity verification</h3><p class="muted">Submit an ID document when you're ready. You can use IzzyDrop before this step; identity approval is required before payouts. Your document is private.</p></div></div>
          <div id="verify-dropshipper-state" class="notice">Loading verification status…</div>
          <form id="verify-dropshipper-form" class="form">
            <label class="field-label" for="verify-id-file">ID document (PDF/JPG/PNG, max 5 MB)</label><input id="verify-id-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required>
            <small id="verify-id-saved" class="muted"></small>
            <button class="btn" type="submit">Submit ID for review</button><div id="verify-dropshipper-status" class="status" role="status" aria-live="polite"></div>
          </form>
        </div>
      </section>`;
    }else return false;
    appearancePanel.insertAdjacentHTML('beforebegin',content);
    const tab=root.querySelector('[data-settings-tab="verification"]');
    tab.onclick=()=>{
      root.querySelectorAll('[data-settings-tab]').forEach(x=>x.classList.toggle('on',x===tab));
      root.querySelectorAll('[data-settings-panel]').forEach(x=>x.hidden=x.dataset.settingsPanel!=='verification');
      const shared=root.querySelector('#settings-status');if(shared)shared.textContent='';
      if(role==='supplier')loadSupplier().catch(e=>status($('#verify-supplier-status'),e.message,true));
      else loadDropshipper().catch(e=>status($('#verify-dropshipper-status'),e.message,true));
    };
    if(role==='supplier')$('#verify-supplier-form').onsubmit=submitSupplier;
    else $('#verify-dropshipper-form').onsubmit=submitDropshipper;
    return true;
  }
  async function waitForPanel(){
    // Settings markup is synchronous; retry once when settings has finished initializing.
    if(!addPanel())setTimeout(()=>{if(!addPanel())console.warn('Verification settings panel could not attach.');},300);
  }
  async function loadSupplier(){
    const uid=IZZY.session()?.user?.id;
    if(!uid)throw Error('Please sign in again.');
    const rows=await IZZY.request('/rest/v1/suppliers?select=id,status&profile_id=eq.'+encodeURIComponent(uid)+'&limit=1');
    accountId=rows?.[0]?.id||null;
    if(!accountId)throw Error('Supplier account not found.');
    const apps=await IZZY.request('/rest/v1/supplier_verification_applications?select=*&supplier_id=eq.'+encodeURIComponent(accountId)+'&limit=1');
    application=apps?.[0]||null;
    const state=$('#verify-supplier-state');
    state.textContent=(window.IZZY_I18N?.isArabic()?'الحالة: ':'Status: ')+((window.IZZY_I18N?.isArabic())?localReviewStatus(application?.review_status):String(application?.review_status||'not submitted').replaceAll('_',' '))+(application?.review_reason?' — '+application.review_reason:'');
    const values={
      'verify-business-address':application?.business_address,'verify-business-phone':application?.business_phone,
      'verify-registration-status':application?.registration_status,'verify-registration-number':application?.registration_number,
      'verify-tax-number':application?.tax_registration_number,'verify-supplier-notes':application?.supplier_notes
    };
    for(const [id,value] of Object.entries(values))if($('#'+id))$('#'+id).value=value||'';
    $('#verify-registration-saved').textContent=application?.registration_document_path?'Existing registration document saved privately.':'';
    $('#verify-tax-saved').textContent=application?.tax_document_path?'Existing tax document saved privately.':'';
    const locked=application?.review_status==='approved';
    $('#verify-supplier-form').querySelectorAll('input,select,textarea,button[type="submit"]').forEach(el=>el.disabled=locked);
  }
  async function submitSupplier(e){
    e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type="submit"]');
    button.disabled=true;
    try{
      let regPath=application?.registration_document_path||null,taxPath=application?.tax_document_path||null;
      const reg=$('#verify-registration-file').files?.[0],tax=$('#verify-tax-file').files?.[0];
      if(reg)regPath=await upload(reg,'supplier-documents',accountId,'registration');
      if(tax)taxPath=await upload(tax,'supplier-documents',accountId,'tax');
      status($('#verify-supplier-status'),'Submitting your application…');
      await IZZY.rpc('supplier_submit_verification',{
        _business_address:$('#verify-business-address').value.trim(),_business_phone:$('#verify-business-phone').value.trim(),
        _registration_status:$('#verify-registration-status').value,_registration_number:$('#verify-registration-number').value.trim()||null,
        _tax_registration_number:$('#verify-tax-number').value.trim()||null,_registration_document_path:regPath,_tax_document_path:taxPath,
        _supplier_notes:$('#verify-supplier-notes').value.trim()||null
      });
      status($('#verify-supplier-status'),'Verification submitted. IzzyDrop will review it.');
      await loadSupplier();
    }catch(err){status($('#verify-supplier-status'),err.message||'Could not submit verification.',true)}
    finally{button.disabled=false}
  }

  async function loadDropshipper(){
    const uid=IZZY.session()?.user?.id;
    if(!uid)throw Error('Please sign in again.');
    const rows=await IZZY.request('/rest/v1/dropshippers?select=id&profile_id=eq.'+encodeURIComponent(uid)+'&limit=1');
    accountId=rows?.[0]?.id||null;if(!accountId)throw Error('Dropshipper account not found.');
    const apps=await IZZY.request('/rest/v1/dropshipper_identity_verifications?select=*&dropshipper_id=eq.'+encodeURIComponent(accountId)+'&limit=1');
    application=apps?.[0]||null;
    $('#verify-dropshipper-state').textContent=(window.IZZY_I18N?.isArabic()?'الحالة: ':'Status: ')+((window.IZZY_I18N?.isArabic())?localReviewStatus(application?.review_status):String(application?.review_status||'not submitted').replaceAll('_',' '))+(application?.review_reason?' — '+application.review_reason:'');
    $('#verify-id-saved').textContent=application?.id_document_path?'An ID document is saved privately. Choose a new file to resubmit if changes are requested.':'';
    $('#verify-dropshipper-form').querySelector('[type="submit"]').disabled=application?.review_status==='approved';
  }
  async function submitDropshipper(e){
    e.preventDefault();const button=e.currentTarget.querySelector('[type="submit"]');button.disabled=true;
    try{
      const file=$('#verify-id-file').files?.[0];
      if(!file&&!application?.id_document_path)throw Error('Choose an ID document first.');
      const path=file?await upload(file,'dropshipper-identity-documents',accountId,'id'):application.id_document_path;
      status($('#verify-dropshipper-status'),'Submitting ID for review…');
      await IZZY.rpc('dropshipper_submit_identity_verification',{_id_document_path:path});
      status($('#verify-dropshipper-status'),'ID submitted. Payouts will be available after approval.');
      await loadDropshipper();
    }catch(err){status($('#verify-dropshipper-status'),err.message||'Could not submit ID.',true)}
    finally{button.disabled=false}
  }
  window.addEventListener('izzy:supplier-ready',()=>{role='supplier';waitForPanel();});
  window.addEventListener('izzy:dropshipper-ready',()=>{role='dropshipper';waitForPanel();});
  // settings.js initializes synchronously, so attach after this script loads as a fallback too.
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForPanel);else waitForPanel();
})();