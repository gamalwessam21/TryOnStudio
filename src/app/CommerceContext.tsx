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
import { ApiError, formatGeneralApiError } from '../services/fashionApi';
import type { FashionItemDetails, FashionVariant } from '../types/api';
import type {
  AssistantChatMessage,
  AssistantContextSnapshot,
  AssistantStylePreferences,
  CartActionResult,
  CartItem,
  CheckoutDraftItem,
  CheckoutMode,
  LoyaltyAccountSummary,
  LoyaltyRules,
  PersistedOrder,
} from '../types/commerce';
import {
  buildCartLineKey,
  DEFAULT_LOYALTY_RULES,
  DEFAULT_USD_TO_EGP_RATE,
} from '../utils/commerceHelpers';
import { useLanguage } from '../i18n/LanguageContext';
import { useStudio } from './StudioContext';

export const CART_STORAGE_KEY = 'tys.cart';
export const RECEIPT_TOKENS_STORAGE_KEY = 'tys.receiptTokens';
export const CONFIRMED_ORDERS_SESSION_KEY = 'tryonstudio_session_orders';
export const MAX_CART_LINES = 20;
export const MAX_LINE_QUANTITY = 20;
export const MAX_ASSISTANT_MESSAGE_CHARS = 1200;
export const MAX_ASSISTANT_HISTORY_TURNS = 16;

export interface CommerceContextValue {
  // Pricing & Payment Platform State
  usdToEgpRate: number;
  stripeConfigured: boolean;
  stripeMode: 'sandbox' | 'live' | 'unconfigured';
  loyaltyRules: LoyaltyRules;
  loyaltyBackendAvailable: boolean | null;

  // Multi-Product Shopping Cart State (persisted in localStorage under tys.cart)
  cartItems: CartItem[];
  cartTotalQuantity: number;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  cartNotice: string | null;
  clearCartNotice: () => void;
  addToCart: (params: {
    item: FashionItemDetails;
    variant: FashionVariant | null;
    size: string | null;
    quantity?: number;
  }) => CartActionResult;
  updateCartItemQuantity: (lineKey: string, quantity: number) => CartActionResult;
  updateCartItemSize: (lineKey: string, size: string) => CartActionResult;
  updateCartItemVariant: (
    lineKey: string,
    variant: FashionVariant
  ) => CartActionResult;
  syncCartItemCatalogData: (
    fashionItemId: number,
    details: FashionItemDetails
  ) => void;
  removeCartItem: (lineKey: string) => void;
  clearCart: () => void;

  // Checkout Selection State (Buy Now vs Cart Checkout)
  checkoutMode: CheckoutMode;
  setCheckoutMode: (mode: CheckoutMode) => void;
  cartCheckoutReady: boolean;
  startCartCheckout: () => void;
  clearCheckoutDraft: () => void;
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
  updateCheckoutVariant: (variant: FashionVariant) => void;

  // Persisted Order & Receipt Token State
  recentConfirmedOrders: Record<string, PersistedOrder>;
  recordConfirmedOrder: (order: PersistedOrder) => void;
  getReceiptToken: (orderNumber: string) => string | null;
  saveReceiptToken: (orderNumber: string, token: string) => void;

  // Verified Customer Loyalty State (strictly in-memory)
  loyaltyVerificationToken: string | null;
  loyaltyAccount: LoyaltyAccountSummary | null;
  loyaltyLoading: boolean;
  loyaltyError: string | null;
  loyaltyOtpExpiresInSeconds: number | null;
  loyaltyRetryAfterSeconds: number | null;
  requestCustomerVerification: (phone: string) => Promise<{
    challengeSent: boolean;
    expiresInSeconds?: number;
    message?: string;
    retryAfterSeconds?: number | null;
  }>;
  confirmCustomerVerification: (phone: string, code: string) => Promise<boolean>;
  refreshLoyaltyAccount: () => Promise<void>;
  clearLoyaltySession: () => void;
  handleLoyaltyUnauthorized: () => void;

  // AI Fashion Assistant Session State
  assistantMessages: AssistantChatMessage[];
  assistantSending: boolean;
  assistantError: string | null;
  assistantConfigured: boolean | null;
  assistantProvider: string | null;
  assistantModel: string | null;
  assistantDrawerOpen: boolean;
  setAssistantDrawerOpen: (open: boolean) => void;
  stylePreferences: AssistantStylePreferences;
  setStylePreferences: (prefs: AssistantStylePreferences) => void;
  latestScannedSize: string | null;
  setLatestScannedSize: (size: string | null) => void;
  tryOnActiveState: boolean;
  setTryOnActiveState: (active: boolean) => void;
  sendAssistantPrompt: (promptText: string) => Promise<void>;
  retryLastAssistantPrompt: () => Promise<void>;
  clearAssistantChat: () => void;
}

