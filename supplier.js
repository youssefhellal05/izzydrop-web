(()=>{
  const $=s=>document.querySelector(s);
  let SUP=null,PRODUCTS=[],VARIANTS=[],IMAGES=[],ORDERS=[],ITEMS=[],REQUESTS=[],QUOTES=[],CATEGORIES=[],SAMPLES=[],SELECTED_IMAGES=[],ORDER_FILTER='all',NEW_CONTENT_LANG='en',NEW_SOURCE_LANGUAGE='en',EDIT_CONTENT_LANG='en',VARIANT_MODE='single',PRODUCT_STEP=3,VARIANT_ADVANCED=false,SIMPLE_PRODUCT_FLOW=true,VARIANT_PRICES_VARY=false;
  const SELECTED_PRODUCT_IDS=new Set();
  const VARIANT_COMBO_STATE=new Map();
  const VARIANT_IMAGE_STATE=new Map();
  let VARIANT_GENERATION_SIGNATURE='';

  const VIEW_COPY={
    overview:['Overview','What needs your attention.'],
    products:['My Products','Your products and stock.'],
    orders:['Orders','Ship customer orders.'],
    requests:['Requests','Products dropshippers want sourced.'],
    add:['Add product','Create a product in three simple steps.'],
    samples:['Samples','Sample requests from dropshippers.'],
    settings:['Settings','Account and preferences.']
  };

  const msg=(t,b=false)=>{
    const e=$('#status');
    if(e){e.textContent=t||'';e.className='status'+(b?' bad':'')}
  };

  function go(v){
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===v));
    document.querySelectorAll('.view').forEach(x=>x.hidden=true);
    const panel=$('#view-'+v);
    if(panel)panel.hidden=false;
    const copy=VIEW_COPY[v]||VIEW_COPY.overview;
    $('#supplier-page-title').textContent=copy[0];
    $('#supplier-page-subtitle').textContent=copy[1];
    const more=document.querySelector('.supplier-more');
    if(more){
      more.classList.toggle('has-active',['samples','settings'].includes(v));
      if(!['samples','settings'].includes(v))more.open=false;
    }
    if(v==='add')setProductStep(1,false);
    msg('');
  }

  function orderFor(id){return ORDERS.find(o=>o.id===id)||{}}
  function productFor(id){return PRODUCTS.find(p=>p.id===id)||{}}
  function variantsFor(id){return VARIANTS.filter(v=>v.product_id===id)}
  function enabledVariantsFor(id){return variantsFor(id).filter(v=>v.is_enabled!==false)}
  function imagesFor(id){return IMAGES.filter(i=>i.product_id===id).sort((a,b)=>Number(a.position)-Number(b.position))}
  function totalStock(id){return enabledVariantsFor(id).reduce((n,v)=>n+Number(v.stock_quantity||0),0)}
  function threshold(){return Number(SUP?.low_stock_threshold??5)}
  function lowStockProduct(p){const vs=enabledVariantsFor(p.id);return vs.length>0&&vs.some(v=>Number(v.stock_quantity||0)<=threshold())}
  function supplierOrderState(item){
    if(item.fulfillment_status==='cancelled')return 'cancelled';
    const o=orderFor(item.order_id);
    if(item.fulfillment_status==='fulfilled'){
      if(['delivered','refused','returned','in_transit','shipped'].includes(o.status))return o.status;
      return 'shipped';
    }
    return o.status==='processing'?'processing':'new';
  }
  const productName=p=>window.IZZY_I18N?.productName(p)||p?.name||'';
  const productDescription=p=>window.IZZY_I18N?.productDescription(p)||p?.description||'';
  const local=(en,ar)=>window.IZZY_I18N?.isArabic?.()?ar:en;

  const FIELD_HELP={
    sku:{
      en:'SKU means Stock Keeping Unit. It is a unique code you use to identify this product in your inventory. Enter your own code, or leave it blank and IzzyDrop will create one automatically.',
      ar:'SKU هو رمز فريد تستخدمه لتمييز المنتج داخل مخزونك. يمكنك كتابة رمزك الخاص، أو تركه فارغًا وسيقوم IzzyDrop بإنشائه تلقائيًا.'
    },
    cost:{
      en:'This is the price a dropshipper pays you for one unit of the product. IzzyDrop uses it when showing the dropshipper their estimated profit.',
      ar:'هذا هو السعر الذي يدفعه لك الدروبشيبر مقابل وحدة واحدة من المنتج. يستخدمه IzzyDrop لحساب الربح التقديري للدروبشيبر.'
    },
    retail:{
      en:'This is the selling price you recommend the dropshipper charges the final customer. It is only a suggestion — the dropshipper can choose a different selling price.',
      ar:'هذا هو سعر البيع الذي تقترحه على الدروبشيبر للعميل النهائي. هو سعر مقترح فقط، ويمكن للدروبشيبر اختيار سعر بيع مختلف.'
    }
  };

  function variantLabel(v){
    const opts=v?.option_values||v?.options||{};
    const entries=Object.entries(opts||{}).filter(([,value])=>String(value??'').trim());
    return entries.length?entries.map(([name,value])=>`${name}: ${value}`).join(' · '):(v?.variant_name||v?.name||v?.sku||'Default');
  }

  const categoryName=c=>window.IZZY_I18N?.isArabic?.()?(c?.name_ar||c?.name||''):(c?.name||c?.name_ar||'');

  function categoryOptions(selected=''){
    return '<option value="">'+local('Choose category','اختر الفئة')+'</option>'+
      CATEGORIES.map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${IZZY.esc(categoryName(c))}</option>`).join('');
  }

  function refreshCategorySelects(){
    const add=$('#p-category');
    if(add){
      const current=add.value;
      add.innerHTML=categoryOptions(current);
      if(CATEGORIES.some(c=>c.id===current))add.value=current;
    }
    const edit=$('#edit-product-category');
    if(edit){
      const current=edit.value;
      edit.innerHTML='<option value="">'+local('No category','بدون فئة')+'</option>'+
        CATEGORIES.map(c=>`<option value="${c.id}">${IZZY.esc(categoryName(c))}</option>`).join('');
      if(CATEGORIES.some(c=>c.id===current))edit.value=current;
    }
  }

  function selectedImageOptions(selectedIndex=''){
    return '<option value="">'+local('Use main photo','استخدم الصورة الرئيسية')+'</option>'+
      SELECTED_IMAGES.map((file,index)=>`<option value="${index}" ${String(selectedIndex)===String(index)?'selected':''}>${local('Photo','صورة')} ${index+1} · ${IZZY.esc(file.name||'')}</option>`).join('');
  }

  function existingImageOptions(productId,currentUrl=''){
    const imgs=imagesFor(productId);
    return '<option value="">'+local('Use main photo','استخدم الصورة الرئيسية')+'</option>'+
      imgs.map((img,index)=>`<option value="${IZZY.esc(img.url)}" ${img.url===currentUrl?'selected':''}>${local('Photo','صورة')} ${index+1}</option>`).join('');
  }

  function refreshVariantPhotoChoices(){
    document.querySelectorAll('[data-variant-group-image]').forEach(select=>{
      const current=select.value;
      select.innerHTML=selectedImageOptions(current);
      if([...select.options].some(o=>o.value===current))select.value=current;
      VARIANT_IMAGE_STATE.set(select.dataset.variantImageKey,select.value);
      const card=select.closest('[data-variant-photo-card]');
      if(card)updateVariantGroupPhoto(card);
    });
  }

  function clearFormInvalidState(el){
    if(!el)return;
    el.closest('.field,.photo-upload,.variant-builder-panel')?.classList.remove('is-invalid');
    el.removeAttribute?.('aria-invalid');
  }

  function showFormError(el,message){
    if(el){
      el.closest('.field,.photo-upload,.variant-builder-panel')?.classList.add('is-invalid');
      el.setAttribute?.('aria-invalid','true');
      el.scrollIntoView?.({behavior:'smooth',block:'center'});
      setTimeout(()=>el.focus?.({preventScroll:true}),250);
    }
    msg(message,true);
    return false;
  }

  function updatePricePreview(){
    const costRaw=$('#p-cost')?.value;
    const retailRaw=$('#p-retail')?.value;
    const value=$('#price-margin-value');
    const note=$('#price-margin-note');
    const box=$('#price-margin-preview');
    if(!value||!note||!box)return;
    const cost=Number(costRaw),retail=Number(retailRaw);
    const valid=costRaw!==''&&retailRaw!==''&&Number.isFinite(cost)&&Number.isFinite(retail)&&cost>=0&&retail>=0;
    box.classList.remove('positive','negative');
    if(!valid){
      value.textContent='—';
      note.textContent=local('Enter both prices to preview the margin before delivery.','أدخل السعرين لمعاينة الهامش قبل التوصيل.');
      return;
    }
    const margin=retail-cost;
    const pct=retail>0?(margin/retail)*100:0;
    value.textContent=`${IZZY.money(margin,'EGP')} · ${pct.toFixed(1)}%`;
    box.classList.add(margin>=0?'positive':'negative');
    note.textContent=margin>=0
      ? local('Suggested customer price minus your supplier price. Delivery is separate.','سعر البيع المقترح ناقص سعر المورّد. التوصيل منفصل.')
      : local('Suggested selling price is below your supplier price.','سعر البيع المقترح أقل من سعر المورّد.');
  }

  function productWizardSummary(){
    const name=$('#p-name-'+NEW_CONTENT_LANG)?.value?.trim()||$('#p-name-en')?.value?.trim()||$('#p-name-ar')?.value?.trim()||'—';
    const categorySelect=$('#p-category');
    const category=categorySelect?.value?(categorySelect.selectedOptions?.[0]?.textContent?.trim()||'—'):'—';
    let variants=[],variantsValid=true;
    try{variants=collectVariants()}catch(e){variantsValid=false}
    const enabled=variants.filter(v=>v.enabled!==false);
    const stock=enabled.reduce((sum,v)=>sum+Number(v.stock||0),0);
    const baseRetailRaw=$('#p-retail')?.value;
    const baseRetail=Number(baseRetailRaw);
    let priceText=baseRetailRaw!==''&&Number.isFinite(baseRetail)?IZZY.money(baseRetail,'EGP'):'—';
    if(!SIMPLE_PRODUCT_FLOW&&VARIANT_PRICES_VARY&&enabled.length){
      const prices=enabled.map(v=>Number(v.retail)).filter(Number.isFinite);
      if(prices.length){
        const min=Math.min(...prices),max=Math.max(...prices);
        priceText=min===max?IZZY.money(min,'EGP'):`${IZZY.money(min,'EGP')} – ${IZZY.money(max,'EGP')}`;
      }
    }

    if($('#publish-product-name'))$('#publish-product-name').textContent=name;
    if($('#publish-category'))$('#publish-category').textContent=category;
    if($('#publish-photo-count'))$('#publish-photo-count').textContent=String(SELECTED_IMAGES.length);
    if($('#publish-variant-count'))$('#publish-variant-count').textContent=String(SIMPLE_PRODUCT_FLOW?1:enabled.length);
    if($('#publish-stock-count'))$('#publish-stock-count').textContent=String(stock);
    if($('#publish-price'))$('#publish-price').textContent=priceText;

    const missing=[];
    if(name==='—')missing.push(local('product name','اسم المنتج'));
    if(!categorySelect?.value)missing.push(local('category','الفئة'));
    if(!SELECTED_IMAGES.length)missing.push(local('photo','صورة'));
    const costRaw=$('#p-cost')?.value,cost=Number(costRaw);
    if(costRaw===''||!Number.isFinite(cost)||cost<0)missing.push(local('supplier price','سعر المورّد'));
    if(baseRetailRaw===''||!Number.isFinite(baseRetail)||baseRetail<0)missing.push(local('suggested price','سعر البيع المقترح'));
    if(!SIMPLE_PRODUCT_FLOW&&!variantsValid)missing.push(local('variants','الخيارات'));

    const readiness=$('#publish-readiness');
    if(readiness){
      readiness.classList.toggle('ok',missing.length===0);
      readiness.classList.toggle('warn',missing.length>0);
      readiness.textContent=missing.length
        ? local(`Still needed: ${missing.join(', ')}.`,`ما زال مطلوبًا: ${missing.join('، ')}.`)
        : local('Everything required is ready.','كل البيانات المطلوبة جاهزة.');
    }
    updatePricePreview();
  }

  function validateProductStep(step){
    document.querySelectorAll('#add-form .is-invalid').forEach(el=>el.classList.remove('is-invalid'));
    document.querySelectorAll('#add-form [aria-invalid="true"]').forEach(el=>el.removeAttribute('aria-invalid'));
    if(step===1){
      const nameEn=$('#p-name-en')?.value?.trim(),nameAr=$('#p-name-ar')?.value?.trim();
      if(!nameEn&&!nameAr)return showFormError($('#p-name-'+NEW_CONTENT_LANG),local('Add a product name first.','أضف اسم المنتج أولًا.'));
      if(!$('#p-category')?.value)return showFormError($('#p-category'),local('Choose a product category.','اختر فئة للمنتج.'));
      if(!SELECTED_IMAGES.length)return showFormError($('#photo-drop-zone'),local('Add at least one product photo.','أضف صورة واحدة على الأقل للمنتج.'));
      msg('');
      return true;
    }
    if(step===2){
      try{collectVariants();msg('');return true}
      catch(e){return showFormError($('#variant-builder-card'),e.message)}
    }
    return true;
  }

  function setVariantFlow(hasVariants,scroll=false){
    SIMPLE_PRODUCT_FLOW=!hasVariants;
    PRODUCT_STEP=3;
    const builder=$('#variant-builder-card');
    const simpleStock=$('#simple-product-stock-field');
    const choice=$('#variant-choice-card');
    if(builder)builder.hidden=!hasVariants;
    if(simpleStock)simpleStock.hidden=hasVariants;
    if(choice)choice.classList.toggle('variants-on',hasVariants);
    document.querySelectorAll('[data-product-version-mode]').forEach(btn=>{
      const active=btn.dataset.productVersionMode===(hasVariants?'options':'single');
      btn.classList.toggle('on',active);
      btn.setAttribute('aria-pressed',active?'true':'false');
      const mark=btn.querySelector('.product-version-check');
      if(mark)mark.textContent=active?'✓':(btn.dataset.productVersionMode==='options'?'+':'○');
    });
    if(hasVariants)updateCategoryOptionSuggestion();
    productWizardSummary();
    if(scroll&&hasVariants)builder?.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function setProductStep(step,scroll=true){
    PRODUCT_STEP=3;
    setVariantFlow(!SIMPLE_PRODUCT_FLOW,false);
    if(scroll)document.querySelector('#view-add .section-heading')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function setVariantAdvanced(show){
    VARIANT_ADVANCED=!!show;
    const form=$('#add-form');
    if(form)form.classList.toggle('show-variant-advanced',VARIANT_ADVANCED);
    const btn=$('#toggle-variant-advanced');
    if(btn)btn.textContent=VARIANT_ADVANCED?local('Hide SKU & weight','إخفاء SKU والوزن'):local('Add SKU & weight','إضافة SKU والوزن');
  }

  function setNewContentLang(lang,userAction=true){
    NEW_CONTENT_LANG=lang;
    if(userAction){
      const enHas=!!$('#p-name-en')?.value?.trim();
      const arHas=!!$('#p-name-ar')?.value?.trim();
      if(!enHas&&!arHas)NEW_SOURCE_LANGUAGE=lang;
      else if(lang==='en'&&enHas&&!arHas)NEW_SOURCE_LANGUAGE='en';
      else if(lang==='ar'&&arHas&&!enHas)NEW_SOURCE_LANGUAGE='ar';
    }
    document.querySelectorAll('[data-new-content-lang]').forEach(b=>b.classList.toggle('on',b.dataset.newContentLang===lang));
    document.querySelectorAll('[data-new-content-panel]').forEach(p=>p.hidden=p.dataset.newContentPanel!==lang);
    const btn=$('#p-translate-btn');
    if(btn)btn.textContent=lang==='en'?'Generate Arabic translation':'Generate English translation';
  }

  function setEditContentLang(lang){
    EDIT_CONTENT_LANG=lang;
    document.querySelectorAll('[data-edit-content-lang]').forEach(b=>b.classList.toggle('on',b.dataset.editContentLang===lang));
    document.querySelectorAll('[data-edit-content-panel]').forEach(p=>p.hidden=p.dataset.editContentPanel!==lang);
    const btn=$('#edit-translate-btn');
    if(btn)btn.textContent=lang==='en'?'Generate Arabic translation':'Generate English translation';
  }

  async function translateText(text,from,to){
    if(!String(text||'').trim())return '';
    const data=await IZZY.request('/functions/v1/translate-product',{
      method:'POST',
      body:JSON.stringify({text:String(text).trim(),from,to})
    });
    return data?.translated_text||'';
  }

  async function translateNewContent(){
    const from=NEW_CONTENT_LANG,to=from==='en'?'ar':'en';
    const sourceName=$('#p-name-'+from).value.trim();
    const sourceDescription=$('#p-description-'+from).value.trim();
    const st=$('#p-translation-status'),btn=$('#p-translate-btn');
    const targetHas=$('#p-name-'+to).value.trim()||$('#p-description-'+to).value.trim();
    if(targetHas&&!confirm(to==='ar'?'Replace the existing Arabic translation?':'Replace the existing English translation?'))return;
    if(!sourceName){st.textContent=from==='en'?'Enter the English product name first.':'أدخل اسم المنتج بالعربية أولًا.';st.className='status bad';return}
    btn.disabled=true;
    btn.textContent=from==='en'?'Translating to Arabic…':'Translating to English…';
    st.textContent='Generating a draft translation…';st.className='status';
    try{
      const [name,description]=await Promise.all([
        translateText(sourceName,from,to),
        sourceDescription?translateText(sourceDescription,from,to):Promise.resolve('')
      ]);
      $('#p-name-'+to).value=name;
      $('#p-description-'+to).value=description;
      setNewContentLang(to,false);
      st.textContent=to==='ar'?'تم إنشاء الترجمة العربية. راجعها وعدّلها قبل حفظ المنتج.':'English translation generated. Review and edit it before saving.';
    }catch(e){st.textContent=e.message||'Translation failed.';st.className='status bad'}
    finally{btn.disabled=false;btn.textContent=NEW_CONTENT_LANG==='en'?'Generate Arabic translation':'Generate English translation'}
  }

  async function translateEditContent(){
    const from=EDIT_CONTENT_LANG,to=from==='en'?'ar':'en';
    const sourceName=$('#edit-product-name-'+from).value.trim();
    const sourceDescription=$('#edit-product-description-'+from).value.trim();
    const st=$('#edit-translation-status'),btn=$('#edit-translate-btn');
    const targetHas=$('#edit-product-name-'+to).value.trim()||$('#edit-product-description-'+to).value.trim();
    if(targetHas&&!confirm(to==='ar'?'Replace the existing Arabic translation?':'Replace the existing English translation?'))return;
    if(!sourceName){st.textContent=from==='en'?'Enter the English product name first.':'أدخل اسم المنتج بالعربية أولًا.';st.className='status bad';return}
    btn.disabled=true;
    btn.textContent=from==='en'?'Translating to Arabic…':'Translating to English…';
    st.textContent='Generating a draft translation…';st.className='status';
    try{
      const [name,description]=await Promise.all([
        translateText(sourceName,from,to),
        sourceDescription?translateText(sourceDescription,from,to):Promise.resolve('')
      ]);
      $('#edit-product-name-'+to).value=name;
      $('#edit-product-description-'+to).value=description;
      setEditContentLang(to);
      st.textContent=to==='ar'?'تم إنشاء الترجمة العربية. راجعها وعدّلها قبل الحفظ.':'English translation generated. Review and edit it before saving.';
    }catch(e){st.textContent=e.message||'Translation failed.';st.className='status bad'}
    finally{btn.disabled=false;btn.textContent=EDIT_CONTENT_LANG==='en'?'Generate Arabic translation':'Generate English translation'}
  }

  function setLoading(){
    $('#attention-list').innerHTML='<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line medium" style="margin-top:10px"></div><div class="skeleton skeleton-line short" style="margin-top:10px"></div>';
    $('#today-summary').innerHTML='<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div>';
    $('#products').innerHTML=Array.from({length:4},()=>'<div class="supplier-product-table supplier-product-table-row"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-button"></div></div>').join('');
    $('#orders').innerHTML=Array.from({length:3},()=>'<div class="card supplier-order-card"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line" style="margin-top:12px"></div><div class="skeleton skeleton-line medium" style="margin-top:10px"></div></div>').join('');
    if($('#supplier-samples'))$('#supplier-samples').innerHTML=Array.from({length:2},()=>'<div class="card supplier-order-card"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line medium" style="margin-top:10px"></div></div>').join('');
  }

  async function verify(){
    const s=IZZY.session();
    if(!s?.user?.id){location.href='login.html';return false}

    let rows=await IZZY.request(`/rest/v1/suppliers?select=id,business_name,status,low_stock_threshold,notification_preferences&profile_id=eq.${encodeURIComponent(s.user.id)}&limit=1`);
    SUP=rows?.[0];

    if(!SUP){
      const prof=await IZZY.request(`/rest/v1/profiles?select=business_name,requested_account_type&id=eq.${encodeURIComponent(s.user.id)}&limit=1`);
      if(prof?.[0]?.requested_account_type==='supplier'){
        const created=await IZZY.request('/rest/v1/suppliers',{
          method:'POST',
          headers:{Prefer:'return=representation'},
          body:JSON.stringify({profile_id:s.user.id,business_name:prof[0].business_name||s.user.email,status:'pending'})
        });
        SUP=created?.[0];
      }
    }

    if(!SUP){location.href='login.html';return false}
    if(SUP.status!=='approved'){
      const g=$('#gate-message');
      g.textContent=SUP.status==='pending'?'Your IzzyDrop supplier application is waiting for admin approval.':'Your IzzyDrop supplier account is '+SUP.status+'.';
      return false;
    }

    $('#gate').hidden=true;
    $('#supplier').hidden=false;
    $('#business').textContent=SUP.business_name||'Supplier';
    $('#supplier-email').textContent=s.user.email||'';
    resetVariantBuilder();
    setLoading();
    await load();
    return true;
  }

  function renderOverview(){
    const newItems=ITEMS.filter(i=>supplierOrderState(i)==='new');
    const openItems=ITEMS.filter(i=>!['fulfilled','cancelled'].includes(i.fulfillment_status));
    const lowProducts=PRODUCTS.filter(lowStockProduct);
    const active=PRODUCTS.filter(p=>p.status==='active');

    $('#new-order-count').textContent=newItems.length;
    $('#open-order-count').textContent=openItems.length;
    $('#low-stock-count').textContent=lowProducts.length;
    $('#active-product-count').textContent=active.length;
    $('#total-product-label').textContent=`${PRODUCTS.length} total product${PRODUCTS.length===1?'':'s'}`;

    const attention=[];
    if(newItems.length)attention.push({
      type:'order',
      title:`${newItems.length} new order${newItems.length===1?'':'s'} waiting`,
      text:'Review customer details and prepare fulfillment.',
      action:'View orders',
      view:'orders',
      filter:'new'
    });
    if(lowProducts.length)attention.push({
      type:'stock',
      title:`${lowProducts.length} product${lowProducts.length===1?'':'s'} low on stock`,
      text:`At or below your warning level of ${threshold()} units.`,
      action:'Update stock',
      view:'products'
    });
    const inactive=PRODUCTS.filter(p=>p.status==='inactive');
    if(inactive.length)attention.push({
      type:'product',
      title:`${inactive.length} paused product${inactive.length===1?'':'s'}`,
      text:'Paused products are hidden from dropshippers.',
      action:'Manage products',
      view:'products'
    });

    $('#attention-list').innerHTML=attention.map(a=>`<div class="attention-row">
      <span class="attention-icon">${a.type==='order'?'↗':a.type==='stock'?'!':'•'}</span>
      <div><b>${IZZY.esc(a.title)}</b><small>${IZZY.esc(a.text)}</small></div>
      <button class="btn secondary attention-action" data-attention-view="${a.view}" ${a.filter?`data-attention-filter="${a.filter}"`:''}>${a.action}</button>
    </div>`).join('')||'<div class="empty-mini"><b>Everything looks good.</b><span>No urgent supplier tasks right now.</span></div>';

    document.querySelectorAll('.attention-action').forEach(b=>b.onclick=()=>{
      if(b.dataset.attentionFilter)setOrderFilter(b.dataset.attentionFilter);
      go(b.dataset.attentionView);
    });

    const today=new Date().toDateString();
    const todayOrders=ORDERS.filter(o=>new Date(o.created_at).toDateString()===today);
    const shippedToday=ITEMS.filter(i=>i.fulfillment_status==='fulfilled'&&new Date(i.updated_at||i.created_at).toDateString()===today);
    const unitsToday=ITEMS.filter(i=>new Date(i.created_at).toDateString()===today).reduce((n,i)=>n+Number(i.quantity||0),0);
    $('#today-summary').innerHTML=`
      <div><small>${local('Orders received','طلبات وصلت')}</small><strong>${todayOrders.length}</strong></div>
      <div><small>${local('Units ordered','وحدات مطلوبة')}</small><strong>${unitsToday}</strong></div>
      <div><small>${local('Items shipped','عناصر تم شحنها')}</small><strong>${shippedToday.length}</strong></div>
    `;
  }

  function renderNotifications(){
    const notes=[];
    ITEMS.filter(i=>supplierOrderState(i)==='new').slice(0,6).forEach(i=>{
      const o=orderFor(i.order_id),p=productFor(i.supplier_product_id);
      notes.push({
        kind:'order',
        title:'New order',
        text:`${productName(p)||'Product'} × ${Number(i.quantity||1)} for ${o.customer_name||'customer'}`,
        view:'orders',
        filter:'new'
      });
    });
    PRODUCTS.filter(lowStockProduct).slice(0,6).forEach(p=>{
      notes.push({
        kind:'stock',
        title:local('Low stock','مخزون منخفض'),
        text:local(`${productName(p)} has ${totalStock(p.id)} total units left`,`${productName(p)} متبقي منه ${totalStock(p.id)} وحدة`),
        view:'products'
      });
    });
    SAMPLES.filter(x=>x.status==='requested').slice(0,4).forEach(x=>notes.push({
      kind:'sample',
      title:local('New sample request','طلب عينة جديد'),
      text:productName({name:x.product_name,name_en:x.product_name_en,name_ar:x.product_name_ar})||local('Product sample','عينة منتج'),
      view:'samples'
    }));

    $('#notification-count').textContent=notes.length;
    $('#notification-count').hidden=notes.length===0;
    $('#notification-list').innerHTML=notes.map(n=>`<button class="notification-item" data-note-view="${n.view}" ${n.filter?`data-note-filter="${n.filter}"`:''}>
      <span class="notification-item-icon">${n.kind==='order'?'↗':'!'}</span>
      <span><b>${IZZY.esc(n.title)}</b><small>${IZZY.esc(n.text)}</small></span>
    </button>`).join('')||'<div class="empty-mini"><b>You are all caught up.</b><span>No supplier alerts right now.</span></div>';

    document.querySelectorAll('.notification-item').forEach(b=>b.onclick=()=>{
      if(b.dataset.noteFilter)setOrderFilter(b.dataset.noteFilter);
      go(b.dataset.noteView);
      $('#notification-panel').hidden=true;
    });
  }

  function filteredProducts(){
    const q=$('#supplier-product-search').value.trim().toLowerCase();
    const status=$('#supplier-product-status').value;
    return PRODUCTS.filter(p=>{
      const hay=[p.name,p.name_en,p.name_ar,p.sku,p.description,p.description_en,p.description_ar].filter(Boolean).join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(!status||p.status===status);
    });
  }

  function updateBulkProductUi(){
    const shown=filteredProducts().map(p=>p.id);
    const selectedShown=shown.filter(id=>SELECTED_PRODUCT_IDS.has(id));
    const count=SELECTED_PRODUCT_IDS.size;
    const all=$('#select-all-products');
    if(all){
      all.checked=shown.length>0&&selectedShown.length===shown.length;
      all.indeterminate=selectedShown.length>0&&selectedShown.length<shown.length;
    }
    const label=$('#bulk-selection-count');
    if(label)label.textContent=`${count} selected`;
    ['#bulk-activate-products','#bulk-pause-products','#bulk-clear-products'].forEach(sel=>{
      const el=$(sel);if(el)el.disabled=count===0;
    });
  }

  async function bulkSetProductStatus(nextStatus){
    const ids=[...SELECTED_PRODUCT_IDS];
    if(!ids.length)return;
    const verb=nextStatus==='active'?'activate':'pause';
    if(!confirm(`${verb[0].toUpperCase()+verb.slice(1)} ${ids.length} selected product${ids.length===1?'':'s'}?`))return;
    const a=$('#bulk-activate-products'),p=$('#bulk-pause-products');
    if(a)a.disabled=true;if(p)p.disabled=true;
    msg(`${nextStatus==='active'?'Activating':'Pausing'} selected products…`);
    try{
      await IZZY.request(`/rest/v1/supplier_products?id=in.(${ids.map(encodeURIComponent).join(',')})&supplier_id=eq.${encodeURIComponent(SUP.id)}`,{
        method:'PATCH',
        body:JSON.stringify({status:nextStatus,updated_at:new Date().toISOString()})
      });
      SELECTED_PRODUCT_IDS.clear();
      await load(false);
      msg(`${ids.length} product${ids.length===1?'':'s'} ${nextStatus==='active'?'activated':'paused'}.`);
    }catch(e){msg(e.message,true);updateBulkProductUi()}
  }

  function renderProducts(){
    const products=filteredProducts();
    $('#supplier-products-meta').textContent=`${products.length} product${products.length===1?'':'s'} shown`;
    $('#products').innerHTML=products.map(p=>{
      const img=imagesFor(p.id)[0];
      const stock=totalStock(p.id);
      const low=lowStockProduct(p);
      return `<div class="supplier-product-table supplier-product-table-row ${SELECTED_PRODUCT_IDS.has(p.id)?'is-selected':''}">
        <label class="supplier-product-select" aria-label="Select ${IZZY.esc(productName(p))}">
          <input class="product-select-checkbox" type="checkbox" data-id="${p.id}" ${SELECTED_PRODUCT_IDS.has(p.id)?'checked':''}>
        </label>
        <div class="supplier-table-product">
          <div class="supplier-product-thumb">${img?.url?`<img src="${IZZY.esc(img.url)}" alt="">`:'IZ'}</div>
          <div><b>${IZZY.esc(productName(p))}</b><small>${enabledVariantsFor(p.id).length} active variant${enabledVariantsFor(p.id).length===1?'':'s'}${variantsFor(p.id).length!==enabledVariantsFor(p.id).length?` · ${variantsFor(p.id).length-enabledVariantsFor(p.id).length} off`:''} · ${imagesFor(p.id).length} photo${imagesFor(p.id).length===1?'':'s'}</small></div>
        </div>
        <span class="supplier-table-cell" data-label="SKU">${IZZY.esc(p.sku||'—')}</span>
        <span class="supplier-table-cell ${low?'stock-low':''}" data-label="Stock">${stock}${low?' · Low':''}</span>
        <span class="supplier-table-cell" data-label="Your price">${IZZY.money(p.cost_price,p.currency)}</span>
        <span class="supplier-table-cell" data-label="Suggested retail">${IZZY.money(p.suggested_retail_price,p.currency)}</span>
        <span class="supplier-table-cell" data-label="Status"><span class="tag ${p.status==='active'?'ok':p.status==='inactive'?'warn':''}">${p.status==='inactive'?'paused':IZZY.esc(p.status)}</span></span>
        <div class="supplier-table-actions">
          ${p.public_slug?'<a class="btn secondary" href="product.html?slug='+encodeURIComponent(p.public_slug)+'" target="_blank" rel="noopener">View</a>':''}
          <button class="btn secondary edit-product-btn" data-id="${p.id}">Edit</button>
          <button class="btn secondary toggle-product-btn" data-id="${p.id}" data-next="${p.status==='active'?'inactive':'active'}">${p.status==='active'?'Pause':'Activate'}</button>
        </div>
      </div>`;
    }).join('')||'<div class="empty-state supplier-table-empty"><div class="empty-icon">□</div><h3>No products found</h3><p>Add your first product or change the current filters.</p><button class="btn" data-jump="add">Add product</button></div>';

    document.querySelectorAll('.product-select-checkbox').forEach(c=>c.onchange=()=>{
      if(c.checked)SELECTED_PRODUCT_IDS.add(c.dataset.id);else SELECTED_PRODUCT_IDS.delete(c.dataset.id);
      c.closest('.supplier-product-table-row')?.classList.toggle('is-selected',c.checked);
      updateBulkProductUi();
    });
    document.querySelectorAll('.edit-product-btn').forEach(b=>b.onclick=()=>openEditProduct(b.dataset.id));
    document.querySelectorAll('.toggle-product-btn').forEach(b=>b.onclick=()=>toggleProduct(b));
    document.querySelectorAll('#products [data-jump]').forEach(b=>b.onclick=()=>go(b.dataset.jump));
    updateBulkProductUi();
  }

  function setOrderFilter(filter){
    ORDER_FILTER=filter||'all';
    document.querySelectorAll('[data-supplier-order-filter]').forEach(b=>b.classList.toggle('on',b.dataset.supplierOrderFilter===ORDER_FILTER));
    renderOrders();
  }

  function renderOrders(){
    const list=ITEMS.filter(i=>ORDER_FILTER==='all'||supplierOrderState(i)===ORDER_FILTER);
    $('#orders').innerHTML=list.map(i=>{
      const o=orderFor(i.order_id),p=productFor(i.supplier_product_id),addr=o.shipping_address||{},state=supplierOrderState(i);
      const shipped=i.fulfillment_status==='fulfilled',cancelled=state==='cancelled';
      const stateBad=['cancelled','refused','returned'].includes(state);
      const stateOk=['shipped','in_transit','delivered'].includes(state);
      return `<article class="card supplier-order-card ${state==='new'?'is-new':''}">
        <div class="supplier-order-head">
          <div>
            <div class="supplier-order-title"><b>${IZZY.esc(productName(p)||local('Product','المنتج'))} × ${Number(i.quantity||1)}</b>${state==='new'?'<span class="new-pill">NEW</span>':''}</div>
            <small>${IZZY.esc(o.external_order_ref||o.shopify_order_name||('Order '+String(o.id||'').slice(0,8)))} · ${new Date(o.created_at).toLocaleString()}</small>
          </div>
          <span class="tag ${stateOk?'ok':state==='new'?'warn':stateBad?'bad':''}">${IZZY.esc(window.IZZY_I18N?.status?.(state)||state)}</span>
        </div>

        <div class="supplier-order-grid">
          <div><small>${local('Customer','العميل')}</small><b>${IZZY.esc(o.customer_name||'—')}</b><span>${IZZY.esc(o.customer_phone||'—')}</span></div>
          <div><small>${local('Delivery address','عنوان التوصيل')}</small><b>${IZZY.esc([addr.address1,addr.city,addr.governorate].filter(Boolean).join(', ')||'—')}</b></div>
          <div><small>${local('Quantity','الكمية')}</small><b>${Number(i.quantity||1)}</b><span>${IZZY.money(i.retail_price_at_purchase,o.currency||'EGP')} ${local('each','للوحدة')}</span></div>
        </div>

        ${shipped?`<div class="fulfilled-strip"><span>${local('Shipped','تم الشحن')}</span><b>${IZZY.esc(i.shipping_carrier||local('Carrier','شركة الشحن'))} ${IZZY.esc(i.tracking_number||'')}</b></div>`:
          cancelled?'<div class="notice">'+local('This order item was cancelled.','تم إلغاء هذا العنصر.')+'</div>':
          `<div class="fulfillment-box">
            <div><b>${local('Shipping','الشحن')}</b><small>${local('Add tracking when the order leaves you.','أضف بيانات التتبع عندما يخرج الطلب للشحن.')}</small></div>
            <div class="fulfillment-fields">
              <input data-carrier="${i.id}" placeholder="${local('Shipping carrier','شركة الشحن')}">
              <input data-tracking="${i.id}" placeholder="${local('Tracking number','رقم التتبع')}">
              <button class="btn fulfill-btn" data-id="${i.id}">${local('Mark shipped','تحديد كمشحون')}</button>
            </div>
          </div>`}
      </article>`;
    }).join('')||`<div class="empty-state"><div class="empty-icon">□</div><h3>${local('No orders found','لا توجد طلبات')}</h3><p>${local('Orders will appear here when dropshippers sell your products.','ستظهر الطلبات هنا عندما يبيع الدروبشيبرز منتجاتك.')}</p></div>`;

    document.querySelectorAll('.fulfill-btn').forEach(b=>b.onclick=()=>fulfill(b));
  }

  async function fulfill(btn){
    const id=btn.dataset.id;
    const carrier=document.querySelector(`[data-carrier="${id}"]`)?.value?.trim()||null;
    const tracking=document.querySelector(`[data-tracking="${id}"]`)?.value?.trim()||null;
    btn.disabled=true;btn.textContent=local('Updating…','جارٍ التحديث…');
    try{
      await IZZY.rpc('supplier_fulfill_order_item',{_order_item_id:id,_tracking_number:tracking,_shipping_carrier:carrier});
      msg(local('Order marked shipped.','تم تحديد الطلب كمشحون.'));
      await load(false);
    }catch(e){msg(e.message,true);btn.disabled=false;btn.textContent=local('Mark shipped','تحديد كمشحون')}
  }

  function renderSourcingRequests(){
    const el=$('#supplier-requests');if(!el)return;
    const myQuoteByRequest=new Map((QUOTES||[]).map(q=>[q.request_id,q]));
    const productOptions='<option value="">'+local('Choose an IzzyDrop product','اختر منتجًا على IzzyDrop')+'</option>'+(PRODUCTS||[]).filter(p=>p.status==='active').map(p=>`<option value="${p.id}">${IZZY.esc(productName(p)||p.sku||local('Product','المنتج'))}</option>`).join('');
    el.innerHTML=(REQUESTS||[]).map(r=>{
      const q=myQuoteByRequest.get(r.id);
      return `<article class="card order-card">
        <div class="order-card-head"><div><span class="order-id">${IZZY.esc(r.title)}</span><small>${new Date(r.created_at).toLocaleString()}</small></div><span class="tag ${r.status==='matched'?'ok':'warn'}">${IZZY.esc(r.status)}</span></div>
        <div class="order-summary-grid">
          <div><small>Target cost</small><b>${r.target_cost==null?'—':IZZY.money(r.target_cost,'EGP')}</b></div>
          <div><small>Source</small><b>${r.source_url?'<a href="'+IZZY.esc(r.source_url)+'" target="_blank" rel="noopener">Open link</a>':'—'}</b></div>
          <div><small>Notes</small><span>${IZZY.esc(r.notes||'—')}</span></div>
        </div>
        ${q?`<div class="notice ${q.status==='accepted'?'ok':''}"><b>${local('Your quote','عرضك')}: ${IZZY.money(q.offered_cost,'EGP')}</b><span>${IZZY.esc(q.message||'')} · ${IZZY.esc(window.IZZY_I18N?.status?.(q.status)||q.status)}</span></div>`:
        `<form class="form quote-form" data-request-id="${r.id}">
          <select name="product_id" required>${productOptions}</select>
          <input name="offered_cost" type="number" min="0" step="0.01" placeholder="${local('Select a product to use its price','اختر منتجًا لاستخدام سعره')}" readonly required>
          <input name="available_quantity" type="number" min="0" step="1" placeholder="${local('Available quantity','الكمية المتاحة')}">
          <input name="lead_time_days" type="number" min="0" step="1" placeholder="${local('Lead time days','مدة التجهيز بالأيام')}">
          <input name="message" class="span-2" placeholder="${local('Message / MOQ / notes','رسالة / الحد الأدنى / ملاحظات')}">
          <button class="btn span-2" type="submit">${local('Submit quote','إرسال العرض')}</button>
        </form>`}
      </article>`;
    }).join('')||'<div class="empty-state"><div class="empty-icon">⌕</div><h3>No sourcing requests right now</h3><p>New requests from dropshippers will appear here.</p></div>';

    document.querySelectorAll('.quote-form').forEach(form=>{
      const productSelect=form.querySelector('[name="product_id"]');
      const offered=form.querySelector('[name="offered_cost"]');
      const syncPrice=()=>{
        const p=(PRODUCTS||[]).find(x=>x.id===productSelect.value);
        offered.value=p?Number(p.cost_price||0).toFixed(2):'';
      };
      productSelect.onchange=syncPrice;
      syncPrice();
      form.onsubmit=async e=>{
      e.preventDefault();
      const btn=form.querySelector('button[type="submit"]');
      btn.disabled=true;btn.textContent='Sending…';
      const fd=new FormData(form);
      try{
        await IZZY.rpc('submit_product_request_quote',{
          _request_id:form.dataset.requestId,
          _offered_cost:Number(fd.get('offered_cost')),
          _available_quantity:fd.get('available_quantity')===''?null:Number(fd.get('available_quantity')),
          _lead_time_days:fd.get('lead_time_days')===''?null:Number(fd.get('lead_time_days')),
          _message:String(fd.get('message')||'').trim()||null,
          _product_id:String(fd.get('product_id')||'').trim()||null
        });
        msg('Quote sent to the dropshipper.');
        await load(false);
      }catch(err){msg(err.message,true);btn.disabled=false;btn.textContent=local('Submit quote','إرسال العرض')}
      };
    });
  }


  function renderSamples(){
    const el=$('#supplier-samples');if(!el)return;
    el.innerHTML=(SAMPLES||[]).map(x=>{
      const addr=x.shipping_address||{};
      const name=productName({name:x.product_name,name_en:x.product_name_en,name_ar:x.product_name_ar})||local('Product','المنتج');
      const options=Object.entries(x.variant_options||{}).map(([k,v])=>`${k}: ${v}`).join(' · ');
      const tracking=[x.shipping_carrier,x.tracking_number].filter(Boolean).join(' · ');
      let actions='';
      if(x.status==='requested')actions=`<div class="sample-actions"><button class="btn sample-action" data-id="${x.id}" data-next="approved">${local('Approve','موافقة')}</button><button class="btn secondary sample-action" data-id="${x.id}" data-next="rejected">${local('Reject','رفض')}</button></div>`;
      else if(x.status==='approved')actions=`<div class="sample-ship-form"><input data-sample-carrier="${x.id}" placeholder="${local('Shipping carrier','شركة الشحن')}"><input data-sample-tracking="${x.id}" placeholder="${local('Tracking number','رقم التتبع')}"><button class="btn sample-action" data-id="${x.id}" data-next="shipped">${local('Mark shipped','تحديد كمشحون')}</button></div>`;
      else if(x.status==='shipped')actions=`<div class="sample-actions"><button class="btn secondary sample-action" data-id="${x.id}" data-next="delivered">${local('Mark delivered','تحديد كمُسلّم')}</button></div>`;
      return `<article class="card sample-card">
        <div class="order-card-head"><div><span class="order-id">${IZZY.esc(name)}</span><small>${IZZY.esc(options||x.variant_name||'')} · ${new Date(x.created_at).toLocaleString()}</small></div><span class="tag ${x.status==='delivered'?'ok':x.status==='rejected'?'bad':x.status==='requested'?'warn':''}">${IZZY.esc(window.IZZY_I18N?.status?.(x.status)||x.status)}</span></div>
        <div class="order-summary-grid">
          <div><small>${local('Dropshipper','الدروبشيبر')}</small><b>${IZZY.esc(x.dropshipper_name||'—')}</b></div>
          <div><small>${local('Delivery address','عنوان التوصيل')}</small><b>${IZZY.esc([addr.address1,addr.city,addr.governorate].filter(Boolean).join(', ')||'—')}</b></div>
          <div><small>${local('Tracking','التتبع')}</small><span>${IZZY.esc(tracking||'—')}</span></div>
        </div>
        ${actions}
      </article>`;
    }).join('')||`<div class="empty-state"><div class="empty-icon">□</div><h3>${local('No sample requests','لا توجد طلبات عينات')}</h3><p>${local('Dropshipper sample requests will appear here.','ستظهر طلبات عينات الدروبشيبرز هنا.')}</p></div>`;

    document.querySelectorAll('.sample-action').forEach(btn=>btn.onclick=async()=>{
      const id=btn.dataset.id,next=btn.dataset.next;
      const carrier=document.querySelector(`[data-sample-carrier="${id}"]`)?.value?.trim()||null;
      const tracking=document.querySelector(`[data-sample-tracking="${id}"]`)?.value?.trim()||null;
      btn.disabled=true;
      try{
        await IZZY.rpc('supplier_update_sample_order',{_sample_id:id,_status:next,_tracking_number:tracking,_shipping_carrier:carrier});
        msg(local('Sample request updated.','تم تحديث طلب العينة.'));
        await load(false);
      }catch(e){msg(e.message,true);btn.disabled=false}
    });
  }

  async function load(showMessage=false){
    const [supplierRows,products,variants,orders,items,requests,quotes,categories,samples]=await Promise.all([
      IZZY.request(`/rest/v1/suppliers?select=id,business_name,status,low_stock_threshold,notification_preferences&id=eq.${encodeURIComponent(SUP.id)}&limit=1`),
      IZZY.request(`/rest/v1/supplier_products?select=*&supplier_id=eq.${encodeURIComponent(SUP.id)}&order=created_at.desc`),
      IZZY.request('/rest/v1/product_variants?select=*&order=created_at.asc'),
      IZZY.request('/rest/v1/orders?select=*&order=created_at.desc&limit=150'),
      IZZY.request(`/rest/v1/order_items?select=*&supplier_id=eq.${encodeURIComponent(SUP.id)}&order=created_at.desc&limit=250`),
      IZZY.request('/rest/v1/product_requests?select=*&status=in.(open,matched,accepted)&order=created_at.desc&limit=100'),
      IZZY.request(`/rest/v1/product_request_quotes?select=*&supplier_id=eq.${encodeURIComponent(SUP.id)}&order=created_at.desc&limit=100`),
      IZZY.request('/rest/v1/categories?select=id,name,name_ar&order=name.asc'),
      IZZY.rpc('supplier_samples')
    ]);

    if(supplierRows?.[0]){
      SUP={...SUP,...supplierRows[0]};
      $('#business').textContent=SUP.business_name||'Supplier';
    }
    PRODUCTS=products||[];
    VARIANTS=variants||[];
    ORDERS=orders||[];
    ITEMS=items||[];
    REQUESTS=requests||[];
    QUOTES=quotes||[];
    CATEGORIES=categories||[];
    SAMPLES=Array.isArray(samples)?samples:[];

    if(PRODUCTS.length){
      const ids=PRODUCTS.map(p=>p.id).join(',');
      IMAGES=await IZZY.request(`/rest/v1/product_images?select=*&product_id=in.(${ids})&order=position.asc`);
    }else IMAGES=[];

    refreshCategorySelects();
    renderOverview();
    renderNotifications();
    renderProducts();
    renderSourcingRequests();
    renderSamples();
    renderOrders();
    if(showMessage)msg('Supplier workspace updated.');
  }

  async function toggleProduct(btn){
    const p=productFor(btn.dataset.id);
    const next=btn.dataset.next;
    if(!p)return;
    btn.disabled=true;btn.textContent=next==='inactive'?'Pausing…':'Activating…';
    try{
      await IZZY.request(`/rest/v1/supplier_products?id=eq.${encodeURIComponent(p.id)}`,{
        method:'PATCH',
        body:JSON.stringify({status:next,updated_at:new Date().toISOString()})
      });
      msg(next==='inactive'?'Product paused.':'Product activated.');
      await load(false);
    }catch(e){msg(e.message,true);btn.disabled=false}
  }

  function openEditProduct(id){
    const p=productFor(id);
    if(!p)return;
    $('#edit-product-id').value=p.id;
    $('#edit-product-name-en').value=p.name_en||p.name||'';
    $('#edit-product-name-ar').value=p.name_ar||'';
    $('#edit-product-description-en').value=p.description_en||p.description||'';
    $('#edit-product-description-ar').value=p.description_ar||'';
    $('#edit-product-sku').value=p.sku||'';
    $('#edit-product-cost').value=p.cost_price??0;
    refreshCategorySelects();
    $('#edit-product-category').value=p.category_id||'';
    $('#edit-product-market-status').value=p.status||'active';
    setEditContentLang(p.content_source_language==='ar'?'ar':'en');
    $('#edit-product-retail').value=p.suggested_retail_price??'';

    const vs=variantsFor(id);
    $('#edit-variant-list').innerHTML=vs.map(v=>`<div class="edit-variant-row" data-variant-id="${v.id}">
      <label class="edit-variant-enabled"><input data-edit-variant-enabled type="checkbox" ${v.is_enabled!==false?'checked':''}><span>${local('Available','متاح')}</span></label>
      <div class="edit-variant-name-cell">
        <input data-edit-variant-name value="${IZZY.esc(v.variant_name||'Default')}" placeholder="${local('Variant','الخيار')}">
        <small>${IZZY.esc(variantLabel(v))}</small>
      </div>
      <input data-edit-variant-sku value="${IZZY.esc(v.sku||'')}" placeholder="SKU">
      <input data-edit-variant-stock type="number" min="0" step="1" value="${Number(v.stock_quantity||0)}" placeholder="${local('Stock','المخزون')}">
      <select data-edit-variant-image aria-label="${local('Variant photo','صورة الخيار')}">${existingImageOptions(id,v.variant_image_url||'')}</select>
      <input data-edit-variant-cost type="number" min="0" step="0.01" value="${v.cost_price??''}" placeholder="${local('Supplier price','سعر المورّد')}">
      <input data-edit-variant-retail type="number" min="0" step="0.01" value="${v.suggested_retail_price??''}" placeholder="${local('Suggested sell','سعر البيع المقترح')}">
      <input data-edit-variant-weight type="number" min="0" step="1" value="${v.weight_grams??''}" placeholder="${local('Weight (g)','الوزن (جم)')}">
    </div>`).join('')||'<div class="notice">No variants found.</div>';

    $('#edit-product-status').textContent='';
    $('#product-edit-modal').hidden=false;
  }

  $('#edit-product-form').onsubmit=async e=>{
    e.preventDefault();
    const id=$('#edit-product-id').value,p=productFor(id),btn=$('#save-product-edit');
    if(!p)return;
    btn.disabled=true;btn.textContent='Saving…';
    const st=$('#edit-product-status');st.textContent='Saving product…';st.className='status';
    try{
      await IZZY.request(`/rest/v1/supplier_products?id=eq.${encodeURIComponent(id)}`,{
        method:'PATCH',
        body:JSON.stringify((()=>{
          const nameEn=$('#edit-product-name-en').value.trim()||null;
          const nameAr=$('#edit-product-name-ar').value.trim()||null;
          const descEn=$('#edit-product-description-en').value.trim()||null;
          const descAr=$('#edit-product-description-ar').value.trim()||null;
          const source=p.content_source_language==='ar'?'ar':'en';
          return {
            name_en:nameEn,
            name_ar:nameAr,
            description_en:descEn,
            description_ar:descAr,
            content_source_language:source,
            name:(source==='ar'?(nameAr||nameEn):(nameEn||nameAr)),
            description:(source==='ar'?(descAr||descEn):(descEn||descAr)),
            sku:$('#edit-product-sku').value.trim(),
            cost_price:Number($('#edit-product-cost').value),
            category_id:$('#edit-product-category').value||null,
            suggested_retail_price:$('#edit-product-retail').value===''?null:Number($('#edit-product-retail').value),
            status:$('#edit-product-market-status').value,
            updated_at:new Date().toISOString()
          };
        })())
      });

      const rows=[...document.querySelectorAll('.edit-variant-row[data-variant-id]')];
      for(const row of rows){
        const vid=row.dataset.variantId;
        await IZZY.request(`/rest/v1/product_variants?id=eq.${encodeURIComponent(vid)}`,{
          method:'PATCH',
          body:JSON.stringify({
            variant_name:row.querySelector('[data-edit-variant-name]').value.trim()||'Default',
            sku:row.querySelector('[data-edit-variant-sku]').value.trim()||null,
            stock_quantity:Number(row.querySelector('[data-edit-variant-stock]').value||0),
            cost_price:row.querySelector('[data-edit-variant-cost]').value===''?null:Number(row.querySelector('[data-edit-variant-cost]').value),
            suggested_retail_price:row.querySelector('[data-edit-variant-retail]').value===''?null:Number(row.querySelector('[data-edit-variant-retail]').value),
            weight_grams:row.querySelector('[data-edit-variant-weight]').value===''?null:Number(row.querySelector('[data-edit-variant-weight]').value),
            variant_image_url:row.querySelector('[data-edit-variant-image]').value||null,
            is_enabled:row.querySelector('[data-edit-variant-enabled]').checked,
            updated_at:new Date().toISOString()
          })
        });
      }
      st.textContent='Product updated.';
      await load(false);
      setTimeout(()=>{$('#product-edit-modal').hidden=true},400);
    }catch(err){st.textContent=err.message;st.className='status bad'}
    finally{btn.disabled=false;btn.textContent='Save changes'}
  };

  const OPTION_QUICK_VALUES={
    Color:['Black','White','Blue','Red','Beige'],
    Size:['S','M','L','XL','XXL','One size'],
    Storage:['64 GB','128 GB','256 GB','512 GB'],
    Material:['Cotton','Polyester','Leather']
  };

  function quickValuesForOption(type){
    const category=($('#p-category')?.selectedOptions?.[0]?.textContent||'').toLowerCase();
    if(type==='Size'){
      if(/shoe|footwear|sneaker/.test(category))return ['38','39','40','41','42','43','44'];
      if(/perfume|fragrance/.test(category))return ['30 ml','50 ml','100 ml'];
    }
    return OPTION_QUICK_VALUES[type]||[];
  }
  const MAX_OPTION_TYPES=3;
  const MAX_VARIANT_COMBINATIONS=100;

  function optionCards(){
    return [...document.querySelectorAll('#variant-option-list [data-option-card]')];
  }

  function parseOptionValues(raw){
    const seen=new Set();
    return String(raw||'').split(/[,;\n]+/).map(v=>v.trim()).filter(v=>{
      if(!v)return false;
      const key=v.toLowerCase();
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    });
  }

  function optionDefinitions(strict=false){
    const cards=optionCards();
    if(strict&&!cards.length)throw Error(local('Add at least one product option.','أضف خيارًا واحدًا على الأقل للمنتج.'));
    if(cards.length>MAX_OPTION_TYPES)throw Error(local('Use no more than 3 option types.','استخدم 3 أنواع خيارات كحد أقصى.'));

    const definitions=cards.map((card,index)=>{
      const name=card.querySelector('[data-option-name]').value.trim();
      const values=parseOptionValues(card.querySelector('[data-option-values]').value);
      if(strict&&!name)throw Error(local(`Name Option ${index+1}.`,`اكتب اسم الخيار ${index+1}.`));
      if(strict&&!values.length)throw Error(local(`Add at least one value for ${name||`Option ${index+1}`}.`,`أضف قيمة واحدة على الأقل لـ ${name||`الخيار ${index+1}`}.`));
      return {name,values};
    }).filter(d=>d.name||d.values.length);

    if(strict){
      const names=new Set();
      definitions.forEach(def=>{
        const key=def.name.toLowerCase();
        if(names.has(key))throw Error(local(`Option "${def.name}" is duplicated.`,`الخيار "${def.name}" مكرر.`));
        names.add(key);
      });
    }
    return definitions;
  }

  function variantDefinitionSignature(definitions=optionDefinitions(false)){
    return JSON.stringify(definitions.map(def=>[def.name.toLowerCase(),def.values.map(v=>v.toLowerCase())]));
  }

  function buildVariantCombinations(definitions){
    return definitions.reduce((rows,def)=>{
      const next=[];
      rows.forEach(row=>def.values.forEach(value=>next.push({...row,[def.name]:value})));
      return next;
    },[{}]);
  }

  function variantStateKey(options){
    return JSON.stringify(Object.entries(options).map(([name,value])=>[name.toLowerCase(),String(value).toLowerCase()]));
  }

  function variantImageKey(value){
    return `color:${String(value||'').trim().toLowerCase()}`;
  }

  function captureVariantDraftState(){
    document.querySelectorAll('#variant-combination-list [data-variant-row]').forEach(row=>{
      VARIANT_COMBO_STATE.set(row.dataset.variantKey,{
        enabled:!!row.querySelector('[data-variant-enabled]')?.checked,
        stock:row.querySelector('[data-variant-stock]')?.value??'0',
        cost:row.querySelector('[data-variant-cost]')?.value??'',
        retail:row.querySelector('[data-variant-retail]')?.value??'',
        sku:row.querySelector('[data-variant-sku]')?.value??'',
        weight:row.querySelector('[data-variant-weight]')?.value??''
      });
    });
    document.querySelectorAll('[data-variant-group-image]').forEach(select=>{
      VARIANT_IMAGE_STATE.set(select.dataset.variantImageKey,select.value);
    });
  }

  function updateVariantBuildPreview(){
    const cards=optionCards();
    const preview=$('#variant-build-preview');
    const btn=$('#generate-variants-btn');
    if(!preview||!btn)return;
    if(!cards.length){
      preview.textContent=local('Add an option and its values to see how many variants will be created.','أضف خيارًا وقيمه لمعرفة عدد الخيارات التي سيتم إنشاؤها.');
      btn.disabled=true;
      btn.textContent=local('Add option values first','أضف قيم الخيارات أولًا');
      return;
    }
    const defs=cards.map(card=>({
      name:card.querySelector('[data-option-name]')?.value?.trim()||'',
      values:parseOptionValues(card.querySelector('[data-option-values]')?.value||'')
    }));
    if(defs.some(def=>!def.name||!def.values.length)){
      preview.textContent=local('Complete the option name and values first.','أكمل اسم الخيار وقيمه أولًا.');
      btn.disabled=true;
      btn.textContent=local('Complete option values','أكمل قيم الخيارات');
      return;
    }
    const count=defs.reduce((n,def)=>n*def.values.length,1);
    if(count>MAX_VARIANT_COMBINATIONS){
      preview.textContent=local(`${count} variants is too many. Reduce the values to ${MAX_VARIANT_COMBINATIONS} or fewer.`,`${count} خيارًا عدد كبير جدًا. قلّل القيم إلى ${MAX_VARIANT_COMBINATIONS} أو أقل.`);
      btn.disabled=true;
      btn.textContent=local('Too many variants','عدد خيارات كبير');
      return;
    }
    preview.textContent=local(
      `${count} sellable ${count===1?'variant':'variants'} will be created from ${defs.length} option ${defs.length===1?'type':'types'}.`,
      `سيتم إنشاء ${count} ${count===1?'خيار':'خيارات'} قابلة للبيع من ${defs.length} ${defs.length===1?'نوع':'أنواع'}.`
    );
    btn.disabled=false;
    const currentSignature=variantDefinitionSignature(defs);
    btn.textContent=!VARIANT_GENERATION_SIGNATURE
      ? local(`Build ${count} ${count===1?'variant':'variants'}`,`إنشاء ${count} ${count===1?'خيار':'خيارات'}`)
      : currentSignature===VARIANT_GENERATION_SIGNATURE
        ? local(`Rebuild ${count} ${count===1?'variant':'variants'}`,`إعادة إنشاء ${count} ${count===1?'خيار':'خيارات'}`)
        : local(`Update ${count} ${count===1?'variant':'variants'}`,`تحديث ${count} ${count===1?'خيار':'خيارات'}`);
  }

  function markVariantGenerationStale(){
    updateVariantBuildPreview();
    productWizardSummary();
  }

  function selectedOptionTypeNames(){
    return new Set(optionCards().map(card=>card.querySelector('[data-option-name]')?.value?.trim().toLowerCase()).filter(Boolean));
  }

  function refreshOptionTypeButtons(){
    const selected=selectedOptionTypeNames();
    document.querySelectorAll('[data-add-option-type]').forEach(btn=>{
      const type=btn.dataset.addOptionType;
      btn.disabled=type!=='custom'&&selected.has(type.toLowerCase());
    });
  }

  function addQuickValue(input,value){
    const values=parseOptionValues(input.value);
    if(!values.some(v=>v.toLowerCase()===String(value).toLowerCase()))values.push(value);
    input.value=values.join(', ');
    markVariantGenerationStale();
    updateVariantBuildPreview();
  }

  function addOptionCard(type='custom',prefillValues=[]){
    const box=$('#variant-option-list');
    if(!box)return;
    if(optionCards().length>=MAX_OPTION_TYPES){
      msg(local('You can use up to 3 option types per product.','يمكنك استخدام 3 أنواع خيارات كحد أقصى لكل منتج.'),true);
      return;
    }
    const preset=type!=='custom'?type:'';
    if(preset&&selectedOptionTypeNames().has(preset.toLowerCase()))return;
    const card=document.createElement('div');
    card.className='variant-option-card';
    card.dataset.optionCard='1';
    const quick=quickValuesForOption(preset);
    card.innerHTML=`
      <div class="variant-option-card-head">
        <div><b>${preset?local(preset,preset):local('Custom option','خيار مخصص')}</b><small>${local('Enter the choices a customer can select.','أدخل الاختيارات التي يمكن للعميل تحديدها.')}</small></div>
        <button type="button" class="variant-option-remove" data-remove-option aria-label="${local('Remove option','حذف الخيار')}">×</button>
      </div>
      <div class="variant-option-fields">
        <div class="field">
          <label class="field-label">${local('Option name','اسم الخيار')}</label>
          <input data-option-name value="${IZZY.esc(preset)}" ${preset?'readonly':''} placeholder="${local('e.g. Volume','مثال: السعة')}">
        </div>
        <div class="field">
          <label class="field-label">${local('Values','القيم')}</label>
          <input data-option-values value="${IZZY.esc((prefillValues||[]).join(', '))}" placeholder="${local('Separate values with commas','افصل القيم بفواصل')}">
        </div>
      </div>
      ${quick.length?`<div class="option-quick-values"><small>${local('Quick add','إضافة سريعة')}</small><div>${quick.map(value=>`<button type="button" data-option-quick-value="${IZZY.esc(value)}">${IZZY.esc(value)}</button>`).join('')}</div></div>`:''}
    `;

    card.querySelector('[data-remove-option]').onclick=()=>{
      card.remove();
      markVariantGenerationStale();
      refreshOptionTypeButtons();
      updateCategoryOptionSuggestion();
      updateVariantBuildPreview();
    };
    card.querySelectorAll('[data-option-name],[data-option-values]').forEach(input=>{
      input.addEventListener('input',()=>{
        markVariantGenerationStale();
        refreshOptionTypeButtons();
        updateVariantBuildPreview();
      });
    });
    card.querySelectorAll('[data-option-quick-value]').forEach(btn=>btn.onclick=()=>{
      addQuickValue(card.querySelector('[data-option-values]'),btn.dataset.optionQuickValue);
    });
    box.appendChild(card);
    refreshOptionTypeButtons();
    updateCategoryOptionSuggestion();
    updateVariantBuildPreview();
    card.querySelector(preset?'[data-option-values]':'[data-option-name]')?.focus();
  }

  function optionPresetForCategory(){
    const text=($('#p-category')?.selectedOptions?.[0]?.textContent||'').toLowerCase();
    if(!text||text.includes('choose'))return null;
    if(/clothing|fashion|apparel|shirt|t-shirt|dress|pants|trouser|shoe|footwear|sneaker/.test(text)){
      return {types:['Color','Size'],label:local('Recommended for this category: Color + Size','المقترح لهذه الفئة: اللون + المقاس')};
    }
    if(/phone|smartphone|mobile|tablet/.test(text)){
      return {types:['Color','Storage'],label:local('Recommended for this category: Color + Storage','المقترح لهذه الفئة: اللون + السعة')};
    }
    if(/perfume|fragrance/.test(text)){
      return {types:['Size'],label:local('Recommended for this category: Size','المقترح لهذه الفئة: المقاس')};
    }
    return null;
  }

  function applyOptionPreset(types){
    types.forEach(type=>{
      if(optionCards().length<MAX_OPTION_TYPES&&!selectedOptionTypeNames().has(type.toLowerCase()))addOptionCard(type);
    });
  }

  function updateCategoryOptionSuggestion(){
    const box=$('#variant-category-suggestion');
    if(!box)return;
    const preset=optionPresetForCategory();
    if(SIMPLE_PRODUCT_FLOW||!preset||optionCards().length){
      box.hidden=true;
      box.innerHTML='';
      return;
    }
    box.hidden=false;
    box.innerHTML=`<div><b>${preset.label}</b><small>${local('You can change this — it is only a shortcut.','يمكنك تغييره — هذا مجرد اختصار.')}</small></div><button class="btn secondary" type="button">${local('Use suggestion','استخدم الاقتراح')}</button>`;
    box.querySelector('button').onclick=()=>applyOptionPreset(preset.types);
  }

  function updateVariantGroupPhoto(card){
    if(!card)return;
    const select=card.querySelector('[data-variant-group-image]');
    const preview=card.querySelector('[data-variant-photo-preview]');
    if(!select||!preview)return;
    const index=select.value===''?null:Number(select.value);
    const file=index==null?null:SELECTED_IMAGES[index];
    preview.innerHTML=file
      ? `<img src="${URL.createObjectURL(file)}" alt=""><span>${IZZY.esc(file.name||local('Color photo','صورة اللون'))}</span>`
      : `<span class="manual-variant-photo-empty">${local('Use main product photo','استخدم صورة المنتج الرئيسية')}</span>`;
  }

  function addVariantColorPhotoFile(file,select){
    if(!file)return false;
    const allowed=['image/jpeg','image/png','image/webp'];
    if(!allowed.includes(file.type)||file.size>5*1024*1024){
      msg(local('Photos must be JPG, PNG, or WebP and no larger than 5 MB each.','يجب أن تكون الصور JPG أو PNG أو WebP وبحد أقصى 5 ميجابايت للصورة.'),true);
      return false;
    }
    let index=SELECTED_IMAGES.findIndex(x=>x.name===file.name&&x.size===file.size&&x.lastModified===file.lastModified);
    if(index<0){
      if(SELECTED_IMAGES.length>=6){
        msg(local('You can add up to 6 product photos.','يمكنك إضافة حتى 6 صور للمنتج.'),true);
        return false;
      }
      SELECTED_IMAGES.push(file);
      index=SELECTED_IMAGES.length-1;
      renderSelectedImages();
    }
    refreshVariantPhotoChoices();
    select.value=String(index);
    VARIANT_IMAGE_STATE.set(select.dataset.variantImageKey,select.value);
    updateVariantGroupPhoto(select.closest('[data-variant-photo-card]'));
    productWizardSummary();
    return true;
  }

  function renderVariantColorPhotos(definitions){
    const box=$('#variant-color-photos');
    if(!box)return;
    const colorDef=definitions.find(def=>def.name.toLowerCase()==='color');
    if(!colorDef){
      box.hidden=true;
      box.innerHTML='';
      return;
    }
    box.hidden=false;
    box.innerHTML=`<div class="variant-color-photo-head"><div><b>${local('Photos by color','الصور حسب اللون')}</b><small>${local('Choose one photo for each color. Every size of that color will use it.','اختر صورة واحدة لكل لون. ستستخدم جميع مقاسات هذا اللون نفس الصورة.')}</small></div></div><div class="variant-color-photo-grid"></div>`;
    const grid=box.querySelector('.variant-color-photo-grid');
    colorDef.values.forEach(value=>{
      const key=variantImageKey(value);
      const current=VARIANT_IMAGE_STATE.get(key)??'';
      const card=document.createElement('div');
      card.className='variant-color-photo-card';
      card.dataset.variantPhotoCard='1';
      card.innerHTML=`
        <div class="variant-color-photo-name"><b>${IZZY.esc(value)}</b><small>${local('Color photo','صورة اللون')}</small></div>
        <div class="manual-variant-photo compact" data-variant-photo-preview></div>
        <select data-variant-group-image data-variant-image-key="${IZZY.esc(key)}">${selectedImageOptions(current)}</select>
        <label class="btn secondary variant-color-upload">
          ${local('Upload photo','رفع صورة')}
          <input data-variant-photo-upload type="file" accept="image/jpeg,image/png,image/webp" hidden>
        </label>
      `;
      const select=card.querySelector('[data-variant-group-image]');
      select.value=String(current);
      select.onchange=()=>{
        VARIANT_IMAGE_STATE.set(key,select.value);
        updateVariantGroupPhoto(card);
        productWizardSummary();
      };
      card.querySelector('[data-variant-photo-upload]').onchange=e=>{
        const file=e.target.files?.[0];
        e.target.value='';
        addVariantColorPhotoFile(file,select);
      };
      grid.appendChild(card);
      updateVariantGroupPhoto(card);
    });
  }

  function fillEmptyVariantPricesFromDefaults(){
    if(!VARIANT_PRICES_VARY)return;
    const baseCost=$('#p-cost')?.value??'';
    const baseRetail=$('#p-retail')?.value??'';
    document.querySelectorAll('#variant-combination-list [data-variant-row]').forEach(row=>{
      const cost=row.querySelector('[data-variant-cost]');
      const retail=row.querySelector('[data-variant-retail]');
      if(cost&&cost.value==='')cost.value=baseCost;
      if(retail&&retail.value==='')retail.value=baseRetail;
    });
    captureVariantDraftState();
  }

  function setVariantPricingMode(mode){
    VARIANT_PRICES_VARY=mode==='vary';
    const form=$('#add-form');
    if(form)form.classList.toggle('variant-prices-vary',VARIANT_PRICES_VARY);
    document.querySelectorAll('[data-variant-pricing-mode]').forEach(btn=>{
      btn.classList.toggle('on',btn.dataset.variantPricingMode===(VARIANT_PRICES_VARY?'vary':'same'));
    });
    const note=$('#variant-pricing-note');
    if(note)note.textContent=VARIANT_PRICES_VARY
      ? local('Each enabled variant can have its own supplier price and suggested selling price.','يمكن لكل خيار مفعّل أن يكون له سعر مورد وسعر بيع مقترح خاص به.')
      : local('The product prices below will be used for every variant.','سيتم استخدام أسعار المنتج بالأسفل لكل الخيارات.');
    fillEmptyVariantPricesFromDefaults();
    productWizardSummary();
  }

  function renderVariantCombinations(){
    try{
      captureVariantDraftState();
      const definitions=optionDefinitions(true);
      const combinations=buildVariantCombinations(definitions);
      if(combinations.length>MAX_VARIANT_COMBINATIONS){
        throw Error(local(`That creates ${combinations.length} variants. Keep it to ${MAX_VARIANT_COMBINATIONS} or fewer by removing option values.`,`هذا ينشئ ${combinations.length} خيارًا. اجعله ${MAX_VARIANT_COMBINATIONS} أو أقل بحذف بعض القيم.`));
      }
      VARIANT_GENERATION_SIGNATURE=variantDefinitionSignature(definitions);
      const list=$('#variant-combination-list');
      list.innerHTML='';
      renderVariantColorPhotos(definitions);

      const groupDef=definitions.find(def=>def.name.toLowerCase()==='color')||definitions[0];
      const labelDefs=definitions.filter(def=>def!==groupDef);
      const groups=new Map();
      combinations.forEach(combo=>{
        const value=combo[groupDef.name];
        if(!groups.has(value))groups.set(value,[]);
        groups.get(value).push(combo);
      });

      groups.forEach((combos,groupValue)=>{
        const section=document.createElement('div');
        section.className='variant-generated-group';
        section.innerHTML=`<div class="variant-generated-group-head"><b>${IZZY.esc(groupDef.name)}: ${IZZY.esc(groupValue)}</b><small>${combos.length} ${local(combos.length===1?'version':'versions',combos.length===1?'نسخة':'نسخ')}</small></div><div class="variant-generated-rows"></div>`;
        const rows=section.querySelector('.variant-generated-rows');

        combos.forEach(combo=>{
          const key=variantStateKey(combo);
          const state=VARIANT_COMBO_STATE.get(key)||{
            enabled:true,
            stock:'0',
            cost:VARIANT_PRICES_VARY?($('#p-cost')?.value??''):'',
            retail:VARIANT_PRICES_VARY?($('#p-retail')?.value??''):'',
            sku:'',
            weight:''
          };
          const rest=labelDefs.map(def=>combo[def.name]);
          const label=rest.length?rest.join(' / '):combo[groupDef.name];
          const full=definitions.map(def=>`${def.name}: ${combo[def.name]}`).join(' · ');
          const row=document.createElement('div');
          row.className='variant-generated-row'+(state.enabled===false?' is-disabled':'');
          row.dataset.variantRow='1';
          row.dataset.variantKey=key;
          row.innerHTML=`
            <div class="variant-generated-name"><b>${IZZY.esc(label)}</b><small>${IZZY.esc(full)}</small></div>
            <label class="variant-sell-toggle"><input data-variant-enabled type="checkbox" ${state.enabled===false?'':'checked'}><span>${local('Available','متاح')}</span></label>
            <div class="field"><label class="field-label">${local('Stock','المخزون')}</label><input data-variant-stock type="number" min="0" step="1" value="${IZZY.esc(state.stock??'0')}"></div>
            <div class="field variant-price-field"><label class="field-label">${local('Supplier price','سعر المورّد')}</label><input data-variant-cost type="number" min="0" step="0.01" value="${IZZY.esc(state.cost??'')}" placeholder="${local('Use product price','استخدم سعر المنتج')}"></div>
            <div class="field variant-price-field"><label class="field-label">${local('Suggested sell','سعر البيع المقترح')}</label><input data-variant-retail type="number" min="0" step="0.01" value="${IZZY.esc(state.retail??'')}" placeholder="${local('Use product price','استخدم سعر المنتج')}"></div>
            <div class="field variant-advanced-field"><label class="field-label">${local('Variant SKU','SKU للخيار')}</label><input data-variant-sku value="${IZZY.esc(state.sku??'')}" placeholder="${local('Auto if blank','تلقائي إذا تركته فارغًا')}"></div>
            <div class="field variant-advanced-field"><label class="field-label">${local('Weight (g)','الوزن (جم)')}</label><input data-variant-weight type="number" min="0" step="1" value="${IZZY.esc(state.weight??'')}"></div>
          `;
          const enabled=row.querySelector('[data-variant-enabled]');
          enabled.onchange=()=>{
            row.classList.toggle('is-disabled',!enabled.checked);
            captureVariantDraftState();
            productWizardSummary();
          };
          row.querySelectorAll('input:not([data-variant-enabled])').forEach(input=>input.addEventListener('input',()=>{
            captureVariantDraftState();
            productWizardSummary();
          }));
          rows.appendChild(row);
        });
        list.appendChild(section);
      });

      $('#variant-combination-count').textContent=String(combinations.length);
      const btn=$('#generate-variants-btn');
      updateVariantBuildPreview();
      msg('');
      productWizardSummary();
    }catch(err){
      msg(err.message,true);
    }
  }

  function collectVariants(){
    if(SIMPLE_PRODUCT_FLOW){
      const stock=Number($('#simple-product-stock')?.value||0);
      if(!Number.isFinite(stock)||stock<0)throw Error(local('Enter valid stock.','أدخل مخزونًا صحيحًا.'));
      return [{
        name:'Default',
        sku:null,
        stock,
        cost:null,
        weight_grams:null,
        image_index:null,
        enabled:true,
        options:{}
      }];
    }

    const definitions=optionDefinitions(true);
    const combinations=buildVariantCombinations(definitions);
    if(combinations.length>MAX_VARIANT_COMBINATIONS)throw Error(local('Too many variants. Reduce the option values first.','عدد الخيارات كبير جدًا. قلّل القيم أولًا.'));
    const signature=variantDefinitionSignature(definitions);
    if(!VARIANT_GENERATION_SIGNATURE||signature!==VARIANT_GENERATION_SIGNATURE){
      throw Error(local('Your options changed. Press "Generate variants" before publishing.','تم تغيير الخيارات. اضغط "إنشاء الخيارات" قبل النشر.'));
    }

    captureVariantDraftState();
    const colorDef=definitions.find(def=>def.name.toLowerCase()==='color');
    const variants=combinations.map(combo=>{
      const key=variantStateKey(combo);
      const state=VARIANT_COMBO_STATE.get(key)||{enabled:true,stock:'0',cost:'',retail:'',sku:'',weight:''};
      const enabled=state.enabled!==false;
      const stock=Number(state.stock||0);
      if(enabled&&(!Number.isFinite(stock)||stock<0))throw Error(local(`Enter valid stock for ${Object.values(combo).join(' / ')}.`,`أدخل مخزونًا صحيحًا لـ ${Object.values(combo).join(' / ')}.`));
      const cost=VARIANT_PRICES_VARY?(state.cost===''?null:Number(state.cost)):null;
      const retail=VARIANT_PRICES_VARY?(state.retail===''?null:Number(state.retail)):null;
      if(enabled&&VARIANT_PRICES_VARY&&cost==null)throw Error(local(`Enter the supplier price for ${Object.values(combo).join(' / ')}.`,`أدخل سعر المورّد لـ ${Object.values(combo).join(' / ')}.`));
      if(enabled&&VARIANT_PRICES_VARY&&retail==null)throw Error(local(`Enter the suggested selling price for ${Object.values(combo).join(' / ')}.`,`أدخل سعر البيع المقترح لـ ${Object.values(combo).join(' / ')}.`));
      if(cost!=null&&(!Number.isFinite(cost)||cost<0))throw Error(local('Enter a valid variant supplier price.','أدخل سعر مورد صحيحًا للخيار.'));
      if(retail!=null&&(!Number.isFinite(retail)||retail<0))throw Error(local('Enter a valid variant suggested selling price.','أدخل سعر بيع مقترح صحيحًا للخيار.'));
      const weight=state.weight===''?null:Number(state.weight);
      if(weight!=null&&(!Number.isFinite(weight)||weight<0))throw Error(local('Enter a valid variant weight.','أدخل وزنًا صحيحًا للخيار.'));
      const colorValue=colorDef?combo[colorDef.name]:null;
      const imageValue=colorValue==null?'':(VARIANT_IMAGE_STATE.get(variantImageKey(colorValue))??'');
      return {
        name:Object.values(combo).join(' / '),
        sku:String(state.sku||'').trim()||null,
        stock:enabled?stock:0,
        cost,
        retail,
        weight_grams:weight,
        image_index:imageValue===''?null:Number(imageValue),
        enabled,
        options:combo
      };
    });
    if(!variants.some(v=>v.enabled))throw Error(local('Keep at least one variant enabled.','اترك خيارًا واحدًا على الأقل مفعّلًا.'));
    return variants;
  }

  function resetVariantBuilder(){
    VARIANT_COMBO_STATE.clear();
    VARIANT_IMAGE_STATE.clear();
    VARIANT_GENERATION_SIGNATURE='';
    const options=$('#variant-option-list');
    if(options)options.innerHTML='';
    const combinations=$('#variant-combination-list');
    if(combinations)combinations.innerHTML=`<div class="variant-empty-state">${local('Your variants will appear here after you build them.','ستظهر خيارات المنتج هنا بعد إنشائها.')}</div>`;
    const photos=$('#variant-color-photos');
    if(photos){photos.hidden=true;photos.innerHTML=''}
    if($('#variant-combination-count'))$('#variant-combination-count').textContent='0';
    updateVariantBuildPreview();
    if($('#simple-product-stock'))$('#simple-product-stock').value='0';
    setVariantPricingMode('same');
    refreshOptionTypeButtons();
    updateCategoryOptionSuggestion();
    productWizardSummary();
  }

  function adjustImageReference(value,removedIndex){
    if(value===''||value==null)return '';
    const n=Number(value);
    if(!Number.isInteger(n))return '';
    if(n===removedIndex)return '';
    return String(n>removedIndex?n-1:n);
  }

  function removeSelectedImage(index){
    document.querySelectorAll('[data-variant-group-image]').forEach(select=>{
      select.value=adjustImageReference(select.value,index);
      VARIANT_IMAGE_STATE.set(select.dataset.variantImageKey,select.value);
    });
    SELECTED_IMAGES.splice(index,1);
    const input=$('#p-images');if(input)input.value='';
    renderSelectedImages();
    msg(local('Photo removed.','تم حذف الصورة.'));
  }

  function renderSelectedImages(){
    const box=$('#p-image-preview');
    if(!SELECTED_IMAGES.length)box.innerHTML='<div class="photo-empty">'+local('No photos selected yet.','لم يتم اختيار صور بعد.')+'</div>';
    else box.innerHTML=SELECTED_IMAGES.map((f,i)=>`<div class="photo-preview">
      <img src="${URL.createObjectURL(f)}" alt="">
      <span>${i===0?local('Main photo','الصورة الرئيسية'):`${local('Photo','صورة')} ${i+1}`}</span>
      <button class="photo-remove-btn" type="button" data-remove-image="${i}" aria-label="${local('Remove photo','حذف الصورة')}">×</button>
    </div>`).join('');
    document.querySelectorAll('[data-remove-image]').forEach(btn=>btn.onclick=()=>removeSelectedImage(Number(btn.dataset.removeImage)));
    refreshVariantPhotoChoices();
    productWizardSummary();
  }

  $('#p-images').onchange=e=>{
    const files=[...e.target.files];
    const allowed=['image/jpeg','image/png','image/webp'];
    const bad=files.find(f=>!allowed.includes(f.type)||f.size>5*1024*1024);
    if(bad){msg(local('Photos must be JPG, PNG, or WebP and no larger than 5 MB each.','يجب أن تكون الصور JPG أو PNG أو WebP وبحد أقصى 5 ميجابايت للصورة.'),true);e.target.value='';return}
    const merged=[...SELECTED_IMAGES];
    files.forEach(file=>{
      const duplicate=merged.some(x=>x.name===file.name&&x.size===file.size&&x.lastModified===file.lastModified);
      if(!duplicate)merged.push(file);
    });
    if(merged.length>6){
      msg(local('You can add up to 6 product photos.','يمكنك إضافة حتى 6 صور للمنتج.'),true);
      e.target.value='';
      return;
    }
    SELECTED_IMAGES=merged;
    e.target.value='';
    renderSelectedImages();
    msg(SELECTED_IMAGES.length?local(`${SELECTED_IMAGES.length} product photo${SELECTED_IMAGES.length===1?'':'s'} ready.`,`${SELECTED_IMAGES.length} صورة جاهزة للمنتج.`):'');
  };

  $('#add-form').onsubmit=async e=>{
    e.preventDefault();
    const step1ok=validateProductStep(1);
    if(!step1ok)return;
    if(!SIMPLE_PRODUCT_FLOW&&!validateProductStep(2)){
      $('#variant-builder-card')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    const btn=$('#add-product-btn');btn.disabled=true;btn.textContent=local('Publishing…','جارٍ النشر…');
    try{
      const cost=Number($('#p-cost').value);
      const retail=Number($('#p-retail').value);
      if(!Number.isFinite(cost)||cost<0)throw Error(local('Enter your supplier price.','أدخل سعر المورّد.'));
      if(!Number.isFinite(retail)||retail<0)throw Error(local('Enter a suggested selling price.','أدخل سعر البيع المقترح.'));
      const variants=collectVariants();

      let nameEn=$('#p-name-en').value.trim()||null;
      let nameAr=$('#p-name-ar').value.trim()||null;
      let descEn=$('#p-description-en').value.trim()||null;
      let descAr=$('#p-description-ar').value.trim()||null;
      if(!nameEn&&!nameAr)throw Error(local('Enter the product name.','أدخل اسم المنتج.'));

      if(!nameEn||!nameAr){
        btn.textContent=local('Preparing translation…','جارٍ تجهيز الترجمة…');
        try{
          const from=nameEn?'en':'ar',to=from==='en'?'ar':'en';
          const translated=await translateText(nameEn||nameAr,from,to);
          if(to==='en')nameEn=translated;else nameAr=translated;
        }catch(e){console.warn('Automatic name translation skipped',e)}
      }
      if((descEn&&!descAr)||(descAr&&!descEn)){
        btn.textContent=local('Preparing translation…','جارٍ تجهيز الترجمة…');
        try{
          const from=descEn?'en':'ar',to=from==='en'?'ar':'en';
          const translated=await translateText(descEn||descAr,from,to);
          if(to==='en')descEn=translated;else descAr=translated;
        }catch(e){console.warn('Automatic description translation skipped',e)}
      }
      const result=await IZZY.rpc('supplier_create_product_v2',{
        _name_en:nameEn,
        _name_ar:nameAr,
        _description_en:descEn,
        _description_ar:descAr,
        _source_language:NEW_SOURCE_LANGUAGE,
        _sku:$('#p-sku').value.trim()||null,
        _cost:cost,
        _retail:retail,
        _currency:'EGP',
        _variants:variants,
        _category_id:$('#p-category').value||null,
        _shipping_cost:0
      });

      const pid=result.product_id;
      let uploaded=0;
      const uploadedUrls=[];
      for(let i=0;i<SELECTED_IMAGES.length;i++){
        btn.textContent=`Uploading photo ${i+1} of ${SELECTED_IMAGES.length}…`;
        const file=SELECTED_IMAGES[i],ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
        const path=`${SUP.id}/${pid}/${String(i+1).padStart(2,'0')}-${Date.now()}.${ext}`;
        try{
          const url=await IZZY.uploadProductImage(path,file);
          await IZZY.request('/rest/v1/product_images',{
            method:'POST',
            headers:{Prefer:'return=representation'},
            body:JSON.stringify({product_id:pid,url,position:i})
          });
          uploadedUrls[i]=url;
          uploaded++;
        }catch(photoError){
          console.warn(photoError);
          msg(`Product created, but only ${uploaded} of ${SELECTED_IMAGES.length} photos uploaded.`,true);
          break;
        }
      }

      for(const created of (result.variants||[])){
        const source=variants[Number(created.index)];
        const imageUrl=source?.image_index==null?null:uploadedUrls[source.image_index]||null;
        if(imageUrl){
          await IZZY.request(`/rest/v1/product_variants?id=eq.${encodeURIComponent(created.id)}`,{
            method:'PATCH',
            body:JSON.stringify({variant_image_url:imageUrl,updated_at:new Date().toISOString()})
          });
        }
      }

      e.target.reset();
      const resetLang=window.IZZY_I18N?.isArabic?.()?'ar':'en';NEW_SOURCE_LANGUAGE=resetLang;setNewContentLang(resetLang,false);
      $('#p-translation-status').textContent='';
      SELECTED_IMAGES=[];renderSelectedImages();
      resetVariantBuilder();
      setVariantAdvanced(false);
      setVariantFlow(false,false);
      await load(false);
      go('products');
      msg(`Product added · SKU ${result.sku}${uploaded? ` · ${uploaded} photo${uploaded===1?'':'s'}`:''}.`);
    }catch(err){msg(err.message,true)}
    finally{btn.disabled=false;btn.textContent=local('Publish product','نشر المنتج')}
  };

  $('#toggle-product-variants').onclick=()=>{
    const enable=SIMPLE_PRODUCT_FLOW;
    setVariantFlow(enable,enable);
  };
  $('#toggle-variant-advanced').onclick=()=>setVariantAdvanced(!VARIANT_ADVANCED);
  ['#p-name-en','#p-name-ar','#simple-product-stock','#p-cost','#p-retail'].forEach(sel=>{
    const el=$(sel);if(el)el.addEventListener('input',()=>{
      if(sel==='#p-cost'||sel==='#p-retail')fillEmptyVariantPricesFromDefaults();
      productWizardSummary();
    });
  });
  document.querySelectorAll('[data-add-option-type]').forEach(btn=>btn.onclick=()=>addOptionCard(btn.dataset.addOptionType));
  $('#generate-variants-btn').onclick=renderVariantCombinations;
  document.querySelectorAll('[data-variant-pricing-mode]').forEach(btn=>btn.onclick=()=>setVariantPricingMode(btn.dataset.variantPricingMode));
  $('#p-category').addEventListener('change',updateCategoryOptionSuggestion);
  document.querySelectorAll('.field-info-btn').forEach(btn=>btn.onclick=e=>{
    e.preventDefault();
    e.stopPropagation();
    const key=btn.dataset.fieldHelp;
    const scope=btn.closest('.field')||btn.closest('form');
    const panel=scope?.querySelector(`[data-field-help-panel="${key}"]`);
    document.querySelectorAll('.field-help-panel').forEach(p=>{if(p!==panel)p.hidden=true});
    if(!panel)return;
    panel.textContent=FIELD_HELP[key]?.[window.IZZY_I18N?.isArabic?.()?'ar':'en']||'';
    panel.hidden=!panel.hidden;
    btn.setAttribute('aria-expanded',panel.hidden?'false':'true');
  });
  document.querySelectorAll('[data-new-content-lang]').forEach(b=>b.onclick=()=>setNewContentLang(b.dataset.newContentLang,true));
  document.querySelectorAll('[data-edit-content-lang]').forEach(b=>b.onclick=()=>setEditContentLang(b.dataset.editContentLang));
  $('#p-translate-btn').onclick=translateNewContent;
  $('#edit-translate-btn').onclick=translateEditContent;
  const initialContentLang=window.IZZY_I18N?.isArabic?.()?'ar':'en';NEW_SOURCE_LANGUAGE=initialContentLang;setNewContentLang(initialContentLang,false);setVariantAdvanced(false);resetVariantBuilder();setVariantPricingMode('same');setVariantFlow(false,false);
  $('#supplier-product-search').oninput=renderProducts;
  $('#supplier-product-status').onchange=renderProducts;
  $('#select-all-products').onchange=e=>{
    filteredProducts().forEach(p=>e.target.checked?SELECTED_PRODUCT_IDS.add(p.id):SELECTED_PRODUCT_IDS.delete(p.id));
    renderProducts();
  };
  $('#bulk-clear-products').onclick=()=>{SELECTED_PRODUCT_IDS.clear();renderProducts()};
  $('#bulk-activate-products').onclick=()=>bulkSetProductStatus('active');
  $('#bulk-pause-products').onclick=()=>bulkSetProductStatus('inactive');

  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>go(b.dataset.view));
  document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{
    if(b.dataset.filter)setOrderFilter(b.dataset.filter);
    go(b.dataset.jump);
  });
  document.querySelectorAll('[data-supplier-order-filter]').forEach(b=>b.onclick=()=>setOrderFilter(b.dataset.supplierOrderFilter));

  $('#notification-bell').onclick=e=>{
    e.stopPropagation();
    $('#notification-panel').hidden=!$('#notification-panel').hidden;
  };
  $('#notification-panel').onclick=e=>e.stopPropagation();
  document.addEventListener('click',()=>{$('#notification-panel').hidden=true});

  $('#close-product-edit').onclick=()=>$('#product-edit-modal').hidden=true;
  $('#product-edit-modal').onclick=e=>{if(e.target===$('#product-edit-modal'))$('#product-edit-modal').hidden=true};

  (async()=>{
    try{await verify()}
    catch(e){
      const g=$('#gate-message');
      if(g){g.textContent=e.message;g.style.color='var(--bad)'}
    }
  })();
})();