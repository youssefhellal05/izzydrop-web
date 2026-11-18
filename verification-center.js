(()=> {
  'use strict';
  const $=s=>document.querySelector(s);
  let role=window.IZZY_SETTINGS_ROLE,accountId=null,application=null;
  const isAr=()=>window.IZZY_I18N?.isArabic?.()===true;
  const local=(en,ar)=>isAr()?ar:en;
  const note=(node,en,ar,bad=false)=>{if(node){node.textContent=local(en,ar);node.className='status'+(bad?' bad':'')}};
  const statusName=v=>{
    const key=String(v||'not submitted').toLowerCase();
    const ar={'not submitted':'لم يتم الإرسال',submitted:'تم الإرسال',approved:'تمت الموافقة',pending:'قيد المراجعة',rejected:'مرفوض',needs_changes:'مطلوب إجراء تعديلات'};
    return isAr()?(ar[key]||key.replaceAll('_',' ')):key.replaceAll('_',' ');
  };
  const mime={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'};
  async function upload(file,bucket,folder,kind){
    const ext=mime[file?.type];
    if(!file||!ext||file.size<1||file.size>5*1024*1024)throw Error(local('Choose a PDF, JPG or PNG file up to 5 MB.','اختر ملف PDF أو JPG أو PNG بحجم لا يتجاوز 5 ميجابايت.'));
    const session=IZZY.session();if(!session?.access_token)throw Error(local('Please sign in again.','يرجى تسجيل الدخول مرة أخرى.'));
    const path=folder+'/'+kind+'-'+crypto.randomUUID()+'.'+ext;
    const response=await fetch(IZZY.config.supabaseUrl+'/storage/v1/object/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/'),{
      method:'POST',headers:{apikey:IZZY.config.supabaseKey,Authorization:'Bearer '+session.access_token,'Content-Type':file.type,'x-upsert':'false'},body:file
    });
    if(!response.ok){let data;try{data=await response.json()}catch{};throw Error(data?.message||data?.error||local('Secure upload failed.','فشل رفع الملف بشكل آمن.'));}
    return path;
  }
  function addPanel(){
    const root=$('#settings-root');
    if(!root||root.dataset.verificationAdded==='true')return false;
    const tabBase=root.querySelector('[data-settings-tab="appearance"]'),panelBase=root.querySelector('[data-settings-panel="appearance"]');
    if(!tabBase||!panelBase)return false;
    root.dataset.verificationAdded='true';
    tabBase.insertAdjacentHTML('beforebegin','<button type="button" data-settings-tab="verification">'+local('Verification','التحقق')+'</button>');
    let markup='';
    if(role==='supplier'){
      markup=[
        '<section class="settings-panel" data-settings-panel="verification" hidden><div class="card settings-card">',
        '<div class="settings-title"><div><h3>'+local('Supplier verification','التحقق من المورد')+'</h3><p class="muted">'+local('Browse IzzyDrop while your application is reviewed. Complete these details for manual approval. Documents are stored privately.','يمكنك تصفح IzzyDrop أثناء مراجعة طلبك. أكمل البيانات للمراجعة اليدوية. تُحفظ المستندات بشكل خاص.')+'</p></div></div>',
        '<div id="verify-supplier-state" class="notice">'+local('Loading verification status…','جارٍ تحميل حالة التحقق…')+'</div><form id="verify-supplier-form" class="form">',
        '<label class="field-label" for="verify-legal-name">'+local('Full legal name','الاسم القانوني بالكامل')+'</label><input id="verify-legal-name" autocomplete="name" maxlength="120" required>',
        '<label class="field-label" for="verify-business-address">'+local('Business / warehouse address','عنوان النشاط التجاري / المخزن')+'</label><textarea id="verify-business-address" minlength="8" maxlength="400" rows="2" required></textarea>',
        '<label class="field-label" for="verify-business-maps">'+local('Google Maps link (optional)','رابط Google Maps (اختياري)')+'</label><input id="verify-business-maps" type="url" maxlength="500" placeholder="https://maps.app.goo.gl/...">',
        '<label class="field-label" for="verify-business-phone">'+local('Business contact phone','رقم هاتف التواصل الخاص بالنشاط')+'</label><input id="verify-business-phone" type="tel" minlength="7" maxlength="40" autocomplete="tel" required>',
        '<label class="field-label" for="verify-registration-status">'+local('Business registration status','حالة تسجيل النشاط')+'</label><select id="verify-registration-status" required><option value="">'+local('Choose one','اختر')+'</option><option value="registered">'+local('Registered','مسجل')+'</option><option value="in_progress">'+local('Registration in progress','جارٍ التسجيل')+'</option><option value="not_registered">'+local('Not registered yet','غير مسجل حاليًا')+'</option></select>',
        '<div class="form-two-col"><div><label class="field-label" for="verify-registration-number">'+local('Commercial registration number (when applicable)','رقم السجل التجاري (إن وجد)')+'</label><input id="verify-registration-number" maxlength="100"></div><div><label class="field-label" for="verify-registration-file">'+local('Commercial registration document (when applicable)','مستند السجل التجاري (إن وجد)')+'</label><input id="verify-registration-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"><small id="verify-registration-saved" class="muted"></small></div></div>',
        '<div class="form-two-col"><div><label class="field-label" for="verify-tax-number">'+local('Tax registration number (optional)','رقم التسجيل الضريبي (اختياري)')+'</label><input id="verify-tax-number" maxlength="100"></div><div><label class="field-label" for="verify-tax-file">'+local('Tax card / document (optional)','البطاقة أو المستند الضريبي (اختياري)')+'</label><input id="verify-tax-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"><small id="verify-tax-saved" class="muted"></small></div></div>',
        '<label class="field-label" for="verify-supplier-id-file">'+local('National ID document (PDF/JPG/PNG, max 5 MB)','مستند بطاقة الرقم القومي (PDF/JPG/PNG، بحد أقصى 5 ميجابايت)')+'</label><input id="verify-supplier-id-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"><small id="verify-supplier-id-saved" class="muted"></small>',
        '<label class="field-label" for="verify-supplier-notes">'+local('Notes for IzzyDrop (optional)','ملاحظات لإيزي دروب (اختياري)')+'</label><textarea id="verify-supplier-notes" maxlength="1500" rows="2"></textarea>',
        '<small class="muted">'+local('Add your payout destination under Settings → Payout details. Registered suppliers must submit commercial registration. Tax documents are reviewed when applicable; other registration situations may be considered manually by an administrator.','أضف بيانات استلام مستحقاتك من الإعدادات ← بيانات الدفع. يجب على النشاط المسجل تقديم السجل التجاري. تتم مراجعة المستندات الضريبية عند انطباقها، ويمكن للمسؤول مراجعة الحالات الأخرى يدويًا.')+'</small>',
        '<button class="btn" type="submit">'+local('Submit verification','إرسال طلب التحقق')+'</button><div id="verify-supplier-status" class="status" role="status" aria-live="polite"></div></form></div></section>'
      ].join('');
    }else if(role==='dropshipper'){
      markup=[
        '<section class="settings-panel" data-settings-panel="verification" hidden><div class="card settings-card">',
        '<div class="settings-title"><div><h3>'+local('Identity verification','التحقق من الهوية')+'</h3><p class="muted">'+local('Submit your identity and residential delivery details for manual review. You can browse the marketplace while pending; approval is required before linking or publishing products and receiving payouts.','أرسل بيانات الهوية وعنوان التوصيل السكني للمراجعة اليدوية. يمكنك تصفح السوق أثناء الانتظار؛ لكن يلزم اعتماد الهوية قبل ربط المنتجات أو نشرها واستلام المستحقات.')+'</p></div></div>',
        '<div id="verify-dropshipper-state" class="notice">'+local('Loading verification status…','جارٍ تحميل حالة التحقق…')+'</div><form id="verify-dropshipper-form" class="form">',
        '<label class="field-label" for="verify-drop-legal-name">'+local('Full legal name','الاسم القانوني بالكامل')+'</label><input id="verify-drop-legal-name" autocomplete="name" maxlength="120" required>',
        '<label class="field-label" for="verify-drop-phone">'+local('Contact phone','رقم هاتف التواصل')+'</label><input id="verify-drop-phone" type="tel" minlength="7" maxlength="40" autocomplete="tel" required>',
        '<small class="muted">'+local('SMS verification is not enabled at launch.','لن يتم تفعيل التحقق عبر الرسائل النصية عند الإطلاق.')+'</small>',
        '<label class="field-label" for="verify-residential-address">'+local('Residential delivery address','عنوان السكن والتوصيل')+'</label><textarea id="verify-residential-address" minlength="8" maxlength="500" rows="3" required></textarea>',
        '<label class="field-label" for="verify-residential-maps">'+local('Google Maps link (optional)','رابط Google Maps (اختياري)')+'</label><input id="verify-residential-maps" type="url" maxlength="500" placeholder="https://maps.app.goo.gl/...">',
        '<label class="field-label" for="verify-id-file">'+local('National ID document (PDF/JPG/PNG, max 5 MB)','مستند بطاقة الرقم القومي (PDF/JPG/PNG، بحد أقصى 5 ميجابايت)')+'</label><input id="verify-id-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"><small id="verify-id-saved" class="muted"></small>',
        '<small class="muted">'+local('Save your payout destination under Settings → Payout details before requesting approval. Your private information is not shown to customers.','احفظ بيانات استلام المستحقات من الإعدادات ← بيانات الدفع قبل طلب الاعتماد. لن تظهر بياناتك الخاصة للعملاء.')+'</small>',
        '<button class="btn" type="submit">'+local('Submit identity for review','إرسال الهوية للمراجعة')+'</button><div id="verify-dropshipper-status" class="status" role="status" aria-live="polite"></div></form></div></section>'
      ].join('');
    }else return false;
    panelBase.insertAdjacentHTML('beforebegin',markup);
    const tab=root.querySelector('[data-settings-tab="verification"]');
    tab.onclick=()=>{
      root.querySelectorAll('[data-settings-tab]').forEach(x=>x.classList.toggle('on',x===tab));
      root.querySelectorAll('[data-settings-panel]').forEach(x=>x.hidden=x.dataset.settingsPanel!=='verification');
      const shared=root.querySelector('#settings-status');if(shared)shared.textContent='';
      if(role==='supplier')loadSupplier().catch(e=>note($('#verify-supplier-status'),e.message,'تعذر تحميل بيانات التحقق.',true));
      else loadDropshipper().catch(e=>note($('#verify-dropshipper-status'),e.message,'تعذر تحميل بيانات التحقق.',true));
    };
    if(role==='supplier')$('#verify-supplier-form').onsubmit=submitSupplier;
    else $('#verify-dropshipper-form').onsubmit=submitDropshipper;
    return true;
  }
  function waitForPanel(){if(!addPanel())setTimeout(()=>{if(!addPanel())console.warn('Verification settings panel could not attach.');},300);}
  async function loadSupplier(){
    const uid=IZZY.session()?.user?.id;if(!uid)throw Error(local('Please sign in again.','يرجى تسجيل الدخول مرة أخرى.'));
    const rows=await IZZY.request('/rest/v1/suppliers?select=id,status&profile_id=eq.'+encodeURIComponent(uid)+'&limit=1');
    accountId=rows?.[0]?.id||null;if(!accountId)throw Error(local('Supplier account not found.','لم يتم العثور على حساب المورد.'));
    const apps=await IZZY.request('/rest/v1/supplier_verification_applications?select=*&supplier_id=eq.'+encodeURIComponent(accountId)+'&limit=1');
    application=apps?.[0]||null;
    $('#verify-supplier-state').textContent=local('Status: ','الحالة: ')+statusName(application?.review_status)+(application?.review_reason?' — '+application.review_reason:'');
    const values={'verify-legal-name':application?.legal_name,'verify-business-address':application?.business_address,'verify-business-maps':application?.business_maps_url,'verify-business-phone':application?.business_phone,'verify-registration-status':application?.registration_status,'verify-registration-number':application?.registration_number,'verify-tax-number':application?.tax_registration_number,'verify-supplier-notes':application?.supplier_notes};
    Object.entries(values).forEach(([id,value])=>{if($('#'+id))$('#'+id).value=value||'';});
    $('#verify-registration-saved').textContent=application?.registration_document_path?local('Existing document saved privately.','تم حفظ المستند الحالي بشكل خاص.'):'';
    $('#verify-tax-saved').textContent=application?.tax_document_path?local('Existing document saved privately.','تم حفظ المستند الحالي بشكل خاص.'):'';
    $('#verify-supplier-id-saved').textContent=application?.identity_document_path?local('Existing ID document saved privately.','تم حفظ مستند الهوية الحالي بشكل خاص.'):'';
    $('#verify-supplier-form').querySelectorAll('input,select,textarea,button[type="submit"]').forEach(el=>el.disabled=application?.review_status==='approved');
  }
  async function submitSupplier(e){
    e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;
    try{
      const regStatus=$('#verify-registration-status').value,regNumber=$('#verify-registration-number').value.trim(),taxNumber=$('#verify-tax-number').value.trim();
      const regFile=$('#verify-registration-file').files?.[0],taxFile=$('#verify-tax-file').files?.[0];
      if(regStatus==='registered'&&!regNumber&&!regFile&&!application?.registration_document_path)throw Error(local('Enter the commercial registration number and upload its document for a registered business.','أدخل رقم السجل التجاري وارفع المستند للنشاط المسجل.'));
      const hasTaxNumber=!!(taxNumber||application?.tax_registration_number),hasTaxFile=!!(taxFile||application?.tax_document_path);
      if(hasTaxNumber!==hasTaxFile)throw Error(local('Provide the tax number and document together, or leave both blank.','أدخل رقم التسجيل الضريبي والمستند معًا أو اتركهما فارغين.'));
      let regPath=application?.registration_document_path||null,taxPath=application?.tax_document_path||null,idPath=application?.identity_document_path||null;
      if(regFile)regPath=await upload(regFile,'supplier-documents',accountId,'registration');
      if(taxFile)taxPath=await upload(taxFile,'supplier-documents',accountId,'tax');
      const idFile=$('#verify-supplier-id-file').files?.[0];if(idFile)idPath=await upload(idFile,'supplier-documents',accountId,'identity');
      if(!idPath)throw Error(local('Upload your national ID document first.','ارفع مستند بطاقة الرقم القومي أولاً.'));
      note($('#verify-supplier-status'),'Submitting your application…','جارٍ إرسال طلبك…');
      await IZZY.rpc('supplier_submit_verification_v2',{
        _legal_name:$('#verify-legal-name').value.trim(),_business_address:$('#verify-business-address').value.trim(),
        _business_phone:$('#verify-business-phone').value.trim(),_business_maps_url:$('#verify-business-maps').value.trim()||null,
        _registration_status:regStatus,_registration_number:regNumber||null,_tax_registration_number:taxNumber||null,
        _registration_document_path:regPath,_tax_document_path:taxPath,_identity_document_path:idPath,
        _supplier_notes:$('#verify-supplier-notes').value.trim()||null
      });
      note($('#verify-supplier-status'),'Verification submitted. IzzyDrop will review it.','تم إرسال طلب التحقق. ستتم مراجعته.');
      await loadSupplier();
    }catch(err){note($('#verify-supplier-status'),err.message||'Could not submit verification.','تعذر إرسال طلب التحقق.',true);}
    finally{button.disabled=false;}
  }
  async function loadDropshipper(){
    const uid=IZZY.session()?.user?.id;if(!uid)throw Error(local('Please sign in again.','يرجى تسجيل الدخول مرة أخرى.'));
    const [rows,profiles]=await Promise.all([
      IZZY.request('/rest/v1/dropshippers?select=id&profile_id=eq.'+encodeURIComponent(uid)+'&limit=1'),
      IZZY.request('/rest/v1/profiles?select=phone&id=eq.'+encodeURIComponent(uid)+'&limit=1')
    ]);
    accountId=rows?.[0]?.id||null;if(!accountId)throw Error(local('Dropshipper account not found.','لم يتم العثور على حساب الدروبشيبر.'));
    const applicationRows=await IZZY.request('/rest/v1/dropshipper_identity_verifications?select=*&dropshipper_id=eq.'+encodeURIComponent(accountId)+'&limit=1');
    application=applicationRows?.[0]||null;
    $('#verify-dropshipper-state').textContent=local('Status: ','الحالة: ')+statusName(application?.review_status)+(application?.review_reason?' — '+application.review_reason:'');
    $('#verify-drop-legal-name').value=application?.legal_name||'';
    $('#verify-drop-phone').value=profiles?.[0]?.phone||'';
    $('#verify-residential-address').value=application?.residential_address||'';
    $('#verify-residential-maps').value=application?.residential_maps_url||'';
    $('#verify-id-saved').textContent=application?.id_document_path?local('An ID document is saved privately.','تم حفظ مستند الهوية بشكل خاص.'):'';
    $('#verify-dropshipper-form').querySelectorAll('input,textarea,button[type="submit"]').forEach(el=>el.disabled=application?.review_status==='approved');
  }
  async function submitDropshipper(e){
    e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;
    try{
      const uid=IZZY.session()?.user?.id,phone=$('#verify-drop-phone').value.trim();
      if(phone.replace(/[^0-9+]/g,'').length<8)throw Error(local('Enter a valid contact phone number.','أدخل رقم هاتف صحيحًا للتواصل.'));
      await IZZY.request('/rest/v1/profiles?id=eq.'+encodeURIComponent(uid),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({phone})});
      const file=$('#verify-id-file').files?.[0],path=file?await upload(file,'dropshipper-identity-documents',accountId,'id'):application?.id_document_path;
      if(!path)throw Error(local('Choose your national ID document first.','اختر مستند بطاقة الرقم القومي أولاً.'));
      note($('#verify-dropshipper-status'),'Submitting ID for review…','جارٍ إرسال الهوية للمراجعة…');
      await IZZY.rpc('dropshipper_submit_identity_verification_v2',{
        _legal_name:$('#verify-drop-legal-name').value.trim(),_residential_address:$('#verify-residential-address').value.trim(),
        _residential_maps_url:$('#verify-residential-maps').value.trim()||null,_id_document_path:path
      });
      note($('#verify-dropshipper-status'),'Identity submitted. Approval is required before product linking, publishing and payouts.','تم إرسال الهوية. يلزم اعتمادها قبل ربط المنتجات ونشرها واستلام المستحقات.');
      await loadDropshipper();
    }catch(err){note($('#verify-dropshipper-status'),err.message||'Could not submit identity.','تعذر إرسال الهوية.',true);}
    finally{button.disabled=false;}
  }
  window.addEventListener('izzy:supplier-ready',()=>{role='supplier';waitForPanel();});
  window.addEventListener('izzy:dropshipper-ready',()=>{role='dropshipper';waitForPanel();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForPanel);else waitForPanel();
})();