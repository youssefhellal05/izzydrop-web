window.IZZY_CONFIG = {
  supabaseUrl: 'https://bbqpowtmzsoorluqwfbm.supabase.co',
  supabaseKey: 'sb_publishable_7zwBJFyaTcCrIG8hvmUQuQ_IzPEfZA7'
};

// Supplier-only UI refinements are isolated from the shared app scripts.
if (/\/supplier\.html$/i.test(location.pathname)) {
  window.addEventListener('load', () => {
    const script = document.createElement('script');
    script.src = 'supplier-overrides.js?v=20260925-simpleflows1';
    script.async = false;
    document.body.appendChild(script);
  }, { once: true });
}
