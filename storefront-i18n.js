(() => {
  'use strict';

  const readStoredLanguage = () => {
    try {
      const direct = localStorage.getItem('izzy_language');
      if (direct === 'ar' || direct === 'en') return direct;
      const session = JSON.parse(localStorage.getItem('izzy_session') || 'null');
      const account = session?.user?.user_metadata?.preferred_language;
      if (account === 'ar' || account === 'en') return account;
    } catch (_) {}
    return null;
  };

  const requested = new URLSearchParams(location.search).get('lang');
  const browser = (navigator.language || '').toLowerCase();
  const language = requested === 'ar' || requested === 'en'
    ? requested
    : readStoredLanguage() || (browser.startsWith('ar') ? 'ar' : 'en');
  const arabic = language === 'ar';
  const designPage = document.body?.classList.contains('store-design-page')
    || location.pathname.endsWith('store-design.html');

  const translations = {
    'Dropshipper': 'الدروبشيبر',
    'Workspace': 'مساحة العمل',
    'Design my store': 'تصميم متجري',
    'Sign out': 'تسجيل الخروج',
    'My Store': 'متجري',
    'Product': 'منتج',
    'Back to My Store': 'العودة إلى متجري',
    'View store': 'عرض المتجر',
    'View published store ↗': 'عرض المتجر المنشور ↗',
    'YOUR OWN STOREFRONT': 'متجرك الإلكتروني',
    'Your own storefront': 'متجرك الإلكتروني',
    'Make it look like your brand.': 'اجعل متجرك يعكس هويتك.',
    'Choose products from IzzyDrop, customize what customers see, and share your store link.': 'اختر المنتجات من IzzyDrop، وخصص طريقة ظهورها للعملاء، ثم شارك رابط متجرك.',
    'Store details': 'تفاصيل المتجر',
    'Your store name and address are shown to customers. Supplier identities and supplier costs are not shown on your public store.': 'يظهر اسم متجرك ورابطه للعملاء. ولا تظهر هوية الموردين أو تكاليفهم في متجرك العام.',
    'Not published': 'غير منشور',
    'Published': 'منشور',
    'Store name': 'اسم المتجر',
    'Your brand name': 'اسم علامتك التجارية',
    'Store link': 'رابط المتجر',
    'Lowercase letters, numbers and hyphens. This is your unique store address.': 'استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطات. هذا هو رابط متجرك الفريد.',
    'Short description': 'وصف مختصر',
    'What does your store sell?': 'ماذا يبيع متجرك؟',
    'Publish my store': 'نشر متجري',
    'When enabled, anyone with your link can view your published products.': 'عند التفعيل، سيتمكن أي شخص لديه رابط متجرك من مشاهدة المنتجات المنشورة.',
    'Save store details': 'حفظ تفاصيل المتجر',
    'Copy store link': 'نسخ رابط المتجر',
    'Public store link': 'رابط المتجر العام',
    'Add products from IzzyDrop': 'إضافة منتجات من IzzyDrop',
    "Products are copied into your store listing. Editing your listing will not change the supplier's original product.": 'تُضاف المنتجات إلى قائمة متجرك. تعديل قائمتك لن يغيّر بيانات المنتج الأصلية لدى المورد.',
    'Search marketplace products': 'ابحث في منتجات السوق',
    'Search marketplace products…': 'ابحث في منتجات السوق…',
    'Sort products': 'ترتيب المنتجات',
    'Newest': 'الأحدث',
    'Lowest suggested price': 'أقل سعر مقترح',
    'Highest suggested price': 'أعلى سعر مقترح',
    'Loading marketplace products…': 'جارٍ تحميل منتجات السوق…',
    'Loading your store…': 'جارٍ تحميل متجرك…',
    'Products in your store': 'المنتجات في متجرك',
    'Edit the title, description, photos, and price customers will see. Supplier prices remain visible here only to you.': 'عدّل العنوان والوصف والصور وسعر البيع الذي سيظهر للعملاء. أسعار الموردين ظاهرة لك وحدك.',
    'CUSTOMIZE LISTING': 'تخصيص المنتج',
    'Customize listing': 'تخصيص المنتج',
    'Edit product': 'تعديل المنتج',
    'Product title': 'عنوان المنتج',
    'Product description': 'وصف المنتج',
    'Photos': 'الصور',
    'Choose the supplier photos you want to show, or upload your own.': 'اختر صور المورد التي تريد عرضها، أو ارفع صورك الخاصة.',
    'Add your own photos': 'إضافة صورك الخاصة',
    'Maximum 5 MB per image. Your upload is separate from the supplier\'s original photos.': 'الحد الأقصى 5 ميجابايت للصورة الواحدة. صورك المرفوعة منفصلة عن صور المورد الأصلية.',
    'I reviewed this listing before publishing': 'راجعت هذه القائمة قبل نشرها',
    'I checked the title, description, and selected photos to make sure they do not reveal supplier names, contact details, or private sourcing information.': 'تحققت من العنوان والوصف والصور المختارة للتأكد من أنها لا تكشف أسماء الموردين أو بيانات الاتصال أو معلومات التوريد الخاصة.',
    'Variants and selling prices': 'الخيارات وأسعار البيع',
    'Set a separate price for each variant. You can use any non-negative price.': 'حدد سعر بيع مستقلًا لكل خيار. يجب أن يكون السعر صفرًا أو أكثر.',
    'Cancel': 'إلغاء',
    'Save listing': 'حفظ المنتج',
    'Close editor': 'إغلاق المحرر',

    'Save your store details first. Then choose products to add.': 'احفظ تفاصيل متجرك أولًا، ثم اختر المنتجات التي تريد إضافتها.',
    'No matching products are available to add. Try another search.': 'لا توجد منتجات مطابقة متاحة للإضافة. جرّب بحثًا آخر.',
    'No description provided yet.': 'لا يوجد وصف لهذا المنتج حتى الآن.',
    'Supplier price': 'سعر المورد',
    'Suggested retail': 'سعر البيع المقترح',
    'Add to my store': 'أضف إلى متجري',
    'Your store is empty. Add a product from the IzzyDrop marketplace above.': 'متجرك فارغ. أضف منتجًا من سوق IzzyDrop بالأعلى.',
    'Visible in store': 'ظاهر في المتجر',
    'Hidden from store': 'مخفي من المتجر',
    'Variants enabled': 'الخيارات المفعّلة',
    'Supplier availability needs attention. The listing will not be shown while its source product is unavailable.': 'هناك مشكلة في توفر المنتج لدى المورد. لن يظهر هذا المنتج في متجرك حتى يصبح المنتج الأصلي متاحًا.',
    'Customize': 'تخصيص',
    'Hide': 'إخفاء',
    'Show': 'إظهار',
    'Remove': 'إزالة',
    'Loading your store and marketplace…': 'جارٍ تحميل متجرك والسوق…',
    'Please sign in again to manage your store.': 'يرجى تسجيل الدخول مرة أخرى لإدارة متجرك.',
    'This account does not have a dropshipper workspace yet.': 'هذا الحساب لا يحتوي على مساحة عمل دروبشيبر حتى الآن.',
    'Your dropshipper account must be active before you can publish a store.': 'يجب أن يكون حساب الدروبشيبر نشطًا قبل نشر المتجر.',
    'Enter a store name with at least 2 characters.': 'أدخل اسمًا للمتجر يتكون من حرفين على الأقل.',
    'Choose a different store link. Use lowercase letters, numbers and hyphens.': 'اختر رابطًا آخر للمتجر، باستخدام أحرف إنجليزية صغيرة وأرقام وشرطات فقط.',
    'Saving store details…': 'جارٍ حفظ تفاصيل المتجر…',
    'Store details saved.': 'تم حفظ تفاصيل المتجر.',
    'Could not save your store details.': 'تعذر حفظ تفاصيل المتجر.',
    'This product is paused in My Products. Reactivate it there before adding it to your store.': 'هذا المنتج متوقف في «منتجاتي». أعد تفعيله هناك قبل إضافته إلى متجرك.',
    'Could not link this product to My Products.': 'تعذر ربط هذا المنتج بقائمة «منتجاتي».',
    'Save your store details first, then add products.': 'احفظ تفاصيل متجرك أولًا، ثم أضف المنتجات.',
    'This product is no longer available to add.': 'لم يعد هذا المنتج متاحًا للإضافة.',
    'Adding…': 'جارٍ الإضافة…',
    'Adding the product and preparing its variants…': 'جارٍ إضافة المنتج وتجهيز خياراته…',
    'No enabled variants are available for this product.': 'لا توجد خيارات مفعّلة متاحة لهذا المنتج.',
    'The store listing could not be created.': 'تعذر إنشاء قائمة المنتج في متجرك.',
    'Product added. Customize its title, description, photos, and selling prices below.': 'تمت إضافة المنتج. يمكنك تخصيص عنوانه ووصفه وصوره وأسعار بيعه بالأسفل.',
    'Could not add this product.': 'تعذرت إضافة هذا المنتج.',
    'Could not load this listing. Refresh and try again.': 'تعذر تحميل هذا المنتج. حدّث الصفحة وحاول مرة أخرى.',
    'Loading photos…': 'جارٍ تحميل الصور…',
    'Loading variants…': 'جارٍ تحميل الخيارات…',
    'No supplier photos are available. Upload at least one photo to publish the listing.': 'لا توجد صور للمورد. ارفع صورة واحدة على الأقل قبل نشر المنتج.',
    'No currently enabled variants can be edited. Check product availability.': 'لا توجد خيارات مفعّلة يمكن تعديلها حاليًا. تحقق من توفر المنتج.',
    'Show variant': 'إظهار الخيار',
    'Your selling price': 'سعر البيع الخاص بك',
    'Default option': 'الخيار الافتراضي',
    'Enter a title between 2 and 200 characters.': 'أدخل عنوانًا يتراوح بين حرفين و200 حرف.',
    'The description must be 5,000 characters or fewer.': 'يجب ألا يتجاوز الوصف 5000 حرف.',
    'Keep at least one photo or upload your own.': 'احتفظ بصورة واحدة على الأقل أو ارفع صورة خاصة بك.',
    'Enter a valid non-negative selling price for every variant.': 'أدخل سعر بيع صحيحًا يساوي صفرًا أو أكثر لكل خيار.',
    'Saving your custom listing…': 'جارٍ حفظ تعديلات المنتج…',
    'Listing saved. The supplier’s original product remains unchanged.': 'تم حفظ المنتج. لم يتم تغيير المنتج الأصلي لدى المورد.',
    'Could not save your listing.': 'تعذر حفظ تعديلات المنتج.',
    'Product is now visible in your store.': 'أصبح المنتج ظاهرًا في متجرك.',
    'Product is hidden from your store.': 'تم إخفاء المنتج من متجرك.',
    'Could not update product visibility.': 'تعذر تحديث حالة ظهور المنتج.',
    'Remove this product from your store? It will remain in My Products.': 'هل تريد إزالة هذا المنتج من متجرك؟ سيظل موجودًا في قائمة «منتجاتي».',
    'Product removed from your store. It remains in My Products.': 'تمت إزالة المنتج من متجرك، وسيظل موجودًا في قائمة «منتجاتي».',
    'Could not remove this listing.': 'تعذر إزالة هذا المنتج.',
    'A listing can have up to 12 of your own uploaded photos.': 'يمكنك رفع 12 صورة كحد أقصى لكل منتج.',
    'Use a JPG, PNG, WebP or AVIF image.': 'استخدم صورة بصيغة JPG أو PNG أو WebP أو AVIF.',
    'Each photo must be 5 MB or smaller.': 'يجب ألا يتجاوز حجم كل صورة 5 ميجابايت.',
    'Please sign in again to upload photos.': 'يرجى تسجيل الدخول مرة أخرى لرفع الصور.',
    'Uploading your photos…': 'جارٍ رفع صورك…',
    'Photos uploaded. Save the listing to publish them.': 'تم رفع الصور. احفظ المنتج لنشرها.',
    'Could not upload a photo.': 'تعذر رفع الصورة.',
    'Store link copied.': 'تم نسخ رابط المتجر.',
    'Copy this store link:': 'انسخ رابط المتجر هذا:',
    'Could not open My Store.': 'تعذر فتح صفحة متجري.',
    'My Store could not load. Sign in with an active dropshipper account, then refresh.': 'تعذر تحميل صفحة متجري. سجّل الدخول بحساب دروبشيبر نشط ثم حدّث الصفحة.',
    'Supplier photo': 'صورة المورد',
    'Your photo': 'صورتك',
    'Remove uploaded photo': 'إزالة الصورة المرفوعة',
    'Your uploaded photo': 'صورتك المرفوعة',
    'Show photo': 'عرض الصورة',
    'Your supplier price:': 'سعر المورد الخاص بك:',
    'Stock:': 'المخزون:',
    'Your supplier price': 'سعر المورد الخاص بك',
    'Uploading logo…': 'جارٍ رفع الشعار…',
    'Uploading banner…': 'جارٍ رفع صورة الغلاف…',
    'Could not upload the image.': 'تعذر رفع الصورة.',
    'Failed to fetch': 'تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مرة أخرى.',
    'Could not load product details.': 'تعذر تحميل تفاصيل المنتج.',

    'My Stores': 'متاجري',
    'YOUR STOREFRONTS': 'متاجرك الإلكترونية',
    'STORE OVERVIEW': 'نظرة عامة على المتجر',
    'An active dropshipper workspace is required.': 'يلزم وجود مساحة عمل دروبشيبر نشطة.',
    'Reactivate your store': 'إعادة تفعيل متجرك',
    'Your store is hidden from customers. Reactivate it when you are ready to publish it again.': 'متجرك مخفي عن العملاء. أعد تفعيله عندما تكون مستعدًا لنشره مرة أخرى.',
    'Your store is a draft. Publish it when your details, design and product listings are ready.': 'متجرك محفوظ كمسودة. انشره عندما تصبح التفاصيل والتصميم وقوائم المنتجات جاهزة.',
    'Publish this store now? Customers will be able to visit its public link.': 'هل تريد نشر هذا المتجر الآن؟ سيتمكن العملاء من زيارة رابطه العام.',
    'Shut down this store? Its public link will stop working, but its products and design will be kept.': 'هل تريد إيقاف هذا المتجر؟ سيتوقف رابطه العام عن العمل، مع الاحتفاظ بمنتجاته وتصميمه.',
    'Reactivate and publish this store? Customers will be able to visit it again.': 'هل تريد إعادة تفعيل هذا المتجر ونشره؟ سيتمكن العملاء من زيارته مرة أخرى.',
    'Updating store status…': 'جارٍ تحديث حالة المتجر…',

    'Loading your stores…': 'جارٍ تحميل متاجرك…',
    '← Back to My Stores': '← العودة إلى متاجري',
    'This is the name customers will see on your storefront.': 'هذا هو الاسم الذي سيظهر للعملاء في متجرك.',
    'Use English lowercase letters, numbers, and hyphens. Your public address will be unique.': 'استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطات. يجب أن يكون رابط متجرك فريدًا.',
    'Describe your store in a sentence or two. You can change this later.': 'اكتب وصفًا مختصرًا لمتجرك. يمكنك تغييره لاحقًا.',
    'Products are copied into your store listing. Editing your listing will not change the supplier\'s original product.': 'تُضاف المنتجات إلى قائمة متجرك. تعديل قائمتك لن يغيّر المنتج الأصلي لدى المورد.',
    'View storefront ↗': 'عرض المتجر ↗',
    'Update your storefront whenever you need.': 'حدّث متجرك متى شئت.',
    'Store visibility': 'ظهور المتجر',
    'You can make the storefront unavailable without deleting its content.': 'يمكنك إيقاف إتاحة المتجر للعملاء دون حذف محتواه.',
    '＋ Create another store': '＋ إنشاء متجر آخر',
    'Store content is kept when a storefront is shut down.': 'يتم الاحتفاظ بمحتوى المتجر عند إيقافه.',
    'Store Design · IzzyDrop': 'تصميم المتجر · IzzyDrop',
    'Manage Store · IzzyDrop': 'إدارة المتجر · IzzyDrop',
    'Create a Store · IzzyDrop': 'إنشاء متجر · IzzyDrop',
    'Store Dashboard · IzzyDrop': 'لوحة المتجر · IzzyDrop',
    'My Stores · IzzyDrop': 'متاجري · IzzyDrop',
    'Your store': 'متجرك',
    'Loading your store…': 'جارٍ تحميل متجرك…',

    'NEW STOREFRONT · STEP 1 OF 2': 'متجر جديد · الخطوة 1 من 2',
    'PUBLIC STORE LINK': 'رابط المتجر العام',
    'STORE OVERVIEW': 'نظرة عامة على المتجر',
    'YOUR STOREFRONTS': 'متاجرك الإلكترونية',
    'Your business, your storefronts.': 'مشروعك، ومتاجرك الإلكترونية.',
    'You can manage several independent storefronts from the same account.': 'يمكنك إدارة عدة متاجر مستقلة من الحساب نفسه.',
    'Products visible': 'منتجات ظاهرة',
    'Listings published': 'قوائم منشورة',
    'Products added': 'منتجات مضافة',
    'View storefront': 'عرض المتجر',
    'Copy link': 'نسخ الرابط',
    'Edit design': 'تعديل التصميم',
    'Back to dashboard': 'العودة إلى لوحة المتجر',
    'Finish and view dashboard': 'إنهاء والانتقال إلى لوحة المتجر',
    'Continue to store design →': 'المتابعة إلى تصميم المتجر ←',
    'Creating your store…': 'جارٍ إنشاء متجرك…',
    'Saving your store as a draft…': 'جارٍ حفظ متجرك كمسودة…',
    'Create your store': 'أنشئ متجرك',
    'Store link copied.': 'تم نسخ رابط المتجر.',
    'That store link is already in use. Choose another one.': 'رابط المتجر مستخدم بالفعل. اختر رابطًا آخر.',
    'Choose a different store link. Use lowercase English letters, numbers and hyphens.': 'اختر رابطًا آخر باستخدام أحرف إنجليزية صغيرة وأرقام وشرطات.',
    'An active dropshipper workspace is required.': 'يلزم وجود مساحة عمل دروبشيبر نشطة.',
    'Shut down this store? Its public link will stop working, but its products and design will be kept.': 'هل تريد إيقاف المتجر؟ سيتوقف الرابط العام عن العمل، مع الاحتفاظ بالمنتجات والتصميم.',
    'Reactivate and publish this store? Customers will be able to visit it again.': 'هل تريد إعادة تفعيل المتجر ونشره؟ سيتمكن العملاء من زيارته مرة أخرى.',
    'Publish this store now? Customers will be able to visit its public link.': 'هل تريد نشر المتجر الآن؟ سيتمكن العملاء من زيارة رابطه العام.',

    'Create a store': 'إنشاء متجر',
    'Create your first store': 'أنشئ متجرك الأول',
    'Your first store starts here': 'متجرك الأول يبدأ من هنا',
    'Your storefronts': 'متاجرك الإلكترونية',
    'Create and manage all your online stores from one place.': 'أنشئ جميع متاجرك الإلكترونية وأدرها من مكان واحد.',
    'Create your store': 'أنشئ متجرك',
    'Start with your store name and link. Next, you\'ll choose a design and customize your brand.': 'ابدأ باسم متجرك ورابطه. بعد ذلك ستختار التصميم وتخصص هوية علامتك التجارية.',
    'Back to My Stores': 'العودة إلى متاجري',
    'Store dashboard': 'لوحة المتجر',
    'Open store dashboard': 'افتح لوحة المتجر',
    'Manage store': 'إدارة المتجر',
    'STORE MANAGEMENT': 'إدارة المتجر',
    'Update this store’s details, select products from IzzyDrop, and customize what customers see.': 'حدّث تفاصيل هذا المتجر، واختر منتجات من IzzyDrop، وخصص ما يراه العملاء.',
    'Edit design': 'تعديل التصميم',
    'Finish and view dashboard': 'إنهاء والانتقال إلى لوحة المتجر',
    'Your store will be saved as a draft. It won\'t be public until you publish it.': 'سيتم حفظ متجرك كمسودة، ولن يكون متاحًا للعملاء حتى تنشره.',
    'Continue to store design': 'المتابعة إلى تصميم المتجر',
    'Store overview': 'نظرة عامة على المتجر',
    'Manage your store': 'إدارة متجرك',
    'Edit store details': 'تعديل تفاصيل المتجر',
    'Name, link and description': 'الاسم والرابط والوصف',
    'Edit store design': 'تعديل تصميم المتجر',
    'Templates, colors and homepage': 'القوالب والألوان والصفحة الرئيسية',
    'Manage products': 'إدارة المنتجات',
    'Add, customize and hide products': 'إضافة المنتجات وتخصيصها وإخفاؤها',
    'Products added': 'المنتجات المضافة',
    'Products visible to customers': 'المنتجات الظاهرة للعملاء',
    'Store design': 'تصميم المتجر',
    'Customized': 'مخصص',
    'Not customized': 'لم يتم تخصيصه',
    'Shut down': 'متوقف',
    'Shut down store': 'إيقاف المتجر',
    'Reactivate store': 'إعادة تفعيل المتجر',
    'Publish store': 'نشر المتجر',
    'Store status updated.': 'تم تحديث حالة المتجر.',
    'Created': 'تاريخ الإنشاء',
    'Create another store': 'إنشاء متجر آخر',
    'Your business, your storefronts.': 'مشروعك، ومتاجرك الإلكترونية.',
    'Choose a store name and unique link.': 'اختر اسمًا للمتجر ورابطًا فريدًا.',
    'You can run multiple independent stores from this same account.': 'يمكنك إدارة عدة متاجر مستقلة من الحساب نفسه.',
    'Your store is a draft.': 'متجرك محفوظ كمسودة.',
    'Public store link': 'رابط المتجر العام',
    'STORE BUILDER · DESIGN STUDIO': 'منشئ المتجر · استوديو التصميم',
    'Make it look like your brand.': 'اجعل متجرك يعكس هوية علامتك التجارية.',
    'Choose a layout, set your brand style, and preview your storefront as you customize it.': 'اختر قالبًا، وحدد هوية متجرك، وشاهد التعديلات مباشرة أثناء تخصيصه.',
    'Choose a layout': 'اختر التصميم',
    'Change the structure of your storefront': 'غيّر شكل وترتيب متجرك',
    'Clean': 'بسيط',
    'Simple and product-first': 'بسيط ويركز على المنتجات',
    'Editorial': 'تحريري',
    'Big visuals and storytelling': 'صور كبيرة ومساحة لسرد قصة علامتك',
    'Bold': 'جريء',
    'Strong color and statement style': 'ألوان قوية وتصميم لافت',
    'Brand identity': 'هوية العلامة التجارية',
    'Make the store yours': 'اجعل المتجر يعبر عنك',
    'Store logo': 'شعار المتجر',
    'JPG, PNG, WebP or AVIF · Maximum 5 MB': 'JPG أو PNG أو WebP أو AVIF · بحد أقصى 5 ميجابايت',
    'Cover image / banner': 'صورة الغلاف / البانر',
    'Wide images work best · Maximum 5 MB': 'تُفضّل الصور العريضة · بحد أقصى 5 ميجابايت',
    'Colors and typography': 'الألوان والخطوط',
    'Set your visual style': 'حدد أسلوبك البصري',
    'Accent color': 'اللون الرئيسي',
    'Page background': 'خلفية الصفحة',
    'Text color': 'لون النص',
    'Font style': 'نمط الخط',
    'Modern · clean': 'عصري · بسيط',
    'Classic · editorial': 'كلاسيكي · تحريري',
    'Rounded · friendly': 'مستدير · ودود',
    'Homepage content': 'محتوى الصفحة الرئيسية',
    'What customers see first': 'ما يراه العملاء أولًا',
    'Main headline': 'العنوان الرئيسي',
    'Short introduction': 'مقدمة قصيرة',
    'Announcement bar': 'شريط الإعلانات',
    'Optional': 'اختياري',
    'Discover your next favorite thing': 'اكتشف منتجك المفضل القادم',
    'A short introduction to your store.': 'نبذة قصيرة عن متجرك.',
    'Example: New arrivals just landed': 'مثال: وصلت منتجات جديدة',
    'Save design': 'حفظ التصميم',
    'Your changes are not saved yet.': 'لديك تغييرات لم يتم حفظها بعد.',
    'All changes saved.': 'تم حفظ جميع التغييرات.',
    'Live preview': 'معاينة مباشرة',
    'Updates as you edit': 'تتحدث المعاينة مع كل تعديل',
    'Desktop preview': 'معاينة الكمبيوتر',
    'Mobile preview': 'معاينة الهاتف',
    'Desktop': 'كمبيوتر',
    'Mobile': 'هاتف',
    'Loading your store preview…': 'جارٍ تحميل معاينة متجرك…',
    'This is a preview of the storefront design. Your actual products and stock availability are managed separately in My Store.': 'هذه معاينة لتصميم متجرك. تتم إدارة منتجاتك الفعلية وتوفر المخزون بشكل منفصل من صفحة «متجري».',
    'This is a preview of the storefront design. Your actual products and stock availability are managed separately in متجري.': 'هذه معاينة لتصميم متجرك. تتم إدارة منتجاتك الفعلية وتوفر المخزون بشكل منفصل من صفحة «متجري».',
    'Current store logo': 'شعار المتجر الحالي',
    'Current cover image': 'صورة الغلاف الحالية',
    'WELCOME TO': 'مرحبًا بك في',
    'HOME　 SHOP　 CONTACT': 'الرئيسية　 المتجر　 تواصل معنا',
    'Explore collection': 'تصفح المنتجات',
    'Featured products': 'منتجات مميزة',
    'A preview of how your products will be presented': 'معاينة لطريقة عرض منتجاتك',
    'Everyday essential': 'منتج أساسي للاستخدام اليومي',
    'Customer favorite': 'اختيار العملاء المفضل',
    'New arrival': 'وصل حديثًا',
    'Create your store name and link in My Store first, then return here.': 'أنشئ اسم متجرك ورابطه من صفحة «متجري» أولًا، ثم عُد إلى هنا.',
    'Your store preview will appear here after you create your store details.': 'ستظهر معاينة متجرك هنا بعد حفظ تفاصيل المتجر.',
    'Use a JPG, PNG, WebP or AVIF image.': 'استخدم صورة بصيغة JPG أو PNG أو WebP أو AVIF.',
    'Each image must be 5 MB or smaller.': 'يجب ألا يتجاوز حجم كل صورة 5 ميجابايت.',
    'Create your store details first in My Store.': 'أنشئ تفاصيل متجرك أولًا من صفحة «متجري».',
    'Uploading logo…': 'جارٍ رفع الشعار…',
    'Uploading banner…': 'جارٍ رفع صورة الغلاف…',
    'Logo uploaded. Save your design to apply it.': 'تم رفع الشعار. احفظ التصميم لتطبيقه.',
    'Cover image uploaded. Save your design to apply it.': 'تم رفع صورة الغلاف. احفظ التصميم لتطبيقها.',
    'Choose valid colors before saving.': 'اختر ألوانًا صحيحة قبل الحفظ.',
    'Saving your store design…': 'جارٍ حفظ تصميم المتجر…',
    'Design saved. Your public storefront will use these settings.': 'تم حفظ التصميم. سيظهر متجرك العام بهذه الإعدادات.',
    'Could not save your design.': 'تعذر حفظ التصميم.',
    'Loading your store…': 'جارٍ تحميل متجرك…',
    'This account does not have a dropshipper workspace.': 'هذا الحساب لا يحتوي على مساحة عمل دروبشيبر.',
    'Your dropshipper account must be active before using the store builder.': 'يجب أن يكون حساب الدروبشيبر نشطًا قبل استخدام منشئ المتجر.',
    'Could not load the store design studio.': 'تعذر تحميل استوديو تصميم المتجر.'
  };

  const placeholders = {
    'Your brand name': 'اسم علامتك التجارية',
    'What does your store sell?': 'ماذا يبيع متجرك؟',
    'Search marketplace products': 'ابحث في منتجات السوق',
    'Discover your next favorite thing': 'اكتشف منتجك المفضل القادم',
    'A short introduction to your store.': 'نبذة قصيرة عن متجرك.',
    'Example: New arrivals just landed': 'مثال: وصلت منتجات جديدة'
  };

  function translateValue(value) {
    const raw = String(value ?? '');
    const trimmed = raw.trim();
    if (!trimmed) return raw;
    if (translations[trimmed]) return raw.replace(trimmed, translations[trimmed]);

    let match = trimmed.match(/^(\d+) products?$/i);
    if (match) {
      const n = Number(match[1]);
      let count;
      if (n === 0) count = 'منتجات';
      else if (n === 1) count = 'منتج واحد';
      else if (n === 2) count = 'منتجان';
      else if (n % 100 >= 3 && n % 100 <= 10) count = n + ' منتجات';
      else if (n % 100 >= 11 && n % 100 <= 99) count = n + ' منتجًا';
      else count = n + ' منتج';
      return raw.replace(trimmed, count);
    }

    match = trimmed.match(/^Supplier price shown only in your workspace: (.+)\. Customers will see only your selling price\.$/i);
    if (match) return raw.replace(trimmed, 'سعر المورد ظاهر لك وحدك في مساحة العمل: ' + match[1] + '. ولن يرى العملاء سوى سعر البيع الذي تحدده.');
    match = trimmed.match(/^Stock: (\d+)(?: · SKU (.+))?$/i);
    if (match) return raw.replace(trimmed, 'المخزون: ' + match[1] + (match[2] ? ' · SKU ' + match[2] : ''));
    match = trimmed.match(/^Supplier photo (\d+)$/i);
    if (match) return raw.replace(trimmed, 'صورة المورد ' + match[1]);
    match = trimmed.match(/^Your photo (\d+)$/i);
    if (match) return raw.replace(trimmed, 'صورتك ' + match[1]);
    match = trimmed.match(/^Show photo (\d+)$/i);
    if (match) return raw.replace(trimmed, 'عرض الصورة ' + match[1]);
    match = trimmed.match(/^Your supplier price: (.+)$/i);
    if (match) return raw.replace(trimmed, 'سعر المورد الخاص بك: ' + match[1]);
    match = trimmed.match(/^WELCOME TO (.+)$/i);
    if (match) return raw.replace(trimmed, 'مرحبًا بك في ' + match[1]);
    match = trimmed.match(/^Copy this store link: (.+)$/i);
    if (match) return raw.replace(trimmed, 'انسخ رابط المتجر هذا: \u2066' + match[1] + '\u2069');
    match = trimmed.match(/^Variants enabled$/i);
    if (match) return raw.replace(trimmed, 'الخيارات المفعّلة');
    return raw;
  }

  function translateElement(el) {
    if (!(el instanceof Element)) return;
    if (el.hasAttribute('placeholder')) {
      const value = el.getAttribute('placeholder');
      if (placeholders[value]) el.setAttribute('placeholder', placeholders[value]);
      else if (translations[value]) el.setAttribute('placeholder', translations[value]);
    }
    for (const attribute of ['aria-label', 'title', 'alt']) {
      if (!el.hasAttribute(attribute)) continue;
      const value = el.getAttribute(attribute);
      if (translations[value]) el.setAttribute(attribute, translations[value]);
      else {
        const changed = translateValue(value);
        if (changed !== value) el.setAttribute(attribute, changed);
      }
    }
  }

  function scan(root) {
    if (!arabic || !root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      root.nodeValue = translateValue(root.nodeValue);
      return;
    }
    if (!(root instanceof Element || root === document)) return;
    if (root instanceof Element) translateElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (parent?.closest('input, textarea, script, style, [translate="no"], [data-i18n-skip="true"], .store-hub-card-name, #dashboard-store-name, .store-manager-product-body h3, .store-card-description, #store-name, #store-slug, #store-description, #edit-product-title, #edit-product-description, .design-preview-user-copy')) continue;
      node.nodeValue = translateValue(node.nodeValue);
    }
    if (root.querySelectorAll) {
      root.querySelectorAll('[placeholder], [aria-label], [title], [alt]').forEach(translateElement);
      root.querySelectorAll('option').forEach(option => {
        option.textContent = translateValue(option.textContent);
      });
    }
  }

  function preserveArabicRoutes() {
    if (!arabic) return;
    document.querySelectorAll('a[href="app.html"], a[href="store-manager.html"], a[href="store-design.html"], a[href="my-stores.html"], a[href="store-create.html"], a[href="store-dashboard.html"]').forEach(link => {
      const target = new URL(link.getAttribute('href'), location.href);
      target.searchParams.set('lang', 'ar');
      link.href = target.href;
    });
  }

  document.documentElement.lang = language;
  document.documentElement.dir = arabic ? 'rtl' : 'ltr';
  document.body?.classList.toggle('rtl', arabic);

  const pageName = location.pathname.split('/').pop() || '';
  const arabicPageTitles = {
    'my-stores.html': 'متاجري · IzzyDrop',
    'store-create.html': 'إنشاء متجر · IzzyDrop',
    'store-dashboard.html': 'لوحة المتجر · IzzyDrop',
    'store-manager.html': 'إدارة المتجر · IzzyDrop',
    'store-design.html': 'تصميم المتجر · IzzyDrop'
  };
  if (arabic) document.title = arabicPageTitles[pageName] || 'IzzyDrop';

  window.IZZY_STORE_I18N = {
    language: () => language,
    isArabic: () => arabic,
    t: value => arabic ? (translations[value] || translateValue(value)) : value
  };

  const boot = () => {
    if (!arabic) return;
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    document.body.classList.add('rtl');
    scan(document.body);
    preserveArabicRoutes();
    const observer = new MutationObserver(records => {
      for (const record of records) {
        record.addedNodes.forEach(scan);
      }
    });
    observer.observe(document.body, {childList: true, subtree: true});
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
  else boot();
})();