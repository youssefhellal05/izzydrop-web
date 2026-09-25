window.IZZY_CONFIG = {
  supabaseUrl: 'https://bbqpowtmzsoorluqwfbm.supabase.co',
  supabaseKey: 'sb_publishable_7zwBJFyaTcCrIG8hvmUQuQ_IzPEfZA7'
};

// One visual language across every IzzyDrop surface.
(()=>{
  if (document.querySelector('link[data-izzydrop-design]')) return;
  const design = document.createElement('link');
  design.rel = 'stylesheet';
  design.href = 'izzydrop-design.css?v=20260925-cohesion1';
  design.dataset.izzydropDesign = '1';
  document.head.appendChild(design);
})();

// Supplier-only UI refinements are isolated from the shared app scripts.
if (/\/supplier\.html$/i.test(location.pathname)) {
  window.addEventListener('load', () => {
    const flow = document.createElement('script');
    flow.src = 'supplier-overrides.js?v=20260925-simpleflows2';
    flow.async = false;
    flow.onload = () => {
      const sync = document.createElement('script');
      sync.src = 'supplier-photo-sync.js?v=20260925-simpleflows2';
      sync.async = false;
      document.body.appendChild(sync);

      const variantEdit = document.createElement('script');
      variantEdit.src = 'supplier-variant-edit.js?v=20260925-variantedit1';
      variantEdit.async = false;
      document.body.appendChild(variantEdit);
    };
    document.body.appendChild(flow);
  }, { once: true });
}

// Make variant creation explain pricing in plain language and expose per-variant prices clearly.
if (/\/supplier-variant\.html$/i.test(location.pathname)) {
  window.addEventListener('load', () => {
    const script = document.createElement('script');
    script.src = 'supplier-variant-create-help.js?v=20260925-variantpublish1';
    script.async = false;
    document.body.appendChild(script);
  }, { once: true });
}

// Keep sourcing requests simple: dropshippers pick an image file instead of pasting an image URL.
if (/\/app\.html$/i.test(location.pathname)) {
  window.addEventListener('load', () => {
    const script = document.createElement('script');
    script.src = 'app-request-image-upload.js?v=20260925-fileupload1';
    script.async = false;
    document.body.appendChild(script);
  }, { once: true });
}