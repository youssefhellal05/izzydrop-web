(()=>{
  const $=s=>document.querySelector(s);
  const modal=$('#product-edit-modal');
  const form=$('#edit-product-form');
  if(!modal||!form||!window.IZZY)return;

  let supplierId=null;

  const style=document.createElement('style');
  style.textContent=`
    #edit-variant-list{display:grid;gap:12px}
    .edit-variant-row.variant-edit-card{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;padding:14px!important;border:1px solid var(--line)!important;border-radius:14px!important;background:var(--soft)!important;align-items:start!important}
    .variant-edit-card-head{grid-column:1/-1;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:9px;border-bottom:1px solid var(--line)}
    .variant-edit-card-head div{display:grid;gap:2px}.variant-edit-card-head b{font-size:12px}.variant-edit-card-head small{color:var(--muted);font-size:9px}
    .variant-edit-field{display:grid;gap:5px;min-width:0}.variant-edit-field>span,.variant-edit-name-label{font-size:9px;font-weight:850;color:var(--muted)}.variant-edit-field>small{font-size:8px;color:var(--muted);line-height:1.35}
    .variant-edit-card .edit-variant-name-cell{grid-column:1/-1;display:grid;gap:5px}.variant-edit-card .edit-variant-name-cell>small{color:var(--muted)}
    .variant-edit-card .edit-variant-enabled{grid-column:1/-1;justify-self:start}
    .variant-option-editor{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px;border:1px solid var(--line);border-radius:11px;background:var(--card)}
    .variant-option-editor-head{grid-column:1/-1;display:grid;gap:2px}.variant-option-editor-head b{font-size:10px}.variant-option-editor-head small{font-size:8px;color:var(--muted)}
    .variant-edit-photo-preview{grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:9px;border:1px solid var(--line);border-radius:11px;background:var(--card)}.variant-edit-photo-preview img{width:54px;height:54px;border-radius:9px;object-fit:cover;background:var(--soft)}.variant-edit-photo-preview div{display:grid;gap:2px}.variant-edit-photo-preview small{font-size:8px;color:var(--muted)}
    .variant-edit-actions{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:4px}.variant-edit-actions-left{display:flex;flex-wrap:wrap;gap:8px}.variant-edit-status{font-size:9px;color:var(--muted)}.variant-edit-status.bad{color:var(--bad)}.variant-edit-status.ok{color:var(--good)}
    @media(max-width:640px){.edit-variant-row.variant-edit-card,.variant-option-editor{grid-template-columns:1fr!important}.variant-edit-field,.variant-edit-card .edit-variant-name-cell,.variant-option-editor,.variant-edit-photo-preview,.variant-edit-actions,.variant-edit-card-head,.variant-edit-card .edit-variant-enabled{grid-column:1!important}.variant-edit-actions{align-items:stretch;flex-direction:column}.variant-edit-actions-left{display:grid}.variant-edit-actions .btn{width:100%}}
  `;
  document.head.appendChild(style);

  async function getSupplierId(){
    if(supplierId)return supplierId;
    const uid=IZZY.session()?.user?.id;
    if(!uid)throw Error('Please log in again.');
    const rows=await IZZY.request(`/rest/v1/suppliers?select=id&profile_id=eq.${encodeURIComponent(uid)}&limit=1`);
    supplierId=rows?.[0]?.id||null;
    if(!supplierId)throw Error('Supplier account not found.');
    return supplierId;
  }

  async function getVariantDetails(productId){
    return await IZZY.request(`/rest/v1/product_variants?select=id,option_values,barcode,variant_image_url&product_id=eq.${encodeURIComponent(productId)}&order=created_at.asc`);
  }

  async function getProductImages(productId){
    return await IZZY.request(`/rest/v1/product_images?select=id,url,position&product_id=eq.${encodeURIComponent(productId)}&order=position.asc`);
  }

  function setCardStatus(row,text,type=''){
    const el=row.querySelector('.variant-edit-status');
    if(!el)return;
    el.textContent=text||'';
    el.className='variant-edit-status'+(type?` ${type}`:'');
  }

  function wrapControl(control,labelText,help=''){
    if(!control||control.closest('.variant-edit-field'))return;
    const wrapper=document.createElement('label');
    wrapper.className='variant-edit-field';
    const label=document.createElement('span');
    label.textContent=labelText;
    control.parentNode.insertBefore(wrapper,control);
    wrapper.append(label,control);
    if(help){const small=document.createElement('small');small.textContent=help;wrapper.appendChild(small)}
  }

  function readOptions(row){
    const result={};
    row.querySelectorAll('[data-edit-option-key]').forEach(input=>{
      const key=input.dataset.editOptionKey;
      const value=input.value.trim();
      if(!value)throw Error(`${key} cannot be blank.`);
      result[key]=value;
    });
    return result;
  }

  function readVariantBody(row,includeEverything=true){
    const costInput=row.querySelector('[data-edit-variant-cost]');
    const retailInput=row.querySelector('[data-edit-variant-retail]');
    const stockInput=row.querySelector('[data-edit-variant-stock]');
    const weightInput=row.querySelector('[data-edit-variant-weight]');
    const cost=costInput?.value===''?null:Number(costInput?.value);
    const retail=retailInput?.value===''?null:Number(retailInput?.value);
    const stock=Number(stockInput?.value||0);
    const weight=weightInput?.value===''?null:Number(weightInput?.value);
    if(!Number.isFinite(stock)||stock<0)throw Error('Stock must be 0 or more.');
    if(cost!=null&&(!Number.isFinite(cost)||cost<0))throw Error('Supplier price must be 0 or more.');
    if(retail!=null&&(!Number.isFinite(retail)||retail<0))throw Error('Suggested customer price must be 0 or more.');
    if(cost!=null&&retail!=null&&retail<cost)throw Error('Suggested customer price cannot be below the supplier price.');
    if(weight!=null&&(!Number.isFinite(weight)||weight<0))throw Error('Weight must be 0 or more.');

    const base={
      option_values:readOptions(row),
      barcode:row.querySelector('[data-edit-variant-barcode]')?.value.trim()||null,
      updated_at:new Date().toISOString()
    };
    if(!includeEverything)return base;
    return {
      ...base,
      variant_name:row.querySelector('[data-edit-variant-name]')?.value.trim()||'Default',
      sku:row.querySelector('[data-edit-variant-sku]')?.value.trim()||null,
      stock_quantity:stock,
      cost_price:cost,
      suggested_retail_price:retail,
      weight_grams:weight,
      variant_image_url:row.querySelector('[data-edit-variant-image]')?.value||null,
      is_enabled:row.querySelector('[data-edit-variant-enabled]')?.checked!==false
    };
  }

  async function saveVariantCard(row){
    const id=row.dataset.variantId;
    if(!id)return;
    const button=row.querySelector('[data-save-one-variant]');
    if(button){button.disabled=true;button.textContent='Saving…'}
    setCardStatus(row,'Saving this variant…');
    try{
      const body=readVariantBody(row,true);
      await IZZY.request(`/rest/v1/product_variants?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(body)});
      const title=row.querySelector('.variant-edit-card-head b');
      if(title)title.textContent=body.variant_name||'Variant';
      setCardStatus(row,'Variant saved.','ok');
    }catch(err){
      setCardStatus(row,err.message||'Could not save this variant.','bad');
    }finally{
      if(button){button.disabled=false;button.textContent='Save this variant'}
    }
  }

  async function refreshPhotoSelects(productId,preferredRow=null,preferredUrl=''){
    const images=await getProductImages(productId);
    document.querySelectorAll('#edit-variant-list [data-edit-variant-image]').forEach(select=>{
      const row=select.closest('[data-variant-id]');
      const current=(row===preferredRow&&preferredUrl)?preferredUrl:select.value;
      select.innerHTML='<option value="">Use main product photo</option>';
      (images||[]).forEach((img,index)=>{
        const option=document.createElement('option');
        option.value=img.url;
        option.textContent=`Photo ${index+1}`;
        select.appendChild(option);
      });
      if([...select.options].some(option=>option.value===current))select.value=current;
      updatePhotoPreview(row);
    });
  }

  function updatePhotoPreview(row){
    if(!row)return;
    const preview=row.querySelector('[data-variant-photo-preview]');
    const select=row.querySelector('[data-edit-variant-image]');
    if(!preview||!select)return;
    const url=select.value;
    const img=preview.querySelector('img');
    const note=preview.querySelector('small');
    if(url){img.src=url;img.hidden=false;if(note)note.textContent='This photo is assigned to this variant.'}
    else{img.removeAttribute('src');img.hidden=true;if(note)note.textContent='Using the main product photo.'}
  }

  function validImage(file){
    return file&&['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size<=5*1024*1024;
  }

  async function uploadVariantPhoto(row,file){
    if(!validImage(file))throw Error('Use a JPG, PNG, or WebP image up to 5 MB.');
    const productId=$('#edit-product-id')?.value;
    const variantId=row.dataset.variantId;
    if(!productId||!variantId)throw Error('Open the product again and retry.');
    const images=await getProductImages(productId);
    if((images||[]).length>=6)throw Error('This product already has 6 photos. Remove or replace one product photo first.');
    const sid=await getSupplierId();
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
    const path=`${sid}/${productId}/variant-${variantId}-${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`;
    setCardStatus(row,'Uploading variant photo…');
    const url=await IZZY.uploadProductImage(path,file);
    await IZZY.request('/rest/v1/product_images',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({product_id:productId,url,position:(images||[]).length})});
    await IZZY.request(`/rest/v1/product_variants?id=eq.${encodeURIComponent(variantId)}`,{method:'PATCH',body:JSON.stringify({variant_image_url:url,updated_at:new Date().toISOString()})});
    await refreshPhotoSelects(productId,row,url);
    setCardStatus(row,'Variant photo updated.','ok');
  }

  function buildOptionEditor(row,options){
    let editor=row.querySelector('.variant-option-editor');
    if(editor)editor.remove();
    editor=document.createElement('div');
    editor.className='variant-option-editor';
    const head=document.createElement('div');
    head.className='variant-option-editor-head';
    const title=document.createElement('b');title.textContent='Variant options';
    const help=document.createElement('small');help.textContent='Change the value for this exact version, for example Black → Navy or Large → XL.';
    head.append(title,help);editor.appendChild(head);
    const entries=Object.entries(options||{});
    if(!entries.length){
      const empty=document.createElement('small');empty.className='muted';empty.textContent='This product has no named option values.';editor.appendChild(empty);
    }else{
      entries.forEach(([key,value])=>{
        const label=document.createElement('label');label.className='variant-edit-field';
        const span=document.createElement('span');span.textContent=key;
        const input=document.createElement('input');input.dataset.editOptionKey=key;input.value=String(value??'');
        label.append(span,input);editor.appendChild(label);
      });
    }
    const actions=row.querySelector('.variant-edit-actions');
    row.insertBefore(editor,actions||null);
  }

  function enhanceRow(row,details){
    if(row.dataset.variantEditorEnhanced==='1'){
      buildOptionEditor(row,details?.option_values||{});
      const barcode=row.querySelector('[data-edit-variant-barcode]');if(barcode)barcode.value=details?.barcode||'';
      updatePhotoPreview(row);
      return;
    }
    row.dataset.variantEditorEnhanced='1';
    row.classList.add('variant-edit-card');

    const nameCell=row.querySelector('.edit-variant-name-cell');
    const nameInput=row.querySelector('[data-edit-variant-name]');
    if(nameCell&&!nameCell.querySelector('.variant-edit-name-label')){
      const label=document.createElement('span');label.className='variant-edit-name-label';label.textContent='Variant name';nameCell.prepend(label);
    }

    const header=document.createElement('div');header.className='variant-edit-card-head';
    const headerText=document.createElement('div');
    const headerTitle=document.createElement('b');headerTitle.textContent=nameInput?.value||'Variant';
    const headerHelp=document.createElement('small');headerHelp.textContent='Everything in this card changes only this variant.';
    headerText.append(headerTitle,headerHelp);
    const badge=document.createElement('span');badge.className='tag';badge.textContent='Editable variant';
    header.append(headerText,badge);row.prepend(header);

    wrapControl(row.querySelector('[data-edit-variant-sku]'),'SKU','Your internal code for this variant.');
    wrapControl(row.querySelector('[data-edit-variant-stock]'),'Stock','How many units of this exact variant are available.');
    wrapControl(row.querySelector('[data-edit-variant-image]'),'Variant photo','Choose a saved product photo for this variant.');
    wrapControl(row.querySelector('[data-edit-variant-cost]'),'Supplier price — dropshipper pays you','Leave blank only if this variant should inherit the product price.');
    wrapControl(row.querySelector('[data-edit-variant-retail]'),'Suggested customer price','The selling price you recommend for this exact variant.');
    wrapControl(row.querySelector('[data-edit-variant-weight]'),'Weight (g)','Optional shipping weight for this variant.');

    const barcodeField=document.createElement('label');barcodeField.className='variant-edit-field';
    const barcodeLabel=document.createElement('span');barcodeLabel.textContent='Barcode';
    const barcodeInput=document.createElement('input');barcodeInput.dataset.editVariantBarcode='1';barcodeInput.value=details?.barcode||'';barcodeInput.placeholder='Optional';
    barcodeField.append(barcodeLabel,barcodeInput);row.appendChild(barcodeField);

    const preview=document.createElement('div');preview.className='variant-edit-photo-preview';preview.dataset.variantPhotoPreview='1';
    const image=document.createElement('img');image.alt='Variant photo';image.hidden=true;
    const previewText=document.createElement('div');const previewTitle=document.createElement('b');previewTitle.textContent='Variant photo';const previewNote=document.createElement('small');previewText.append(previewTitle,previewNote);preview.append(image,previewText);row.appendChild(preview);

    const actions=document.createElement('div');actions.className='variant-edit-actions';
    const left=document.createElement('div');left.className='variant-edit-actions-left';
    const upload=document.createElement('button');upload.type='button';upload.className='btn secondary';upload.textContent='Upload / change variant photo';
    const file=document.createElement('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';file.hidden=true;
    upload.onclick=()=>file.click();
    file.onchange=async()=>{
      const selected=file.files?.[0];file.value='';if(!selected)return;
      upload.disabled=true;upload.textContent='Uploading…';
      try{await uploadVariantPhoto(row,selected)}catch(err){setCardStatus(row,err.message||'Could not upload photo.','bad')}
      finally{upload.disabled=false;upload.textContent='Upload / change variant photo'}
    };
    const save=document.createElement('button');save.type='button';save.className='btn';save.dataset.saveOneVariant='1';save.textContent='Save this variant';save.onclick=()=>saveVariantCard(row);
    left.append(upload,file,save);
    const status=document.createElement('span');status.className='variant-edit-status';
    actions.append(left,status);row.appendChild(actions);

    buildOptionEditor(row,details?.option_values||{});
    const photoSelect=row.querySelector('[data-edit-variant-image]');
    if(photoSelect)photoSelect.addEventListener('change',()=>updatePhotoPreview(row));
    updatePhotoPreview(row);
  }

  async function enhanceVariantEditor(){
    const productId=$('#edit-product-id')?.value;
    if(!productId)return;
    const rows=[...document.querySelectorAll('#edit-variant-list [data-variant-id]')];
    if(!rows.length)return;
    try{
      const variants=await getVariantDetails(productId);
      const map=new Map((variants||[]).map(v=>[String(v.id),v]));
      rows.forEach(row=>enhanceRow(row,map.get(String(row.dataset.variantId))||{}));
      await refreshPhotoSelects(productId);
    }catch(err){console.warn('Could not enhance variant editor',err)}
  }

  const originalSubmit=form.onsubmit;
  if(originalSubmit&&!form.dataset.variantExtrasWrapped){
    form.dataset.variantExtrasWrapped='1';
    form.onsubmit=async function(event){
      event.preventDefault();
      try{
        for(const row of document.querySelectorAll('#edit-variant-list [data-variant-id]')){
          if(!row.querySelector('[data-edit-option-key]')&&!row.querySelector('[data-edit-variant-barcode]'))continue;
          const body=readVariantBody(row,false);
          await IZZY.request(`/rest/v1/product_variants?id=eq.${encodeURIComponent(row.dataset.variantId)}`,{method:'PATCH',body:JSON.stringify(body)});
        }
      }catch(err){
        const status=$('#edit-product-status')||$('#status');
        if(status){status.textContent=err.message||'Could not save variant details.';status.className='status bad'}
        return;
      }
      return originalSubmit.call(this,event);
    };
  }

  new MutationObserver(()=>{
    if(!modal.hidden)setTimeout(()=>enhanceVariantEditor(),80);
  }).observe(modal,{attributes:true,attributeFilter:['hidden']});
  document.addEventListener('click',event=>{
    if(event.target.closest?.('.edit-product-btn'))setTimeout(()=>enhanceVariantEditor(),120);
  },true);
})();
