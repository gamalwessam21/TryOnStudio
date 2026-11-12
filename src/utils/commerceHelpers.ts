import type {
  AppLanguage,
  LoyaltyRules,
  OrderStatus,
  PaymentStatus,
} from '../types/commerce';

export const DEFAULT_USD_TO_EGP_RATE = 50;

export const DEFAULT_LOYALTY_RULES: LoyaltyRules = {
  earnUnitAmountEgp: 10,
  pointsEarnedPerUnit: 1,
  redemptionBlockPoints: 100,
  redemptionBlockValueEgp: 10,
  minRedemptionPoints: 100,
  maxRedemptionRatio: 1,
};

export function convertUsdToEgp(
  priceUsd: number,
  usdToEgpRate = DEFAULT_USD_TO_EGP_RATE
): number {
  if (!Number.isFinite(priceUsd) || priceUsd < 0) return 0;
  const safeRate =
    Number.isFinite(usdToEgpRate) && usdToEgpRate > 0
      ? usdToEgpRate
      : DEFAULT_USD_TO_EGP_RATE;
  return Math.round(priceUsd * safeRate);
}

export function formatEgp(
  amountEgp: number | null | undefined,
  lang: AppLanguage = 'en'
): string {
  if (typeof amountEgp !== 'number' || Number.isNaN(amountEgp)) {
    return '—';
  }
  const formatted = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG', {
    maximumFractionDigits: 0,
  }).format(Math.round(amountEgp));
  return lang === 'ar' ? `${formatted} ج.م` : `${formatted} EGP`;
}

export function formatDualPrice(
  priceUsd: number | null | undefined,
  usdToEgpRate = DEFAULT_USD_TO_EGP_RATE,
  lang: AppLanguage = 'en'
): string {
  if (typeof priceUsd !== 'number' || Number.isNaN(priceUsd)) {
    return '—';
  }
  const egp = convertUsdToEgp(priceUsd, usdToEgpRate);
  const usdStr = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(priceUsd);
  return `${formatEgp(egp, lang)} (${usdStr})`;
}

export function normalizePhoneNumber(raw: string): string {
  return raw.replace(/[\s()-]/g, '').trim();
}

export interface CustomerValidationErrors {
  fullName?: string;
  phone?: string;
}

export function validatePhoneNumber(
  phone: string,
  lang: AppLanguage = 'en'
): string | undefined {
  const normalizedPhone = normalizePhoneNumber(phone);
  // Accepts Egyptian mobile (010/011/012/015 + 8 digits or +201...) and standard E.164 (+country + 8-14 digits)
  const egyptLocalPattern = /^01[0125]\d{8}$/;
  const egyptIntlPattern = /^\+201[0125]\d{8}$/;
  const generalIntlPattern = /^\+[1-9]\d{7,14}$/;

  if (!normalizedPhone) {
    return lang === 'ar'
      ? 'يرجى إدخال رقم الهاتف المحمول.'
      : 'Please enter your mobile phone number.';
  }
  if (
    normalizedPhone.length > 30 ||
    (!egyptLocalPattern.test(normalizedPhone) &&
      !egyptIntlPattern.test(normalizedPhone) &&
      !generalIntlPattern.test(normalizedPhone))
  ) {
    return lang === 'ar'
      ? 'أدخل رقم موبايل صحيح (مثل 01012345678 أو +201012345678).'
      : 'Enter a valid mobile number (e.g. 01012345678 or +201012345678).';
  }
  return undefined;
}

