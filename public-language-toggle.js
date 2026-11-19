(() => {
  'use strict';

  const toggle = document.getElementById('public-language-toggle');
  const i18n = window.IZZY_I18N;
  if (!toggle || !i18n) return;

  const currentLanguage = i18n.lang() === 'ar' ? 'ar' : 'en';
  const targetLanguage = currentLanguage === 'ar' ? 'en' : 'ar';

  // Show the language the visitor can switch to, not the active language.
  toggle.textContent = targetLanguage === 'ar' ? 'العربية' : 'English';
  toggle.setAttribute('lang', targetLanguage);
  toggle.setAttribute(
    'aria-label',
    currentLanguage === 'ar' ? 'التبديل إلى الإنجليزية' : 'Switch to Arabic'
  );

  toggle.addEventListener('click', () => {
    i18n.set(i18n.lang() === 'ar' ? 'en' : 'ar');
  });
})();
