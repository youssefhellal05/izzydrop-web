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
    'Fulfilled':'تم الشحن',
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
    'Choose whether this product has one version or options such as color and size.':'اختر ما إذا كان المنتج له نسخة واحدة أو خيارات مثل اللون والمقاس.',
    'One version':'نسخة واحدة',
    'Has options':'لديه خيارات',
    'Product options':'خيارات المنتج',
    'Add option':'إضافة خيار',
    'Add values separated by commas. IzzyDrop will create every combination automatically.':'أضف القيم مفصولة بفواصل، وسيقوم IzzyDrop بإنشاء كل التركيبات تلقائيًا.',
    'Example: Color = Black, White · Size = S, M, L. Then turn off any combination you do not sell.':'مثال: اللون = أسود، أبيض · المقاس = S، M، L. ثم أوقف أي تركيبة لا تبيعها.',
    'Combinations':'التركيبات',
    'Turn a combination off when that color/size does not exist.':'أوقف التركيبة إذا كان هذا اللون أو المقاس غير متوفر لديك.',
    'Sell':'بيع',
    'Supplier price':'سعر المورّد',
    'Supplier price override':'سعر مورّد مختلف',
    'Variant SKU':'SKU للخيار',
    'Set what dropshippers pay you and the customer price you recommend.':'حدد السعر الذي يدفعه لك الدروبشيبر وسعر البيع الذي تقترحه للعميل.',
    'Your price to dropshippers (EGP)':'سعرك للدروبشيبر (جنيه)',
    'Suggested selling price (EGP)':'سعر البيع المقترح (جنيه)',
    'Available':'متاح',
    'More':'المزيد',
    'Filters':'الفلاتر',
    'Find product':'البحث عن منتج',
    'Search products':'ابحث عن المنتجات',
    'Suggested sell':'سعر البيع المقترح',
    'My Products':'منتجاتي',
    'No products match':'لا توجد منتجات مطابقة',
    'Clear filters':'مسح الفلاتر',
    'Find products to sell.':'ابحث عن منتجات لبيعها.',
    'Products you chose to sell.':'المنتجات التي اخترت بيعها.',
    'Create and track customer orders.':'أنشئ وتابع طلبات العملاء.',
    'Ask suppliers to source something you need.':'اطلب من المورّدين توفير منتج تحتاجه.',
    'Track product samples.':'تابع عينات المنتجات.',
    'Account and preferences.':'الحساب والتفضيلات.',

    'Samples':'العينات',
    'Sample requests':'طلبات العينات',
    'Track the product samples you requested from suppliers.':'تابع عينات المنتجات التي طلبتها من المورّدين.',
    'Approve sample requests, ship them, and add tracking.':'وافق على طلبات العينات واشحنها وأضف بيانات التتبع.',
    'Request sample':'طلب عينة',
    'PRODUCT SAMPLE':'عينة منتج',
    'Choose the exact variant and tell the supplier where to send the sample.':'اختر الخيار المحدد وأخبر المورّد بمكان إرسال العينة.',
    'Send sample request':'إرسال طلب العينة',
    'Category':'الفئة',
    'Choose category':'اختر الفئة',
    'No category':'بدون فئة',
    'Estimated shipping cost (EGP)':'تكلفة الشحن التقديرية (جنيه)',
    'Typical delivery cost the dropshipper should include when estimating profit.':'تكلفة التوصيل المعتادة التي يجب أن يضعها الدروبشيبر في حساب الربح التقديري.',
    'Variant photo':'صورة الخيار',
    'Use main photo':'استخدم الصورة الرئيسية',
    'Shipped':'تم الشحن',
    'In transit':'قيد التوصيل',
    'Delivered':'تم التوصيل',
    'Refused':'مرفوض',
    'Returned':'مرتجع',
    'Shipping':'الشحن',
    'Mark shipped':'تحديد كمشحون',
    'Mark delivered':'تحديد كمُسلّم',
    'I received it':'استلمت العينة',
    'Failed delivery':'فشل التوصيل',
    'Delivery success':'نجاح التوصيل',
    'Collected COD':'قيمة COD المحصلة',
    'Target cost':'التكلفة المستهدفة',
    'Open link':'فتح الرابط',
    'Notes':'ملاحظات',
    'Accept quote':'قبول العرض',
    'Accepted':'تم القبول',
    'Not selected':'لم يتم اختياره',
    'No supplier quotes yet.':'لا توجد عروض من المورّدين بعد.',
    'Unavailable':'غير متاح',
    'Supplier paused this product':'أوقف المورّد هذا المنتج مؤقتًا',
    'No variants are currently available':'لا توجد خيارات متاحة حاليًا',
    'Your price':'سعرك',
    'Supplier price':'سعر المورّد',
    'Mark in transit':'تحديد قيد التوصيل',
    'Customer refused':'رفض العميل',
    'Mark returned':'تحديد كمرتجع',
    'Sample delivery address':'عنوان توصيل العينة',
    'Items shipped':'عناصر تم شحنها',
    'Add tracking when the order leaves you.':'أضف بيانات التتبع عندما يخرج الطلب للشحن.',
    'Ship customer orders and add tracking when they leave you.':'اشحن طلبات العملاء وأضف بيانات التتبع عند خروجها منك.',
    'Pending through delivery':'من الانتظار حتى التوصيل',
    'Delivered orders':'الطلبات التي تم توصيلها',
    'Orders received':'طلبات وصلت',
    'Units ordered':'وحدات مطلوبة',
    'Items shipped':'عناصر تم شحنها',
    'Approve sample requests and add tracking when they ship.':'وافق على طلبات العينات وأضف بيانات التتبع عند شحنها.',
    'Manage pricing, availability and the products you have chosen.':'أدر الأسعار والتوفر والمنتجات التي اخترتها.',
    'Create orders and track shipping and COD delivery results.':'أنشئ الطلبات وتابع الشحن ونتائج الدفع عند الاستلام.',
    'Choose the closest category so dropshippers can find the product faster.':'اختر أقرب فئة حتى يتمكن الدروبشيبرز من العثور على المنتج أسرع.',
    'Select a product to use its price':'اختر منتجًا لاستخدام سعره',
    'Available quantity':'الكمية المتاحة',
    'Lead time days':'مدة التجهيز بالأيام',
    'Submit quote':'إرسال العرض',
    'Waiting for supplier to link a product.':'في انتظار أن يربط المورّد منتجًا بالعرض.',

    'Fashion & Accessories':'الأزياء والإكسسوارات',
    'Electronics & Gadgets':'الإلكترونيات والأجهزة',
    'Home & Kitchen':'المنزل والمطبخ',
    'Beauty & Personal Care':'الجمال والعناية الشخصية',
    'Health & Fitness':'الصحة واللياقة',
    'Kids & Baby':'الأطفال والرضع',
    'Pet Supplies':'مستلزمات الحيوانات الأليفة',
    'Car Accessories':'إكسسوارات السيارات',
    'Office & Stationery':'المكتب والأدوات المكتبية',
    'Other':'أخرى',


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
    'Mark fulfilled':'تحديد كمشحون',
    'Fulfillment':'الشحن',
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
    'active':'نشط',
    'inactive':'متوقف',
    'draft':'مسودة',
    'pending_review':'قيد المراجعة',
    'pending':'قيد الانتظار',
    'processing':'قيد التنفيذ',
    'fulfilled':'تم الشحن',
    'cancelled':'ملغي',
    'refunded':'مسترد',
    'approved':'مقبول',
    'rejected':'مرفوض',
    'suspended':'معلّق',
    'paused':'متوقف',
    'new':'جديد',
    'unfulfilled':'غير منفذ',
    'partially_fulfilled':'منفذ جزئيًا',
    'Linked':'مرتبط',
    'Suggested':'المقترح',
    'Vs suggested':'مقارنة بالمقترح',
    'Carrier':'شركة الشحن',
    'Default':'افتراضي',
    'Find products. Work with trusted suppliers. Grow your store. IzzyDrop brings the supply side of Egyptian dropshipping into one place — without forcing you onto any website platform.':'اعثر على المنتجات وتعامل مع مورّدين موثوقين وطوّر متجرك. يجمع IzzyDrop جانب التوريد للدروبشيبنج في مصر في مكان واحد من دون إجبارك على منصة معينة.',
    'Browse approved supplier products.':'تصفح منتجات المورّدين المعتمدين.',
    'Copy the IzzyDrop product link and use it on your own website.':'استخدم رابط منتج IzzyDrop على موقعك أو متجرك.',
    'Custom-coded site, WordPress, Shopify, WooCommerce — your choice.':'موقع مبرمج خصيصًا أو WordPress أو Shopify أو WooCommerce — الاختيار لك.',
    'No platform lock-in. Pick the side of the marketplace you need.':'لا يوجد ارتباط إجباري بمنصة. اختر ما يناسبك.',
    'Choose products, get public links, and use them on any storefront you control.':'اختر المنتجات واستخدمها على أي متجر تديره.',
    'List products, manage stock, and receive fulfillment requests from dropshippers.':'أضف منتجاتك وأدر المخزون واستقبل طلبات التنفيذ من الدروبشيبرز.',
    'Browse public products before creating an account.':'تصفح المنتجات المتاحة قبل إنشاء حساب.',
    'Independent by design · Built for Egypt.':'مستقل بطبيعته · مصمم لمصر.',
    'Sign in once. We detect your access and open the right workspace automatically.':'سجّل الدخول مرة واحدة وسنحدد صلاحيتك ونفتح مساحة العمل المناسبة تلقائيًا.',
    'Discover products, link them to your store, and manage orders.':'اكتشف المنتجات واربطها بمتجرك وأدر الطلبات.',
    'Manage products, inventory, variants, and fulfillment.':'أدر المنتجات والمخزون والخيارات وعمليات التنفيذ.',
    'Admin access is invitation-only and never available through public signup.':'صلاحية المشرف متاحة بالدعوة فقط ولا تظهر في التسجيل العام.',
    'You can add or change this later in Settings.':'يمكنك إضافة هذا أو تغييره لاحقًا من الإعدادات.',
    'Add both English and Arabic product names. Use Generate translation if you need it.':'أضف اسم المنتج بالإنجليزية والعربية. استخدم إنشاء الترجمة إذا احتجت.',
    'Add both English and Arabic descriptions, or leave both descriptions empty.':'أضف الوصف بالإنجليزية والعربية، أو اترك الوصف فارغًا في اللغتين.',
    '← Back to IzzyDrop':'العودة إلى IzzyDrop →',
    'Forgot password?':'نسيت كلمة المرور؟',
    'ACCOUNT RECOVERY':'استعادة الحساب',
    'Reset your password':'إعادة تعيين كلمة المرور',
    'Enter your email and we’ll send you a secure IzzyDrop recovery link.':'أدخل بريدك الإلكتروني وسنرسل لك رابطًا آمنًا لاستعادة حساب IzzyDrop.',
    'Send recovery link':'إرسال رابط الاستعادة',
    'Back to log in':'العودة لتسجيل الدخول',
    'Create a new password':'إنشاء كلمة مرور جديدة',
    'Choose a new password for your IzzyDrop account.':'اختر كلمة مرور جديدة لحسابك على IzzyDrop.',
    'Recovery link verified.':'تم التحقق من رابط الاستعادة.',
    'You can now create a new password.':'يمكنك الآن إنشاء كلمة مرور جديدة.',
    'New password':'كلمة المرور الجديدة',
    'Confirm new password':'تأكيد كلمة المرور الجديدة',
    'Save new password':'حفظ كلمة المرور الجديدة',
    'Sending…':'جارٍ الإرسال…',
    'Saving password…':'جارٍ حفظ كلمة المرور…',
    'Updating your password…':'جارٍ تحديث كلمة المرور…',
    'Password changed. Opening your IzzyDrop workspace…':'تم تغيير كلمة المرور. جارٍ فتح مساحة عمل IzzyDrop…',
    'If an IzzyDrop account exists for this email, we sent a recovery link. Check your inbox and spam folder.':'إذا كان هناك حساب IzzyDrop بهذا البريد، فقد أرسلنا رابط استعادة. تحقق من البريد الوارد ومجلد الرسائل غير المرغوب فيها.',
    'Too many recovery requests. Please wait a little and try again.':'تم إرسال عدد كبير من طلبات الاستعادة. انتظر قليلًا ثم حاول مرة أخرى.',
    'We could not send the recovery email right now. Please try again.':'تعذر إرسال رسالة الاستعادة الآن. حاول مرة أخرى.',
    'Reset password by email':'إعادة تعيين كلمة المرور بالبريد',
    'Send a secure recovery link to your signed-in email address.':'أرسل رابط استعادة آمنًا إلى بريدك الإلكتروني المسجل.',
    'Send reset email':'إرسال رسالة إعادة التعيين',
    'Sending a secure recovery link…':'جارٍ إرسال رابط استعادة آمن…',
    'If this email belongs to an IzzyDrop account, a recovery link has been sent. Check your inbox and spam folder.':'إذا كان هذا البريد مرتبطًا بحساب IzzyDrop، فقد تم إرسال رابط استعادة. تحقق من البريد الوارد ومجلد الرسائل غير المرغوب فيها.',
    'Passwords do not match.':'كلمتا المرور غير متطابقتين.',
    'Add to your web':'أضفه إلى موقعك',
    'IZZYDROP WEB AUTOMATION':'أتمتة IZZYDROP للموقع',
    'Connect this product to your website. Orders placed through the IzzyDrop web widget go directly into your IzzyDrop Orders and reserve stock automatically.':'اربط هذا المنتج بموقعك. الطلبات التي تتم من خلال أداة IzzyDrop على موقعك تصل مباشرة إلى طلبات IzzyDrop ويتم حجز المخزون تلقائيًا.',
    'Your website URL':'رابط موقعك',
    'For security, automatic orders will only be accepted from this website.':'للأمان، سيتم قبول الطلبات التلقائية من هذا الموقع فقط.',
    'Your selling price (EGP)':'سعر بيعك (جنيه)',
    'Create automatic web setup':'إنشاء الربط التلقائي بالموقع',
    'Update web setup':'تحديث ربط الموقع',
    'Customer orders on your website':'العميل يطلب من موقعك',
    'IzzyDrop receives the order instantly':'IzzyDrop يستقبل الطلب فورًا',
    'Stock is reserved and supplier fulfillment starts':'يتم حجز المخزون ويبدأ تنفيذ المورّد',
    'Automatic orders enabled':'الطلبات التلقائية مفعّلة',
    'Paste this once on the product page of your website.':'الصق هذا الكود مرة واحدة في صفحة المنتج على موقعك.',
    'Website embed code':'كود الإضافة للموقع',
    'Copy embed code':'نسخ كود الإضافة',
    'This widget keeps price, stock and variants connected to IzzyDrop. Customer orders are created automatically — no manual order entry required.':'تحافظ هذه الأداة على ربط السعر والمخزون والخيارات مع IzzyDrop. يتم إنشاء طلبات العملاء تلقائيًا دون إدخال يدوي.',
    'Web connected':'الموقع متصل',
    'My product':'منتجي',
    'Website connection ready. Paste the embed code once on your product page.':'تم تجهيز ربط الموقع. الصق كود الإضافة مرة واحدة في صفحة المنتج.',
    'Embed code copied. Paste it on the product page of your website.':'تم نسخ كود الإضافة. الصقه في صفحة المنتج على موقعك.',
    'Connecting website…':'جارٍ ربط الموقع…',
    'Creating automatic order connection…':'جارٍ إنشاء ربط الطلبات التلقائي…',
    'Log in to add to your web':'سجّل الدخول لإضافته إلى موقعك',
    '2. Add it to your web':'2. أضفه إلى موقعك',
    'Connect the product to your website with IzzyDrop web automation.':'اربط المنتج بموقعك باستخدام أتمتة IzzyDrop للموقع.',
    '3. Orders flow automatically':'3. الطلبات تصل تلقائيًا',
    'Customer orders arrive in IzzyDrop, stock is reserved, and supplier fulfillment starts.':'تصل طلبات العملاء إلى IzzyDrop تلقائيًا، ويتم حجز المخزون ويبدأ تنفيذ المورّد.',
    'Choose products, connect them to your website, and receive customer orders directly in IzzyDrop.':'اختر المنتجات واربطها بموقعك واستقبل طلبات العملاء مباشرة داخل IzzyDrop.',
    'Variants to add':'الخيارات التي ستضيفها',
    'Choose which supplier variants you want on your website and set your selling price for each one.':'اختر خيارات المورّد التي تريد عرضها على موقعك وحدد سعر بيعك لكل خيار.',
    'Select all':'تحديد الكل',
    'Clear all':'إلغاء تحديد الكل',
    'Use':'استخدام',
    'Your price':'سعرك',
    'Loading variants…':'جارٍ تحميل الخيارات…',
    'No variants are available for this product.':'لا توجد خيارات متاحة لهذا المنتج.',
    'Choose at least one variant to add to your website.':'اختر خيارًا واحدًا على الأقل لإضافته إلى موقعك.',
    'Enter a valid selling price for every selected variant.':'أدخل سعر بيع صحيحًا لكل خيار محدد.',
    'Selling price':'سعر البيع',
    'Use IzzyDrop test store':'استخدم متجر IzzyDrop التجريبي',
    'Open test store':'فتح المتجر التجريبي',
    'Test store selected. Choose variants and prices, then create the setup.':'تم اختيار متجر IzzyDrop التجريبي. اختر الخيارات والأسعار ثم أنشئ الربط.',
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
    const ar={active:'نشط',inactive:'متوقف',draft:'مسودة',pending_review:'قيد المراجعة',pending:'قيد الانتظار',processing:'قيد التنفيذ',fulfilled:'تم الشحن',shipped:'تم الشحن',in_transit:'قيد التوصيل',delivered:'تم التوصيل',refused:'مرفوض',returned:'مرتجع',cancelled:'ملغي',refunded:'مسترد',approved:'مقبول',rejected:'مرفوض',requested:'تم الطلب',accepted:'تم القبول',declined:'لم يتم اختياره',submitted:'تم إرسال العرض',suspended:'معلّق',paused:'متوقف',new:'جديد',unfulfilled:'غير منفذ',partially_fulfilled:'منفذ جزئيًا',paid:'مدفوع',failed:'فشل'};
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
      if(lang==='ar'&&root.hasAttribute('data-label')){
        const label=root.getAttribute('data-label');
        if(exactAr[label])root.setAttribute('data-label',exactAr[label]);
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
      root.querySelectorAll?.('[data-label]').forEach(el=>{
        const label=el.getAttribute('data-label');
        if(exactAr[label])el.setAttribute('data-label',exactAr[label]);
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
    const host=document.querySelector('.auth-nav-actions')||document.querySelector('.navlinks')||document.querySelector('.supplier-top-actions');
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