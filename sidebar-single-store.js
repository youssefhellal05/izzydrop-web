(() => {
  'use strict';

  const nav = document.querySelector('.dropshipper-side nav');
  if (!nav) return;

  const storeLabels = new Set(['my store', 'my stores', 'متجري', 'متاجري']);
  const isStoreEntry = item => {
    const label = (item.querySelector('span')?.textContent || item.textContent || '')
      .replace(/\\s+/g, ' ')
      .trim()
      .toLowerCase();
    return item.id === 'dropshipper-my-store-link'
      || item.id === 'dropshipper-my-stores-link'
      || item.id === 'native-store-manager-nav'
      || storeLabels.has(label);
  };

  function normalizeStoreNavigation() {
    const entries = [...nav.querySelectorAll('a,button')].filter(isStoreEntry);
    let canonical = nav.querySelector('#dropshipper-my-stores-link, #dropshipper-my-store-link')
      || entries[0];

    if (!canonical) {
      canonical = document.createElement('a');
      canonical.className = 'dropshipper-mobile-nav-item';
      canonical.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16l-2-6H6zM6 10v10h12V10M9 20v-6h6v6"/></svg><span></span>';
      const linked = nav.querySelector('button[data-view="linked"]');
      if (linked) linked.after(canonical);
      else nav.prepend(canonical);
    }

    canonical.id = 'dropshipper-my-stores-link';
    canonical.href = new URL('my-stores.html', location.href).href;
    const arabic = window.IZZY_I18N?.isArabic?.() === true;
    const label = arabic ? 'متاجري' : 'My Stores';
    let textNode = canonical.querySelector('span');
    if (!textNode) {
      textNode = document.createElement('span');
      canonical.append(textNode);
    }
    if (textNode.textContent !== label) textNode.textContent = label;
    if (canonical.getAttribute('aria-label') !== label) canonical.setAttribute('aria-label', label);
    if (canonical.getAttribute('lang') !== (arabic ? 'ar' : 'en')) {
      canonical.setAttribute('lang', arabic ? 'ar' : 'en');
    }

    for (const item of entries) {
      if (item !== canonical && item.isConnected) item.remove();
    }
  }

  normalizeStoreNavigation();

  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(normalizeStoreNavigation);
    observer.observe(nav, { childList: true, subtree: true, characterData: true });
  }
})();
