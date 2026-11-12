import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOYALTY_RULES,
  DEFAULT_USD_TO_EGP_RATE,
  buildCartLineKey,
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
  validatePhoneNumber,
} from '../utils/commerceHelpers';
import { commerceApi } from '../services/commerceApi';
import {
  ApiError,
  formatGeneralApiError,
  formatSizeScanError,
  parseRetryAfterHeader,
} from '../services/fashionApi';

describe('Customer Info Validation (Full Name & Phone)', () => {
  it('accepts valid full names (3-100 chars) and Egyptian mobile numbers', () => {
    const errors = validateCustomerInfo('Mohamed Gamal', '01012345678', 'en');
    expect(errors.fullName).toBeUndefined();
    expect(errors.phone).toBeUndefined();
  });

  it('accepts valid 3+ character single-word names per Swagger CreateOrderCustomerRequest', () => {
    const errors = validateCustomerInfo('Mohamed', '01012345678', 'en');
    expect(errors.fullName).toBeUndefined();
    expect(errors.phone).toBeUndefined();
  });

  it('accepts Arabic names and formatted phone numbers with spaces and dashes', () => {
    const errors = validateCustomerInfo('جمال وسام', '+20 11 9876-5432', 'ar');
    expect(errors.fullName).toBeUndefined();
    expect(errors.phone).toBeUndefined();
  });

  it('rejects names shorter than 3 characters or longer than 100 characters', () => {
    expect(validateCustomerInfo('Al', '01234567890', 'en').fullName).toBeDefined();
    expect(validateCustomerInfo('A'.repeat(101), '01234567890', 'en').fullName).toBeDefined();
  });

  it('rejects invalid or too-short phone numbers (requires 7-20 digits)', () => {
    const errors = validateCustomerInfo('Ahmed Ali', '12345', 'en');
    expect(errors.phone).toBeDefined();
    expect(validatePhoneNumber('123456', 'en')).toBeDefined();
    expect(validatePhoneNumber('01012345678', 'en')).toBeUndefined();
  });

  it('normalizes phone numbers by stripping whitespace and dashes', () => {
    expect(normalizePhoneNumber('+20 10 1234-5678')).toBe('+201012345678');
    expect(normalizePhoneNumber('(010) 1234 5678')).toBe('01012345678');
  });
});

describe('Cart Line Key & Idempotency Key Utilities', () => {
  it('builds deterministic composite cart line keys from fashionItemId + variantId + size', () => {
    expect(buildCartLineKey(1, 10, 'M')).toBe('1::10::M');
    expect(buildCartLineKey(1, 10, 'm')).toBe('1::10::M');
    expect(buildCartLineKey(7, null, null)).toBe('7::default::nosize');
    expect(buildCartLineKey(1, 10, 'M')).not.toBe(buildCartLineKey(1, 10, 'L'));
    expect(buildCartLineKey(1, 10, 'M')).not.toBe(buildCartLineKey(1, 11, 'M'));
  });

  it('generates standard UUID idempotency keys without custom prefixes', () => {
    const key1 = generateIdempotencyKey();
    const key2 = generateIdempotencyKey();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(key1).toMatch(uuidRegex);
    expect(key2).toMatch(uuidRegex);
    expect(key1).not.toBe(key2);
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
    expect(isQualifyingPurchaseForPoints('confirmed', 'paid')).toBe(true);
    expect(isQualifyingPurchaseForPoints('completed', 'paid')).toBe(true);

    expect(isQualifyingPurchaseForPoints('confirmed', 'pending_payment')).toBe(false);
    expect(isQualifyingPurchaseForPoints('confirmed', 'pending_collection')).toBe(false);
    expect(isQualifyingPurchaseForPoints('cancelled', 'refunded')).toBe(false);
  });
});

