(()=>{
  const API='https://bbqpowtmzsoorluqwfbm.supabase.co/functions/v1/storefront-gateway';

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=(n,c='EGP')=>{try{return new Intl.NumberFormat('en-EG',{style:'currency',currency:c||'EGP'}).format(Number(n||0))}catch{return `${Number(n||0)} ${c||'EGP'}`}};
  const uid=()=>globalThis.crypto?.randomUUID?.()||('iz-'+Date.now()+'-'+Math.random().toString(16).slice(2));

  function labels(ar){
    return ar?{
      order:'اطلب الآن',variant:'اختر الخيار',qty:'الكمية',name:'اسمك',phone:'رقم الهاتف',email:'البريد الإلكتروني (اختياري)',
      address:'العنوان',city:'المنطقة / الحي',gov:'المحافظة',submit:'تأكيد الطلب',sending:'جارٍ إرسال الطلب…',
      supplier:'المورّد',stock:'متوفر',out:'نفد المخزون',success:'تم استلام طلبك بنجاح',error:'تعذر إرسال الطلب',
      close:'إغلاق',cod:'الدفع عند الاستلام',powered:'مدعوم من IzzyDrop'
    }:{
      order:'Order now',variant:'Choose variant',qty:'Quantity',name:'Your name',phone:'Phone number',email:'Email (optional)',
      address:'Delivery address',city:'Area / district',gov:'Governorate',submit:'Place order',sending:'Sending order…',
      supplier:'Supplier',stock:'in stock',out:'Out of stock',success:'Your order was received',error:'Could not place order',
      close:'Close',cod:'Cash on delivery',powered:'Powered by IzzyDrop'
    };
  }

  function style(){
    return `
      :host{all:initial;font-family:Inter,Arial,sans-serif;color:#111318}
      *{box-sizing:border-box}
      .iz-card{border:1px solid #e4e7eb;border-radius:18px;background:#fff;overflow:hidden;max-width:460px;box-shadow:0 10px 28px rgba(17,19,24,.06)}
      .iz-image{aspect-ratio:4/3;background:#f5f6f8;display:grid;place-items:center;overflow:hidden}
      .iz-image img{width:100%;height:100%;object-fit:cover}
      .iz-body{padding:18px}
      .iz-badge{display:inline-flex;padding:6px 9px;border-radius:999px;background:#eef8f1;font-size:11px;font-weight:800;color:#245d35}
      h3{font-size:21px;line-height:1.15;margin:10px 0 6px;font-weight:900;letter-spacing:-.4px}
      p{font-size:13px;line-height:1.55;color:#68717d;margin:0 0 12px}
      .iz-meta{display:flex;justify-content:space-between;align-items:end;gap:12px;margin:12px 0 14px}
      .iz-price{font-size:20px;font-weight:900}
      .iz-supplier{font-size:11px;color:#68717d;text-align:end}
      button{font:inherit}
      .iz-primary,.iz-secondary{width:100%;border:0;border-radius:11px;padding:12px 14px;font-weight:850;cursor:pointer}
      .iz-primary{background:#111318;color:#fff}
      .iz-primary:disabled{opacity:.55;cursor:not-allowed}
      .iz-secondary{background:#f2f4f6;color:#111318;margin-top:7px}
      .iz-form{display:grid;gap:9px;margin-top:14px;padding-top:14px;border-top:1px solid #eceef1}
      .iz-form[hidden]{display:none}
      .iz-grid{display:grid;grid-template-columns:1fr 100px;gap:8px}
      input,select{width:100%;border:1px solid #dfe3e8;border-radius:10px;padding:11px 12px;font:inherit;font-size:13px;background:#fff;color:#111318}
      .iz-note{font-size:11px;color:#68717d;text-align:center}
      .iz-status{font-size:12px;line-height:1.45;margin-top:7px}
      .iz-status.ok{color:#24703d}.iz-status.bad{color:#a12d2d}
      .iz-powered{text-align:center;font-size:10px;color:#8b929b;margin-top:10px}
      .iz-hp{position:absolute!important;left:-9999px!important;opacity:0!important;pointer-events:none!important}
      [dir="rtl"]{text-align:right;font-family:Tahoma,Arial,sans-serif}
      [dir="rtl"] .iz-meta{direction:rtl}
      @media(max-width:480px){.iz-grid{grid-template-columns:1fr}}
    `;
  }

  async function getProduct(token){
    const r=await fetch(API+'?token='+encodeURIComponent(token),{method:'GET'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(d?.error||'IzzyDrop product unavailable');
    return d;
  }

  async function sendOrder(token,body){
    const r=await fetch(API+'?token='+encodeURIComponent(token),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(d?.error||'Could not place order');
    return d;
  }

  async function mount(host){
    const token=(host.dataset.izzydropToken||host.dataset.izzydrop||'').trim();
    if(!token)return;
    if(host.dataset.izzydropReady==='1')return;
    host.dataset.izzydropReady='1';

    const shadow=host.attachShadow({mode:'open'});
    shadow.innerHTML=`<style>${style()}</style><div class="iz-card"><div class="iz-body">Loading IzzyDrop product…</div></div>`;

    try{
      const p=await getProduct(token);
      const shipping=p.shipping||{};
      const delivery=Number(shipping.delivery_fee);
      const shippingReady=shipping.available===true&&Number.isFinite(delivery);
      const requested=(host.dataset.lang||document.documentElement.lang||navigator.language||'en').toLowerCase();
      const ar=requested.startsWith('ar');
      const L=labels(ar);
      const name=ar?(p.name_ar||p.name_en||p.name):(p.name_en||p.name_ar||p.name);
      const desc=ar?(p.description_ar||p.description_en||p.description):(p.description_en||p.description_ar||p.description);
      const variants=(p.variants||[]);
      const variantLabel=v=>{
        const entries=Object.entries(v?.options||{}).filter(([,value])=>String(value??'').trim());
        return entries.length?entries.map(([name,value])=>`${name}: ${value}`).join(' · '):(v?.name||v?.sku||'Default');
      };
      const inStock=variants.reduce((n,v)=>n+Number(v.stock_quantity||0),0);
      const direction=ar?'rtl':'ltr';

      shadow.innerHTML=`
        <style>${style()}</style>
        <div class="iz-card" dir="${direction}">
          <div class="iz-image">${(p.image_url||variants.find(v=>v.image_url)?.image_url)?`<img class="iz-product-image" src="${esc(p.image_url||variants.find(v=>v.image_url)?.image_url)}" alt="${esc(name)}">`:'<b>IZ</b>'}</div>
          <div class="iz-body">
            <span class="iz-badge">${inStock>0?`${inStock} ${L.stock}`:L.out}</span>
            <h3>${esc(name)}</h3>
            ${desc?`<p>${esc(desc)}</p>`:''}
            <div class="iz-meta">
              <div class="iz-price">${variants.length>1?(ar?'ابتداءً من ':'From '):''}${money(p.retail_price,p.currency)}</div>
              <div class="iz-supplier">${L.supplier}<br><b>${esc(p.supplier_name||'IzzyDrop')}</b></div>
            </div>
            <button class="iz-primary iz-open" ${inStock<=0||!shippingReady?'disabled':''}>${L.order}</button>
            <div class="iz-form" hidden>
              <select class="iz-variant" required>
                <option value="">${L.variant}</option>
                ${variants.map(v=>`<option value="${esc(v.id)}" data-price="${Number(v.retail_price||0)}" ${Number(v.stock_quantity||0)<=0?'disabled':''}>${esc(variantLabel(v))} · ${money(v.retail_price,p.currency)} · ${Number(v.stock_quantity||0)} ${L.stock}</option>`).join('')}
              </select>
              <div class="iz-grid">
                <input class="iz-name" placeholder="${L.name}" autocomplete="name">
                <input class="iz-qty" type="number" min="1" max="50" value="1" placeholder="${L.qty}">
              </div>
              <input class="iz-phone" placeholder="${L.phone}" autocomplete="tel">
              <input class="iz-email" type="email" placeholder="${L.email}" autocomplete="email">
              <input class="iz-address" placeholder="${L.address}" autocomplete="street-address">
              <div class="iz-grid">
                <input class="iz-city" placeholder="${L.city}" autocomplete="address-level2">
                <input class="iz-gov" value="${ar?'القاهرة':'Cairo'}" readonly aria-label="${L.gov}" autocomplete="address-level1">
              </div>
              <input class="iz-hp" tabindex="-1" autocomplete="off" name="website">
              <div class="iz-note">${shippingReady?(ar?'توصيل القاهرة: ':'Cairo delivery: ')+money(delivery,shipping.currency||p.currency)+' · '+L.cod:(ar?'توصيل القاهرة قيد الإعداد':'Cairo delivery is not configured yet')}</div>
              <button class="iz-primary iz-submit">${L.submit}</button>
              <button class="iz-secondary iz-close" type="button">${L.close}</button>
              <div class="iz-status"></div>
            </div>
            <div class="iz-powered">${L.powered}</div>
          </div>
        </div>`;

      const priceEl=shadow.querySelector('.iz-price');
      const variantSelect=shadow.querySelector('.iz-variant');
      const productImage=shadow.querySelector('.iz-product-image');
      const note=shadow.querySelector('.iz-note');
      const qtyInput=shadow.querySelector('.iz-qty');
      function refreshPrice(){
        const option=variantSelect?.selectedOptions?.[0];
        const selectedPrice=option?.dataset?.price?Number(option.dataset.price):Number(p.retail_price||0);
        const qty=Math.max(1,Number(qtyInput?.value||1));
        if(option?.dataset?.price)priceEl.textContent=money(selectedPrice,p.currency);
        else priceEl.textContent=(variants.length>1?(ar?'ابتداءً من ':'From '):'')+money(p.retail_price,p.currency);
        if(note){
          note.textContent=shippingReady
            ? (ar?'توصيل القاهرة: ':'Cairo delivery: ')+money(delivery,shipping.currency||p.currency)+' · '+(ar?'إجمالي الدفع عند الاستلام: ':'COD total: ')+money(selectedPrice*qty+delivery,p.currency)
            : (ar?'توصيل القاهرة قيد الإعداد':'Cairo delivery is not configured yet');
        }
      }
      variantSelect?.addEventListener('change',()=>{
        refreshPrice();
        const selected=variants.find(v=>String(v.id)===String(variantSelect.value));
        if(productImage)productImage.src=selected?.image_url||p.image_url||productImage.src;
      });
      qtyInput?.addEventListener('input',refreshPrice);
      refreshPrice();
      const open=shadow.querySelector('.iz-open');
      const form=shadow.querySelector('.iz-form');
      const close=shadow.querySelector('.iz-close');
      const submit=shadow.querySelector('.iz-submit');
      const status=shadow.querySelector('.iz-status');
      let requestKey=uid();

      open?.addEventListener('click',()=>{form.hidden=false;open.hidden=true});
      close?.addEventListener('click',()=>{form.hidden=true;open.hidden=false;status.textContent='';status.className='iz-status'});

      submit?.addEventListener('click',async()=>{
        const variant=shadow.querySelector('.iz-variant').value;
        const qty=Number(shadow.querySelector('.iz-qty').value||1);
        const customerName=shadow.querySelector('.iz-name').value.trim();
        const phone=shadow.querySelector('.iz-phone').value.trim();
        const email=shadow.querySelector('.iz-email').value.trim();
        const address=shadow.querySelector('.iz-address').value.trim();
        const city=shadow.querySelector('.iz-city').value.trim();
        const governorate=shadow.querySelector('.iz-gov').value.trim();
        const hp=shadow.querySelector('.iz-hp').value;

        if(!variant||!customerName||!phone||!address||!city){
          status.textContent=ar?'أكمل البيانات المطلوبة واختر الخيار.':'Complete the required details and choose a variant.';
          status.className='iz-status bad';
          return;
        }

        submit.disabled=true;submit.textContent=L.sending;status.textContent='';
        try{
          const result=await sendOrder(token,{
            variant_id:variant,quantity:qty,customer_name:customerName,customer_phone:phone,
            customer_email:email||null,address1:address,city,governorate,
            idempotency_key:requestKey,website:hp
          });
          status.textContent=`${L.success} ✓ ${result.reference||''}`;
          status.className='iz-status ok';
          submit.hidden=true;
          close.textContent=L.close;
          requestKey=uid();
        }catch(e){
          status.textContent=(e?.message||L.error);
          status.className='iz-status bad';
          submit.disabled=false;submit.textContent=L.submit;
        }
      });
    }catch(e){
      shadow.innerHTML=`<style>${style()}</style><div class="iz-card"><div class="iz-body"><div class="iz-status bad">${esc(e?.message||'IzzyDrop product unavailable')}</div></div></div>`;
    }
  }

  function scan(){
    document.querySelectorAll('[data-izzydrop-token],[data-izzydrop]').forEach(mount);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);
  else scan();

  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
})();