(() => {
  'use strict';
  const nav = document.querySelector('.dropshipper-side nav');
  if (!nav) return;

  // The dashboard already renders the canonical My Stores link. Normalize it
  // and remove any legacy injected copy instead of adding a second entry.
  const canonical = nav.querySelector('#dropshipper-my-stores-link, #dropshipper-my-store-link');
  if (canonical) {
    canonical.id = 'dropshipper-my-stores-link';
    canonical.href = new URL('my-stores.html', location.href).href;
    const label = canonical.querySelector('span');
    if (label) label.textContent = 'My Stores';
    nav.querySelectorAll('#native-store-manager-nav').forEach(item => item.remove());
    return;
  }

  nav.querySelectorAll('#native-store-manager-nav').forEach(item => item.remove());
  const linked = nav.querySelector('button[data-view="linked"]');
  if (!linked) return;

  const link = document.createElement('a');
  link.className = 'dropshipper-mobile-nav-item';
  link.id = 'dropshipper-my-stores-link';
  link.href = new URL('my-stores.html', location.href).href;
  link.setAttribute('aria-label', 'Open My Stores');
  link.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10l2-6h14l2 6M4 10h16v10H4zM9 20v-6h6v6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/></svg><span>My Stores</span>';
  linked.after(link);
})();