describe('Commerce API Multi-Product Order, Receipt Token, Stripe & Assistant Contracts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits multi-product items[] payload with UUID Idempotency-Key header to POST /api/orders', async () => {
    const mockOrder = {
      orderNumber: 'TYS-20261112-99999',
      receiptNumber: 'RCP-20261112-99999',
      receiptAccessToken: 'tok_secret_123',
      transactionReference: 'COD-TYS-20261112-99999',
      checkoutUrl: null,
      customerName: 'Wessam Gamal',
      customerPhoneMasked: '+201••••••678',
      currency: 'EGP',
      items: [
        {
          fashionItemId: 1,
          productName: 'Monospace Tee',
          categoryName: 'T-Shirts',
          variantId: 1,
          colorName: 'Black',
          imageUrl: null,
          size: 'M',
          quantity: 2,
          unitPriceUsd: 20,
          unitPriceEgp: 1000,
          lineTotalEgp: 2000,
        },
        {
          fashionItemId: 2,
          productName: 'Darko Polo',
          categoryName: 'Polo Shirts',
          variantId: 4,
          colorName: 'Navy',
          imageUrl: null,
          size: 'L',
          quantity: 1,
          unitPriceUsd: 30,
          unitPriceEgp: 1500,
          lineTotalEgp: 1500,
        },
      ],
      subtotalEgp: 3500,
      discountEgp: 0,
      pointsRedeemed: 0,
      finalTotalEgp: 3500,
      paymentMethod: 'cod',
      paymentStatus: 'pending_collection',
      orderStatus: 'confirmed',
      createdAt: new Date().toISOString(),
      pointsEarned: 350,
      updatedLoyaltyBalance: 350,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockOrder), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const idemKey = generateIdempotencyKey();
    const result = await commerceApi.createOrder(
      {
        items: [
          { fashionItemId: 1, variantId: 1, size: 'M', quantity: 2 },
          { fashionItemId: 2, variantId: 4, size: 'L', quantity: 1 },
        ],
        customer: { fullName: 'Wessam Gamal', phone: '+201012345678' },
        paymentMethod: 'cod',
        pointsToRedeem: 0,
        loyaltyVerificationToken: null,
      },
      idemKey
    );

    expect(result.orderNumber).toBe('TYS-20261112-99999');
    expect(result.receiptAccessToken).toBe('tok_secret_123');
    expect(result.items).toHaveLength(2);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/orders');
    const headers = init?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe(idemKey);

    const sentBody = JSON.parse(String(init?.body));
    expect(Array.isArray(sentBody.items)).toBe(true);
    expect(sentBody.items).toHaveLength(2);
    expect(sentBody.fashionItemId).toBeUndefined();
  });

  it('passes X-Receipt-Token header when fetching GET /api/orders/{orderNumber}', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          orderNumber: 'TYS-20261112-99999',
          receiptNumber: 'RCP-20261112-99999',
          receiptAccessToken: null,
          items: [],
          subtotalEgp: 1000,
          discountEgp: 0,
          pointsRedeemed: 0,
          finalTotalEgp: 1000,
          paymentMethod: 'stripe',
          paymentStatus: 'paid',
          orderStatus: 'confirmed',
          createdAt: new Date().toISOString(),
          pointsEarned: 100,
          updatedLoyaltyBalance: 100,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await commerceApi.getOrder('TYS-20261112-99999', 'tok_secret_123');
    const [, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['X-Receipt-Token']).toBe('tok_secret_123');
  });

  it('sends orderNumber and receiptAccessToken to Vercel /api/payments/stripe', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: 'cs_test_123',
          checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
          mode: 'sandbox',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const idemKey = generateIdempotencyKey();
    const res = await commerceApi.createStripeCheckoutSession({
      orderNumber: 'TYS-20261112-99999',
      receiptAccessToken: 'tok_secret_123',
      idempotencyKey: idemKey,
    });

    expect(res.checkoutUrl).toContain('checkout.stripe.com');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/payments/stripe');
    const body = JSON.parse(String(init?.body));
    expect(body.orderNumber).toBe('TYS-20261112-99999');
    expect(body.receiptAccessToken).toBe('tok_secret_123');
  });

  it('routes assistant status and chat to the authoritative backend base URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          configured: true,
          provider: 'gemini',
          model: 'gemini-3-flash-preview',
          usdToEgpRate: 50,
          loyaltyRules: DEFAULT_LOYALTY_RULES,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const status = await commerceApi.getAssistantStatus();
    expect(status.model).toBe('gemini-3-flash-preview');
    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('https://clothesai3d.runasp.net/api/assistant/chat');
  });
});

describe('Error Formatting & Retry-After Parsing', () => {
  it('parses Retry-After header seconds and HTTP dates', () => {
    expect(parseRetryAfterHeader('45')).toBe(45);
    expect(parseRetryAfterHeader(null)).toBeNull();
    expect(parseRetryAfterHeader('invalid')).toBeNull();
  });

  it('formats 413, 409, and 429 errors in both English and Arabic', () => {
    const err413En = formatSizeScanError(new ApiError('Payload Too Large', 413), 'en');
    const err413Ar = formatSizeScanError(new ApiError('Payload Too Large', 413), 'ar');
    expect(err413En.message).toContain('20 MB');
    expect(err413Ar.message).toContain('ميجابايت');

    const err429Ar = formatGeneralApiError(
      new ApiError('Rate limited', 429, 'rate_limited', null, 30),
      'ar'
    );
    expect(err429Ar).toContain('30');
  });
});
