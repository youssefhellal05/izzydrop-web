(()=>{
  const KEY='izzy_language';
  const saved=localStorage.getItem(KEY);
  const browser=(navigator.language||'').toLowerCase();
  let lang=saved==='ar'||saved==='en'?saved:(browser.startsWith('ar')?'ar':'en');

  const exactAr={
    'Public site':'الموقع العام',
    'Explore products':'استكشف المنتجات',
    'Log in / Sign up':'تسجيل الدخول / إنشاء حساب',
    'Log in':'تسجيل الدخول',
    'Create account':'إنشاء حساب',
    'Welcome back':'مرحبًا بعودتك',
    'Create your IzzyDrop account':'أنشئ حسابك على IzzyDrop',
    'Email':'البريد الإلكتروني',
    'Password':'كلمة المرور',
    'Full name':'الاسم الكامل',
    'Supplier':'المورّد',
    'Dropshipper':'الدروبشيبر',
    'Products':'المنتجات',
    'My products':'منتجاتي',
    'Orders':'الطلبات',
    'Settings':'الإعدادات',
    'Overview':'نظرة عامة',
    'Add product':'إضافة منتج',
    'Admins':'المشرفون',
    'Suppliers':'المورّدون',
    'Commissions':'العمولات',
    'Account':'الحساب',
    'Business':'النشاط التجاري',
    'Notifications':'الإشعارات',
    'Appearance':'المظهر',
    'Security':'الأمان',
    'Dark mode':'الوضع الداكن',
    'Sign out':'تسجيل الخروج',
    'Sign out all devices':'تسجيل الخروج من كل الأجهزة',
    'Save account':'حفظ الحساب',
    'Save business':'حفظ بيانات النشاط',
    'Save notifications':'حفظ الإشعارات',
    'Change password':'تغيير كلمة المرور',
    'New password':'كلمة المرور الجديدة',
    'Confirm new password':'تأكيد كلمة المرور الجديدة',
    'Active':'نشط',
    'Pending':'قيد الانتظار',
    'Processing':'قيد التنفيذ',
    'Fulfilled':'تم التنفيذ',
    'Cancelled':'ملغي',
    'Refunded':'مسترد',
    'All':'الكل',
    'New':'جديد',
    'Close':'إغلاق',
    'Copy link':'نسخ الرابط',
    'View details':'عرض التفاصيل',
    'Link to your web':'اربطه بمتجرك',
    'Get link':'الحصول على الرابط',
    'Create order':'إنشاء طلب',
    'Quantity':'الكمية',
    'Customer name':'اسم العميل',
    'Customer phone':'هاتف العميل',
    'Governorate':'المحافظة',
    'City':'المدينة',
    'Search products or SKU':'ابحث عن منتج أو SKU',
    'Search products, suppliers or SKU':'ابحث عن منتج أو مورّد أو SKU',
    'All categories':'كل الفئات',
    'Newest':'الأحدث',
    'Price: low to high':'السعر: من الأقل للأعلى',
    'Price: high to low':'السعر: من الأعلى للأقل',
    'Stock: high to low':'المخزون: من الأعلى للأقل',
    'In stock only':'المتوفر فقط',
    'Suggested selling price':'سعر البيع المقترح',
    'Suggested retail':'سعر البيع المقترح',
    'Suggested retail (EGP)':'سعر البيع المقترح (جنيه)',
    'Your cost':'تكلفتك',
    'Your cost (EGP)':'تكلفتك (جنيه)',
    'Status':'الحالة',
    'Actions':'الإجراءات',
    'Stock':'المخزون',
    'Variant':'الخيار',
    'Variants':'الخيارات',
    'Weight (g)':'الوزن (جم)',
    'Cost override':'تكلفة مختلفة',
    'Add variant':'إضافة خيار',
    'Edit':'تعديل',
    'Pause':'إيقاف مؤقت',
    'Activate':'تفعيل',
    'Deactivate':'إلغاء التفعيل',
    'Approve':'موافقة',
    'Reject':'رفض',
    'Suspend':'تعليق',
    'Review':'مراجعة',
    'Inspect':'فحص',
    'Marketplace':'السوق',
    'Today':'اليوم',
    'Needs attention':'يحتاج انتباهك',
    'Low stock':'مخزون منخفض',
    'Active products':'المنتجات النشطة',
    'New orders':'طلبات جديدة',
    'Needs fulfillment':'طلبات تحتاج تنفيذ',
    'Product':'المنتج',
    'Joined':'تاريخ الانضمام',
    'Commission':'العمولة',
    'Admin':'مشرف',
    'Super admin':'المشرف الرئيسي',
    'Account information':'بيانات الحساب',
    'Business profile':'بيانات النشاط التجاري',
    'Supplier notifications':'إشعارات المورّد',
    'Email notifications':'إشعارات البريد الإلكتروني',
    'Order cancellations':'إلغاءات الطلبات',
    'Product updates':'تحديثات المنتجات',
    'Important IzzyDrop announcements':'إعلانات IzzyDrop المهمة',
    'Low-stock warning level':'حد تنبيه المخزون المنخفض',
    'Two-factor authentication':'المصادقة الثنائية',
    'Coming later':'قريبًا',
    'Signed-in account':'الحساب المسجل حاليًا',
    'Store / business name':'اسم المتجر / النشاط',
    'Business name':'اسم النشاط التجاري',
    'Business registration number':'رقم السجل التجاري',
    'Registration number':'رقم التسجيل',
    'Product name':'اسم المنتج',
    'Description':'الوصف',
    'Photos':'الصور',
    'Pricing':'التسعير',
    'Inventory & variants':'المخزون والخيارات',
    'Basic information':'المعلومات الأساسية',
    'Product photos':'صور المنتج',
    'Choose photos':'اختيار الصور',
    'Ready to list?':'جاهز للنشر؟',
    'Add product':'إضافة المنتج',
    'Save changes':'حفظ التغييرات',
    'Edit product':'تعديل المنتج',
    'Variants & stock':'الخيارات والمخزون',
    'Shipping carrier':'شركة الشحن',
    'Tracking number':'رقم التتبع',
    'Mark fulfilled':'تحديده كمُنفذ',
    'Fulfillment':'التنفيذ',
    'Delivery address':'عنوان التوصيل',
    'Customer':'العميل',
    'Marketplace default':'الإعداد الافتراضي للسوق',
    'Supplier override':'تخصيص للمورّد',
    'Product override':'تخصيص للمنتج',
    'Inherited':'موروث',
    'Effective commission':'العمولة الفعلية',
    'Admin access':'صلاحيات المشرفين',
    'Admin accounts':'حسابات المشرفين',
    'Invite admin':'دعوة مشرف',
    'Send admin invite':'إرسال دعوة مشرف',
    'Revoke':'سحب الصلاحية',
    'Welcome to IzzyDrop':'مرحبًا بك في IzzyDrop',
    'Back to IzzyDrop':'العودة إلى IzzyDrop',
    'IZZYDROP ACCOUNT':'حساب IZZYDROP',
    'What will you use IzzyDrop as?':'كيف ستستخدم IzzyDrop؟',
    'Dropshipper':'دروبشيبر',
    'Supplier':'مورّد',
    'Store / business name (optional)':'اسم المتجر / النشاط (اختياري)',
    'At least 8 characters':'8 أحرف على الأقل',
    'Create supplier account':'إنشاء حساب مورّد',
    'Create dropshipper account':'إنشاء حساب دروبشيبر',
    'Choose an account type':'اختر نوع الحساب',
    'Admin invitation accepted.':'تم قبول دعوة المشرف.',
    'Finish admin setup':'إكمال إعداد المشرف',
    'The smarter way to dropship in Egypt.':'الطريقة الأذكى للدروبشيبنج في مصر.',
    'Built for independent sellers':'مصمم للبائعين المستقلين',
    'Get started':'ابدأ الآن',
    'Choose your path':'اختر طريقك',
    'What brings you to IzzyDrop?':'كيف تريد استخدام IzzyDrop؟',
    'Build your catalog':'ابنِ كتالوجك',
    'Supply the market':'ورّد للسوق',
    'Just looking':'أتصفح فقط',
    'Explore first':'استكشف أولًا',
    'One account.':'حساب واحد.',
    'Everything IzzyDrop.':'كل IzzyDrop.',
    'Built for Egyptian dropshipping.':'مصمم للدروبشيبنج في مصر.',
    'Log in and we’ll take you to the right workspace.':'سجّل الدخول وسنفتح لك مساحة العمل المناسبة.',
    'Choose how you’ll use IzzyDrop. You can sign in from this same page later.':'اختر كيف ستستخدم IzzyDrop. ويمكنك تسجيل الدخول لاحقًا من الصفحة نفسها.',
    'Find products and sell them online.':'اعثر على المنتجات وبِعها أونلاين.',
    'List products and fulfill orders.':'أضف المنتجات ونفّذ الطلبات.',
    'Required for supplier accounts.':'مطلوب لحسابات المورّدين.',
    'Use at least 8 characters.':'استخدم 8 أحرف على الأقل.',
    'Opening your workspace…':'جارٍ فتح مساحة عملك…',
    'Browse products and add the ones you want to sell.':'تصفح المنتجات وأضف ما تريد بيعه.',
    'Manage the products you have chosen to sell.':'أدر المنتجات التي اخترت بيعها.',
    'Create orders and track fulfillment from your suppliers.':'أنشئ الطلبات وتابع تنفيذها مع المورّدين.',
    'No products match':'لا توجد منتجات مطابقة',
    'Clear filters':'مسح الفلاتر',
    'No linked products yet':'لا توجد منتجات مرتبطة بعد',
    'Browse products':'تصفح المنتجات',
    'Your selling price':'سعر بيعك',
    'Save price':'حفظ السعر',
    'Details':'التفاصيل',
    'Remove':'إزالة',
    'See what needs your attention today.':'اطّلع على ما يحتاج انتباهك اليوم.',
    'Manage prices, inventory, variants and marketplace status.':'أدر الأسعار والمخزون والخيارات وحالة المنتجات.',
    'Fulfill customer orders and add tracking when they ship.':'نفّذ طلبات العملاء وأضف بيانات التتبع عند الشحن.',
    'Create a complete product listing for dropshippers.':'أنشئ منتجًا كاملًا لعرضه على الدروبشيبرز.',
    'Waiting for action':'في انتظار إجراء',
    'Items not shipped':'عناصر لم تُشحن',
    'The most important things to handle next.':'أهم الأمور التي تحتاج إلى التعامل معها الآن.',
    'A quick snapshot of supplier activity.':'ملخص سريع لنشاط المورّد.',
    'Write the product once, then let IzzyDrop generate the other language for you to review.':'اكتب المنتج مرة واحدة، ثم دع IzzyDrop ينشئ اللغة الأخرى لتراجعها.',
    'Translation is a draft — review it before saving.':'الترجمة مسودة — راجعها قبل الحفظ.',
    'Your cost stays private from dropshippers.':'تكلفتك تظل مخفية عن الدروبشيبرز.',
    'Add sizes, colors, models, or keep one default variant.':'أضف المقاسات أو الألوان أو الموديلات، أو استخدم خيارًا افتراضيًا واحدًا.',
    'Monitor the marketplace and handle what needs attention.':'راقب المنصة وتعامل مع ما يحتاج إلى انتباه.',
    'Review applications and manage supplier access.':'راجع طلبات المورّدين وأدر صلاحياتهم.',
    'Inspect and moderate products across the marketplace.':'راجع المنتجات وأدرها عبر المنصة.',
    'Inspect marketplace orders, fulfillment and tracking.':'راجع طلبات المنصة والتنفيذ والتتبع.',
    'Control marketplace, supplier, and product commission rules.':'تحكم في عمولات المنصة والمورّدين والمنتجات.',
    'Invite trusted people and review Control Center access.':'ادعُ أشخاصًا موثوقين وراجع صلاحيات مركز التحكم.',
    'Pending suppliers':'مورّدون بانتظار المراجعة',
    'Active suppliers':'المورّدون النشطون',
    'Open orders':'الطلبات المفتوحة',
    'Waiting for review':'في انتظار المراجعة',
    'Approved on IzzyDrop':'معتمدون على IzzyDrop',
    'Visible to dropshippers':'ظاهر للدروبشيبرز',
    'Pending or processing':'قيد الانتظار أو التنفيذ',
    'Marketplace issues worth handling next.':'أمور في المنصة تستحق التعامل معها الآن.',
    'Current operating snapshot.':'ملخص حالة التشغيل الحالية.',
    'Recent admin activity':'نشاط المشرفين الأخير',
    'Changes recorded by IzzyDrop’s audit log.':'التغييرات المسجلة في سجل IzzyDrop.',
    'All suppliers':'كل المورّدين',
    'Default commission (%)':'العمولة الافتراضية (%)',
    'Save default':'حفظ الافتراضي',
    'Supplier override (%)':'تخصيص عمولة المورّد (%)',
    'Save supplier rate':'حفظ عمولة المورّد',
    'Leave blank to inherit the marketplace default.':'اتركه فارغًا لاستخدام العمولة الافتراضية للمنصة.',
    'Effective supplier rate':'العمولة الفعلية للمورّد',
    'Send a secure IzzyDrop invitation by email.':'أرسل دعوة IzzyDrop آمنة عبر البريد الإلكتروني.',
    'People with current admin access.':'الأشخاص الذين لديهم صلاحية مشرف حاليًا.',
    'Manage your IzzyDrop account and preferences.':'أدر حساب IzzyDrop وتفضيلاتك.',
    'Your personal IzzyDrop account details.':'بيانات حسابك الشخصية على IzzyDrop.',
    'Changing your email may require confirmation from your inbox.':'قد يتطلب تغيير البريد الإلكتروني تأكيدًا من بريدك.',
    'Choose what IzzyDrop should alert you about.':'اختر التنبيهات التي تريد أن يرسلها IzzyDrop.',
    'Choose how IzzyDrop looks on this device.':'اختر مظهر IzzyDrop على هذا الجهاز.',
    'Protect access to your IzzyDrop account.':'احمِ الوصول إلى حسابك على IzzyDrop.',
    'Extra login protection for your account.':'حماية إضافية لتسجيل الدخول إلى حسابك.',
    'Sign out of IzzyDrop on this device.':'سجّل الخروج من IzzyDrop على هذا الجهاز.',
    'End your IzzyDrop sessions on all devices.':'أنهِ جلسات IzzyDrop على جميع الأجهزة.',
    'Language':'اللغة',
    'Choose the IzzyDrop interface language on this device.':'اختر لغة واجهة IzzyDrop على هذا الجهاز.',
    'Generate Arabic translation':'إنشاء الترجمة العربية',
    'Generate English translation':'إنشاء الترجمة الإنجليزية',
    'Translating to Arabic…':'جارٍ الترجمة إلى العربية…',
    'Translating to English…':'جارٍ الترجمة إلى الإنجليزية…',
    'Generating a draft translation…':'جارٍ إنشاء مسودة الترجمة…',
    'English translation generated. Review and edit it before saving.':'تم إنشاء الترجمة الإنجليزية. راجعها وعدّلها قبل الحفظ.',
    'Enter the English product name first.':'أدخل اسم المنتج بالإنجليزية أولًا.',
    'English':'English',
    'Arabic':'العربية'
  };

  const placeholderAr={
    'Search products or SKU':'ابحث عن منتج أو SKU',
    'Search products, suppliers or SKU':'ابحث عن منتج أو مورّد أو SKU',
    'Search supplier or owner':'ابحث عن مورّد أو مالك',
    'Search product, supplier or SKU':'ابحث عن منتج أو مورّد أو SKU',
    'Search order, customer, product or supplier':'ابحث عن طلب أو عميل أو منتج أو مورّد',
    'Your name':'اسمك',
    'Your store or business':'اسم متجرك أو نشاطك',
    'Your supplier business name':'اسم نشاطك كمورّد',
    'you@example.com':'you@example.com',
    'Your password':'كلمة المرور',
    'At least 8 characters':'8 أحرف على الأقل',
    'Repeat password':'أعد كتابة كلمة المرور',
    'Customer name':'اسم العميل',
    'Customer phone':'هاتف العميل',
    'Customer email (optional)':'بريد العميل (اختياري)',
    'Street / address':'الشارع / العنوان',
    'City':'المدينة',
    'Governorate':'المحافظة',
    'Shipping carrier':'شركة الشحن',
    'Tracking number':'رقم التتبع',
    'e.g. Wireless earbuds':'مثال: سماعات لاسلكية',
    'Leave blank for IzzyDrop to create one':'اتركه فارغًا ليُنشئه IzzyDrop',
    'What is the product, what makes it useful, and what should a dropshipper know?':'ما هو المنتج؟ وما أهم مميزاته؟ وما الذي يجب أن يعرفه الدروبشيبر؟'
  };

  const keys={
    'products':'المنتجات',
    'my_products':'منتجاتي',
    'orders':'الطلبات',
    'settings':'الإعدادات',
    'overview':'نظرة عامة',
    'add_product':'إضافة منتج',
    'supplier':'المورّد',
    'dropshipper':'الدروبشيبر',
    'admin':'المشرف',
    'in_stock':'متوفر',
    'out_of_stock':'نفد المخزون',
    'product':'المنتج',
    'no_description':'لا يوجد وصف للمنتج بعد.',
    'verified_supplier':'مورّد موثّق من IzzyDrop',
    'sold_by':'يباع بواسطة',
    'suggested_selling_price':'سعر البيع المقترح',
    'available_stock':'المخزون المتاح',
    'category':'الفئة',
    'uncategorized':'غير مصنف',
    'variants':'الخيارات',
    'default_variant':'افتراضي',
    'copy_product_link':'نسخ رابط المنتج',
    'login_to_use_product':'سجل الدخول لاستخدام المنتج',
    'back_to_products':'العودة إلى المنتجات',
    'link_to_web':'اربطه بمتجرك',
    'get_product_link':'الحصول على رابط المنتج',
    'products_shown':'منتج معروض',
    'no_products_match':'لا توجد منتجات مطابقة',
    'clear_filters':'مسح الفلاتر',
    'translation_generated':'تم إنشاء الترجمة. راجعها وعدّلها قبل الحفظ.',
    'translation_failed':'تعذر إنشاء الترجمة.',
    'generate_arabic':'إنشاء الترجمة العربية',
    'generate_english':'إنشاء الترجمة الإنجليزية',
    'english_content':'English',
    'arabic_content':'العربية',
    'original_language':'لغة المحتوى الأصلية',
    'review_translation':'راجع الترجمة قبل حفظ المنتج.',
    'name_required':'أدخل اسم المنتج بلغة واحدة على الأقل.'
  };

  function t(key,vars={}){
    let value=lang==='ar'?(keys[key]||exactAr[key]||key):key;
    Object.entries(vars).forEach(([k,v])=>{value=value.replaceAll('{'+k+'}',String(v))});
    return value;
  }

  function localProductName(p){
    if(lang==='ar') return p?.name_ar||p?.name_en||p?.name||'';
    return p?.name_en||p?.name_ar||p?.name||'';
  }
  function localProductDescription(p){
    if(lang==='ar') return p?.description_ar||p?.description_en||p?.description||'';
    return p?.description_en||p?.description_ar||p?.description||'';
  }
  function localStatus(v){
    const ar={active:'نشط',inactive:'متوقف',draft:'مسودة',pending_review:'قيد المراجعة',pending:'قيد الانتظار',processing:'قيد التنفيذ',fulfilled:'تم التنفيذ',cancelled:'ملغي',refunded:'مسترد',approved:'مقبول',rejected:'مرفوض',suspended:'معلّق',paused:'متوقف',new:'جديد',unfulfilled:'غير منفذ',partially_fulfilled:'منفذ جزئيًا'};
    return lang==='ar'?(ar[v]||v):v;
  }

  function translateTextNode(node){
    if(lang!=='ar'||node.nodeType!==Node.TEXT_NODE)return;
    const raw=node.nodeValue;
    const trimmed=raw.trim();
    if(!trimmed)return;
    const translated=exactAr[trimmed];
    if(translated){
      const start=raw.match(/^\s*/)?.[0]||'';
      const end=raw.match(/\s*$/)?.[0]||'';
      node.nodeValue=start+translated+end;
      return;
    }
    const stock=trimmed.match(/^(\d+) in stock$/i);
    if(stock){node.nodeValue=raw.replace(trimmed,`${stock[1]} متوفر`);return}
    const shown=trimmed.match(/^(\d+) products? shown$/i);
    if(shown){node.nodeValue=raw.replace(trimmed,`${shown[1]} منتج معروض`);return}
    const available=trimmed.match(/^(\d+) products? available$/i);
    if(available){node.nodeValue=raw.replace(trimmed,`${available[1]} منتج متاح`);return}
    const total=trimmed.match(/^(\d+) total products?$/i);
    if(total){node.nodeValue=raw.replace(trimmed,`${total[1]} إجمالي المنتجات`);return}
  }

  function scan(root=document.body){
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE){translateTextNode(root);return}
    if(root.nodeType!==Node.ELEMENT_NODE&&root!==document.body)return;

    if(root instanceof HTMLElement){
      if(root.dataset?.i18n){
        const k=root.dataset.i18n;
        root.textContent=lang==='ar'?(keys[k]||exactAr[k]||root.textContent):root.dataset.i18nEn||root.textContent;
      }
      if(lang==='ar'&&root.hasAttribute('placeholder')){
        const p=root.getAttribute('placeholder');
        if(placeholderAr[p])root.setAttribute('placeholder',placeholderAr[p]);
      }
      if(lang==='ar'&&root.tagName==='OPTION'){
        const val=root.textContent.trim();
        if(exactAr[val])root.textContent=exactAr[val];
      }
    }

    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(walker.nextNode())translateTextNode(walker.currentNode);
    if(lang==='ar'){
      root.querySelectorAll?.('[placeholder]').forEach(el=>{
        const p=el.getAttribute('placeholder');
        if(placeholderAr[p])el.setAttribute('placeholder',placeholderAr[p]);
      });
      root.querySelectorAll?.('option').forEach(el=>{
        const v=el.textContent.trim();
        if(exactAr[v])el.textContent=exactAr[v];
      });
    }
  }

  function applyDirection(){
    document.documentElement.lang=lang;
    document.documentElement.dir=lang==='ar'?'rtl':'ltr';
    document.body?.classList.toggle('rtl',lang==='ar');
  }

  function ensureToggle(){
    if(document.querySelector('[data-language-toggle]'))return;
    const host=document.querySelector('.navlinks')||document.querySelector('.auth-nav')||document.querySelector('.supplier-top-actions');
    if(!host)return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='language-toggle';
    btn.dataset.languageToggle='1';
    btn.textContent=lang==='ar'?'English':'العربية';
    btn.setAttribute('aria-label',lang==='ar'?'Switch to English':'التبديل إلى العربية');
    btn.onclick=()=>{
      localStorage.setItem(KEY,lang==='ar'?'en':'ar');
      location.reload();
    };
    host.appendChild(btn);
  }

  applyDirection();
  window.IZZY_I18N={
    lang:()=>lang,
    isArabic:()=>lang==='ar',
    t,
    productName:localProductName,
    productDescription:localProductDescription,
    status:localStatus,
    scan,
    set(next){if(next!=='en'&&next!=='ar')return;localStorage.setItem(KEY,next);location.reload()}
  };

  const boot=()=>{
    applyDirection();
    scan(document.body);
    ensureToggle();
    const observer=new MutationObserver(muts=>{
      for(const m of muts){
        m.addedNodes.forEach(n=>scan(n));
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();