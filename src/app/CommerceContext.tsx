import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { commerceApi, isBackendEndpointMissing } from '../services/commerceApi';
import { formatGeneralApiError } from '../services/fashionApi';
import type { FashionItemDetails, FashionVariant } from '../types/api';
import type {
  AssistantChatMessage,
  AssistantContextSnapshot,
  AssistantStylePreferences,
  CheckoutDraftItem,
  LoyaltyAccountSummary,
  LoyaltyRules,
  PersistedOrder,
} from '../types/commerce';
import {
  DEFAULT_LOYALTY_RULES,
  DEFAULT_USD_TO_EGP_RATE,
} from '../utils/commerceHelpers';
import { useLanguage } from '../i18n/LanguageContext';
import { useStudio } from './StudioContext';

export interface CommerceContextValue {
  // Pricing & Payment Platform State
  usdToEgpRate: number;
  stripeConfigured: boolean;
  stripeMode: 'sandbox' | 'live' | 'unconfigured';
  loyaltyRules: LoyaltyRules;
  loyaltyBackendAvailable: boolean | null;

  // Checkout Selection State
  checkoutDraft: CheckoutDraftItem | null;
  selectedPurchaseSize: string | null;
  setSelectedPurchaseSize: (size: string | null) => void;
  prepareCheckoutFromItem: (params: {
    item: FashionItemDetails;
    variant: FashionVariant | null;
    size: string | null;
    quantity?: number;
  }) => CheckoutDraftItem;
  updateCheckoutQuantity: (quantity: number) => void;
  updateCheckoutSize: (size: string) => void;

  // Session-only cache of backend-confirmed orders for immediate receipt rendering before re-fetch
  recentConfirmedOrders: Record<string, PersistedOrder>;
  recordConfirmedOrder: (order: PersistedOrder) => void;

  // Verified Customer Loyalty State (never faked in localStorage)
  loyaltyVerificationToken: string | null;
  loyaltyAccount: LoyaltyAccountSummary | null;
  loyaltyLoading: boolean;
  loyaltyError: string | null;
  requestCustomerVerification: (phone: string) => Promise<{
    challengeSent: boolean;
    message?: string;
  }>;
  confirmCustomerVerification: (phone: string, code: string) => Promise<boolean>;
  refreshLoyaltyAccount: () => Promise<void>;
  clearLoyaltySession: () => void;

  // AI Fashion Assistant Session State
  assistantMessages: AssistantChatMessage[];
  assistantSending: boolean;
  assistantError: string | null;
  assistantConfigured: boolean | null;
  assistantDrawerOpen: boolean;
  setAssistantDrawerOpen: (open: boolean) => void;
  stylePreferences: AssistantStylePreferences;
  setStylePreferences: (prefs: AssistantStylePreferences) => void;
  latestScannedSize: string | null;
  setLatestScannedSize: (size: string | null) => void;
  sendAssistantPrompt: (promptText: string) => Promise<void>;
  retryLastAssistantPrompt: () => Promise<void>;
  clearAssistantChat: () => void;
}

const CommerceContext = createContext<CommerceContextValue | null>(null);

