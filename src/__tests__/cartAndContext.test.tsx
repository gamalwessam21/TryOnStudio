import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CART_STORAGE_KEY,
  CommerceProvider,
  RECEIPT_TOKENS_STORAGE_KEY,
  useCommerce,
  type CommerceContextValue,
} from '../app/CommerceContext';
import { StudioProvider } from '../app/StudioContext';
import { LanguageProvider, useLanguage } from '../i18n/LanguageContext';
import { CartPage } from '../app/pages/CartPage';
import { CheckoutPage } from '../app/pages/CheckoutPage';
import type { FashionItemDetails } from '../types/api';
import type { PersistedOrder } from '../types/commerce';

const mockTee: FashionItemDetails = {
  id: 1,
  name: 'Monospace Essential Tee',
  description: 'Premium cotton tee',
  price: 20,
  categoryId: 1,
  categoryName: 'T-Shirts',
  thumbnailUrl: 'https://clothesai3d.runasp.net/images/tee.png',
  availableSizes: ['S', 'M', 'L', 'XL'],
  variants: [
    {
      id: 101,
      colorName: 'Obsidian Black',
      colorHex: '#111827',
      imageUrl: 'https://clothesai3d.runasp.net/images/tee-black.png',
      tryOnPrompt: null,
    },
    {
      id: 102,
      colorName: 'Cloud White',
      colorHex: '#f8fafc',
      imageUrl: 'https://clothesai3d.runasp.net/images/tee-white.png',
      tryOnPrompt: null,
    },
  ],
};

const mockPolo: FashionItemDetails = {
  id: 2,
  name: 'Darko Performance Polo',
  description: 'Pique polo shirt',
  price: 30,
  categoryId: 2,
  categoryName: 'Polo Shirts',
  thumbnailUrl: 'https://clothesai3d.runasp.net/images/polo.png',
  availableSizes: ['M', 'L', 'XXL'],
  variants: [
    {
      id: 201,
      colorName: 'Navy Blue',
      colorHex: '#1e3a8a',
      imageUrl: 'https://clothesai3d.runasp.net/images/polo-navy.png',
      tryOnPrompt: null,
    },
  ],
};

