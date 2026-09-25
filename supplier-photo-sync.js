(()=>{
  const DRAFT_KEY='izzy_variant_product_draft_v1';
  const $=s=>document.querySelector(s);

  async function syncEditVariantPhotoSelects(){
    const productId=$('#edit-product-id')?.value;if(!productId)return;
    try{
      const [images,variants]=await Promise.all([
        IZZY.request(`/rest/v1/product_images?select=id,url,position&product_id=eq.${encodeURIComponent(productId)}&order=position.asc`),
        IZZY.request(`/rest/v1/product_variants?select=id,variant_image_url&product_id=eq.${encodeURIComponent(productId)}`)
      ]);
      const byId=new Map((variants||[]).map(v=>[String(v.id),v]));
      document.querySelectorAll('#edit-variant-list .edit-variant-row[data-variant-id]').forEach(row=>{
        const select=row.querySelector('[data-edit-variant-image]');if(!select)return;
        const variant=byId.get(String(row.dataset.variantId));
        select.innerHTML='<option value="">Use main photo</option>'+(images||[]).map((img,i)=>`<option value="${IZZY.esc(img.url)}">Photo ${i+1}</option>`).join('');
        const wanted=variant?.variant_image_url||'';
        select.value=[...select.options].some(o=>o.value===wanted)?wanted:'';
      });
    }catch(e){console.warn('Could not sync edited variant photos',e)}
  }

  const photoStatus=$('#edit-photo-status');
  if(photoStatus){
    new MutationObserver(()=>{
      if(/Photo (replaced|removed|added)\./.test(photoStatus.textContent||''))setTimeout(syncEditVariantPhotoSelects,120);
    }).observe(photoStatus,{childList:true,characterData:true,subtree:true});
  }

  const params=new URLSearchParams(location.search);
  if(params.get('view')==='add'&&params.get('restore')==='1'){
    const reapplyCategory=()=>{
      let draft=null;try{draft=JSON.parse(sessionStorage.getItem(DRAFT_KEY)||'null')}catch(e){}
      const select=$('#p-category');
      if(!draft?.category_id||!select)return true;
      if(![...select.options].some(o=>o.value===draft.category_id))return false;
      if(select.value!==draft.category_id){select.value=draft.category_id;select.dispatchEvent(new Event('change',{bubbles:true}))}
      return true;
    };
    if(!reapplyCategory()){
      const started=Date.now();
      const timer=setInterval(()=>{if(reapplyCategory()||Date.now()-started>10000)clearInterval(timer)},120);
    }
  }
})();