export function validateCustomerInfo(
  fullName: string,
  phone: string,
  lang: AppLanguage = 'en'
): CustomerValidationErrors {
  const errors: CustomerValidationErrors = {};
  const trimmedName = fullName.trim().replace(/\s+/g, ' ');

  if (!trimmedName) {
    errors.fullName =
      lang === 'ar'
        ? 'يرجى إدخال الاسم الكامل.'
        : 'Please enter your full name.';
  } else if (trimmedName.length < 3 || trimmedName.length > 100) {
    errors.fullName =
      lang === 'ar'
        ? 'يجب أن يتكون الاسم الكامل من 3 إلى 100 حرف.'
        : 'Full name must be between 3 and 100 characters.';
  } else if (!/^[\p{L}\s.'-]+$/u.test(trimmedName)) {
    errors.fullName =
      lang === 'ar'
        ? 'يرجى إدخال الاسم بحروف صحيحة.'
        : 'Please enter your name using valid letters.';
  }

  const phoneError = validatePhoneNumber(phone, lang);
  if (phoneError) {
    errors.phone = phoneError;
  }

  return errors;
}

export function buildCartLineKey(
  fashionItemId: number,
  variantId: number | null,
  size: string | null
): string {
  const vKey = variantId !== null && variantId !== undefined ? String(variantId) : 'default';
  const sKey = size && size.trim() ? size.trim().toUpperCase() : 'nosize';
  return `${fashionItemId}::${vKey}::${sKey}`;
}

export function maskPhoneNumber(phone: string): string {
  const cleaned = normalizePhoneNumber(phone);
  if (!cleaned) return '—';
  if (cleaned.includes('•') || cleaned.includes('*')) {
    return phone;
  }
  if (cleaned.length <= 4) return cleaned;
  const prefix = cleaned.slice(0, cleaned.startsWith('+') ? 4 : 3);
  const suffix = cleaned.slice(-2);
  const middleLen = Math.max(3, cleaned.length - prefix.length - suffix.length);
  return `${prefix}${'•'.repeat(middleLen)}${suffix}`;
}

export function isQualifyingPurchaseForPoints(
  orderStatus: OrderStatus,
  paymentStatus: PaymentStatus
): boolean {
  if (orderStatus === 'cancelled' || orderStatus === 'refunded') {
    return false;
  }
  if (
    paymentStatus === 'failed' ||
    paymentStatus === 'cancelled' ||
    paymentStatus === 'refunded' ||
    paymentStatus === 'pending_payment' ||
    paymentStatus === 'pending_collection'
  ) {
    return false;
  }
  return (
    paymentStatus === 'paid' &&
    (orderStatus === 'confirmed' || orderStatus === 'completed')
  );
}

/**
 * Calculates preview loyalty points earned on eligible merchandise after discounts.
 * Note: Authoritative awarding always occurs on the backend when an order is completed & paid.
 */
export function calculateLoyaltyPointsEarned(
  eligibleTotalAfterDiscountEgp: number,
  rules: LoyaltyRules = DEFAULT_LOYALTY_RULES
): number {
  if (
    !Number.isFinite(eligibleTotalAfterDiscountEgp) ||
    eligibleTotalAfterDiscountEgp <= 0 ||
    rules.earnUnitAmountEgp <= 0
  ) {
    return 0;
  }
  return (
    Math.floor(eligibleTotalAfterDiscountEgp / rules.earnUnitAmountEgp) *
    rules.pointsEarnedPerUnit
  );
}

export interface RedemptionPreview {
  valid: boolean;
  pointsToRedeem: number;
  discountEgp: number;
  maxRedeemablePoints: number;
  updatedTotalEgp: number;
  reason?: string;
}

/**
 * Computes client-side preview bounds for redeeming points; authoritative validation
 * is enforced by the backend during order creation.
 */
export function evaluatePointsRedemption(params: {
  requestedPoints: number;
  availablePoints: number;
  subtotalEgp: number;
  rules?: LoyaltyRules;
  lang?: AppLanguage;
}): RedemptionPreview {
  const {
    requestedPoints,
    availablePoints,
    subtotalEgp,
    rules = DEFAULT_LOYALTY_RULES,
    lang = 'en',
  } = params;

  const safeSubtotal = Math.max(0, Math.round(subtotalEgp));
  const safeAvailable = Math.max(0, Math.floor(availablePoints));

  const maxDiscountAllowedEgp = Math.floor(
    safeSubtotal * Math.min(1, Math.max(0, rules.maxRedemptionRatio))
  );
  const maxBlocksBySubtotal = Math.floor(
    maxDiscountAllowedEgp / rules.redemptionBlockValueEgp
  );
  const maxBlocksByBalance = Math.floor(
    safeAvailable / rules.redemptionBlockPoints
  );
  const maxRedeemablePoints =
    Math.max(0, Math.min(maxBlocksBySubtotal, maxBlocksByBalance)) *
    rules.redemptionBlockPoints;

  if (requestedPoints <= 0) {
    return {
      valid: true,
      pointsToRedeem: 0,
      discountEgp: 0,
      maxRedeemablePoints,
      updatedTotalEgp: safeSubtotal,
    };
  }

  if (requestedPoints > safeAvailable) {
    return {
      valid: false,
      pointsToRedeem: 0,
      discountEgp: 0,
      maxRedeemablePoints,
      updatedTotalEgp: safeSubtotal,
      reason:
        lang === 'ar'
          ? 'لا يمكن استبدال نقاط أكثر من رصيدك الحالي.'
          : 'Cannot redeem more points than your available balance.',
    };
  }

  if (requestedPoints < rules.minRedemptionPoints) {
    return {
      valid: false,
      pointsToRedeem: 0,
      discountEgp: 0,
      maxRedeemablePoints,
      updatedTotalEgp: safeSubtotal,
      reason:
        lang === 'ar'
          ? `الحد الأدنى للاستبدال هو ${rules.minRedemptionPoints} نقطة.`
          : `Minimum redemption is ${rules.minRedemptionPoints} points.`,
    };
  }

  if (requestedPoints % rules.redemptionBlockPoints !== 0) {
    return {
      valid: false,
      pointsToRedeem: 0,
      discountEgp: 0,
      maxRedeemablePoints,
      updatedTotalEgp: safeSubtotal,
      reason:
        lang === 'ar'
          ? `يتم استبدال النقاط بمضاعفات ${rules.redemptionBlockPoints} نقطة.`
          : `Points must be redeemed in multiples of ${rules.redemptionBlockPoints}.`,
    };
  }

  const blocks = Math.floor(requestedPoints / rules.redemptionBlockPoints);
  const discountEgp = blocks * rules.redemptionBlockValueEgp;

  if (discountEgp > maxDiscountAllowedEgp) {
    return {
      valid: false,
      pointsToRedeem: 0,
      discountEgp: 0,
      maxRedeemablePoints,
      updatedTotalEgp: safeSubtotal,
      reason:
        lang === 'ar'
          ? 'قيمة الخصم تتجاوز إجمالي المشتريات المؤهل.'
          : 'Discount cannot exceed the eligible order subtotal.',
    };
  }

  return {
    valid: true,
    pointsToRedeem: requestedPoints,
    discountEgp,
    maxRedeemablePoints,
    updatedTotalEgp: Math.max(0, safeSubtotal - discountEgp),
  };
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