function loadPersistedCart(): CartItem[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const mergedMap = new Map<string, CartItem>();
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const fashionItemId = Number(entry.fashionItemId);
      if (!Number.isInteger(fashionItemId) || fashionItemId <= 0) continue;

      const rawQty = Math.floor(Number(entry.quantity));
      if (!Number.isInteger(rawQty) || rawQty < 1) continue;
      const quantity = Math.min(MAX_LINE_QUANTITY, rawQty);

      const variantId =
        entry.variantId !== null &&
        entry.variantId !== undefined &&
        Number.isInteger(Number(entry.variantId))
          ? Number(entry.variantId)
          : null;
      const size =
        typeof entry.size === 'string' && entry.size.trim()
          ? entry.size.trim()
          : null;
      const lineKey = buildCartLineKey(fashionItemId, variantId, size);

      const existing = mergedMap.get(lineKey);
      if (existing) {
        existing.quantity = Math.min(
          MAX_LINE_QUANTITY,
          existing.quantity + quantity
        );
        continue;
      }

      if (mergedMap.size >= MAX_CART_LINES) continue;

      mergedMap.set(lineKey, {
        lineKey,
        fashionItemId,
        name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : `Item #${fashionItemId}`,
        categoryName: typeof entry.categoryName === 'string' ? entry.categoryName : '',
        variantId,
        colorName: typeof entry.colorName === 'string' ? entry.colorName : null,
        colorHex: typeof entry.colorHex === 'string' ? entry.colorHex : null,
        imageUrl: typeof entry.imageUrl === 'string' ? entry.imageUrl : null,
        size,
        availableSizes: Array.isArray(entry.availableSizes)
          ? entry.availableSizes.filter((s: unknown): s is string => typeof s === 'string')
          : [],
        variants: Array.isArray(entry.variants) ? entry.variants : undefined,
        quantity,
        unitPriceUsd:
          typeof entry.unitPriceUsd === 'number' && Number.isFinite(entry.unitPriceUsd) && entry.unitPriceUsd >= 0
            ? entry.unitPriceUsd
            : 0,
      });
    }

    return Array.from(mergedMap.values());
  } catch {
    return [];
  }
}

function savePersistedCart(items: CartItem[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors in restricted environments
  }
}

function loadReceiptTokens(): Record<string, string> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem(RECEIPT_TOKENS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === 'string' && typeof v === 'string' && v.trim()) {
        clean[k] = v.trim();
      }
    }
    return clean;
  } catch {
    return {};
  }
}

function persistReceiptTokens(tokens: Record<string, string>): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(
      RECEIPT_TOKENS_STORAGE_KEY,
      JSON.stringify(tokens)
    );
  } catch {
    // Ignore storage errors
  }
}

