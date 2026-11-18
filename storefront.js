(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = IZZY.esc;
  const safeUrl = v => { try { const u = new URL(String(v || '')); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
  const money = (v,c) => IZZY.money(Number(v||0),c||'EGP');
  const root = $('#storefront-main');
  let language = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const copy = {
    'Opening your store…': 'جارٍ فتح متجرك…',
    'Loading its products and availability.': 'جارٍ تحميل المنتجات والتأكد من توفرها.',
    'Store not found': 'المتجر غير موجود',
    'Check that the store link is correct.': 'تأكد من صحة رابط المتجر.',
    'This store is not available': 'هذا المتجر غير متاح حاليًا',
    'The link may be incorrect, or the store has not been published.': 'قد يكون الرابط غير صحيح أو لم يتم نشر المتجر بعد.',
    'Choose language': 'اختر اللغة',
    'Product': 'منتج',
    'Choose a variant': 'اختر أحد الخيارات',
    'View photo': 'عرض الصورة',
    'Store cover image': 'صورة غلاف المتجر',
    'Out of stock': 'غير متوفر',
    'Available': 'متوفر',
    'No variants are available right now.': 'لا توجد خيارات متاحة حاليًا.',
    'Default option': 'الخيار الافتراضي',
    'Online ordering is coming soon. This store is currently a product showcase.': 'الطلب عبر المتجر سيتاح قريبًا. يمكنك تصفح المنتجات حاليًا.',
    'We couldn’t open this store': 'تعذّر فتح المتجر',
    'Please refresh the page in a moment.': 'يرجى تحديث الصفحة بعد قليل.',
    'Find your next favorite': 'اكتشف ما يناسبك',
    'Take a look around and see what catches your eye.': 'تصفّح المنتجات واختر ما يعجبك.',
    'No products published yet': 'لم تُضف منتجات إلى المتجر بعد',
    'This store is being prepared. Please check back soon.': 'المتجر قيد التجهيز. تفقّد المتجر مرة أخرى قريبًا.',
    'Find something you’ll love.': 'اكتشف منتجات تعجبك.',
    'Find products you’ll love.': 'اكتشف منتجات تعجبك.',
    'Order with cash on delivery': 'اطلب والدفع عند الاستلام',
    'Order details': 'بيانات الطلب',
    'Confirm your delivery details to place a cash-on-delivery order. Delivery is currently available in Cairo only.': 'أدخل بيانات التوصيل لتأكيد طلب الدفع عند الاستلام. التوصيل متاح حاليًا في القاهرة فقط.',
    'Full name': 'الاسم بالكامل',
    'Phone number': 'رقم الهاتف',
    'Email (optional)': 'البريد الإلكتروني (اختياري)',
    'Street address / building / apartment': 'العنوان بالتفصيل / المبنى / الشقة',
    'District / city': 'المنطقة / المدينة',
    'Governorate': 'المحافظة',
    'Google Maps link (optional)': 'رابط Google Maps (اختياري)',
    'Quantity': 'الكمية',
    'Place COD order': 'تأكيد الطلب والدفع عند الاستلام',
    'Order total': 'إجمالي الطلب',
    'Product subtotal': 'إجمالي المنتجات',
    'Cash on delivery': 'الدفع عند الاستلام',
    'Order placed successfully': 'تم تسجيل طلبك بنجاح',
    'Try again': 'حاول مرة أخرى',
    'Your order reference is': 'رقم طلبك هو',
    'Your total is': 'إجمالي طلبك'
  };
  const t = value => language === 'ar' ? (copy[value] || value) : value;
  function setLanguage(nextLanguage, reload = false) {
    language = nextLanguage === 'ar' ? 'ar' : 'en';
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.body.classList.toggle('storefront-arabic', language === 'ar');
    const selector = $('#storefront-language');
    if (selector) {
      selector.value = language;
      selector.setAttribute('aria-label', t('Choose language'));
    }
    if (reload) {
      try { localStorage.setItem('izzy_storefront_language', language); } catch (_) {}
      const url = new URL(location.href);
      url.searchParams.set('lang', language);
      location.assign(url.href);
    }
  }
  function wireLanguageSelector() {
    const selector = $('#storefront-language');
    if (!selector) return;
    setLanguage(language);
    selector.addEventListener('change', () => setLanguage(selector.value, true));
  }
  const path = location.pathname.split('/').filter(Boolean);
  const last = path[path.length-1] || '';
  const slug = new URLSearchParams(location.search).get('slug') || (last && last !== 'storefront.html' ? last : '');
  const optionLabel = v => {
    const entries=Object.entries(v.options||{}).filter(([,value])=>String(value??'').trim());
    return entries.length?entries.map(([key,value])=>key+': '+value).join(' · '):(v.name||t('Default option'));
  };
  function errorPage(title,message) {
    root.innerHTML="<section class='storefront-error'><h1>"+esc(t(title))+"</h1><p class='muted'>"+esc(t(message))+"</p></section>";
  }
  function renderProduct(p) {
    const images=(Array.isArray(p.images)?p.images:[]).map(safeUrl).filter(Boolean);
    const variants=Array.isArray(p.variants)?p.variants:[];
    const v=variants.find(x=>x.in_stock===true)||variants[0]||null;
    const index=Math.max(0,variants.indexOf(v)),out=!variants.some(x=>x.in_stock===true);
    const gallery=images.length
      ? "<div class='storefront-gallery'><img class='storefront-main-image' src='"+esc(images[0])+"' alt='"+esc(p.title)+"' loading='lazy'>"+
        (images.length>1?"<div class='storefront-photo-dots'>"+images.map((url,i)=>"<button type='button' data-photo-index='"+i+"' class='"+(i===0?'on':'')+"' aria-label='"+esc(t('View photo'))+' '+(i+1)+"'></button>").join('')+"</div>":"")+"</div>"
      : "<div class='storefront-gallery'><div class='storefront-gallery-empty'>IZ</div></div>";
    const select=variants.length>1?"<label><span class='sr-only'>"+esc(t('Choose a variant'))+"</span><select class='storefront-variant-select' aria-label='"+esc(t('Choose a variant'))+"'>"+
      variants.map((x,i)=>"<option value='"+esc(x.id)+"' "+(i===index?'selected':'')+">"+esc(optionLabel(x))+(x.in_stock?'':' · '+esc(t('Out of stock')))+"</option>").join('')+"</select></label>":"";
    const orderButton="<button type='button' class='btn storefront-order-button' data-order-product='"+esc(p.id)+"' "+(out?'disabled':'')+">"+esc(t('Order with cash on delivery'))+"</button>";
    return "<article class='storefront-product-card' id='store-product-"+esc(p.id)+"' data-store-product-id='"+esc(p.id)+"'>"+gallery+
      "<div class='storefront-product-content'><h3>"+esc(p.title||t('Product'))+"</h3><p class='storefront-product-description'>"+esc(p.description||'')+"</p>"+
      "<div class='storefront-price-row'><span class='storefront-price'>"+(v?money(v.price,p.currency):'—')+"</span><span class='storefront-stock "+(out?'out':'')+"'>"+(out?t('Out of stock'):t('Available'))+"</span></div>"+
      select+"<div class='storefront-option-note'>"+(v?esc(optionLabel(v)):t('No variants are available right now.'))+"</div>"+
      "<div class='storefront-product-actions'>"+orderButton+"</div></div></article>";
  }
  function wireProducts(products) {
    $$('.storefront-product-card').forEach(card=>{
      const p=products.find(x=>x.id===card.dataset.storeProductId);if(!p)return;
      const variants=Array.isArray(p.variants)?p.variants:[];
      const select=$('.storefront-variant-select',card),price=$('.storefront-price',card),stock=$('.storefront-stock',card),note=$('.storefront-option-note',card),image=$('.storefront-main-image',card),order=$('.storefront-order-button',card);
      const images=(Array.isArray(p.images)?p.images:[]).map(safeUrl).filter(Boolean);
      if(select)select.addEventListener('change',()=>{
        const v=variants.find(x=>x.id===select.value)||variants[0];if(!v)return;
        price.textContent=money(v.price,p.currency);
        const out=v.in_stock!==true;stock.textContent=out?t('Out of stock'):t('Available');stock.classList.toggle('out',out);
        note.textContent=optionLabel(v);if(order)order.disabled=out;
        const vi=safeUrl(v.image_url);if(image&&vi&&images.includes(vi))image.src=vi;
      });
      if(order)order.addEventListener('click',()=>{
        const v=variants.find(x=>x.id===(select?.value||''))||variants.find(x=>x.in_stock===true);
        if(!v||v.in_stock!==true)return;
        openCheckout(p,v);
      });
      $$('.storefront-photo-dots button',card).forEach(button=>button.addEventListener('click',()=>{
        const i=Number(button.dataset.photoIndex);if(image&&images[i])image.src=images[i];
        $$('.storefront-photo-dots button',card).forEach(x=>x.classList.toggle('on',x===button));
      }));
    });
  }
  let checkoutSelection=null,checkoutKey='';
  function checkoutMarkup(){
    return "<section id='storefront-checkout' class='storefront-checkout' hidden>"+
      "<div class='storefront-checkout-head'><div><span class='storefront-checkout-eyebrow'>"+esc(t('Order details'))+"</span><h2>"+esc(t('Order details'))+"</h2></div><button type='button' id='storefront-checkout-close' class='storefront-checkout-close' aria-label='Close'>×</button></div>"+
      "<p class='storefront-checkout-intro'>"+esc(t('Confirm your delivery details to place a cash-on-delivery order. Delivery is currently available in Cairo only.') )+"</p>"+
      "<div class='storefront-checkout-summary'><b id='storefront-checkout-product'></b><span id='storefront-checkout-variant'></span><strong id='storefront-checkout-price'></strong></div>"+
      "<form id='storefront-checkout-form' class='storefront-checkout-form'>"+
      "<label>"+esc(t('Full name'))+"<input id='checkout-name' name='customer_name' autocomplete='name' minlength='2' maxlength='120' required></label>"+
      "<label>"+esc(t('Phone number'))+"<input id='checkout-phone' name='customer_phone' type='tel' autocomplete='tel' minlength='7' maxlength='40' required></label>"+
      "<label>"+esc(t('Email (optional)'))+"<input id='checkout-email' name='customer_email' type='email' autocomplete='email' maxlength='254'></label>"+
      "<label class='storefront-checkout-wide'>"+esc(t('Street address / building / apartment'))+"<textarea id='checkout-address' name='address1' minlength='3' maxlength='500' rows='2' required></textarea></label>"+
      "<label>"+esc(t('District / city'))+"<input id='checkout-city' name='city' minlength='2' maxlength='120' required></label>"+
      "<label>"+esc(t('Governorate'))+"<input id='checkout-governorate' name='governorate' value='"+(language==='ar'?'القاهرة':'Cairo')+"' readonly required></label>"+
      "<label class='storefront-checkout-wide'>"+esc(t('Google Maps link (optional)'))+"<input id='checkout-map' name='map_url' type='url' maxlength='500' placeholder='https://maps.app.goo.gl/...'></label>"+
      "<label>"+esc(t('Quantity'))+"<input id='checkout-quantity' type='number' min='1' max='50' step='1' value='1' required></label>"+
      "<div class='storefront-checkout-total'><span>"+esc(t('Order total'))+"</span><strong id='storefront-checkout-total'></strong><small>"+esc(t('Cash on delivery'))+"</small></div>"+
      "<button class='btn storefront-place-order' type='submit'>"+esc(t('Place COD order'))+"</button>"+
      "<div id='storefront-checkout-status' class='status' role='status' aria-live='polite'></div></form></section>"+
      "<section id='storefront-order-result' class='storefront-order-result' hidden><h2>"+esc(t('Order placed successfully'))+"</h2><p id='storefront-order-result-text'></p><button class='btn secondary' type='button' id='storefront-order-another'>"+esc(t('Try again'))+"</button></section>";
  }
  function updateCheckoutSummary(){
    if(!checkoutSelection)return;
    const quantity=Math.max(1,Math.min(50,Number($('#checkout-quantity').value)||1));
    $('#storefront-checkout-price').textContent=money(checkoutSelection.variant.price,checkoutSelection.product.currency);
    $('#storefront-checkout-total').textContent=money(Number(checkoutSelection.variant.price||0)*quantity,checkoutSelection.product.currency)+' · delivery fee added to total';
  }
  function openCheckout(product,variant){
    checkoutSelection={product,variant};checkoutKey=crypto.randomUUID();
    $('#storefront-order-result').hidden=true;$('#storefront-checkout').hidden=false;
    $('#storefront-checkout-product').textContent=product.title||t('Product');
    $('#storefront-checkout-variant').textContent=optionLabel(variant);
    $('#checkout-quantity').value='1';$('#storefront-checkout-status').textContent='';
    $('#checkout-governorate').value=language==='ar'?'القاهرة':'Cairo';
    updateCheckoutSummary();$('#storefront-checkout').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function wireCheckout(){
    const form=$('#storefront-checkout-form');if(!form)return;
    form.addEventListener('input',()=>{checkoutKey=crypto.randomUUID();updateCheckoutSummary();});
    $('#checkout-quantity').addEventListener('change',updateCheckoutSummary);
    $('#storefront-checkout-close').addEventListener('click',()=>{$('#storefront-checkout').hidden=true;});
    $('#storefront-order-another').addEventListener('click',()=>{$('#storefront-order-result').hidden=true;root.scrollIntoView({behavior:'smooth'});});
    form.addEventListener('submit',submitCheckout);
  }
  async function submitCheckout(event){
    event.preventDefault();if(!checkoutSelection)return;
    const button=$('.storefront-place-order'),status=$('#storefront-checkout-status'),quantity=Number($('#checkout-quantity').value);
    if(!Number.isInteger(quantity)||quantity<1||quantity>50){status.textContent=language==='ar'?'أدخل كمية من 1 إلى 50.':'Enter a quantity from 1 to 50.';return;}
    button.disabled=true;status.textContent=language==='ar'?'جارٍ تسجيل الطلب…':'Placing your order…';
    try{
      const payload={slug,variant_id:checkoutSelection.variant.id,quantity,customer_name:$('#checkout-name').value.trim(),
        customer_phone:$('#checkout-phone').value.trim(),customer_email:$('#checkout-email').value.trim()||null,
        address1:$('#checkout-address').value.trim(),city:$('#checkout-city').value.trim(),
        governorate:$('#checkout-governorate').value.trim(),map_url:$('#checkout-map').value.trim()||null,idempotency_key:checkoutKey};
      const response=await fetch(IZZY.config.supabaseUrl+'/functions/v1/native-storefront-gateway',{
        method:'POST',headers:{'Content-Type':'application/json',apikey:IZZY.config.supabaseKey},body:JSON.stringify(payload)
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data.ok!==true)throw Error(data.error||'Could not place your order. Please try again.');
      $('#storefront-checkout').hidden=true;$('#storefront-order-result').hidden=false;
      $('#storefront-order-result-text').textContent=t('Your order reference is')+' '+data.reference+'. '+t('Your total is')+' '+money(data.total_amount,checkoutSelection.product.currency)+' ('+t('Cash on delivery')+').';
      $('#storefront-order-result').scrollIntoView({behavior:'smooth',block:'center'});form.reset();
    }catch(error){status.textContent=error.message||t('Try again');}
    finally{button.disabled=false;}
  }
  async function init() {
    if(!slug||!/^[a-z0-9]+(-[a-z0-9]+)*$/i.test(slug)){errorPage('Store not found','Check that the store link is correct.');return;}
    try {
      const result=await IZZY.rpc('public_dropshipper_store_by_slug',{_slug:slug},false);
      if(!result||!result.store){errorPage('This store is not available','The link may be incorrect, or the store has not been published.');return;}
      const store=result.store,products=Array.isArray(result.products)?result.products:[];
      const designResponse=await fetch(IZZY.config.supabaseUrl+'/rest/v1/dropshipper_store_designs?select=settings&store_id=eq.'+encodeURIComponent(store.id),{headers:{apikey:IZZY.config.supabaseKey}}).catch(()=>null);
      const designRows=designResponse?.ok?await designResponse.json().catch(()=>[]):[];
      const rawDesign=Array.isArray(designRows)?designRows[0]?.settings:null;
      const design=rawDesign&&typeof rawDesign==='object'?rawDesign:{};
      const allowedTemplates=['clean','editorial','bold'];
      const template=allowedTemplates.includes(design.template)?design.template:'clean';
      const colors=['accent_color','background_color','text_color'];
      const validColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
      const palette={
        accent_color:validColor(design.accent_color)?design.accent_color:'#c9f36a',
        background_color:validColor(design.background_color)?design.background_color:'#fbfbfc',
        text_color:validColor(design.text_color)?design.text_color:'#15171b'
      };
      const fonts={modern:'Arial,Helvetica,sans-serif',classic:'Georgia,serif',rounded:'Trebuchet MS,Arial,sans-serif'};
      document.body.classList.add('store-template-'+template);
      document.documentElement.style.setProperty('--store-accent',palette.accent_color);
      document.documentElement.style.setProperty('--store-page-background',palette.background_color);
      document.documentElement.style.setProperty('--store-ink',palette.text_color);
      document.documentElement.style.setProperty('--store-font',fonts[design.font]||fonts.modern);
      const themeMeta=document.querySelector('meta[name="theme-color"]');
      if(themeMeta)themeMeta.content=palette.background_color;
      const logo=safeUrl(design.logo_url)||safeUrl(store.logo_url);
      const banner=safeUrl(design.banner_url);
      const storeName=store.store_name||'Store';
      const heroTitle=String(design.hero_title||'').trim()||storeName;
      const heroDescription=String(design.hero_description||'').trim()||store.description||'';
      document.title=storeName;
      const descriptionMeta=document.querySelector('meta[name="description"]');
      if(descriptionMeta)descriptionMeta.content=(heroDescription||t('Find products you’ll love.')).slice(0,160);
      const favicon=document.querySelector('link[rel="icon"]');
      if(logo){
        const storeFavicon=favicon||document.createElement('link');
        storeFavicon.rel='icon';
        storeFavicon.href=logo;
        if(!favicon)document.head.append(storeFavicon);
      }else if(favicon){
        favicon.remove();
      }
      const announcement=String(design.announcement||'').trim();
      const hasDistinctHeroTitle=heroTitle.trim().toLocaleLowerCase()!==storeName.trim().toLocaleLowerCase();
      const storeNameMarkup=hasDistinctHeroTitle
        ? "<span class='storefront-header-store-name'>"+esc(storeName)+"</span>"
        : "<h1 class='storefront-header-store-name'>"+esc(storeName)+"</h1>";
      const heroHeadingMarkup=hasDistinctHeroTitle
        ? "<h1 class='storefront-store-hero-title'>"+esc(heroTitle)+"</h1>"
        : "";
      const headerBrand=$('#storefront-brand');
      if(headerBrand){
        headerBrand.innerHTML=(logo
          ? "<img class='storefront-header-logo' src='"+esc(logo)+"' alt=''>"
          : "<div class='storefront-header-logo-fallback' aria-hidden='true'>"+esc(storeName.slice(0,2).toUpperCase())+"</div>")+storeNameMarkup;
        headerBrand.hidden=false;
        headerBrand.setAttribute('aria-label',storeName);
      }
      root.innerHTML=(announcement?"<div class='storefront-announcement'>"+esc(announcement)+"</div>":"")+
        (banner?"<div class='storefront-banner' role='img' aria-label='"+esc(t('Store cover image'))+"' style='background-image:url(&quot;"+esc(banner)+"&quot;)'></div>":"")+
        "<section class='storefront-store-hero'>"+
        "<div class='storefront-hero-copy'>"+heroHeadingMarkup+
        (heroDescription?"<p class='storefront-store-description'>"+esc(heroDescription)+"</p>":"")+"</div>"+
        "</section>"+
        "<section class='storefront-products-section'><header class='storefront-products-head'><div><h2>"+esc(t('Find your next favorite'))+"</h2><p>"+esc(t('Take a look around and see what catches your eye.'))+"</p></div></header>"+
        "<div class='storefront-product-grid'>"+(products.length?products.map(renderProduct).join(''):"<div class='storefront-empty-products'><b>"+esc(t('No products published yet'))+"</b><p>"+esc(t('This store is being prepared. Please check back soon.'))+"</p></div>")+"</div></section>"+checkoutMarkup();
      wireProducts(products);
      wireCheckout();
    } catch(error) {
      errorPage('We couldn’t open this store','Please refresh the page in a moment.');
      console.error('Public storefront load failed:',error);
    }
  }
  wireLanguageSelector();
  const loadingTitle=$('.storefront-loading h1');
  const loadingDescription=$('.storefront-loading p');
  if(loadingTitle)loadingTitle.textContent=t('Opening your store…');
  if(loadingDescription)loadingDescription.textContent=t('Loading its products and availability.');
  init();
})();