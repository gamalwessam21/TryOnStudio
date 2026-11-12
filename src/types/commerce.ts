export type AppLanguage = 'en' | 'ar';

export type AssistantRole = 'user' | 'assistant';

export interface AssistantProductRecommendation {
  id: number;
  name: string;
  categoryName: string;
  priceUsd: number;
  priceEgp: number;
  thumbnailUrl: string;
  variantCount: number;
}

export interface AssistantChatMessage {
  id: string;
  role: AssistantRole;
  content: string;
  createdAt: string;
  recommendedItems?: AssistantProductRecommendation[];
  isError?: boolean;
}

export interface AssistantStylePreferences {
  aesthetic?: string;
  fit?: string;
  undertone?: string;
  budgetEgp?: number | null;
}

export interface AssistantContextSnapshot {
  selectedItem?: {
    id: number;
    name: string;
    categoryName: string;
    priceUsd: number;
    selectedColor?: string | null;
    availableColors?: string[];
    availableSizes?: string[];
    description?: string;
  } | null;
  outfitConfirmed?: boolean;
  tryOnActive?: boolean;
  scannedSize?: string | null;
  stylePreferences?: AssistantStylePreferences;
  verifiedLoyaltyPoints?: number | null;
}

export interface AssistantChatResponse {
  reply: string;
  model: string;
  recommendedItems: AssistantProductRecommendation[];
}

export interface AssistantStatusResponse {
  configured: boolean;
  provider: string;
  model: string;
  usdToEgpRate: number;
}

export type PaymentMethodType = 'cod' | 'stripe';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus =
  | 'pending_collection'
  | 'pending_payment'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export interface LoyaltyRules {
  earnUnitAmountEgp: number; // default 10 EGP
  pointsEarnedPerUnit: number; // default 1 point
  redemptionBlockPoints: number; // default 100 points
  redemptionBlockValueEgp: number; // default 10 EGP
  minRedemptionPoints: number; // default 100 points
  maxRedemptionRatio: number; // default 1.0 (100% of eligible merchandise subtotal)
}

export type LoyaltyTransactionType =
  | 'earn'
  | 'redeem'
  | 'reversal'
  | 'adjustment';

export interface LoyaltyTransaction {
  id: string;
  type: LoyaltyTransactionType;
  pointsDelta: number;
  orderNumber: string | null;
  description: string;
  createdAt: string;
}

export interface LoyaltyAccountSummary {
  customerPhoneMasked: string;
  currentBalance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  availableDiscountEgp: number;
  rules: LoyaltyRules;
  transactions: LoyaltyTransaction[];
}

export interface LoyaltyVerifyRequestResponse {
  challengeSent: boolean;
  expiresInSeconds: number;
  message?: string;
}

export interface LoyaltyVerifyConfirmResponse {
  verificationToken: string;
  expiresAt: string;
  account: LoyaltyAccountSummary;
}

export interface CheckoutDraftItem {
  fashionItemId: number;
  name: string;
  categoryName: string;
  variantId: number | null;
  colorName: string | null;
  colorHex: string | null;
  imageUrl: string | null;
  size: string | null;
  availableSizes: string[];
  variants?: Array<{
    id: number;
    colorName: string;
    colorHex: string;
    imageUrl: string;
  }>;
  quantity: number;
  unitPriceUsd: number;
}

export interface CartItem extends CheckoutDraftItem {
  lineKey: string;
}

export type CheckoutMode = 'cart' | 'buy_now';

export interface CartActionResult {
  ok: boolean;
  merged?: boolean;
  quantity?: number;
  code?: 'max_quantity_exceeded' | 'max_lines_exceeded' | 'invalid_item';
  message?: string;
}

export interface CustomerFormValues {
  fullName: string;
  phone: string;
}

export interface CreateOrderItemPayload {
  fashionItemId: number;
  variantId: number | null;
  size: string | null;
  quantity: number;
}

export interface CreateOrderPayload {
  items: CreateOrderItemPayload[];
  customer: {
    fullName: string;
    phone: string;
  };
  paymentMethod: PaymentMethodType;
  pointsToRedeem?: number;
  loyaltyVerificationToken?: string | null;
}

export interface CreateStripeSessionRequest {
  orderNumber: string;
  receiptAccessToken?: string | null;
  idempotencyKey: string;
  // Legacy single-item fallback fields for external/mobile callers
  fashionItemId?: number;
  variantId?: number | null;
  size?: string | null;
  quantity?: number;
  verifiedDiscountEgp?: number;
}

export interface PersistedOrderItem {
  fashionItemId: number;
  productName: string;
  categoryName?: string | null;
  variantId: number | null;
  colorName: string | null;
  imageUrl: string | null;
  size: string | null;
  quantity: number;
  unitPriceEgp: number;
  unitPriceUsd?: number | null;
  lineTotalEgp: number;
}

export interface PersistedOrder {
  orderNumber: string;
  receiptNumber: string;
  transactionReference: string | null;
  customerName: string;
  customerPhoneMasked: string;
  items: PersistedOrderItem[];
  currency: 'EGP';
  subtotalEgp: number;
  discountEgp: number;
  pointsRedeemed: number;
  finalTotalEgp: number;
  paymentMethod: PaymentMethodType;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt: string;
  pointsEarned: number;
  updatedLoyaltyBalance: number | null;
  checkoutUrl?: string | null;
  receiptAccessToken?: string | null;
}

export interface StripePlatformStatus {
  stripeConfigured: boolean;
  stripeMode: 'sandbox' | 'live' | 'unconfigured';
  usdToEgpRate: number;
  defaultLoyaltyRules: LoyaltyRules;
}

export interface StripeSessionVerification {
  sessionId: string;
  sessionStatus: string;
  paymentStatus: string;
  amountTotalMinor: number | null;
  currency: string;
  transactionReference: string;
  orderNumber: string | null;
}