function loadSessionOrders(receiptTokens: Record<string, string>): Record<string, PersistedOrder> {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return {};
    const raw = window.sessionStorage.getItem(CONFIRMED_ORDERS_SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PersistedOrder>;
    if (!parsed || typeof parsed !== 'object') return {};
    for (const [orderNumber, order] of Object.entries(parsed)) {
      if (order && !order.receiptAccessToken && receiptTokens[orderNumber]) {
        order.receiptAccessToken = receiptTokens[orderNumber];
      }
    }
    return parsed;
  } catch {
    return {};
  }
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

  // Shopping Cart state (persisted in localStorage under tys.cart)
  const [cartItems, setCartItems] = useState<CartItem[]>(() =>
    loadPersistedCart()
  );
  const [cartDrawerOpen, setCartDrawerOpen] = useState<boolean>(false);
  const [cartNotice, setCartNotice] = useState<string | null>(null);

  // Checkout mode & isolated Buy Now draft
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>('cart');
  const [cartCheckoutReady, setCartCheckoutReady] = useState<boolean>(false);
  const [selectedPurchaseSize, setSelectedPurchaseSize] = useState<
    string | null
  >(null);
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraftItem | null>(
    null
  );

  // Receipt tokens in localStorage (tys.receiptTokens) + session order cache
  const [receiptTokensMap, setReceiptTokensMap] = useState<
    Record<string, string>
  >(() => loadReceiptTokens());
  const [recentConfirmedOrders, setRecentConfirmedOrders] = useState<
    Record<string, PersistedOrder>
  >(() => loadSessionOrders(loadReceiptTokens()));

  // Verified Loyalty session (strictly in-memory; never stored in localStorage/sessionStorage)
  const [loyaltyVerificationToken, setLoyaltyVerificationToken] = useState<
    string | null
  >(null);
  const [loyaltyAccount, setLoyaltyAccount] =
    useState<LoyaltyAccountSummary | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState<boolean>(false);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);
  const [loyaltyOtpExpiresInSeconds, setLoyaltyOtpExpiresInSeconds] = useState<
    number | null
  >(null);
  const [loyaltyRetryAfterSeconds, setLoyaltyRetryAfterSeconds] = useState<
    number | null
  >(null);

  // AI Fashion Assistant session
  const [assistantMessages, setAssistantMessages] = useState<
    AssistantChatMessage[]
  >([]);
  const [assistantSending, setAssistantSending] = useState<boolean>(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantConfigured, setAssistantConfigured] = useState<
    boolean | null
  >(null);
  const [assistantProvider, setAssistantProvider] = useState<string | null>(
    null
  );
  const [assistantModel, setAssistantModel] = useState<string | null>(null);
  const [assistantDrawerOpen, setAssistantDrawerOpen] =
    useState<boolean>(false);
  const [stylePreferences, setStylePreferences] =
    useState<AssistantStylePreferences>({});
  const [latestScannedSize, setLatestScannedSize] = useState<string | null>(
    null
  );
  const [tryOnActiveState, setTryOnActiveState] = useState<boolean>(false);

  const lastFailedPromptRef = useRef<string | null>(null);

  // Sync cartItems to localStorage whenever modified
  useEffect(() => {
    savePersistedCart(cartItems);
  }, [cartItems]);

  const cartTotalQuantity = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const clearCartNotice = useCallback(() => {
    setCartNotice(null);
  }, []);

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
        if (status.usdToEgpRate && status.usdToEgpRate > 0) {
          setUsdToEgpRate(status.usdToEgpRate);
        }
        setStripeConfigured(status.stripeConfigured);
        setStripeMode(status.stripeMode);
        if (status.defaultLoyaltyRules) {
          setLoyaltyRules((prev) => ({
            ...prev,
            ...status.defaultLoyaltyRules,
          }));
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
        setAssistantProvider(res.provider ?? null);
        setAssistantModel(res.model ?? null);
        if (typeof res.usdToEgpRate === 'number' && res.usdToEgpRate > 0) {
          setUsdToEgpRate(res.usdToEgpRate);
        }
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

  const addToCart = useCallback(
    (params: {
      item: FashionItemDetails;
      variant: FashionVariant | null;
      size: string | null;
      quantity?: number;
    }): CartActionResult => {
      const { item, variant, size, quantity = 1 } = params;
      const requestedQty = Math.floor(Number(quantity));
      if (
        !Number.isInteger(requestedQty) ||
        requestedQty < 1 ||
        requestedQty > MAX_LINE_QUANTITY
      ) {
        const msg =
          language === 'ar'
            ? `يجب أن تكون الكمية بين 1 و ${MAX_LINE_QUANTITY}.`
            : `Quantity must be between 1 and ${MAX_LINE_QUANTITY}.`;
        setCartNotice(msg);
        return {
          ok: false,
          code: 'max_quantity_exceeded',
          message: msg,
        };
      }

      const chosenVariant = variant ?? item.variants?.[0] ?? null;
      const variantId = chosenVariant?.id ?? null;
      const normalizedSize =
        size && size.trim()
          ? size.trim()
          : item.availableSizes?.length === 1
            ? item.availableSizes[0]
            : null;
      const lineKey = buildCartLineKey(item.id, variantId, normalizedSize);

      const existingIdx = cartItems.findIndex((c) => c.lineKey === lineKey);
      if (existingIdx >= 0) {
        const existing = cartItems[existingIdx];
        const nextQty = existing.quantity + requestedQty;
        if (nextQty > MAX_LINE_QUANTITY) {
          const msg =
            language === 'ar'
              ? `الحد الأقصى للكمية من نفس القطعة واللون والمقاس هو ${MAX_LINE_QUANTITY} (لديك حالياً ${existing.quantity} في السلة). يرجى تعديل الكمية.`
              : `Maximum quantity per item configuration is ${MAX_LINE_QUANTITY} (you already have ${existing.quantity} in your cart). Please adjust the quantity.`;
          setCartNotice(msg);
          return {
            ok: false,
            code: 'max_quantity_exceeded',
            quantity: existing.quantity,
            message: msg,
          };
        }

        const updatedLine: CartItem = {
          ...existing,
          name: item.name,
          categoryName: item.categoryName,
          colorName: chosenVariant?.colorName ?? existing.colorName,
          colorHex: chosenVariant?.colorHex ?? existing.colorHex,
          imageUrl:
            chosenVariant?.imageUrl ??
            item.thumbnailUrl ??
            existing.imageUrl ??
            null,
          availableSizes: item.availableSizes ?? existing.availableSizes,
          variants: item.variants?.map((v) => ({
            id: v.id,
            colorName: v.colorName,
            colorHex: v.colorHex,
            imageUrl: v.imageUrl,
          })),
          unitPriceUsd: item.price,
          quantity: nextQty,
        };
        setCartItems((prev) =>
          prev.map((c, idx) => (idx === existingIdx ? updatedLine : c))
        );
        const successMsg =
          language === 'ar'
            ? `تم تحديث الكمية في السلة (${nextQty}).`
            : `Updated quantity in cart (${nextQty}).`;
        setCartNotice(successMsg);
        return {
          ok: true,
          merged: true,
          quantity: nextQty,
          message: successMsg,
        };
      }

      if (cartItems.length >= MAX_CART_LINES) {
        const msg =
          language === 'ar'
            ? `الحد الأقصى للطلب هو ${MAX_CART_LINES} منتجاً مختلفاً. يرجى إزالة منتج قبل إضافة آخر.`
            : `An order can contain at most ${MAX_CART_LINES} distinct product lines. Please remove an item first.`;
        setCartNotice(msg);
        return {
          ok: false,
          code: 'max_lines_exceeded',
          message: msg,
        };
      }

      const newLine: CartItem = {
        lineKey,
        fashionItemId: item.id,
        name: item.name,
        categoryName: item.categoryName,
        variantId,
        colorName: chosenVariant?.colorName ?? null,
        colorHex: chosenVariant?.colorHex ?? null,
        imageUrl: chosenVariant?.imageUrl ?? item.thumbnailUrl ?? null,
        size: normalizedSize,
        availableSizes: item.availableSizes ?? [],
        variants: item.variants?.map((v) => ({
          id: v.id,
          colorName: v.colorName,
          colorHex: v.colorHex,
          imageUrl: v.imageUrl,
        })),
        quantity: requestedQty,
        unitPriceUsd: item.price,
      };

      setCartItems((prev) => [...prev, newLine]);
      const addedMsg =
        language === 'ar'
          ? `تمت إضافة "${item.name}" إلى سلة التسوق.`
          : `Added "${item.name}" to your cart.`;
      setCartNotice(addedMsg);
      return {
        ok: true,
        merged: false,
        quantity: requestedQty,
        message: addedMsg,
      };
    },
    [cartItems, language]
  );

  const updateCartItemQuantity = useCallback(
    (lineKey: string, quantity: number): CartActionResult => {
      const targetQty = Math.floor(Number(quantity));
      if (
        !Number.isInteger(targetQty) ||
        targetQty < 1 ||
        targetQty > MAX_LINE_QUANTITY
      ) {
        const msg =
          language === 'ar'
            ? `يجب أن تكون الكمية لكل منتج بين 1 و ${MAX_LINE_QUANTITY}.`
            : `Quantity per item line must be between 1 and ${MAX_LINE_QUANTITY}.`;
        setCartNotice(msg);
        return {
          ok: false,
          code: 'max_quantity_exceeded',
          message: msg,
        };
      }

      setCartItems((prev) =>
        prev.map((item) =>
          item.lineKey === lineKey ? { ...item, quantity: targetQty } : item
        )
      );
      setCartNotice(null);
      return { ok: true, quantity: targetQty };
    },
    [language]
  );

  const updateCartItemSize = useCallback(
    (lineKey: string, size: string): CartActionResult => {
      const trimmedSize = size.trim();
      const currentLine = cartItems.find((item) => item.lineKey === lineKey);
      if (!currentLine) {
        return { ok: false, code: 'invalid_item' };
      }

      const nextLineKey = buildCartLineKey(
        currentLine.fashionItemId,
        currentLine.variantId,
        trimmedSize
      );
      if (nextLineKey === lineKey) {
        return { ok: true, quantity: currentLine.quantity };
      }

      const duplicateTarget = cartItems.find((item) => item.lineKey === nextLineKey);
      if (duplicateTarget) {
        const combinedQty = duplicateTarget.quantity + currentLine.quantity;
        if (combinedQty > MAX_LINE_QUANTITY) {
          const msg =
            language === 'ar'
              ? `لا يمكن دمج المقاس لأن إجمالي الكمية (${combinedQty}) يتجاوز الحد الأقصى (${MAX_LINE_QUANTITY}). يرجى تقليل الكمية أولاً.`
              : `Cannot switch size because the combined quantity (${combinedQty}) would exceed the maximum of ${MAX_LINE_QUANTITY}. Please reduce the quantity first.`;
          setCartNotice(msg);
          return {
            ok: false,
            code: 'max_quantity_exceeded',
            quantity: duplicateTarget.quantity,
            message: msg,
          };
        }

        setCartItems((prev) =>
          prev
            .filter((item) => item.lineKey !== lineKey)
            .map((item) =>
              item.lineKey === nextLineKey
                ? { ...item, quantity: combinedQty }
                : item
            )
        );
        setCartNotice(null);
        return { ok: true, merged: true, quantity: combinedQty };
      }

      setCartItems((prev) =>
        prev.map((item) =>
          item.lineKey === lineKey
            ? { ...item, size: trimmedSize, lineKey: nextLineKey }
            : item
        )
      );
      setCartNotice(null);
      return { ok: true, quantity: currentLine.quantity };
    },
    [cartItems, language]
  );

  const updateCartItemVariant = useCallback(
    (lineKey: string, variant: FashionVariant): CartActionResult => {
      const currentLine = cartItems.find((item) => item.lineKey === lineKey);
      if (!currentLine) {
        return { ok: false, code: 'invalid_item' };
      }

      const nextLineKey = buildCartLineKey(
        currentLine.fashionItemId,
        variant.id,
        currentLine.size
      );
      if (nextLineKey === lineKey) {
        return { ok: true, quantity: currentLine.quantity };
      }

      const duplicateTarget = cartItems.find((item) => item.lineKey === nextLineKey);
      if (duplicateTarget) {
        const combinedQty = duplicateTarget.quantity + currentLine.quantity;
        if (combinedQty > MAX_LINE_QUANTITY) {
          const msg =
            language === 'ar'
              ? `لا يمكن تغيير اللون لأن إجمالي الكمية (${combinedQty}) يتجاوز الحد الأقصى (${MAX_LINE_QUANTITY}). يرجى تقليل الكمية أولاً.`
              : `Cannot switch color because the combined quantity (${combinedQty}) would exceed the maximum of ${MAX_LINE_QUANTITY}. Please reduce the quantity first.`;
          setCartNotice(msg);
          return {
            ok: false,
            code: 'max_quantity_exceeded',
            quantity: duplicateTarget.quantity,
            message: msg,
          };
        }

        setCartItems((prev) =>
          prev
            .filter((item) => item.lineKey !== lineKey)
            .map((item) =>
              item.lineKey === nextLineKey
                ? { ...item, quantity: combinedQty }
                : item
            )
        );
        setCartNotice(null);
        return { ok: true, merged: true, quantity: combinedQty };
      }

      setCartItems((prev) =>
        prev.map((item) =>
          item.lineKey === lineKey
            ? {
                ...item,
                variantId: variant.id,
                colorName: variant.colorName,
                colorHex: variant.colorHex,
                imageUrl: variant.imageUrl || item.imageUrl,
                lineKey: nextLineKey,
              }
            : item
        )
      );
      setCartNotice(null);
      return { ok: true, quantity: currentLine.quantity };
    },
    [cartItems, language]
  );

  const syncCartItemCatalogData = useCallback(
    (fashionItemId: number, details: FashionItemDetails) => {
      setCartItems((prev) => {
        let anyChanged = false;
        const next = prev.map((line) => {
          if (line.fashionItemId !== fashionItemId) return line;
          const matchedVariant =
            line.variantId !== null
              ? details.variants.find((v) => v.id === line.variantId)
              : details.variants[0];
          const nextSizes = details.availableSizes ?? [];
          const nextColorName = matchedVariant?.colorName ?? line.colorName;
          const nextColorHex = matchedVariant?.colorHex ?? line.colorHex;
          const nextImageUrl =
            matchedVariant?.imageUrl ??
            details.thumbnailUrl ??
            line.imageUrl ??
            null;

          const sizesSame =
            line.availableSizes.length === nextSizes.length &&
            line.availableSizes.every((s, idx) => s === nextSizes[idx]);
          const variantsSame =
            (line.variants?.length ?? 0) === details.variants.length;

          if (
            line.name === details.name &&
            line.categoryName === details.categoryName &&
            line.unitPriceUsd === details.price &&
            line.colorName === nextColorName &&
            line.colorHex === nextColorHex &&
            line.imageUrl === nextImageUrl &&
            sizesSame &&
            variantsSame
          ) {
            return line;
          }

          anyChanged = true;
          return {
            ...line,
            name: details.name,
            categoryName: details.categoryName,
            unitPriceUsd: details.price,
            availableSizes: nextSizes,
            variants: details.variants.map((v) => ({
              id: v.id,
              colorName: v.colorName,
              colorHex: v.colorHex,
              imageUrl: v.imageUrl,
            })),
            colorName: nextColorName,
            colorHex: nextColorHex,
            imageUrl: nextImageUrl,
          };
        });
        return anyChanged ? next : prev;
      });
    },
    []
  );

  const removeCartItem = useCallback((lineKey: string) => {
    setCartItems((prev) => {
      const next = prev.filter((item) => item.lineKey !== lineKey);
      if (next.length === 0) {
        setCartCheckoutReady(false);
      }
      return next;
    });
    setCheckoutDraft((prev) => {
      if (!prev) return null;
      const draftKey = buildCartLineKey(
        prev.fashionItemId,
        prev.variantId,
        prev.size
      );
      return draftKey === lineKey ? null : prev;
    });
    setCartNotice(null);
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setCheckoutDraft(null);
    setCartCheckoutReady(false);
    setCartNotice(null);
  }, []);

  const startCartCheckout = useCallback(() => {
    setCheckoutMode('cart');
    setCartCheckoutReady(true);
  }, []);

  const clearCheckoutDraft = useCallback(() => {
    setCheckoutDraft(null);
    setSelectedPurchaseSize(null);
    setCartCheckoutReady(false);
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
        imageUrl: chosenVariant?.imageUrl ?? item.thumbnailUrl ?? null,
        size: size,
        availableSizes: item.availableSizes ?? [],
        variants: item.variants?.map((v) => ({
          id: v.id,
          colorName: v.colorName,
          colorHex: v.colorHex,
          imageUrl: v.imageUrl,
        })),
        quantity: Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.floor(quantity))),
        unitPriceUsd: item.price,
      };
      // Buy Now sets isolated checkoutDraft and switches checkoutMode to 'buy_now'
      // without modifying or clearing tys.cart
      setCheckoutDraft(draft);
      setCheckoutMode('buy_now');
      return draft;
    },
    []
  );

  const updateCheckoutQuantity = useCallback((quantity: number) => {
    const clamped = Math.max(
      1,
      Math.min(MAX_LINE_QUANTITY, Math.floor(quantity))
    );
    setCheckoutDraft((prev) => (prev ? { ...prev, quantity: clamped } : null));
  }, []);

  const updateCheckoutSize = useCallback((size: string) => {
    setSelectedPurchaseSize(size);
    setCheckoutDraft((prev) => (prev ? { ...prev, size } : null));
  }, []);

  const updateCheckoutVariant = useCallback((variant: FashionVariant) => {
    setCheckoutDraft((prev) =>
      prev
        ? {
            ...prev,
            variantId: variant.id,
            colorName: variant.colorName,
            colorHex: variant.colorHex,
            imageUrl: variant.imageUrl ?? prev.imageUrl,
          }
        : null
    );
  }, []);

  const saveReceiptToken = useCallback((orderNumber: string, token: string) => {
    const trimmedOrder = orderNumber.trim();
    const trimmedToken = token.trim();
    if (!trimmedOrder || !trimmedToken) return;
    setReceiptTokensMap((prev) => {
      if (prev[trimmedOrder] === trimmedToken) return prev;
      const next = { ...prev, [trimmedOrder]: trimmedToken };
      persistReceiptTokens(next);
      return next;
    });
  }, []);

  const getReceiptToken = useCallback(
    (orderNumber: string): string | null => {
      const trimmed = orderNumber.trim();
      if (!trimmed) return null;
      if (receiptTokensMap[trimmed]) {
        return receiptTokensMap[trimmed];
      }
      const fromOrder = recentConfirmedOrders[trimmed]?.receiptAccessToken;
      if (fromOrder) return fromOrder;
      const diskTokens = loadReceiptTokens();
      return diskTokens[trimmed] ?? null;
    },
    [receiptTokensMap, recentConfirmedOrders]
  );

  const recordConfirmedOrder = useCallback((order: PersistedOrder) => {
    const incomingToken =
      typeof order.receiptAccessToken === 'string' &&
      order.receiptAccessToken.trim()
        ? order.receiptAccessToken.trim()
        : null;

    let preservedToken = incomingToken;
    setReceiptTokensMap((prevTokens) => {
      const existingToken = prevTokens[order.orderNumber] ?? null;
      const tokenToKeep = incomingToken || existingToken;
      preservedToken = tokenToKeep;
      if (tokenToKeep && prevTokens[order.orderNumber] !== tokenToKeep) {
        const nextTokens = { ...prevTokens, [order.orderNumber]: tokenToKeep };
        persistReceiptTokens(nextTokens);
        return nextTokens;
      }
      return prevTokens;
    });

    setRecentConfirmedOrders((prev) => {
      const existing = prev[order.orderNumber];
      const merged: PersistedOrder = {
        ...order,
        receiptAccessToken:
          incomingToken ||
          existing?.receiptAccessToken ||
          preservedToken ||
          null,
      };
      const next = {
        ...prev,
        [order.orderNumber]: merged,
      };
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem(
            CONFIRMED_ORDERS_SESSION_KEY,
            JSON.stringify(next)
          );
        }
      } catch {
        // Storage access may be restricted in private browsing
      }
      return next;
    });

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

  const handleLoyaltyUnauthorized = useCallback(() => {
    setLoyaltyVerificationToken(null);
    setLoyaltyAccount(null);
    setLoyaltyError(
      language === 'ar'
        ? 'انتهت صلاحية جلسة التحقق من نقاط الولاء. يرجى التحقق من رقم هاتفك مرة أخرى.'
        : 'Your loyalty verification session has expired. Please verify your phone number again.'
    );
  }, [language]);

  const requestCustomerVerification = useCallback(
    async (
      phone: string
    ): Promise<{
      challengeSent: boolean;
      expiresInSeconds?: number;
      message?: string;
      retryAfterSeconds?: number | null;
    }> => {
      setLoyaltyLoading(true);
      setLoyaltyError(null);
      setLoyaltyRetryAfterSeconds(null);
      try {
        const res = await commerceApi.requestLoyaltyVerification(phone);
        setLoyaltyBackendAvailable(true);
        if (
          typeof res.expiresInSeconds === 'number' &&
          res.expiresInSeconds > 0
        ) {
          setLoyaltyOtpExpiresInSeconds(res.expiresInSeconds);
        }
        return {
          challengeSent: res.challengeSent,
          expiresInSeconds: res.expiresInSeconds,
          message: res.message,
        };
      } catch (err) {
        if (isBackendEndpointMissing(err)) {
          setLoyaltyBackendAvailable(false);
          setLoyaltyError(
            language === 'ar'
              ? 'نقاط الولاء تتطلب تفعيل نقاط نهاية الولاء (/api/loyalty/*) على خادم الكتالوج والطلبات.'
              : 'Loyalty verification requires the /api/loyalty/* endpoints to be deployed on the backend server.'
          );
        } else if (err instanceof ApiError && err.status === 429) {
          if (err.retryAfterSeconds && err.retryAfterSeconds > 0) {
            setLoyaltyRetryAfterSeconds(err.retryAfterSeconds);
          }
          setLoyaltyError(
            err.retryAfterSeconds
              ? language === 'ar'
                ? `تم طلب رموز تحقق كثيرة. يرجى الانتظار ${err.retryAfterSeconds} ثانية قبل المحاولة مرة أخرى.`
                : `Too many verification codes requested. Please wait ${err.retryAfterSeconds}s before trying again.`
              : formatGeneralApiError(
                  err,
                  language === 'ar'
                    ? 'تم طلب رموز تحقق كثيرة. يرجى الانتظار قليلاً.'
                    : 'Too many verification codes requested. Please wait a moment.',
                  language
                )
          );
          return {
            challengeSent: false,
            retryAfterSeconds: err.retryAfterSeconds,
          };
        } else if (err instanceof ApiError && err.status === 503) {
          setLoyaltyError(
            language === 'ar'
              ? 'خدمة التحقق من الهاتف غير متاحة حالياً على الخادم.'
              : 'Phone verification service is temporarily unavailable on the server.'
          );
        } else {
          setLoyaltyError(
            formatGeneralApiError(
              err,
              language === 'ar'
                ? 'تعذر إرسال رمز التحقق حالياً.'
                : 'Could not send customer verification code right now.',
              language
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
        setLoyaltyOtpExpiresInSeconds(null);
        setLoyaltyRetryAfterSeconds(null);
        return true;
      } catch (err) {
        if (isBackendEndpointMissing(err)) {
          setLoyaltyBackendAvailable(false);
          setLoyaltyError(
            language === 'ar'
              ? 'نقاط نهاية التحقق من نقاط الولاء (/api/loyalty/verify-confirm) غير مفعلة بعد على الخادم.'
              : 'Loyalty verification endpoint (/api/loyalty/verify-confirm) is not yet deployed on the backend.'
          );
        } else if (err instanceof ApiError && err.code === 'otp_locked') {
          if (err.retryAfterSeconds && err.retryAfterSeconds > 0) {
            setLoyaltyRetryAfterSeconds(err.retryAfterSeconds);
          }
          setLoyaltyOtpExpiresInSeconds(0);
          setLoyaltyError(
            language === 'ar'
              ? 'تم إدخال رموز خاطئة كثيرة وتم قفل الرمز الحالي. يرجى طلب رمز تحقق جديد.'
              : 'Too many incorrect attempts; this code is now locked. Please request a new verification code.'
          );
        } else if (err instanceof ApiError && err.code === 'invalid_code') {
          setLoyaltyError(
            language === 'ar'
              ? 'رمز التحقق غير صحيح أو منتهي الصلاحية. يرجى التأكد والمحاولة مرة أخرى.'
              : 'Incorrect or expired verification code. Please check the code and try again.'
          );
        } else {
          setLoyaltyError(
            formatGeneralApiError(
              err,
              language === 'ar'
                ? 'رمز التحقق غير صحيح أو منتهي الصلاحية.'
                : 'Invalid or expired verification code.',
              language
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
      if (err instanceof ApiError && err.status === 401) {
        handleLoyaltyUnauthorized();
        return;
      }
      setLoyaltyError(
        formatGeneralApiError(
          err,
          language === 'ar'
            ? 'تعذر تحديث سجل نقاط الولاء.'
            : 'Could not refresh loyalty account summary.',
          language
        )
      );
    } finally {
      setLoyaltyLoading(false);
    }
  }, [loyaltyVerificationToken, language, handleLoyaltyUnauthorized]);

  const clearLoyaltySession = useCallback(() => {
    setLoyaltyVerificationToken(null);
    setLoyaltyAccount(null);
    setLoyaltyError(null);
    setLoyaltyOtpExpiresInSeconds(null);
    setLoyaltyRetryAfterSeconds(null);
  }, []);

  const buildAssistantContext = useCallback((): AssistantContextSnapshot => {
    const ctx: AssistantContextSnapshot = {};

    if (selectedItemDetails) {
      ctx.selectedItem = {
        id: selectedItemDetails.id,
        name: selectedItemDetails.name,
        categoryName: selectedItemDetails.categoryName,
        priceUsd: selectedItemDetails.price,
        ...(selectedVariant?.colorName
          ? { selectedColor: selectedVariant.colorName }
          : {}),
        ...(selectedItemDetails.variants?.length
          ? {
              availableColors: selectedItemDetails.variants.map(
                (v) => v.colorName
              ),
            }
          : {}),
        ...(selectedItemDetails.availableSizes?.length
          ? { availableSizes: selectedItemDetails.availableSizes }
          : {}),
        ...(selectedItemDetails.description
          ? { description: selectedItemDetails.description }
          : {}),
      };
    }

    if (outfitConfirmed) {
      ctx.outfitConfirmed = true;
    }
    if (tryOnActiveState) {
      ctx.tryOnActive = true;
    }
    if (latestScannedSize) {
      ctx.scannedSize = latestScannedSize;
    }

    const cleanPrefs: AssistantStylePreferences = {};
    if (stylePreferences.aesthetic) {
      cleanPrefs.aesthetic = stylePreferences.aesthetic;
    }
    if (stylePreferences.fit) {
      cleanPrefs.fit = stylePreferences.fit;
    }
    if (stylePreferences.undertone) {
      cleanPrefs.undertone = stylePreferences.undertone;
    }
    if (
      typeof stylePreferences.budgetEgp === 'number' &&
      stylePreferences.budgetEgp > 0
    ) {
      cleanPrefs.budgetEgp = stylePreferences.budgetEgp;
    }
    if (Object.keys(cleanPrefs).length > 0) {
      ctx.stylePreferences = cleanPrefs;
    }

    if (typeof loyaltyAccount?.currentBalance === 'number') {
      ctx.verifiedLoyaltyPoints = loyaltyAccount.currentBalance;
    }

    return ctx;
  }, [
    selectedItemDetails,
    selectedVariant,
    outfitConfirmed,
    tryOnActiveState,
    latestScannedSize,
    stylePreferences,
    loyaltyAccount,
  ]);

  const sendAssistantPrompt = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim();
      if (!trimmed || assistantSending) return;

      if (trimmed.length > MAX_ASSISTANT_MESSAGE_CHARS) {
        setAssistantError(
          language === 'ar'
            ? `الرسالة طويلة جداً (${trimmed.length}/${MAX_ASSISTANT_MESSAGE_CHARS} حرفاً). يرجى اختصار سؤالك.`
            : `Message is too long (${trimmed.length}/${MAX_ASSISTANT_MESSAGE_CHARS} characters). Please shorten your question.`
        );
        return;
      }

      const userMsg: AssistantChatMessage = {
        id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      const nextHistory = [...assistantMessages, userMsg];
      const boundedTurns = nextHistory
        .slice(-MAX_ASSISTANT_HISTORY_TURNS)
        .map((m) => ({
          role: m.role,
          content: m.content.slice(0, MAX_ASSISTANT_MESSAGE_CHARS),
        }));

      setAssistantMessages(nextHistory);
      setAssistantSending(true);
      setAssistantError(null);
      lastFailedPromptRef.current = null;

      try {
        const res = await commerceApi.sendAssistantMessage({
          messages: boundedTurns,
          language,
          context: buildAssistantContext(),
        });

        const cleanReply = typeof res.reply === 'string' ? res.reply.trim() : '';
        if (!cleanReply) {
          throw new Error(
            language === 'ar'
              ? 'أرجع مساعد الأناقة رداً فارغاً. يرجى المحاولة مرة أخرى.'
              : 'The AI Fashion Assistant returned an empty reply. Please try again.'
          );
        }

        if (res.model) {
          setAssistantModel(res.model);
        }

        const botMsg: AssistantChatMessage = {
          id: `ast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content: cleanReply,
          createdAt: new Date().toISOString(),
          recommendedItems: Array.isArray(res.recommendedItems)
            ? res.recommendedItems.slice(0, 4)
            : [],
        };
        setAssistantMessages((prev) => [...prev, botMsg]);
        setAssistantConfigured(true);
      } catch (err) {
        lastFailedPromptRef.current = trimmed;
        if (err instanceof ApiError && err.code === 'ai_unconfigured') {
          setAssistantConfigured(false);
        }
        setAssistantError(
          formatGeneralApiError(
            err,
            language === 'ar'
              ? 'تعذر الحصول على رد من مساعد الأناقة حالياً. يرجى المحاولة مرة أخرى.'
              : 'Could not reach the AI Fashion Assistant right now. Please try again.',
            language
          )
        );
      } finally {
        setAssistantSending(false);
      }
    },
    [assistantSending, assistantMessages, language, buildAssistantContext]
  );

  const retryLastAssistantPrompt = useCallback(async () => {
    if (assistantSending) return;
    const lastMsg = assistantMessages[assistantMessages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user') return;

    setAssistantSending(true);
    setAssistantError(null);

    const boundedTurns = assistantMessages
      .slice(-MAX_ASSISTANT_HISTORY_TURNS)
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, MAX_ASSISTANT_MESSAGE_CHARS),
      }));

    try {
      const res = await commerceApi.sendAssistantMessage({
        messages: boundedTurns,
        language,
        context: buildAssistantContext(),
      });

      const cleanReply = typeof res.reply === 'string' ? res.reply.trim() : '';
      if (!cleanReply) {
        throw new Error(
          language === 'ar'
            ? 'أرجع مساعد الأناقة رداً فارغاً. يرجى المحاولة مرة أخرى.'
            : 'The AI Fashion Assistant returned an empty reply. Please try again.'
        );
      }

      if (res.model) {
        setAssistantModel(res.model);
      }

      const botMsg: AssistantChatMessage = {
        id: `ast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: cleanReply,
        createdAt: new Date().toISOString(),
        recommendedItems: Array.isArray(res.recommendedItems)
          ? res.recommendedItems.slice(0, 4)
          : [],
      };
      setAssistantMessages((prev) => [...prev, botMsg]);
      lastFailedPromptRef.current = null;
    } catch (err) {
      setAssistantError(
        formatGeneralApiError(
          err,
          language === 'ar'
            ? 'تعذر إعادة إرسال الرسالة. يرجى المحاولة بعد لحظات.'
            : 'Retry failed. Please try again in a moment.',
          language
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
      cartItems,
      cartTotalQuantity,
      cartDrawerOpen,
      setCartDrawerOpen,
      cartNotice,
      clearCartNotice,
      addToCart,
      updateCartItemQuantity,
      updateCartItemSize,
      updateCartItemVariant,
      syncCartItemCatalogData,
      removeCartItem,
      clearCart,
      checkoutMode,
      setCheckoutMode,
      cartCheckoutReady,
      startCartCheckout,
      clearCheckoutDraft,
      checkoutDraft,
      selectedPurchaseSize,
      setSelectedPurchaseSize,
      prepareCheckoutFromItem,
      updateCheckoutQuantity,
      updateCheckoutSize,
      updateCheckoutVariant,
      recentConfirmedOrders,
      recordConfirmedOrder,
      getReceiptToken,
      saveReceiptToken,
      loyaltyVerificationToken,
      loyaltyAccount,
      loyaltyLoading,
      loyaltyError,
      loyaltyOtpExpiresInSeconds,
      loyaltyRetryAfterSeconds,
      requestCustomerVerification,
      confirmCustomerVerification,
      refreshLoyaltyAccount,
      clearLoyaltySession,
      handleLoyaltyUnauthorized,
      assistantMessages,
      assistantSending,
      assistantError,
      assistantConfigured,
      assistantProvider,
      assistantModel,
      assistantDrawerOpen,
      setAssistantDrawerOpen,
      stylePreferences,
      setStylePreferences,
      latestScannedSize,
      setLatestScannedSize,
      tryOnActiveState,
      setTryOnActiveState,
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
      cartItems,
      cartTotalQuantity,
      cartDrawerOpen,
      cartNotice,
      clearCartNotice,
      addToCart,
      updateCartItemQuantity,
      updateCartItemSize,
      updateCartItemVariant,
      syncCartItemCatalogData,
      removeCartItem,
      clearCart,
      checkoutMode,
      cartCheckoutReady,
      startCartCheckout,
      clearCheckoutDraft,
      checkoutDraft,
      selectedPurchaseSize,
      prepareCheckoutFromItem,
      updateCheckoutQuantity,
      updateCheckoutSize,
      updateCheckoutVariant,
      recentConfirmedOrders,
      recordConfirmedOrder,
      getReceiptToken,
      saveReceiptToken,
      loyaltyVerificationToken,
      loyaltyAccount,
      loyaltyLoading,
      loyaltyError,
      loyaltyOtpExpiresInSeconds,
      loyaltyRetryAfterSeconds,
      requestCustomerVerification,
      confirmCustomerVerification,
      refreshLoyaltyAccount,
      clearLoyaltySession,
      handleLoyaltyUnauthorized,
      assistantMessages,
      assistantSending,
      assistantError,
      assistantConfigured,
      assistantProvider,
      assistantModel,
      assistantDrawerOpen,
      stylePreferences,
      latestScannedSize,
      tryOnActiveState,
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
