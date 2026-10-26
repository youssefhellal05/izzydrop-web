(() => {
  'use strict';
  const nav = document.querySelector('.dropshipper-side nav');
  const linked = nav && nav.querySelector('button[data-view="linked"]');
  if (!nav || !linked || document.getElementById('native-store-manager-nav')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'native-store-manager-nav';
  button.setAttribute('aria-label', 'Open My Store');
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10l2-6h14l2 6M4 10h16v10H4zM9 20v-6h6v6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/></svg><span>My Store</span>';
  button.addEventListener('click', () => { location.href = new URL('store-manager.html', location.href).href; });
  linked.after(button);
})();