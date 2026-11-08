(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clean = value => String(value ?? '').trim();
  const safeUrl = value => {
    try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.href : ''; }
    catch { return ''; }
  };
  const escapeHtml = IZZY.esc;
  const isArabic = () => window.IZZY_STORE_I18N?.isArabic?.() === true;
  const userError = (error, fallbackEn, fallbackAr) => {
    const raw = clean(error && error.message) || fallbackEn;
    if (!isArabic()) return raw;
    const translated = window.IZZY_STORE_I18N?.t?.(raw);
    return translated && translated !== raw ? translated : fallbackAr;
  };
  const defaults = {
    version: 1, template: 'clean', accent_color: '#c9f36a',
    background_color: '#fbfbfc', text_color: '#15171b', font: 'modern',
    logo_url: '', banner_url: '',
    hero_title: isArabic() ? 'اكتشف منتجاتك المفضلة التالية' : 'Discover your next favorite thing',
    hero_description: isArabic() ? 'تصفح مجموعة مختارة بعناية من المنتجات.' : 'Explore a handpicked collection of products selected for you.',
    announcement: ''
  };
  const state = { session: IZZY.session(), user: null, dropshipper: null, store: null, settings: {...defaults}, dirty: false };
  const status = $('#store-design-status');

  function setStatus(message, bad = false) {
    status.textContent = message || '';
    status.className = 'status' + (bad ? ' bad' : '');
  }
  function setDirty(value = true) {
    state.dirty = value;
    $('#design-save-note').textContent = value ? 'You have unsaved changes.' : 'All changes saved.';
  }
  function storeUrl() {
    if (!state.store?.slug) return '';
    const url = new URL('storefront.html', location.href);
    url.searchParams.set('slug', state.store.slug);
    return url.href;
  }
  function renderAssetPreview(id, url, label, wide = false) {
    const root = $(id);
    if (!url) { root.hidden = true; root.innerHTML = ''; return; }
    root.hidden = false;
    root.innerHTML = '<img src="' + escapeHtml(url) + '" alt="">' +
      '<span>' + escapeHtml(label) + '</span>';
    root.classList.toggle('banner-asset-preview', wide);
  }
  function fillControls() {
    const s = state.settings;
    $$('[data-template]').forEach(button => {
      const active = button.dataset.template === s.template;
      button.setAttribute('aria-pressed', String(active));
    });
    $('#design-accent-color').value = s.accent_color;
    $('#design-background-color').value = s.background_color;
    $('#design-text-color').value = s.text_color;
    $('#design-font').value = s.font;
    $('#design-hero-title').value = s.hero_title;
    $('#design-hero-description').value = s.hero_description;
    $('#design-announcement').value = s.announcement;
    renderAssetPreview('#design-logo-preview', s.logo_url, 'Current store logo');
    renderAssetPreview('#design-banner-preview', s.banner_url, 'Current cover image', true);
  }
  function readControls() {
    state.settings = {
      ...state.settings,
      template: $$('[data-template]').find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.template || 'clean',
      accent_color: $('#design-accent-color').value,
      background_color: $('#design-background-color').value,
      text_color: $('#design-text-color').value,
      font: $('#design-font').value,
      hero_title: clean($('#design-hero-title').value),
      hero_description: clean($('#design-hero-description').value),
      announcement: clean($('#design-announcement').value)
    };
  }
  function renderPreview() {
    readControls();
    const s = state.settings;
    const storeName = state.store?.store_name || 'Your Store';
    const logo = safeUrl(s.logo_url);
    const banner = safeUrl(s.banner_url);
    const title = s.hero_title || storeName;
    const description = s.hero_description || state.store?.description || 'A short introduction to your store.';
    const announcement = s.announcement
      ? '<div class="design-preview-announcement">' + escapeHtml(s.announcement) + '</div>' : '';
    const bannerMarkup = banner
      ? '<div class="design-preview-banner" style="background-image:url(&quot;' + escapeHtml(banner) + '&quot;)"></div>' : '';
    const logoMarkup = logo
      ? '<img src="' + escapeHtml(logo) + '" alt="">' : '';
    const root = $('#design-preview');
    root.className = 'design-preview template-' + s.template + ' template-' + s.font;
    root.style.setProperty('--preview-accent', s.accent_color);
    root.style.setProperty('--preview-background', s.background_color);
    root.style.setProperty('--preview-text', s.text_color);
    root.innerHTML = announcement +
      '<header class="design-preview-nav"><div class="design-preview-brand">' + logoMarkup + '<span>' + escapeHtml(storeName) + '</span></div><div class="design-preview-navlinks">HOME　 SHOP　 CONTACT</div></header>' +
      bannerMarkup +
      '<section class="design-preview-hero"><div class="eyebrow">WELCOME TO ' + escapeHtml(storeName.toUpperCase()) + '</div><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(description) + '</p><span class="design-preview-cta">Explore collection</span></section>' +
      '<section class="design-preview-products"><h3>Featured products</h3><p>A preview of how your products will be presented</p><div class="design-preview-product-grid">' +
      ['Everyday essential', 'Customer favorite', 'New arrival'].map((name, index) =>
        '<article class="design-preview-product"><div class="design-preview-product-image"></div><div class="design-preview-product-body"><b>' + name + '</b><span>EGP ' + [450, 620, 375][index] + '</span></div></article>'
      ).join('') + '</div></section>';
  }
  function wireControls() {
    $$('[data-template]').forEach(button => button.addEventListener('click', () => {
      $$('[data-template]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      renderPreview(); setDirty();
    }));
    ['design-accent-color','design-background-color','design-text-color','design-font','design-hero-title','design-hero-description','design-announcement'].forEach(id => {
      const el = $('#' + id);
      el.addEventListener('input', () => { renderPreview(); setDirty(); });
      el.addEventListener('change', () => { renderPreview(); setDirty(); });
    });
    $$('[data-preview-size]').forEach(button => button.addEventListener('click', () => {
      $$('[data-preview-size]').forEach(item => {
        const active = item === button;
        item.classList.toggle('on', active);
        item.setAttribute('aria-pressed', String(active));
      });
      $('#design-preview').classList.toggle('mobile', button.dataset.previewSize === 'mobile');
    }));
    $('#design-logo-file').addEventListener('change', event => uploadAsset(event, 'logo'));
    $('#design-banner-file').addEventListener('change', event => uploadAsset(event, 'banner'));
    $('#design-save').addEventListener('click', saveDesign);
  }
  async function uploadAsset(event, type) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) return setStatus('Use a JPG, PNG, WebP or AVIF image.', true);
    if (file.size > 5242880) return setStatus('Each image must be 5 MB or smaller.', true);
    if (!state.store?.id || !state.user?.id) return setStatus('Create your store details first in My Store.', true);
    const button = $('#design-save');
    button.disabled = true;
    setStatus('Uploading ' + type + '…');
    try {
      const ext = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'}[file.type];
      const path = state.user.id + '/' + state.store.id + '/brand-' + type + '-' + crypto.randomUUID() + '.' + ext;
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      await IZZY.request('/storage/v1/object/storefront-images/' + encoded, {
        method: 'POST',
        headers: {'Content-Type': file.type, 'x-upsert': 'false'},
        body: file
      });
      const url = IZZY.config.supabaseUrl + '/storage/v1/object/public/storefront-images/' + encoded;
      state.settings[type === 'logo' ? 'logo_url' : 'banner_url'] = url;
      fillControls();
      renderPreview();
      setDirty();
      setStatus((type === 'logo' ? 'Logo' : 'Cover image') + ' uploaded. Save your design to apply it.');
    } catch (error) {
      setStatus(userError(error,'Could not upload the image.','تعذر رفع الصورة. تحقق من نوع الملف وحجمه ثم حاول مرة أخرى.'), true);
    } finally {
      button.disabled = false;
    }
  }
  async function saveDesign() {
    readControls();
    const s = state.settings;
    const validColor = value => /^#[0-9a-f]{6}$/i.test(value);
    if (![s.accent_color, s.background_color, s.text_color].every(validColor)) {
      return setStatus('Choose valid colors before saving.', true);
    }
    if (!state.store?.id) return setStatus('Create your store details first in My Store.', true);
    const button = $('#design-save');
    button.disabled = true;
    setStatus('Saving your store design…');
    try {
      const response = await IZZY.request('/rest/v1/dropshipper_store_designs?on_conflict=store_id', {
        method: 'POST',
        headers: {'Prefer': 'resolution=merge-duplicates,return=representation'},
        body: JSON.stringify({store_id: state.store.id, settings: s, updated_at: new Date().toISOString()})
      });
      setDirty(false);
      setStatus('Design saved. Your public storefront will use these settings.');
    } catch (error) {
      setStatus(userError(error,'Could not save your design.','تعذر حفظ التصميم. حاول مرة أخرى.'), true);
    } finally {
      button.disabled = false;
    }
  }
  async function load() {
    if (!state.session?.access_token) { location.replace('login.html'); return; }
    setStatus('Loading your store…');
    const user = await IZZY.request('/auth/v1/user');
    state.user = user;
    const dropshippers = await IZZY.request('/rest/v1/dropshippers?select=id,profile_id,status&profile_id=eq.' + encodeURIComponent(user.id) + '&limit=1');
    state.dropshipper = dropshippers?.[0] || null;
    if (!state.dropshipper) throw new Error('This account does not have a dropshipper workspace.');
    if (state.dropshipper.status !== 'active') throw new Error('Your dropshipper account must be active before using the store builder.');
    const stores = await IZZY.request('/rest/v1/dropshipper_stores?select=*&dropshipper_id=eq.' + encodeURIComponent(state.dropshipper.id) + (state.storeId ? '&id=eq.' + encodeURIComponent(state.storeId) : '') + '&order=created_at.asc&limit=1');
    state.store = stores?.[0] || null;
    if (!state.store) {
      setStatus('Create your store name and link in My Store first, then return here.');
      $('#design-preview').innerHTML = '<div class="design-preview-placeholder">Your store preview will appear here after you create your store details.</div>';
      $('#design-save').disabled = true;
      return;
    }
    const rows = await IZZY.request('/rest/v1/dropshipper_store_designs?select=settings&store_id=eq.' + encodeURIComponent(state.store.id) + '&limit=1');
    state.settings = {...defaults, ...(rows?.[0]?.settings || {})};
    fillControls();
    renderPreview();
    const link = storeUrl();
    if (state.store.published && link) {
      $('#design-open-store').href = link;
      $('#design-open-store').hidden = false;
    }
    setDirty(false);
    setStatus('');
  }
  function init() {
    wireControls();
    load().catch(error => setStatus(userError(error,'Could not load the store design studio.','تعذر تحميل استوديو تصميم المتجر. حاول تحديث الصفحة.'), true));
  }
  init();
})();