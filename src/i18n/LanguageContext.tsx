import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AppLanguage } from '../types/commerce';

const LANG_STORAGE_KEY = 'tys_lang';
const LEGACY_LANG_STORAGE_KEY = 'tryonstudio_ui_lang';

const DICTIONARY = {
  en: {
    // Brand & Header
    brandTitle: 'Try On Studio',
    brandSubtitle: 'See it. Wear it. Find your size.',
    navStudio: 'Try On Studio',
    navBrowse: 'Browse Clothing',
    navSizeGuide: 'Find My Size',
    navAssistant: 'AI Stylist',
    navLoyalty: 'Loyalty Rewards',
    navCart: 'Shopping Cart',
    navCheckout: 'Checkout',
    navHowItWorks: 'How It Works',
    searchPlaceholder: 'Search clothing items by name or description...',
    checkingApi: 'Checking API...',
    apiOnline: 'Catalog API Online',
    apiOffline: 'API Unreachable',
    openStylistBtn: 'Ask AI Stylist',
    buyNow: 'Buy Now',
    addToCart: 'Add to Cart',
    addedToCart: 'Added to Cart',
    viewDetailsBtn: 'Details',
    viewCartBtn: 'View Cart',
    clearSelectionBtn: 'Deselect Outfit',
    undoOutfitConfirm: 'Undo Confirmation',
    proceedToCheckout: 'Proceed to Checkout',
    selectSizeFirst: 'Select a size below to purchase:',
    tryOn: 'Studio Try-On',
    sizeGuide: 'Size Guide',

    // Mirror & Try-On Panel
    mirrorTitle: 'Virtual Try-On Mirror',
    mirrorSubtitle: 'Step into the camera frame or view simulated garment fit',
    startCamera: 'Start Camera',
    stopCamera: 'Stop Camera',
    cameraActive: 'Camera Live',
    cameraStarting: 'Starting Camera...',
    cameraError: 'Camera Access Error',
    cameraSimulated: 'Simulated Mode',
    switchCamera: 'Flip Camera',
    toggleMirror: 'Flip View',
    snapshot: 'Capture Snap',
    togglePose: 'Body Pose',
    toggleGestures: 'Wave Gestures',
    gesturesActive: 'Wave gestures active (Wave left / right to swap variants)',
    tryOnLiveOverlay: 'Try-On Live Overlay',
    tryOnSimulatedPreview: 'Simulated Fitting Preview',
    noGarmentSelected: 'No Garment Selected',
    selectGarmentPrompt: 'Select an outfit below to preview it on your frame',
    gestureSwapped: 'Swapped to {color}',
    retryCamera: 'Retry Camera',
    dismissBanner: 'Dismiss',
    virtualTryOnActive: 'Virtual Try-On Active',
    switchingGarment: 'Switching Garment...',
    requestingToken: 'Requesting Try-On Token...',
    connectingToService: 'Connecting to Decart (2–5s)...',
    cameraPreviewOnly: 'Camera Preview (AI Try-On Off)',
    waitingPermission: 'Waiting for Camera Permission...',
    cameraOff: 'Camera Off',
    standardView: 'Standard View',
    mirrorViewBtn: 'Mirror View',
    endTryOn: 'End Try-On',
    swipeNext: 'Hand Swipe Right → Next Garment',
    swipePrev: '← Hand Swipe Left · Previous Garment',
    stepBackInstruction: 'Step back 1–2 metres & keep head-to-feet visible',
    standFacingInstruction: 'Face the camera with a small gap between your arms and body',
    capturingHud: 'Hold Still — Capturing Frame {current} of {total}',
    holdSteady: 'Keep your posture steady for 3 seconds...',
    analyzingHud: 'Analyzing Your Body Proportions...',
    analyzingDesc: "Comparing measurements with this garment's size chart (may take up to 60s if waking up).",
    allowCameraTitle: 'Allow Camera Access in Your Browser',
    allowCameraDesc: 'Click "Allow" in your browser prompt to start your live camera preview.',
    turnOnCamera: 'Turn On Camera',
    turnOffCamera: 'Turn Off Camera',
    retryCameraAccess: 'Retry Camera Access',
    cameraGuidanceDesc: 'Turn on your camera when you are ready to preview outfits, start live AI virtual try-on, or scan your recommended clothing size. Camera access requires HTTPS.',
    swipeOrArrows: 'Swipe left or right to change garment',
    loadingGestureTracker: 'Loading gesture tracker...',
    useArrowsToSwitch: 'Use arrows to switch garment',
    retryTryOn: 'Retry Try-On',

    // Garment Selector Panel
    selectorTitle: 'Wardrobe Catalog',
    selectorSubtitle: 'Browse clothing categories, colors, and manufactured sizes',
    tabGarments: 'Garments',
    tabColors: 'Colors',
    tabDetails: 'Specs',
    allCategories: 'All Outfits',
    itemsCount: '{count} items',
    searchItems: 'Search garments...',
    clearSearch: 'Clear',
    noItemsFound: 'No garments match your search',
    resetFilters: 'Reset Filters',
    selectVariantPrompt: 'Choose a color variant:',
    availableSizesLabel: 'Manufactured Sizes',
    tryOnThisGarment: 'Try On Outfit',
    changeOutfit: 'Choose Different Garment',
    activeInMirror: 'Active in Mirror',
    selectGarmentFirstColors: 'Select a garment first to browse its color variants.',
    sizesManufacturedNote: 'Note: Listed sizes indicate sizes manufactured for this design, not live warehouse inventory stock.',
    noVariantsReturned: 'No color variants were returned by the server for this garment.',
    startTryOnBtn: 'Start Try-On',
    connectingTryOn: 'Connecting Try-On...',

    // Selected Outfit Card
    selectedOutfitTitle: 'Selected Outfit',
    outfitChosen: 'Outfit Chosen',
    outfitConfirmed: 'Outfit Confirmed',
    chooseOutfit: 'Choose Outfit',
    closeTryOn: 'Close Try-On',
    retryOutfit: 'Retry',
    noOutfitSelected:
      'Choose a garment from the catalog above to inspect its colors and manufactured sizes.',
    colorVariantLabel: 'Selected color variant',
    manufacturedSizesLabel: 'Manufactured Sizes',
    selectSizeToBuy: 'Select a size below to purchase:',
    retryBtn: 'Retry',

    // Workflow Steps Rail
    workflowTitle: 'Interactive Studio Flow',
    workflowSubtitle: 'Get your fit in 7 guided steps',
    step1Title: '1. Turn On Camera',
    step1Desc: 'Allow camera access and start your mirror session.',
    step2Title: '2. Select Garment',
    step2Desc: 'Choose your favorite top and color variant.',
    step3Title: '3. Start Try-On',
    step3Desc: 'Connect to live AI mirror to see yourself wearing it.',
    step4Title: '4. Swipe to Change',
    step4Desc: 'Swipe left or right with your hand to switch.',
    step5Title: '5. Choose This Outfit',
    step5Desc: 'Confirm your garment and return to raw camera.',
    step6Title: '6. Get My Size',
    step6Desc: 'Step 1–2m back while frames are analyzed.',
    step7Title: '7. See Your Size',
    step7Desc: 'View your recommended size and alternatives.',

    // 360 Rack
    rackTitle: '360° Studio Carousel',
    rackSubtitle:
      'Drag horizontally or use arrow buttons to rotate through curated looks',
    dragToRotate: 'Drag or swipe to rotate rack',
    selectFromRack: 'Try On This Look',
    rackLoading: 'Loading 360° Rack...',

    // Size Scan Panel
    scanTitle: 'Camera Size Estimation',
    scanSubtitle: 'Calibrate distance and stand tall for 5 seconds',
    scanInstructionsTitle: 'Positioning Instructions',
    scanInstruction1: 'Stand 2-2.5 meters away so full body is visible',
    scanInstruction2: 'Wear fitted clothes for accurate silhouette measurements',
    scanInstruction3: 'Ensure well-lit environment with plain background',
    scanInstruction4: 'Keep arms slightly apart and stand upright',
    startScan: 'Start 5s Scan',
    scanningHud: 'Scanning in progress... hold still',
    scanCountdown: '{count}s',
    scanCompleted: 'Scan Complete!',
    cancelScan: 'Cancel Scan',
    scanPrivacyNotice:
      'Frame calculations run locally in your browser. No video is ever stored or uploaded.',
    scanTimerSec: '{sec}s timer',
    scanInstructionsBody: 'Stand 1–2 metres away from the camera. Keep your entire body visible from head to feet, face the camera, and leave a small gap between your arms and body.',
    scanLightingTip: 'Good lighting and a clear, unobstructed view improve accuracy.',
    scanChecklist1: 'Full body visible (head to feet)',
    scanChecklist2: 'Face the camera directly',
    scanChecklist3: 'Small gap between arms & body',
    scanChecklist4: 'Stand still in bright lighting',
    scanServerPrivacy: 'To find your size, a few photos are sent to our server for analysis and are not stored.',
    turnOnCameraForSize: 'Turn On Camera to Find Your Size',
    closeTryOnAndScan: 'Close Try-On & Scan My Size',
    findMySizeForGarment: 'Find My Size',
    scanSecondsUnit: 'seconds',
    scanFramesUnit: 'frames',
    scanAnalyzingUnit: 'analyzing',
    startingInSec: 'Starting in {sec}s...',
    capturingFramesHud: 'Capturing ({current}/{total})...',

    // Size Result Card
    recommendedSizeTitle: 'Your Recommended Size',
    recommendedSizeDesc: 'Based on body silhouette proportions',
    confidenceLabel: 'Confidence',
    fitRecommendation: 'Recommended Fit',
    fitStandard: 'Standard Fit',
    fitLoose: 'Relaxed Fit',
    fitSnug: 'Slim Fit',
    sizeAvailability: 'Size Availability',
    availableInSelected: 'Available in selected outfit',
    notInSelected: 'Not manufactured for this specific garment',
    alternativeSizeLabel: 'Borderline Fit Alternative',
    borderlineNote:
      'If you prefer a looser drape, consider size {alt}',
    cameraDisclaimer:
      'Estimated via optical silhouette scan. Please consult brand size chart for exact tailoring.',
    rescanBtn: 'Re-scan Size',
    sizeFitCheckTitle: 'Your Size & Fit Check',
    borderlineDrapeTip: 'Borderline fit — size up for a looser drape',
    confidenceLowWarning: 'Confidence was low. For a more accurate recommendation, step 1–2m back in bright lighting with head-to-feet visible and scan again.',
    singleSizeItemNotice: 'This item is only manufactured in one size ({size}), so it was selected directly.',
    altManufacturedSize: 'Alternative Manufactured Size',
    secondaryFitOption: 'Secondary fit option',
    idleScanPrompt: 'Run Find My Size to see your AI-estimated size here, or check whether a specific size is manufactured for the selected item below.',
    checkSizeOffering: 'Check Manufactured Size Offering',
    checkSizeBtn: 'Check Size',
    sizeIsManufactured: 'Size {size} is manufactured for {name}.',
    sizeNotManufactured: 'Size {size} is not manufactured for {name}.',
    nearestAlternatives: 'Nearest manufactured alternatives: {sizes}',
    highConf: 'High',
    mediumConf: 'Medium',
    lowConf: 'Low',

    // How It Works Page
    howTitle: 'How Try On Studio Works',
    howSubtitle:
      'A step-by-step guide to our virtual fitting room, camera sizing, AI fashion advice, and secure shopping',
    howStep1Title: '1. Explore Live Catalog',
    howStep1Desc:
      'Browse shirts, hoodies, polos, and jackets fetched directly from our cloud catalog.',
    howStep2Title: '2. Real-Time Virtual Try-On',
    howStep2Desc:
      'Turn on your webcam or mobile camera to align garments with your body silhouette using interactive mirror controls.',
    howStep3Title: '3. Touchless Gesture Navigation',
    howStep3Desc:
      'Wave your hand in front of the lens to swap color variants hands-free while standing in front of the mirror.',
    howStep4Title: '4. Optical Size Estimation',
    howStep4Desc:
      'A 5-second countdown analyzes body proportions locally in your browser to recommend your optimal size (S, M, L, XL).',
    howStep5Title: '5. Gemini AI Fashion Assistant',
    howStep5Desc:
      'Consult your personal AI stylist for outfit coordination, color matching, and style advice tailored to real catalog products.',
    howStep6Title: '6. Instant Loyalty & Checkout',
    howStep6Desc:
      'Pay via Cash on Delivery or Stripe, collect loyalty points on every purchase, and redeem discounts on future orders.',
    backToStudio: 'Go to Studio',
    privacyTransparency: 'Data & Privacy Transparency',
    privacyScanPoint: 'Size Scan: To find your size, a few photos are sent to our server for analysis and are not stored.',
    privacyTryOnPoint: 'Virtual Try-On: During an active virtual try-on session, live camera video is streamed to Decart to generate the garment overlay in real time until you disconnect or choose your outfit.',
    privacyInventoryPoint: 'Size Availability vs. Inventory: Size availability shown in the catalog indicates whether a garment design is manufactured in that size—not real-time warehouse stock.',
    openStudioBtn: 'Open Try On Studio',
    browseRackBtn: 'Browse Catalog & 360° Rack',

    // Size Guide Page
    sizeGuideTitle: 'Universal Sizing Chart & Fitting Guide',
    sizeGuideSubtitle:
      'Accurate chest, waist, and length measurements for all standard garments',
    sizeGuideTableTitle: 'Standard Garment Measurements (cm)',
    sizeCol: 'Size',
    chestCol: 'Chest (cm)',
    waistCol: 'Waist (cm)',
    lengthCol: 'Length (cm)',
    fitCol: 'Fit Type',
    howToMeasureTitle: 'How to Measure Yourself',
    measureChestDesc:
      'Measure around the fullest part of your chest, keeping the tape horizontal.',
    measureWaistDesc:
      'Measure around your natural waistline, where your trousers comfortably sit.',
    measureLengthDesc:
      'Measure from the highest point of your shoulder down to your preferred hemline.',
    testCameraScanBtn: 'Test Camera Size Scan',

    // Browse Page
    browseTitle: 'Complete Clothing Collection',
    browseSubtitle:
      'Filter by category, explore color variants, and launch any piece directly into the virtual fitting room',
    filterAll: 'All Categories',
    searchCatalogPlaceholder: 'Search catalog items...',
    noProductsFound: 'No products found matching your search.',
    tryInStudioBtn: 'Try in Studio',

    // Stylist Assistant
    stylistTitle: 'TryOnStudio Fashion Assistant',
    stylistSubtitle:
      'Your personal Gemini-powered stylist for outfit coordination, color harmony, fit guidance, and real catalog picks.',
    stylistEmptyTitle: 'How would you like to style your look today?',
    stylistEmptyDesc:
      'Ask in English or العربية about outfit combinations, warm/cool color palettes, slim vs. relaxed fits, occasion looks, or our live catalog.',
    stylistInputPlaceholder:
      'Ask about outfits, colors, fit, occasions, or catalog items...',
    stylistSend: 'Send',
    stylistTyping: 'Styling your recommendation...',
    stylistRetry: 'Retry',
    stylistClear: 'New Chat',
    stylistTryOnItem: 'Try On',
    stylistBuyItem: 'Buy',
    stylistSessionNote:
      'Conversations stay in this session only and are never stored permanently.',

    // Checkout
    checkoutTitle: 'Secure Checkout',
    checkoutSubtitle:
      'Review your selected garment, enter your delivery contact details, and choose a verified payment method.',
    customerInfoTitle: 'Customer Information',
    fullNameLabel: 'Full Name',
    fullNamePlaceholder: 'e.g. Mohamed Gamal',
    phoneLabel: 'Mobile Phone Number',
    phonePlaceholder: 'e.g. 01012345678 or +201012345678',
    paymentMethodTitle: 'Payment Method',
    codTitle: 'Cash on Delivery (COD)',
    codDesc:
      'Pay in cash when your order arrives. Loyalty points are awarded immediately upon order creation.',
    stripeTitle: 'Online Card Payment (Stripe Hosted Checkout)',
    stripeDesc:
      'Redirect securely to Stripe Hosted Checkout. Card numbers and CVVs never touch TryOnStudio.',
    usePointsTitle: 'Use My Loyalty Points',
    orderSummaryTitle: 'Order Summary',
    placeOrderCod: 'Confirm Order (Cash on Delivery)',
    placeOrderStripe: 'Continue to Stripe Secure Checkout',
    submittingOrder: 'Processing Order...',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    freeShipping: 'FREE',
    discount: 'Discount',
    loyaltyPointsEarned: 'Points Earned on this Order',
    loyaltyDiscount: 'Points Discount Applied',
    grandTotal: 'Total',
    trustBadgeSecure: '256-Bit SSL Encrypted',
    trustBadgeReturn: '14-Day Free Exchange',
    trustBadgeQuality: '100% Verified Egyptian Cotton',

    // Loyalty
    loyaltyTitle: 'Loyalty Points & Rewards',
    loyaltySubtitle:
      'Earn points on every confirmed purchase and redeem them for instant EGP discounts on future outfits.',
    pointsBalance: 'Available Balance',
    tierBronze: 'Bronze Tier',
    tierSilver: 'Silver Tier',
    tierGold: 'Gold Tier',
    tierPlatinum: 'Platinum Tier',
    recentTransactions: 'Points History & Activity',
    noTransactionsYet: 'No transactions yet. Complete an order to earn points!',
    earnedPointsBadge: 'Earned',
    redeemedPointsBadge: 'Redeemed',
    adjustedPointsBadge: 'Adjusted',

    // Receipt
    receiptTitle: 'Official Digital Receipt',
    printReceipt: 'Print / Save PDF',
    copyOrderNumber: 'Copy Order Number',
    copied: 'Copied!',
    returnShopping: 'Return to Shopping',
    viewOrderDetails: 'Refresh Order Status',
    orderIdLabel: 'Order ID',
    orderDateLabel: 'Date',
    paymentStatusLabel: 'Payment Status',
    orderConfirmedNotice:
      'Thank you! Your order has been registered and is being processed by our warehouse.',

    // Shopping Cart & Product Details Modal
    cartTitle: 'Shopping Cart',
    cartSubtitle: 'Review your selected items, adjust colors, sizes, or quantities (1–20 per line), and proceed to checkout.',
    cartEmptyTitle: 'Your shopping cart is empty',
    cartEmptyDesc: 'Browse the clothing collection or try on outfits in the Studio to add items to your cart.',
    clearCartBtn: 'Clear Cart',
    removeItemBtn: 'Remove',
    quantityLabel: 'Quantity',
    lineTotalLabel: 'Line Total',
    productDetailsTitle: 'Product Specifications & Options',
    closeModalBtn: 'Close',
  },
  ar: {
    // Brand & Header
    brandTitle: 'تراي أون ستوديو',
    brandSubtitle: 'شاهدها. جرّبها. اعرف مقاسك.',
    navStudio: 'استوديو القياس الافتراضي',
    navBrowse: 'تصفح الملابس',
    navSizeGuide: 'اعرف مقاسي',
    navAssistant: 'مساعد الأناقة الذكي',
    navLoyalty: 'نقاط الولاء والمكافآت',
    navCart: 'سلة التسوق',
    navCheckout: 'إتمام الشراء',
    navHowItWorks: 'كيف يعمل التطبيق',
    searchPlaceholder: 'ابحث عن الملابس بالاسم أو الوصف...',
    checkingApi: 'جاري فحص الخادم...',
    apiOnline: 'خادم الكتالوج متصل',
    apiOffline: 'الخادم غير متصل',
    openStylistBtn: 'اسأل مساعد الأناقة',
    buyNow: 'اشترِ الآن',
    addToCart: 'أضف إلى السلة',
    addedToCart: 'تمت الإضافة للسلة',
    viewDetailsBtn: 'التفاصيل',
    viewCartBtn: 'عرض السلة',
    clearSelectionBtn: 'إلغاء اختيار القطعة',
    undoOutfitConfirm: 'إلغاء التأكيد',
    proceedToCheckout: 'المتابعة لإتمام الشراء',
    selectSizeFirst: 'اختر المقاس أولاً للشراء:',
    tryOn: 'قياس افتراضي',
    sizeGuide: 'دليل المقاسات',

    // Mirror & Try-On Panel
    mirrorTitle: 'مرآة القياس الافتراضي',
    mirrorSubtitle: 'قف أمام الكاميرا أو شاهد محاكاة القطعة مباشرة على الشاشة',
    startCamera: 'تشغيل الكاميرا',
    stopCamera: 'إيقاف الكاميرا',
    cameraActive: 'الكاميرا تعمل',
    cameraStarting: 'جاري تشغيل الكاميرا...',
    cameraError: 'تعذر الوصول إلى الكاميرا',
    cameraSimulated: 'وضع المحاكاة',
    switchCamera: 'تبديل الكاميرا',
    toggleMirror: 'عكس الرؤية',
    snapshot: 'التقاط صورة',
    togglePose: 'تتبع وضعية الجسم',
    toggleGestures: 'إيماءات التلويح',
    gesturesActive: 'إيماءات التلويح مفعلة (لوّح يميناً أو يساراً للتنقل بين الألوان)',
    tryOnLiveOverlay: 'تجربة القياس المباشرة',
    tryOnSimulatedPreview: 'معاينة القياس التقريبية',
    noGarmentSelected: 'لم يتم اختيار قطعة ملابس',
    selectGarmentPrompt: 'اختر قطعة من الأسفل لتجربتها على صورتك',
    gestureSwapped: 'تم التبديل إلى {color}',
    retryCamera: 'إعادة المحاولة',
    dismissBanner: 'إغلاق',
    virtualTryOnActive: 'تجربة القياس الافتراضية مفعلة',
    switchingGarment: 'جاري تبديل القطعة...',
    requestingToken: 'جاري طلب رمز الجلسة...',
    connectingToService: 'جاري الاتصال بمحرك الذكاء الاصطناعي (2-5 ث)...',
    cameraPreviewOnly: 'معاينة الكاميرا (القياس الافتراضي متوقف)',
    waitingPermission: 'بانتظار إذن الكاميرا...',
    cameraOff: 'الكاميرا متوقفة',
    standardView: 'الرؤية العادية',
    mirrorViewBtn: 'عكس المرآة',
    endTryOn: 'إنهاء القياس',
    swipeNext: 'تمرير اليد يميناً ← القطعة التالية',
    swipePrev: '← تمرير اليد يساراً · القطعة السابقة',
    stepBackInstruction: 'تراجع 1-2 متر مع إبقاء كامل الجسم مرئياً',
    standFacingInstruction: 'قف مواجهاً للكاميرا مع مباعدة ذراعيك قليلاً',
    capturingHud: 'اثبت في مكانك — التقاط الإطار {current} من {total}',
    holdSteady: 'حافظ على ثبات وقفتك لمدة 3 ثوانٍ...',
    analyzingHud: 'جاري تحليل أبعاد وتناسق الجسم...',
    analyzingDesc: 'مقارنة القياسات مع جدول مقاسات هذه القطعة (قد يستغرق حتى 60 ثانية).',
    allowCameraTitle: 'اسمح بالوصول إلى الكاميرا في متصفحك',
    allowCameraDesc: 'انقر على "سماح" في إشعار المتصفح لبدء المعاينة المباشرة للكاميرا.',
    turnOnCamera: 'تشغيل الكاميرا',
    turnOffCamera: 'إيقاف الكاميرا',
    retryCameraAccess: 'إعادة محاولة تشغيل الكاميرا',
    cameraGuidanceDesc: 'شغّل الكاميرا متى كنت مستعداً لمعاينة الملابس، تجربة القياس الافتراضي، أو فحص المقاس المقترح. يتطلب الوصول للكاميرا اتصالاً آمناً HTTPS.',
    swipeOrArrows: 'لوّح بيدك يميناً أو يساراً للتنقل بين الملابس',
    loadingGestureTracker: 'جاري تحميل متتبع الإيماءات...',
    useArrowsToSwitch: 'استخدم الأسهم للتنقل بين الملابس',
    retryTryOn: 'إعادة محاولة القياس',

    // Garment Selector Panel
    selectorTitle: 'خزانة الملابس',
    selectorSubtitle: 'تصفح فئات الملابس والألوان والمقاسات المصنعة',
    tabGarments: 'الملابس',
    tabColors: 'الألوان',
    tabDetails: 'المواصفات',
    allCategories: 'جميع الملابس',
    itemsCount: '{count} قطعة',
    searchItems: 'بحث في الملابس...',
    clearSearch: 'مسح',
    noItemsFound: 'لم يتم العثور على ملابس تطابق بحثك',
    resetFilters: 'إعادة ضبط الفلاتر',
    selectVariantPrompt: 'اختر درجة اللون:',
    availableSizesLabel: 'المقاسات المصنعة',
    tryOnThisGarment: 'تجربة هذه القطعة',
    changeOutfit: 'اختيار قطعة أخرى',
    activeInMirror: 'معروضة في المرآة',
    selectGarmentFirstColors: 'اختر قطعة ملابس أولاً لاستعراض درجات ألوانها.',
    sizesManufacturedNote: 'تنويه: المقاسات الموضحة هي المقاسات المصنّعة لهذا التصميم وليست جرد المستودع اللحظي.',
    noVariantsReturned: 'لم تتوفر ألوان إضافية لهذه القطعة من الخادم.',
    startTryOnBtn: 'بدء القياس الافتراضي',
    connectingTryOn: 'جاري الاتصال بالمرآة...',

    // Selected Outfit Card
    selectedOutfitTitle: 'القطعة المختارة',
    outfitChosen: 'تم اختيار الطقم',
    outfitConfirmed: 'تم تأكيد الطقم',
    chooseOutfit: 'اختيار هذا الطقم',
    closeTryOn: 'إغلاق تجربة القياس',
    retryOutfit: 'إعادة المحاولة',
    noOutfitSelected:
      'اختر قطعة من الكتالوج أعلاه لمطالعة ألوانها ومقاساتها المصنعة.',
    colorVariantLabel: 'درجة اللون المختارة',
    manufacturedSizesLabel: 'المقاسات المصنعة',
    selectSizeToBuy: 'حدد المقاس للشراء:',
    retryBtn: 'إعادة المحاولة',

    // Workflow Steps Rail
    workflowTitle: 'مسار تجربة القياس',
    workflowSubtitle: 'احصل على إطلالتك ومقاسك في 7 خطوات سهلة',
    step1Title: '١. تشغيل الكاميرا',
    step1Desc: 'اسمح بوصول الكاميرا وابدأ جلسة المرآة.',
    step2Title: '٢. اختيار القطعة',
    step2Desc: 'اختر قطعتك المفضلة ودرجة اللون المطلوبة.',
    step3Title: '٣. بدء القياس الافتراضي',
    step3Desc: 'اتصل بالمرآة الذكية لترى مظهر القطعة على جسمك.',
    step4Title: '٤. التمرير باليد للتغيير',
    step4Desc: 'لوّح بيدك يميناً أو يساراً للتنقل بين الألوان.',
    step5Title: '٥. تأكيد هذا الطقم',
    step5Desc: 'قم بتثبيت القطعة المختارة للمتابعة.',
    step6Title: '٦. فحص المقاس',
    step6Desc: 'تراجع 1-2 متر للخلف لتحليل تناسق الجسم.',
    step7Title: '٧. معرفة مقاسك المثالي',
    step7Desc: 'شاهد المقاس المقترح والبدائل المناسبة لك.',

    // 360 Rack
    rackTitle: 'منصة العرض الدوارة 360°',
    rackSubtitle:
      'اسحب أفقياً أو استخدم الأسهم للتدوير واستعراض الإطلالات المختارة',
    dragToRotate: 'اسحب أو مرر للتدوير',
    selectFromRack: 'تجربة هذه الإطلالة',
    rackLoading: 'جاري تحميل منصة العرض...',

    // Size Scan Panel
    scanTitle: 'فحص المقاس عبر الكاميرا',
    scanSubtitle: 'قف مستقيماً واضبط المسافة لمدة 5 ثوانٍ',
    scanInstructionsTitle: 'إرشادات وضعية الفحص',
    scanInstruction1: 'قف على بعد 2-2.5 متر لتظهر كامل تفاصيل الجسم',
    scanInstruction2: 'ارتدِ ملابس متناسقة للحصول على قياس دقيق لأبعاد الجسم',
    scanInstruction3: 'تأكد من الإضاءة الجيدة وخلفية واضحة',
    scanInstruction4: 'باعد ذراعيك قليلاً وقف في وضع مستقيم',
    startScan: 'بدء الفحص (5 ثوانٍ)',
    scanningHud: 'جاري الفحص... اثبت في مكانك',
    scanCountdown: '{count} ث',
    scanCompleted: 'اكتمل الفحص بنجاح!',
    cancelScan: 'إلغاء الفحص',
    scanPrivacyNotice:
      'تُجرى معالجة الصورة محلياً في متصفحك. لا يتم رفع أو تخزين أي فيديو إطلاقاً.',
    scanTimerSec: 'مؤقت {sec} ث',
    scanInstructionsBody: 'قف على بعد 1-2 متر من العدسة مع إبقاء كامل الجسم مرئياً من الرأس إلى القدمين، وقف مواجهاً للكاميرا مع مباعدة الذراعين قليلاً.',
    scanLightingTip: 'الإضاءة الجيدة والخلفية الواضحة تحسّن دقة القياس بشكل ملحوظ.',
    scanChecklist1: 'كامل الجسم ظاهر (من الرأس للقدمين)',
    scanChecklist2: 'الوقوف في مواجهة الكاميرا مباشرة',
    scanChecklist3: 'مسافة صغيرة بين الذراعين والجسم',
    scanChecklist4: 'الثبات في مكان ذي إضاءة جيدة',
    scanServerPrivacy: 'لتحديد مقاسك، تُرسل بضع لقطات إلى الخادم للتحليل فقط ولا يتم حفظها إطلاقاً.',
    turnOnCameraForSize: 'تشغيل الكاميرا لبدء فحص المقاس',
    closeTryOnAndScan: 'إغلاق تجربة القياس وفحص المقاس',
    findMySizeForGarment: 'فحص المقاس',
    scanSecondsUnit: 'ثوانٍ',
    scanFramesUnit: 'إطارات',
    scanAnalyzingUnit: 'جاري التحليل',
    startingInSec: 'يبدأ خلال {sec} ث...',
    capturingFramesHud: 'جاري الالتقاط ({current}/{total})...',

    // Size Result Card
    recommendedSizeTitle: 'مقاسك المقترح',
    recommendedSizeDesc: 'استناداً إلى أبعاد وتناسق الجسم',
    confidenceLabel: 'مستوى الدقة',
    fitRecommendation: 'ملاءمة القياس',
    fitStandard: 'قَصّة معيارية',
    fitLoose: 'قَصّة مريحة',
    fitSnug: 'قَصّة ضيقة',
    sizeAvailability: 'توفر المقاس',
    availableInSelected: 'متوفر في القطعة المختارة',
    notInSelected: 'غير مصنّع لهذه القطعة تحديداً',
    alternativeSizeLabel: 'خيار بديل للمقاس المتقارب',
    borderlineNote:
      'إذا كنت تفضل قَصّة أكثر اتساعاً، ننصح بمقاس {alt}',
    cameraDisclaimer:
      'تقدير استرشادي عبر الفحص البصري. يُرجى مراجعة جدول المقاسات للمقاسات التفصيلية.',
    rescanBtn: 'إعادة الفحص',
    sizeFitCheckTitle: 'فحص المقاس والملاءمة',
    borderlineDrapeTip: 'مقاس متقارب — اختر المقاس الأكبر لقَصّة أكثر راحة',
    confidenceLowWarning: 'نسبة الدقة كانت منخفضة. لتوصية أدق، تراجع 1-2 متر في إضاءة جيدة مع ظهور الجسم كاملاً وأعد الفحص.',
    singleSizeItemNotice: 'هذه القطعة مصنعة بمقاس موحد ({size})، لذا تم تحديده مباشرة.',
    altManufacturedSize: 'مقاس مصنّع بديل',
    secondaryFitOption: 'خيار ملاءمة ثانوي',
    idleScanPrompt: 'ابدأ فحص المقاس لعرض المقاس المقترح هنا، أو تحقق من توفر مقاس مصنّع محدد أدناه.',
    checkSizeOffering: 'فحص توفر مقاس مصنّع',
    checkSizeBtn: 'فحص المقاس',
    sizeIsManufactured: 'المقاس {size} مصنّع للقطعة {name}.',
    sizeNotManufactured: 'المقاس {size} غير مصنّع للقطعة {name}.',
    nearestAlternatives: 'أقرب مقاسات مصنّعة بديلة: {sizes}',
    highConf: 'عالية',
    mediumConf: 'متوسطة',
    lowConf: 'منخفضة',

    // How It Works Page
    howTitle: 'كيف يعمل تراي أون ستوديو',
    howSubtitle:
      'دليلك الشامل لغرفة القياس الافتراضية، قياس الحجم، المساعد الذكي، والتسوق الآمن',
    howStep1Title: '١. تصفح الكتالوج الحي',
    howStep1Desc:
      'استعرض القمصان والهوديز والسترات المحدثة مباشرة من خادمنا السحابي.',
    howStep2Title: '٢. القياس الافتراضي اللحظي',
    howStep2Desc:
      'شغّل الكاميرا وشاهد مظهر الملابس على جسمك مباشرة مع أدوات التحكم في المرآة.',
    howStep3Title: '٣. التنقل الذكي بالإيماءات',
    howStep3Desc:
      'لوّح بيدك أمام العدسة للتبديل بين ألوان القطعة بحرية دون الحاجة للمس الشاشة.',
    howStep4Title: '٤. فحص المقاس الذكي',
    howStep4Desc:
      'فحص سريع لمدة 5 ثوانٍ يحلل تناسق الجسم محلياً في متصفحك ليقترح مقاسك المثالي (S, M, L, XL).',
    howStep5Title: '٥. مساعد الأناقة المدعوم بـ Gemini',
    howStep5Desc:
      'استشر خبير الأناقة الذكي لتنسيق الألوان والأطقم والنصائح المناسبة لمنتجات الكتالوج.',
    howStep6Title: '٦. نقاط الولاء وإتمام الشراء',
    howStep6Desc:
      'ادفع عند الاستلام أو بالبطاقة، واكسب نقاط ولاء مع كل طلب واستبدلها بخصومات فورية.',
    backToStudio: 'الانتقال إلى الاستوديو',
    privacyTransparency: 'الشفافية والخصوصية',
    privacyScanPoint: 'فحص المقاس: لتحديد مقاسك، تُرسل بضع لقطات إلى خادمنا للتحليل فقط ولا يتم تخزينها إطلاقاً.',
    privacyTryOnPoint: 'القياس الافتراضي: أثناء جلسة القياس الافتراضي، يُبث الفيديو المباشر لمحرك الذكاء الاصطناعي لإنشاء محاكاة الملابس لحظياً حتى تنهي الجلسة.',
    privacyInventoryPoint: 'توفر المقاسات: المقاسات الموضحة في الكتالوج تعبر عن المقاسات المصنّعة لهذا الموديل وليست جرد المخزون اللحظي.',
    openStudioBtn: 'فتح استوديو القياس الافتراضي',
    browseRackBtn: 'تصفح الكتالوج ومنصة 360°',

    // Size Guide Page
    sizeGuideTitle: 'جدول المقاسات الشامل ودليل الملاءمة',
    sizeGuideSubtitle:
      'قياسات دقيقة للصدر والخصر والطول لجميع قطع الملابس',
    sizeGuideTableTitle: 'المقاسات المعيارية بالسنتيمتر (سم)',
    sizeCol: 'المقاس',
    chestCol: 'محيط الصدر (سم)',
    waistCol: 'محيط الخصر (سم)',
    lengthCol: 'الطول (سم)',
    fitCol: 'نوع القَصّة',
    howToMeasureTitle: 'طريقة أخذ القياسات بدقة',
    measureChestDesc:
      'قم بالقياس حول الجزء الأعرض من الصدر مع الحفاظ على الشريط أفقياً.',
    measureWaistDesc:
      'قم بالقياس حول محيط الخصر الطبيعي في المكان المعتاد لارتداء البنطال.',
    measureLengthDesc:
      'قم بالقياس من أعلى نقطة في الكتف نزولاً إلى خط الحاشية المطلوب.',
    testCameraScanBtn: 'جرب فحص المقاس بالكاميرا',

    // Browse Page
    browseTitle: 'تشكيلة الملابس الكاملة',
    browseSubtitle:
      'اختر الفئة وتعرف على الألوان وابدأ تجربة أي قطعة مباشرة في غرفة القياس الافتراضية',
    filterAll: 'جميع الفئات',
    searchCatalogPlaceholder: 'ابحث في قطع الكتالوج...',
    noProductsFound: 'لم يتم العثور على منتجات تطابق البحث.',
    tryInStudioBtn: 'تجربة في الاستوديو',

    // Stylist Assistant
    stylistTitle: 'مساعد الأناقة الذكي — TryOnStudio',
    stylistSubtitle:
      'خبير الأناقة الشخصي المدعوم بـ Google Gemini لتنسيق الملابس، الألوان، القَصّات، وترشيحات الكتالوج الفعلي.',
    stylistEmptyTitle: 'كيف ننسّق إطلالتك اليوم؟',
    stylistEmptyDesc:
      'تحدث بالعربية أو الإنجليزية حول تنسيق الأطقم، درجات الألوان، المقاسات والقَصّات، إطلالات المناسبات، أو منتجات الكتالوج.',
    stylistInputPlaceholder:
      'اسأل عن تنسيق الملابس، الألوان، القَصّات، المناسبات، أو المنتجات...',
    stylistSend: 'إرسال',
    stylistTyping: 'جاري إعداد نصيحة الأناقة...',
    stylistRetry: 'إعادة المحاولة',
    stylistClear: 'محادثة جديدة',
    stylistTryOnItem: 'جرّبها الآن',
    stylistBuyItem: 'شراء',
    stylistSessionNote:
      'تُحفظ المحادثة خلال الجلسة الحالية فقط ولا يتم تخزينها بشكل دائم.',

    // Checkout
    checkoutTitle: 'إتمام الطلب بأمان',
    checkoutSubtitle:
      'راجع القطعة المختارة، أدخل بيانات التواصل، واختر وسيلة الدفع المتاحة.',
    customerInfoTitle: 'بيانات العميل',
    fullNameLabel: 'الاسم الكامل',
    fullNamePlaceholder: 'مثال: محمد جمال',
    phoneLabel: 'رقم الهاتف المحمول',
    phonePlaceholder: 'مثال: 01012345678 أو +201012345678',
    paymentMethodTitle: 'طريقة الدفع',
    codTitle: 'الدفع عند الاستلام (COD)',
    codDesc:
      'ادفع نقداً عند استلام طلبك. تُضاف نقاط الولاء فوراً بمجرد تأكيد إنشاء الطلب.',
    stripeTitle: 'الدفع الإلكتروني بالبطاقة (بوابة Stripe الآمنة)',
    stripeDesc:
      'انتقال آمن إلى صفحة الدفع المستضافة من Stripe دون تخزين أي بيانات بطاقة داخل التطبيق.',
    usePointsTitle: 'استخدام نقاط الولاء',
    orderSummaryTitle: 'ملخص الطلب',
    placeOrderCod: 'تأكيد الطلب (الدفع عند الاستلام)',
    placeOrderStripe: 'المتابعة للدفع الآمن عبر Stripe',
    submittingOrder: 'جاري تسجيل الطلب...',
    subtotal: 'المجموع الفرعي',
    shipping: 'الشحن',
    freeShipping: 'مجاناً',
    discount: 'الخصم',
    loyaltyPointsEarned: 'نقاط الولاء المكتسبة من هذا الطلب',
    loyaltyDiscount: 'خصم استبدال نقاط الولاء',
    grandTotal: 'الإجمالي النهائي',
    trustBadgeSecure: 'تشفير آمن للبيانات 256-Bit SSL',
    trustBadgeReturn: 'استبدال مجاني خلال 14 يوماً',
    trustBadgeQuality: 'قطن مصري أصيل 100%',

    // Loyalty
    loyaltyTitle: 'برنامج نقاط الولاء والمكافآت',
    loyaltySubtitle:
      'اكسب نقاطاً مع كل عملية شراء مكتملة واستبدلها بخصومات فورية بالجنيه المصري.',
    pointsBalance: 'رصيد النقاط المتاح',
    tierBronze: 'المستوى البرونزي',
    tierSilver: 'المستوى الفضي',
    tierGold: 'المستوى الذهبي',
    tierPlatinum: 'المستوى البلاتيني',
    recentTransactions: 'سجل حركات النقاط',
    noTransactionsYet: 'لا توجد حركات سابقة. أكمل طلباً لاكتساب النقاط!',
    earnedPointsBadge: 'مكتسبة',
    redeemedPointsBadge: 'مستبدلة',
    adjustedPointsBadge: 'تسوية',

    // Receipt
    receiptTitle: 'إيصال شراء رقمي رسمي',
    printReceipt: 'طباعة / حفظ كـ PDF',
    copyOrderNumber: 'نسخ رقم الطلب',
    copied: 'تم النسخ!',
    returnShopping: 'العودة للتسوق',
    viewOrderDetails: 'تحديث حالة الطلب',
    orderIdLabel: 'رقم الطلب',
    orderDateLabel: 'التاريخ',
    paymentStatusLabel: 'حالة الدفع',
    orderConfirmedNotice:
      'شكراً لك! تم تسجيل طلبك بنجاح وجاري تجهيزه من قِبل المستودع.',

    // Shopping Cart & Product Details Modal
    cartTitle: 'سلة التسوق',
    cartSubtitle: 'راجع المنتجات المختارة، وعدّل الألوان أو المقاسات أو الكميات (1–20 لكل سطر)، ثم تابع لإتمام الشراء.',
    cartEmptyTitle: 'سلة التسوق فارغة حالياً',
    cartEmptyDesc: 'تصفح تشكيلة الملابس أو جرّب القطع في الاستوديو لإضافة منتجات إلى سلتك.',
    clearCartBtn: 'إفراغ السلة',
    removeItemBtn: 'حذف',
    quantityLabel: 'الكمية',
    lineTotalLabel: 'إجمالي السطر',
    productDetailsTitle: 'تفاصيل ومواصفات القطعة',
    closeModalBtn: 'إغلاق',
  },
} as const;

export type TranslationKey = keyof typeof DICTIONARY.en;

interface LanguageContextValue {
  language: AppLanguage;
  isRtl: boolean;
  setLanguage: (lang: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readInitialLanguage(): AppLanguage {
  try {
    const saved =
      window.localStorage.getItem(LANG_STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_LANG_STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    // Ignore storage access issues
  }
  return 'en';
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return Object.keys(params).reduce((str, paramKey) => {
    return str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(params[paramKey]));
  }, template);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(readInitialLanguage);

  const isRtl = language === 'ar';

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, language);
      window.localStorage.setItem(LEGACY_LANG_STORAGE_KEY, language);
    } catch {
      // Ignore storage access issues
    }
  }, [language, isRtl]);

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === 'en' ? 'ar' : 'en'));
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = DICTIONARY[language] as Record<string, string>;
      const fallbackDict = DICTIONARY.en as Record<string, string>;
      const raw = dict[key] ?? fallbackDict[key] ?? key;
      return interpolate(raw, params);
    },
    [language]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      isRtl,
      setLanguage,
      toggleLanguage,
      t,
    }),
    [language, isRtl, setLanguage, toggleLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used inside a <LanguageProvider>.');
  }
  return ctx;
}