export function CommerceProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const {
    selectedItemDetails,
    selectedVariant,
    outfitConfirmed,
  } = useStudio();

  // Platform config
  const [usdToEgpRate, setUsdToEgpRate] = useState<number>(
    DEFAULT_USD_TO_EGP_RATE
  );
  const [stripeConfigured, setStripeConfigured] = useState<boolean>(false);
  const [stripeMode, setStripeMode] = useState<
    'sandbox' | 'live' | 'unconfigured'
  >('unconfigured');
  const [loyaltyRules, setLoyaltyRules] = useState<LoyaltyRules>(
    DEFAULT_LOYALTY_RULES
  );
  const [loyaltyBackendAvailable, setLoyaltyBackendAvailable] = useState<
    boolean | null
  >(null);

  // Selected purchase size synced with currently selected item
  const [selectedPurchaseSize, setSelectedPurchaseSize] = useState<
    string | null
  >(null);
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraftItem | null>(
    null
  );
  const [recentConfirmedOrders, setRecentConfirmedOrders] = useState<
    Record<string, PersistedOrder>
  >({});

  // Verified Loyalty session (strictly in-memory; never faked in localStorage)
  const [loyaltyVerificationToken, setLoyaltyVerificationToken] = useState<
    string | null
  >(null);
  const [loyaltyAccount, setLoyaltyAccount] =
    useState<LoyaltyAccountSummary | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState<boolean>(false);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);

  // AI Fashion Assistant session
  const [assistantMessages, setAssistantMessages] = useState<
    AssistantChatMessage[]
  >([]);
  const [assistantSending, setAssistantSending] = useState<boolean>(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantConfigured, setAssistantConfigured] = useState<
    boolean | null
  >(null);
  const [assistantDrawerOpen, setAssistantDrawerOpen] =
    useState<boolean>(false);
  const [stylePreferences, setStylePreferences] =
    useState<AssistantStylePreferences>({});
  const [latestScannedSize, setLatestScannedSize] = useState<string | null>(
    null
  );

  const lastFailedPromptRef = useRef<string | null>(null);

  // Reset selectedPurchaseSize if selectedItemDetails changes and no longer offers that size
  useEffect(() => {
    if (!selectedItemDetails) {
      setSelectedPurchaseSize(null);
      return;
    }
    const offered = selectedItemDetails.availableSizes ?? [];
    if (offered.length === 0) {
      setSelectedPurchaseSize(null);
    } else if (offered.length === 1) {
      setSelectedPurchaseSize(offered[0]);
    } else {
      setSelectedPurchaseSize((prev) =>
        prev && offered.includes(prev) ? prev : null
      );
    }
  }, [selectedItemDetails]);

  // Load platform Stripe + Gemini + Loyalty rules status on startup
  useEffect(() => {
    let active = true;

    void commerceApi
      .getStripePlatformStatus()
      .then((status) => {
        if (!active) return;
        setUsdToEgpRate(status.usdToEgpRate || DEFAULT_USD_TO_EGP_RATE);
        setStripeConfigured(status.stripeConfigured);
        setStripeMode(status.stripeMode);
        if (status.defaultLoyaltyRules) {
          setLoyaltyRules((prev) => ({ ...prev, ...status.defaultLoyaltyRules }));
        }
      })
      .catch(() => {
        // Keep safe defaults
      });

    void commerceApi
      .getAssistantStatus()
      .then((res) => {
        if (!active) return;
        setAssistantConfigured(res.configured);
      })
      .catch(() => {
        if (!active) return;
        setAssistantConfigured(null);
      });

    void commerceApi
      .getLoyaltyRules()
      .then((rules) => {
        if (!active) return;
        setLoyaltyRules(rules);
        setLoyaltyBackendAvailable(true);
      })
      .catch((err) => {
        if (!active) return;
        if (isBackendEndpointMissing(err)) {
          setLoyaltyBackendAvailable(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const prepareCheckoutFromItem = useCallback(
    (params: {
      item: FashionItemDetails;
      variant: FashionVariant | null;
      size: string | null;
      quantity?: number;
    }): CheckoutDraftItem => {
      const { item, variant, size, quantity = 1 } = params;
      const chosenVariant = variant ?? item.variants?.[0] ?? null;
      const draft: CheckoutDraftItem = {
        fashionItemId: item.id,
        name: item.name,
        categoryName: item.categoryName,
        variantId: chosenVariant?.id ?? null,
        colorName: chosenVariant?.colorName ?? null,
        colorHex: chosenVariant?.colorHex ?? null,
        imageUrl: chosenVariant?.imageUrl ?? null,
        size: size,
        availableSizes: item.availableSizes ?? [],
        quantity: Math.max(1, Math.min(20, Math.floor(quantity))),
        unitPriceUsd: item.price,
      };
      setCheckoutDraft(draft);
      return draft;
    },
    []
  );

  const updateCheckoutQuantity = useCallback((quantity: number) => {
    const clamped = Math.max(1, Math.min(20, Math.floor(quantity)));
    setCheckoutDraft((prev) => (prev ? { ...prev, quantity: clamped } : null));
  }, []);

  const updateCheckoutSize = useCallback((size: string) => {
    setSelectedPurchaseSize(size);
    setCheckoutDraft((prev) => (prev ? { ...prev, size } : null));
  }, []);

  const recordConfirmedOrder = useCallback((order: PersistedOrder) => {
    setRecentConfirmedOrders((prev) => ({
      ...prev,
      [order.orderNumber]: order,
    }));
    if (typeof order.updatedLoyaltyBalance === 'number') {
      setLoyaltyAccount((prev) =>
        prev
          ? {
              ...prev,
              currentBalance: order.updatedLoyaltyBalance!,
              availableDiscountEgp:
                Math.floor(
                  order.updatedLoyaltyBalance! /
                    prev.rules.redemptionBlockPoints
                ) * prev.rules.redemptionBlockValueEgp,
            }
          : prev
      );
    }
  }, []);

  const requestCustomerVerification = useCallback(
    async (phone: string): Promise<{ challengeSent: boolean; message?: string }> => {
      setLoyaltyLoading(true);
      setLoyaltyError(null);
      try {
        const res = await commerceApi.requestLoyaltyVerification(phone);
        setLoyaltyBackendAvailable(true);
        return { challengeSent: res.challengeSent, message: res.message };
      } catch (err) {
        if (isBackendEndpointMissing(err)) {
          setLoyaltyBackendAvailable(false);
          setLoyaltyError(
            language === 'ar'
              ? 'نقاط الولاء تتطلب تفعيل نقاط نهاية الولاء (/api/loyalty/*) على خادم الكتالوج والطلبات.'
              : 'Loyalty verification requires the /api/loyalty/* endpoints to be deployed on the backend server.'
          );
        } else {
          setLoyaltyError(
            formatGeneralApiError(
              err,
              language === 'ar'
                ? 'تعذر إرسال رمز التحقق حالياً.'
                : 'Could not send customer verification code right now.'
            )
          );
        }
        return { challengeSent: false };
      } finally {
        setLoyaltyLoading(false);
      }
    },
    [language]
  );

  const confirmCustomerVerification = useCallback(
    async (phone: string, code: string): Promise<boolean> => {
      setLoyaltyLoading(true);
      setLoyaltyError(null);
      try {
        const res = await commerceApi.confirmLoyaltyVerification(phone, code);
        setLoyaltyVerificationToken(res.verificationToken);
        setLoyaltyAccount(res.account);
        setLoyaltyRules(res.account.rules);
        setLoyaltyBackendAvailable(true);
        return true;
      } catch (err) {
        if (isBackendEndpointMissing(err)) {
          setLoyaltyBackendAvailable(false);
          setLoyaltyError(
            language === 'ar'
              ? 'نقاط نهاية التحقق من نقاط الولاء (/api/loyalty/verify-confirm) غير مفعلة بعد على الخادم.'
              : 'Loyalty verification endpoint (/api/loyalty/verify-confirm) is not yet deployed on the backend.'
          );
        } else {
          setLoyaltyError(
            formatGeneralApiError(
              err,
              language === 'ar'
                ? 'رمز التحقق غير صحيح أو منتهي الصلاحية.'
                : 'Invalid or expired verification code.'
            )
          );
        }
        return false;
      } finally {
        setLoyaltyLoading(false);
      }
    },
    [language]
  );

  const refreshLoyaltyAccount = useCallback(async () => {
    if (!loyaltyVerificationToken) return;
    setLoyaltyLoading(true);
    setLoyaltyError(null);
    try {
      const account = await commerceApi.getLoyaltyAccount(
        loyaltyVerificationToken
      );
      setLoyaltyAccount(account);
      setLoyaltyRules(account.rules);
      setLoyaltyBackendAvailable(true);
    } catch (err) {
      setLoyaltyError(
        formatGeneralApiError(
          err,
          language === 'ar'
            ? 'تعذر تحديث سجل نقاط الولاء.'
            : 'Could not refresh loyalty account summary.'
        )
      );
    } finally {
      setLoyaltyLoading(false);
    }
  }, [loyaltyVerificationToken, language]);

  const clearLoyaltySession = useCallback(() => {
    setLoyaltyVerificationToken(null);
    setLoyaltyAccount(null);
    setLoyaltyError(null);
  }, []);

  const buildAssistantContext = useCallback((): AssistantContextSnapshot => {
    return {
      selectedItem: selectedItemDetails
        ? {
            id: selectedItemDetails.id,
            name: selectedItemDetails.name,
            categoryName: selectedItemDetails.categoryName,
            priceUsd: selectedItemDetails.price,
            selectedColor: selectedVariant?.colorName ?? null,
            availableColors: selectedItemDetails.variants.map(
              (v) => v.colorName
            ),
            availableSizes: selectedItemDetails.availableSizes,
            description: selectedItemDetails.description,
          }
        : null,
      outfitConfirmed,
      tryOnActive: false,
      scannedSize: latestScannedSize,
      stylePreferences,
      verifiedLoyaltyPoints: loyaltyAccount?.currentBalance ?? null,
    };
  }, [
    selectedItemDetails,
    selectedVariant,
    outfitConfirmed,
    latestScannedSize,
    stylePreferences,
    loyaltyAccount,
  ]);

  const sendAssistantPrompt = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim();
      if (!trimmed || assistantSending) return;

      const userMsg: AssistantChatMessage = {
        id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      const nextHistory = [...assistantMessages, userMsg];
      setAssistantMessages(nextHistory);
      setAssistantSending(true);
      setAssistantError(null);
      lastFailedPromptRef.current = null;

      try {
        const res = await commerceApi.sendAssistantMessage({
          messages: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          language,
          context: buildAssistantContext(),
        });

        const botMsg: AssistantChatMessage = {
          id: `ast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content: res.reply,
          createdAt: new Date().toISOString(),
          recommendedItems: res.recommendedItems,
        };
        setAssistantMessages((prev) => [...prev, botMsg]);
        setAssistantConfigured(true);
      } catch (err) {
        lastFailedPromptRef.current = trimmed;
        setAssistantError(
          formatGeneralApiError(
            err,
            language === 'ar'
              ? 'تعذر الحصول على رد من مساعد الأناقة حالياً. يرجى المحاولة مرة أخرى.'
              : 'Could not reach the AI Fashion Assistant right now. Please try again.'
          )
        );
      } finally {
        setAssistantSending(false);
      }
    },
    [
      assistantSending,
      assistantMessages,
      language,
      buildAssistantContext,
    ]
  );

  const retryLastAssistantPrompt = useCallback(async () => {
    if (assistantSending) return;
    const lastMsg = assistantMessages[assistantMessages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user') return;

    setAssistantSending(true);
    setAssistantError(null);

    try {
      const res = await commerceApi.sendAssistantMessage({
        messages: assistantMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        language,
        context: buildAssistantContext(),
      });

      const botMsg: AssistantChatMessage = {
        id: `ast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: res.reply,
        createdAt: new Date().toISOString(),
        recommendedItems: res.recommendedItems,
      };
      setAssistantMessages((prev) => [...prev, botMsg]);
      lastFailedPromptRef.current = null;
    } catch (err) {
      setAssistantError(
        formatGeneralApiError(
          err,
          language === 'ar'
            ? 'تعذر إعادة إرسال الرسالة. يرجى المحاولة بعد لحظات.'
            : 'Retry failed. Please try again in a moment.'
        )
      );
    } finally {
      setAssistantSending(false);
    }
  }, [assistantSending, assistantMessages, language, buildAssistantContext]);

  const clearAssistantChat = useCallback(() => {
    setAssistantMessages([]);
    setAssistantError(null);
    lastFailedPromptRef.current = null;
  }, []);

  const value = useMemo<CommerceContextValue>(
    () => ({
      usdToEgpRate,
      stripeConfigured,
      stripeMode,
      loyaltyRules,
      loyaltyBackendAvailable,
      checkoutDraft,
      selectedPurchaseSize,
      setSelectedPurchaseSize,
      prepareCheckoutFromItem,
      updateCheckoutQuantity,
      updateCheckoutSize,
      recentConfirmedOrders,
      recordConfirmedOrder,
      loyaltyVerificationToken,
      loyaltyAccount,
      loyaltyLoading,
      loyaltyError,
      requestCustomerVerification,
      confirmCustomerVerification,
      refreshLoyaltyAccount,
      clearLoyaltySession,
      assistantMessages,
      assistantSending,
      assistantError,
      assistantConfigured,
      assistantDrawerOpen,
      setAssistantDrawerOpen,
      stylePreferences,
      setStylePreferences,
      latestScannedSize,
      setLatestScannedSize,
      sendAssistantPrompt,
      retryLastAssistantPrompt,
      clearAssistantChat,
    }),
    [
      usdToEgpRate,
      stripeConfigured,
      stripeMode,
      loyaltyRules,
      loyaltyBackendAvailable,
      checkoutDraft,
      selectedPurchaseSize,
      prepareCheckoutFromItem,
      updateCheckoutQuantity,
      updateCheckoutSize,
      recentConfirmedOrders,
      recordConfirmedOrder,
      loyaltyVerificationToken,
      loyaltyAccount,
      loyaltyLoading,
      loyaltyError,
      requestCustomerVerification,
      confirmCustomerVerification,
      refreshLoyaltyAccount,
      clearLoyaltySession,
      assistantMessages,
      assistantSending,
      assistantError,
      assistantConfigured,
      assistantDrawerOpen,
      stylePreferences,
      latestScannedSize,
      sendAssistantPrompt,
      retryLastAssistantPrompt,
      clearAssistantChat,
    ]
  );

  return (
    <CommerceContext.Provider value={value}>
      {children}
    </CommerceContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCommerce(): CommerceContextValue {
  const ctx = useContext(CommerceContext);
  if (!ctx) {
    throw new Error('useCommerce must be used inside a <CommerceProvider>.');
  }
  return ctx;
}

