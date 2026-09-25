window.IZZY_CONFIG = {
  supabaseUrl: 'https://bbqpowtmzsoorluqwfbm.supabase.co',
  supabaseKey: 'sb_publishable_7zwBJFyaTcCrIG8hvmUQuQ_IzPEfZA7'
};

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
    };
    document.body.appendChild(flow);
  }, { once: true });
}
