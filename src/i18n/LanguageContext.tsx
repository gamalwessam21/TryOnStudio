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

const LANG_STORAGE_KEY = 'tryonstudio_ui_lang';

const DICTIONARY = {
  en: {
    brandTitle: 'Try On Studio',
    brandSubtitle: 'See it. Wear it. Find your size.',
    navStudio: 'Try On Studio',
    navBrowse: 'Browse Clothing',
    navSizeGuide: 'Find My Size',
    navAssistant: 'AI Stylist',
    navLoyalty: 'Loyalty Rewards',
    navCheckout: 'Checkout',
    navHowItWorks: 'How It Works',
    searchPlaceholder: 'Search clothing items by name or description...',
    checkingApi: 'Checking API...',
    apiOnline: 'Catalog API Online',
    apiOffline: 'API Unreachable',
    openStylistBtn: 'Ask AI Stylist',
    buyNow: 'Buy Now',
    proceedToCheckout: 'Proceed to Checkout',
    selectSizeFirst: 'Select a size below to purchase:',
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
      'Pay in cash when your order arrives. Points are awarded once delivery & payment are confirmed.',
    stripeTitle: 'Online Card Payment (Stripe Hosted Checkout)',
    stripeDesc:
      'Redirect securely to Stripe Hosted Checkout. Card numbers and CVVs never touch TryOnStudio.',
    usePointsTitle: 'Use My Loyalty Points',
    orderSummaryTitle: 'Order Summary',
    placeOrderCod: 'Confirm Order (Cash on Delivery)',
    placeOrderStripe: 'Continue to Stripe Secure Checkout',
    submittingOrder: 'Processing Order...',
    loyaltyTitle: 'Loyalty Points & Rewards',
    loyaltySubtitle:
      'Earn points on every confirmed purchase and redeem them for instant EGP discounts on future outfits.',
    receiptTitle: 'Official Digital Receipt',
    printReceipt: 'Print / Save PDF',
    copyOrderNumber: 'Copy Order Number',
    copied: 'Copied!',
    returnShopping: 'Return to Shopping',
    viewOrderDetails: 'Refresh Order Status',
    tryOn: 'Studio Try-On',
    sizeGuide: 'Size Guide',
  },
  ar: {
    brandTitle: 'تراي أون ستوديو',
    brandSubtitle: 'شاهدها. جرّبها. اعرف مقاسك.',
    navStudio: 'استوديو القياس الافتراضي',
    navBrowse: 'تصفح الملابس',
    navSizeGuide: 'اعرف مقاسي',
    navAssistant: 'مساعد الأناقة الذكي',
    navLoyalty: 'نقاط الولاء والمكافآت',
    navCheckout: 'إتمام الشراء',
    navHowItWorks: 'كيف يعمل التطبيق',
    searchPlaceholder: 'ابحث عن الملابس بالاسم أو الوصف...',
    checkingApi: 'جاري فحص الخادم...',
    apiOnline: 'خادم الكتالوج متصل',
    apiOffline: 'الخادم غير متصل',
    openStylistBtn: 'اسأل مساعد الأناقة',
    buyNow: 'اشترِ الآن',
    proceedToCheckout: 'المتابعة لإتمام الشراء',
    selectSizeFirst: 'اختر المقاس أولاً للشراء:',
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
      'ادفع نقداً عند استلام طلبك. تُضاف نقاط الولاء بعد تأكيد التسليم والتحصيل.',
    stripeTitle: 'الدفع الإلكتروني بالبطاقة (بوابة Stripe الآمنة)',
    stripeDesc:
      'انتقال آمن إلى صفحة الدفع المستضافة من Stripe دون تخزين أي بيانات بطاقة داخل التطبيق.',
    usePointsTitle: 'استخدام نقاط الولاء',
    orderSummaryTitle: 'ملخص الطلب',
    placeOrderCod: 'تأكيد الطلب (الدفع عند الاستلام)',
    placeOrderStripe: 'المتابعة للدفع الآمن عبر Stripe',
    submittingOrder: 'جاري تسجيل الطلب...',
    loyaltyTitle: 'برنامج نقاط الولاء والمكافآت',
    loyaltySubtitle:
      'اكسب نقاطاً مع كل عملية شراء مكتملة واستبدلها بخصومات فورية بالجنيه المصري.',
    receiptTitle: 'إيصال شراء رقمي رسمي',
    printReceipt: 'طباعة / حفظ كـ PDF',
    copyOrderNumber: 'نسخ رقم الطلب',
    copied: 'تم النسخ!',
    returnShopping: 'العودة للتسوق',
    viewOrderDetails: 'تحديث حالة الطلب',
    tryOn: 'قياس افتراضي',
    sizeGuide: 'دليل المقاسات',
  },
} as const;

export type TranslationKey = keyof typeof DICTIONARY.en;

interface LanguageContextValue {
  language: AppLanguage;
  isRtl: boolean;
  setLanguage: (lang: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readInitialLanguage(): AppLanguage {
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    // Ignore storage access issues
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(readInitialLanguage);

  const isRtl = language === 'ar';

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, language);
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
    (key: TranslationKey): string => {
      return DICTIONARY[language][key] ?? DICTIONARY.en[key];
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