describe('CommerceContext: Multi-Product Cart, Buy Now Isolation, Receipt Tokens & Localization', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latestCommerce: CommerceContextValue | null = null;
  let latestLang: ReturnType<typeof useLanguage> | null = null;

  function Harness() {
    latestCommerce = useCommerce();
    latestLang = useLanguage();
    return null;
  }

  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    window.sessionStorage.clear();
    latestCommerce = null;
    latestLang = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/health')) {
        return new Response(JSON.stringify({ status: 'healthy', products: 15 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/categories')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/sizes')) {
        return new Response(JSON.stringify(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/fashion-items/rack')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/fashion-items')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/assistant/status')) {
        return new Response(
          JSON.stringify({
            configured: true,
            provider: 'gemini',
            model: 'gemini-3-flash-preview',
            usdToEgpRate: 50,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/payments/stripe')) {
        return new Response(
          JSON.stringify({ configured: true, mode: 'sandbox', usdToEgpRate: 50 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  async function mountProviders() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <LanguageProvider>
            <StudioProvider>
              <CommerceProvider>
                <Harness />
              </CommerceProvider>
            </StudioProvider>
          </LanguageProvider>
        </MemoryRouter>
      );
    });
  }

  it('adds items, merges identical configurations, and rejects quantities > 20 without silent truncation', async () => {
    await mountProviders();
    expect(latestCommerce).not.toBeNull();

    // Add 12 units of Tee (Black, M)
    let res1: ReturnType<CommerceContextValue['addToCart']> | undefined;
    await act(async () => {
      res1 = latestCommerce!.addToCart({
        item: mockTee,
        variant: mockTee.variants[0],
        size: 'M',
        quantity: 12,
      });
    });
    expect(res1?.ok).toBe(true);
    expect(latestCommerce!.cartItems).toHaveLength(1);
    expect(latestCommerce!.cartItems[0].quantity).toBe(12);
    expect(latestCommerce!.cartTotalQuantity).toBe(12);

    // Add 5 more units of identical Tee (Black, M) -> merges to 17
    let res2: ReturnType<CommerceContextValue['addToCart']> | undefined;
    await act(async () => {
      res2 = latestCommerce!.addToCart({
        item: mockTee,
        variant: mockTee.variants[0],
        size: 'M',
        quantity: 5,
      });
    });
    expect(res2?.ok).toBe(true);
    expect(res2?.merged).toBe(true);
    expect(latestCommerce!.cartItems).toHaveLength(1);
    expect(latestCommerce!.cartItems[0].quantity).toBe(17);

    // Attempt to add 5 more units (17 + 5 = 22 > 20) -> must reject without silently discarding
    let res3: ReturnType<CommerceContextValue['addToCart']> | undefined;
    await act(async () => {
      res3 = latestCommerce!.addToCart({
        item: mockTee,
        variant: mockTee.variants[0],
        size: 'M',
        quantity: 5,
      });
    });
    expect(res3?.ok).toBe(false);
    expect(res3?.code).toBe('max_quantity_exceeded');
    expect(latestCommerce!.cartItems[0].quantity).toBe(17);
    expect(latestCommerce!.cartNotice).toContain('20');

    // Persisted in localStorage under tys.cart
    const persisted = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || '[]');
    expect(persisted).toHaveLength(1);
    expect(persisted[0].quantity).toBe(17);
  });

  it('keeps Buy Now (checkoutDraft) strictly isolated from tys.cart', async () => {
    await mountProviders();

    // Add Tee to cart
    await act(async () => {
      latestCommerce!.addToCart({
        item: mockTee,
        variant: mockTee.variants[0],
        size: 'M',
        quantity: 2,
      });
    });
    expect(latestCommerce!.cartItems).toHaveLength(1);
    expect(latestCommerce!.checkoutMode).toBe('cart');

    // Trigger Buy Now on Polo
    await act(async () => {
      latestCommerce!.prepareCheckoutFromItem({
        item: mockPolo,
        variant: mockPolo.variants[0],
        size: 'L',
        quantity: 1,
      });
    });

    expect(latestCommerce!.checkoutMode).toBe('buy_now');
    expect(latestCommerce!.checkoutDraft?.fashionItemId).toBe(2);
    // Saved cart must remain untouched!
    expect(latestCommerce!.cartItems).toHaveLength(1);
    expect(latestCommerce!.cartItems[0].fashionItemId).toBe(1);
    expect(latestCommerce!.cartItems[0].quantity).toBe(2);
  });

  it('preserves receiptAccessToken in tys.receiptTokens even when GET /api/orders returns null token', async () => {
    await mountProviders();

    const createdOrder: PersistedOrder = {
      orderNumber: 'TYS-20261112-77777',
      receiptNumber: 'RCP-20261112-77777',
      receiptAccessToken: 'tok_initial_secret_abc',
      transactionReference: null,
      checkoutUrl: null,
      customerName: 'Wessam Gamal',
      customerPhoneMasked: '+201••••••678',
      currency: 'EGP',
      items: [],
      subtotalEgp: 1000,
      discountEgp: 0,
      pointsRedeemed: 0,
      finalTotalEgp: 1000,
      paymentMethod: 'stripe',
      paymentStatus: 'pending_payment',
      orderStatus: 'pending',
      createdAt: new Date().toISOString(),
      pointsEarned: 0,
      updatedLoyaltyBalance: 0,
    };

    await act(async () => {
      latestCommerce!.recordConfirmedOrder(createdOrder);
    });

    expect(latestCommerce!.getReceiptToken('TYS-20261112-77777')).toBe('tok_initial_secret_abc');

    // Simulate subsequent GET /api/orders/{orderNumber} response where receiptAccessToken is null
    const refreshedOrder: PersistedOrder = {
      ...createdOrder,
      receiptAccessToken: null,
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
      pointsEarned: 100,
    };

    await act(async () => {
      latestCommerce!.recordConfirmedOrder(refreshedOrder);
    });

    // Token must still be preserved!
    expect(latestCommerce!.getReceiptToken('TYS-20261112-77777')).toBe('tok_initial_secret_abc');
    expect(
      latestCommerce!.recentConfirmedOrders['TYS-20261112-77777'].receiptAccessToken
    ).toBe('tok_initial_secret_abc');

    const storedMap = JSON.parse(
      window.localStorage.getItem(RECEIPT_TOKENS_STORAGE_KEY) || '{}'
    );
    expect(storedMap['TYS-20261112-77777']).toBe('tok_initial_secret_abc');
  });

  it('synchronizes language preference in tys_lang and updates document dir/lang', async () => {
    await mountProviders();
    expect(latestLang?.language).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');

    await act(async () => {
      latestLang!.setLanguage('ar');
    });

    expect(latestLang?.language).toBe('ar');
    expect(window.localStorage.getItem('tys_lang')).toBe('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('renders CartPage with populated cart items and catalog sync without infinite re-renders', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/cart']}>
          <LanguageProvider>
            <StudioProvider>
              <CommerceProvider>
                <Harness />
                <CartPage />
              </CommerceProvider>
            </StudioProvider>
          </LanguageProvider>
        </MemoryRouter>
      );
    });

    await act(async () => {
      latestCommerce!.addToCart({
        item: mockTee,
        variant: mockTee.variants[0],
        size: 'M',
        quantity: 2,
      });
    });

    expect(container.textContent).toContain('Monospace Essential Tee');
    expect(latestCommerce!.cartItems).toHaveLength(1);
    expect(latestCommerce!.cartItems[0].quantity).toBe(2);
  });

  it('keeps CheckoutPage empty until Proceed to Checkout (startCartCheckout) is triggered, and empties both on remove', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/checkout']}>
          <LanguageProvider>
            <StudioProvider>
              <CommerceProvider>
                <Harness />
                <CheckoutPage />
              </CommerceProvider>
            </StudioProvider>
          </LanguageProvider>
        </MemoryRouter>
      );
    });

    // 1. Add item to Cart without clicking "Proceed to Checkout" -> Checkout stays empty
    await act(async () => {
      latestCommerce!.addToCart({
        item: mockTee,
        variant: mockTee.variants[0],
        size: 'M',
        quantity: 1,
      });
    });
    expect(latestCommerce!.cartItems).toHaveLength(1);
    expect(latestCommerce!.cartCheckoutReady).toBe(false);
    expect(container.textContent).toContain('No garments selected for purchase');

    // 2. User clicks "Proceed to Checkout" in Cart -> startCartCheckout() populates CheckoutPage
    await act(async () => {
      latestCommerce!.startCartCheckout();
    });
    expect(latestCommerce!.cartCheckoutReady).toBe(true);
    expect(container.textContent).toContain('Monospace Essential Tee');

    // 3. Clicking the remove trash button empties both CheckoutPage and Cart
    const removeBtn = container.querySelector(
      'button[aria-label="Remove Monospace Essential Tee"]'
    ) as HTMLButtonElement | null;
    expect(removeBtn).not.toBeNull();

    await act(async () => {
      removeBtn!.click();
    });

    expect(latestCommerce!.cartItems).toHaveLength(0);
    expect(latestCommerce!.cartCheckoutReady).toBe(false);
    expect(container.textContent).toContain('No garments selected for purchase');
  });
});
