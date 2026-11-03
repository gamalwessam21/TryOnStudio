interface CatalogDetailResponse {
  id: number;
  name: string;
  price: number;
  categoryName: string;
  variants?: Array<{
    id: number;
    colorName: string;
    imageUrl: string;
  }>;
  availableSizes?: string[];
}

interface CreateStripeSessionBody {
  orderNumber?: unknown;
  fashionItemId?: unknown;
  variantId?: unknown;
  size?: unknown;
  quantity?: unknown;
  verifiedDiscountEgp?: unknown;
  idempotencyKey?: unknown;
}

function getCatalogBaseUrl(): string {
  const raw = process.env.VITE_API_BASE_URL?.trim();
  return raw ? raw.replace(/\/+$/, '') : 'https://clothesai3d.runasp.net';
}

function getUsdToEgpRate(): number {
  const parsed = Number(process.env.USD_TO_EGP_RATE);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

function getStripeConfig(): {
  configured: boolean;
  mode: 'sandbox' | 'live' | 'unconfigured';
  secretKey: string | null;
} {
  const sk = process.env.STRIPE_SECRET_KEY?.trim() || null;
  if (!sk) {
    return { configured: false, mode: 'unconfigured', secretKey: null };
  }
  const mode = sk.startsWith('sk_live_') ? 'live' : 'sandbox';
  return { configured: true, mode, secretKey: sk };
}

export async function GET(request: Request): Promise<Response> {
  const stripe = getStripeConfig();
  const usdToEgpRate = getUsdToEgpRate();
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId')?.trim();

  if (!sessionId) {
    return Response.json({
      stripeConfigured: stripe.configured,
      stripeMode: stripe.mode,
      usdToEgpRate,
      defaultLoyaltyRules: {
        earnUnitAmountEgp: 10,
        pointsEarnedPerUnit: 1,
        redemptionBlockPoints: 100,
        redemptionBlockValueEgp: 10,
        minRedemptionPoints: 100,
        maxRedemptionRatio: 1,
      },
    });
  }

  if (!stripe.secretKey) {
    return Response.json(
      { error: 'Stripe is not configured on the server.', code: 'stripe_unconfigured' },
      { status: 503 }
    );
  }

  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return Response.json(
      { error: 'Invalid Stripe session identifier.', code: 'invalid_session_id' },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: {
          Authorization: `Bearer ${stripe.secretKey}`,
        },
      }
    );

    if (!res.ok) {
      console.error('[payments/stripe] Session lookup failed:', res.status);
      return Response.json(
        { error: 'Could not verify Stripe Checkout session.', code: 'session_lookup_failed' },
        { status: res.status === 404 ? 404 : 502 }
      );
    }

    const session = (await res.json()) as {
      id: string;
      status: string;
      payment_status: string;
      amount_total: number | null;
      currency: string | null;
      payment_intent: string | null;
      metadata?: Record<string, string>;
    };

    return Response.json({
      sessionId: session.id,
      sessionStatus: session.status,
      paymentStatus: session.payment_status,
      amountTotalMinor: session.amount_total,
      currency: session.currency?.toUpperCase() ?? 'EGP',
      transactionReference:
        typeof session.payment_intent === 'string' ? session.payment_intent : session.id,
      orderNumber: session.metadata?.orderNumber ?? null,
    });
  } catch (err) {
    console.error('[payments/stripe] Error verifying Stripe session:', err);
    return Response.json(
      { error: 'Error communicating with Stripe.', code: 'stripe_network_error' },
      { status: 502 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const stripe = getStripeConfig();
  if (!stripe.secretKey) {
    console.error('[payments/stripe] STRIPE_SECRET_KEY is not configured.');
    return Response.json(
      { error: 'Online card checkout is not configured on the server.', code: 'stripe_unconfigured' },
      { status: 503 }
    );
  }

  let body: CreateStripeSessionBody;
  try {
    body = (await request.json()) as CreateStripeSessionBody;
  } catch {
    return Response.json(
      { error: 'Invalid JSON request body.', code: 'invalid_json' },
      { status: 400 }
    );
  }

  const orderNumber =
    typeof body.orderNumber === 'string' ? body.orderNumber.trim() : '';
  const fashionItemId = Number(body.fashionItemId);
  const variantId = body.variantId !== undefined && body.variantId !== null ? Number(body.variantId) : null;
  const size = typeof body.size === 'string' && body.size.trim() ? body.size.trim() : null;
  const quantity = Math.floor(Number(body.quantity));
  const verifiedDiscountEgp = Math.max(0, Number(body.verifiedDiscountEgp || 0));
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim().slice(0, 120)
      : `order-${orderNumber}`;

  if (!orderNumber || !/^[A-Za-z0-9_-]{4,64}$/.test(orderNumber)) {
    return Response.json(
      {
        error:
          'A persisted backend order number is required before initiating hosted Stripe payment.',
        code: 'missing_persisted_order',
      },
      { status: 400 }
    );
  }

  if (!Number.isInteger(fashionItemId) || fashionItemId <= 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    return Response.json(
      { error: 'Invalid product or quantity for payment session.', code: 'invalid_line_item' },
      { status: 400 }
    );
  }

  // Authoritative server-side price & variant lookup from the catalog backend
  const catalogBase = getCatalogBaseUrl();
  let itemDetail: CatalogDetailResponse;
  try {
    const itemRes = await fetch(
      `${catalogBase}/api/fashion-items/${encodeURIComponent(String(fashionItemId))}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!itemRes.ok) {
      return Response.json(
        { error: 'Selected catalog product could not be verified on the server.', code: 'item_not_found' },
        { status: 404 }
      );
    }
    itemDetail = (await itemRes.json()) as CatalogDetailResponse;
  } catch (err) {
    console.error('[payments/stripe] Failed to verify catalog item price:', err);
    return Response.json(
      { error: 'Unable to verify product price from catalog backend.', code: 'catalog_unreachable' },
      { status: 502 }
    );
  }

  if (
    Array.isArray(itemDetail.availableSizes) &&
    itemDetail.availableSizes.length > 0 &&
    (!size || !itemDetail.availableSizes.includes(size))
  ) {
    return Response.json(
      { error: 'Selected size is not offered for this product.', code: 'invalid_size' },
      { status: 400 }
    );
  }

  const matchedVariant =
    variantId !== null
      ? itemDetail.variants?.find((v) => v.id === variantId)
      : itemDetail.variants?.[0];

  const usdToEgpRate = getUsdToEgpRate();
  const unitPriceEgp = Math.round(itemDetail.price * usdToEgpRate);
  const subtotalEgp = unitPriceEgp * quantity;
  const clampedDiscountEgp = Math.min(subtotalEgp, Math.round(verifiedDiscountEgp));
  const finalTotalEgp = Math.max(0, subtotalEgp - clampedDiscountEgp);

  // Stripe requires positive charge amount in piastres (1 EGP = 100 piastres)
  if (finalTotalEgp <= 0) {
    return Response.json(
      { error: 'Final payable total is zero; online card payment is not needed.', code: 'zero_payable_total' },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  const successUrl = `${origin}/orders/${encodeURIComponent(orderNumber)}?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/orders/${encodeURIComponent(orderNumber)}?payment=cancelled`;

  const labelParts = [itemDetail.name];
  if (matchedVariant?.colorName) labelParts.push(matchedVariant.colorName);
  if (size) labelParts.push(`Size ${size}`);

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', successUrl);
  params.set('cancel_url', cancelUrl);
  params.set('client_reference_id', orderNumber);
  params.set('metadata[orderNumber]', orderNumber);
  params.set('metadata[fashionItemId]', String(itemDetail.id));
  if (size) params.set('metadata[size]', size);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', 'egp');
  params.set('line_items[0][price_data][unit_amount]', String(finalTotalEgp * 100));
  params.set('line_items[0][price_data][product_data][name]', `${labelParts.join(' — ')} (×${quantity})`);
  if (matchedVariant?.imageUrl) {
    params.set('line_items[0][price_data][product_data][images][0]', matchedVariant.imageUrl);
  }

  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripe.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `stripe-session-${idempotencyKey}`,
      },
      body: params.toString(),
    });

    const stripeData = (await stripeRes.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };

    if (!stripeRes.ok || !stripeData.url || !stripeData.id) {
      console.error('[payments/stripe] Stripe session creation failed:', stripeRes.status, stripeData.error?.message);
      return Response.json(
        {
          error: stripeData.error?.message || 'Could not start Stripe Hosted Checkout session.',
          code: 'stripe_session_failed',
        },
        { status: 502 }
      );
    }

    return Response.json({
      sessionId: stripeData.id,
      checkoutUrl: stripeData.url,
      mode: stripe.mode,
    });
  } catch (err) {
    console.error('[payments/stripe] Network error creating Stripe session:', err);
    return Response.json(
      { error: 'Unable to connect to Stripe Checkout right now.', code: 'stripe_network_error' },
      { status: 502 }
    );
  }
}

