import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOYALTY_RULES,
  DEFAULT_USD_TO_EGP_RATE,
  calculateLoyaltyPointsEarned,
  convertUsdToEgp,
  evaluatePointsRedemption,
  formatDualPrice,
  formatEgp,
  generateIdempotencyKey,
  isQualifyingPurchaseForPoints,
  maskPhoneNumber,
  normalizePhoneNumber,
  validateCustomerInfo,
} from '../utils/commerceHelpers';

describe('Customer Info Validation (Full Name & Phone)', () => {
  it('accepts valid full names and Egyptian mobile numbers', () => {
    const errors = validateCustomerInfo('Mohamed Gamal', '01012345678', 'en');
    expect(errors.fullName).toBeUndefined();
    expect(errors.phone).toBeUndefined();
  });

  it('accepts Arabic names and formatted phone numbers with spaces and dashes', () => {
    const errors = validateCustomerInfo('جمال وسام', '+20 11 9876-5432', 'ar');
    expect(errors.fullName).toBeUndefined();
    expect(errors.phone).toBeUndefined();
  });

  it('rejects empty or single-character full names', () => {
    const errors = validateCustomerInfo('A', '01234567890', 'en');
    expect(errors.fullName).toBeDefined();
  });

  it('rejects single-word names (requires first and last name)', () => {
    const errors = validateCustomerInfo('Mohamed', '01012345678', 'en');
    expect(errors.fullName).toBeDefined();
  });

  it('rejects invalid or too-short phone numbers', () => {
    const errors = validateCustomerInfo('Ahmed Ali', '12345', 'en');
    expect(errors.phone).toBeDefined();
  });

  it('normalizes phone numbers by stripping whitespace and dashes', () => {
    expect(normalizePhoneNumber('+20 10 1234-5678')).toBe('+201012345678');
    expect(normalizePhoneNumber('(010) 1234 5678')).toBe('01012345678');
  });
});

describe('Phone Masking Utility', () => {
  it('masks middle digits with bullets for customer privacy', () => {
    const masked = maskPhoneNumber('01012345678');
    expect(masked).toBe('010••••••78');
    expect(masked.startsWith('010')).toBe(true);
    expect(masked.endsWith('78')).toBe(true);
  });

  it('handles international format cleanly', () => {
    const masked = maskPhoneNumber('+201012345678');
    expect(masked.startsWith('+201')).toBe(true);
    expect(masked.endsWith('78')).toBe(true);
  });

  it('handles empty strings gracefully returning placeholder', () => {
    expect(maskPhoneNumber('')).toBe('—');
  });
});

describe('Currency Conversion & Dual Price Formatting', () => {
  it('converts USD to EGP with default or custom exchange rates', () => {
    expect(convertUsdToEgp(30, DEFAULT_USD_TO_EGP_RATE)).toBe(1500);
    expect(convertUsdToEgp(45.5, 50)).toBe(2275);
    expect(convertUsdToEgp(0, 50)).toBe(0);
    expect(convertUsdToEgp(-10, 50)).toBe(0);
  });

  it('formats EGP with proper currency labels in both English and Arabic', () => {
    expect(formatEgp(2500, 'en')).toContain('2,500');
    expect(formatEgp(2500, 'en')).toContain('EGP');

    const arEgp = formatEgp(2500, 'ar');
    expect(arEgp).toContain('ج.م');
  });

  it('formats dual price (EGP and USD) clearly', () => {
    const dualEn = formatDualPrice(35, 50, 'en');
    expect(dualEn).toContain('1,750');
    expect(dualEn).toContain('EGP');
    expect(dualEn).toContain('$35.00');

    const dualAr = formatDualPrice(35, 50, 'ar');
    expect(dualAr).toContain('ج.م');
    expect(dualAr).toContain('$35.00');
  });
});

describe('Loyalty Rules & Points Mathematics', () => {
  it('calculates points earned strictly at 1 point per 10 EGP', () => {
    expect(calculateLoyaltyPointsEarned(1000, DEFAULT_LOYALTY_RULES)).toBe(100);
    expect(calculateLoyaltyPointsEarned(1255, DEFAULT_LOYALTY_RULES)).toBe(125);
    expect(calculateLoyaltyPointsEarned(9, DEFAULT_LOYALTY_RULES)).toBe(0);
    expect(calculateLoyaltyPointsEarned(0, DEFAULT_LOYALTY_RULES)).toBe(0);
  });

  it('evaluates points redemption correctly (100 pts = 10 EGP)', () => {
    const preview = evaluatePointsRedemption({
      requestedPoints: 500,
      availablePoints: 1000,
      subtotalEgp: 2000,
      rules: DEFAULT_LOYALTY_RULES,
    });

    expect(preview.valid).toBe(true);
    expect(preview.pointsToRedeem).toBe(500);
    expect(preview.discountEgp).toBe(50);
    expect(preview.updatedTotalEgp).toBe(1950);
  });

  it('rejects redemptions below minimum points threshold (100 pts)', () => {
    const preview = evaluatePointsRedemption({
      requestedPoints: 50,
      availablePoints: 1000,
      subtotalEgp: 2000,
      rules: DEFAULT_LOYALTY_RULES,
    });

    expect(preview.valid).toBe(false);
    expect(preview.discountEgp).toBe(0);
  });

  it('rejects redemptions that are not multiples of redemption block size (100 pts)', () => {
    const preview = evaluatePointsRedemption({
      requestedPoints: 450,
      availablePoints: 1000,
      subtotalEgp: 2000,
      rules: DEFAULT_LOYALTY_RULES,
    });

    expect(preview.valid).toBe(false);
    expect(preview.discountEgp).toBe(0);
  });

  it('rejects requested points exceeding available balance', () => {
    const preview = evaluatePointsRedemption({
      requestedPoints: 2000,
      availablePoints: 300,
      subtotalEgp: 2000,
      rules: DEFAULT_LOYALTY_RULES,
    });

    expect(preview.valid).toBe(false);
    expect(preview.pointsToRedeem).toBe(0);
  });

  it('evaluates qualifying purchase status truthfully', () => {
    // Only confirmed/completed orders with paid status qualify for points
    expect(isQualifyingPurchaseForPoints('confirmed', 'paid')).toBe(true);
    expect(isQualifyingPurchaseForPoints('completed', 'paid')).toBe(true);

    // Pending payment, collection, or cancelled orders do not qualify
    expect(isQualifyingPurchaseForPoints('confirmed', 'pending_payment')).toBe(false);
    expect(isQualifyingPurchaseForPoints('confirmed', 'pending_collection')).toBe(false);
    expect(isQualifyingPurchaseForPoints('cancelled', 'refunded')).toBe(false);
  });
});

describe('Idempotency Key Generator', () => {
  it('generates non-empty unique keys with custom prefix', () => {
    const key1 = generateIdempotencyKey('chk');
    const key2 = generateIdempotencyKey('chk');
    expect(key1.startsWith('chk-')).toBe(true);
    expect(key2.startsWith('chk-')).toBe(true);
    expect(key1).not.toBe(key2);
  });
});
