(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = IZZY.esc;
  const safeUrl = v => { try { const u = new URL(String(v || '')); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
  const money = (v,c) => IZZY.money(Number(v||0),c||'EGP');
  const root = $('#storefront-main');
  const path = location.pathname.split('/').filter(Boolean);
  const last = path[path.length-1] || '';
  const slug = new URLSearchParams(location.search).get('slug') || (last && last !== 'storefront.html' ? last : '');
  const optionLabel = v => {
    const entries=Object.entries(v.options||{}).filter(([,value])=>String(value??'').trim());
    return entries.length?entries.map(([key,value])=>key+': '+value).join(' · '):(v.name||'Default option');
  };
  function errorPage(title,message) {
    root.innerHTML="<section class='storefront-error'><h1>"+esc(title)+"</h1><p class='muted'>"+esc(message)+"</p></section>";
  }
  function renderProduct(p) {
    const images=(Array.isArray(p.images)?p.images:[]).map(safeUrl).filter(Boolean);
    const variants=Array.isArray(p.variants)?p.variants:[];
    const v=variants[0]||null;
    const out=!v||v.in_stock!==true;
    const gallery=images.length
      ? "<div class='storefront-gallery'><img class='storefront-main-image' src='"+esc(images[0])+"' alt='"+esc(p.title)+"' loading='lazy'>"+
        (images.length>1?"<div class='storefront-photo-dots'>"+images.map((url,i)=>"<button type='button' data-photo-index='"+i+"' class='"+(i===0?'on':'')+"' aria-label='View photo "+(i+1)+"'></button>").join('')+"</div>":"")+"</div>"
      : "<div class='storefront-gallery'><div class='storefront-gallery-empty'>IZ</div></div>";
    const select=variants.length>1?"<label><span class='sr-only'>Choose a variant</span><select class='storefront-variant-select' aria-label='Choose a variant'>"+variants.map((x,i)=>"<option value='"+esc(x.id)+"' "+(i===0?'selected':'')+">"+esc(optionLabel(x))+"</option>").join('')+"</select></label>":"";
    return "<article class='storefront-product-card' id='store-product-"+esc(p.id)+"' data-store-product-id='"+esc(p.id)+"'>"+gallery+
      "<div class='storefront-product-content'><h3>"+esc(p.title||'Product')+"</h3><p class='storefront-product-description'>"+esc(p.description||'')+"</p>"+
      "<div class='storefront-price-row'><span class='storefront-price'>"+(v?money(v.price,p.currency):'—')+"</span><span class='storefront-stock "+(out?'out':'')+"'>"+(out?'Out of stock':'Available')+"</span></div>"+
      select+"<div class='storefront-option-note'>"+(v?esc(optionLabel(v)):'No variants are available right now.')+"</div>"+
      "<div class='storefront-coming-soon'>Online ordering is coming soon. This store is currently a product showcase.</div></div></article>";
  }
  function wireProducts(products) {
    $$('.storefront-product-card').forEach(card=>{
      const p=products.find(x=>x.id===card.dataset.storeProductId);if(!p)return;
      const variants=Array.isArray(p.variants)?p.variants:[];
      const select=$('.storefront-variant-select',card),price=$('.storefront-price',card),stock=$('.storefront-stock',card),note=$('.storefront-option-note',card),image=$('.storefront-main-image',card);
      const dots=$$('.storefront-photo-dots button',card),images=(Array.isArray(p.images)?p.images:[]).map(safeUrl).filter(Boolean);
      if(select)select.addEventListener('change',()=>{
        const v=variants.find(x=>x.id===select.value)||variants[0];if(!v)return;
        price.textContent=money(v.price,p.currency);
        const out=v.in_stock!==true;stock.textContent=out?'Out of stock':'Available';stock.classList.toggle('out',out);
        note.textContent=optionLabel(v);
        const vi=safeUrl(v.image_url);if(image&&vi&&images.includes(vi))image.src=vi;
      });
      dots.forEach(button=>button.addEventListener('click',()=>{
        const i=Number(button.dataset.photoIndex);if(image&&images[i])image.src=images[i];dots.forEach(x=>x.classList.toggle('on',x===button));
      }));
    });
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
      const logo=safeUrl(design.logo_url)||safeUrl(store.logo_url);
      const banner=safeUrl(design.banner_url);
      const storeName=store.store_name||'Store';
      const heroTitle=String(design.hero_title||'').trim()||storeName;
      const heroDescription=String(design.hero_description||'').trim()||store.description||'';
      document.title=storeName;
      const descriptionMeta=document.querySelector('meta[name="description"]');
      if(descriptionMeta)descriptionMeta.content=(heroDescription||'Browse the collection from '+storeName+'.').slice(0,160);
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
        ? "<span class='storefront-brand-name'>"+esc(storeName)+"</span>"
        : "<h1 class='storefront-brand-name storefront-brand-name-heading'>"+esc(storeName)+"</h1>";
      const heroHeadingMarkup=hasDistinctHeroTitle
        ? "<h1 class='storefront-store-hero-title'>"+esc(heroTitle)+"</h1>"
        : "";
      root.innerHTML=(announcement?"<div class='storefront-announcement'>"+esc(announcement)+"</div>":"")+
        (banner?"<div class='storefront-banner' role='img' aria-label='Store cover image' style='background-image:url(&quot;"+esc(banner)+"&quot;)'></div>":"")+
        "<section class='storefront-store-hero'>"+
        "<div class='storefront-brand-lockup'>"+
        (logo?"<img class='storefront-logo' src='"+esc(logo)+"' alt='"+esc(storeName)+"'>":"<div class='storefront-logo-fallback' aria-hidden='true'>"+esc(storeName.slice(0,2).toUpperCase())+"</div>")+
        storeNameMarkup+"</div>"+
        "<div class='storefront-hero-copy'>"+heroHeadingMarkup+
        (heroDescription?"<p class='storefront-store-description'>"+esc(heroDescription)+"</p>":"")+"</div>"+
        "<div class='storefront-count'><span class='storefront-count-number'>"+products.length+"</span><span>product"+(products.length===1?'':'s')+"</span></div></section>"+
        "<section class='storefront-products-section'><header class='storefront-products-head'><div><h2>Shop the collection</h2><p>Explore this store’s collection.</p></div></header>"+
        "<div class='storefront-product-grid'>"+(products.length?products.map(renderProduct).join(''):"<div class='storefront-empty-products'><b>No products published yet</b><p>This store is being prepared. Please check back soon.</p></div>")+"</div></section>";
      wireProducts(products);
    } catch(error) {
      errorPage('We couldn’t open this store','Please refresh the page in a moment.');
      console.error('Public storefront load failed:',error);
    }
  }
  init();
})();