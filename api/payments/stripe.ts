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

interface BackendOrderItemDto {
  fashionItemId: number;
  productName?: string | null;
  categoryName?: string | null;
  variantId?: number | null;
  colorName?: string | null;
  imageUrl?: string | null;
  size?: string | null;
  quantity: number;
  unitPriceEgp: number;
  unitPriceUsd?: number;
  lineTotalEgp: number;
}

interface BackendOrderDto {
  orderNumber: string;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  orderStatus?: string | null;
  subtotalEgp: number;
  discountEgp: number;
  finalTotalEgp: number;
  items?: BackendOrderItemDto[] | null;
}

interface CreateStripeSessionBody {
  orderNumber?: unknown;
  receiptAccessToken?: unknown;
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
  const receiptAccessToken =
    typeof body.receiptAccessToken === 'string' && body.receiptAccessToken.trim()
      ? body.receiptAccessToken.trim()
      : null;
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

  const catalogBase = getCatalogBaseUrl();
  const origin = new URL(request.url).origin;
  const successUrl = `${origin}/orders/${encodeURIComponent(orderNumber)}?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/orders/${encodeURIComponent(orderNumber)}?payment=cancelled`;

  let finalTotalEgp = 0;
  let sessionProductName = `Try On Studio Order ${orderNumber}`;
  let sessionProductDescription: string | null = null;
  let sessionProductImage: string | null = null;
  let primaryFashionItemId: string | null = null;
  let primarySize: string | null = null;

  if (receiptAccessToken) {
    // New Multi-Product Authoritative Order Flow:
    // Fetch the persisted order directly from the ASP.NET backend using X-Receipt-Token.
    let backendOrder: BackendOrderDto;
    try {
      const orderRes = await fetch(
        `${catalogBase}/api/orders/${encodeURIComponent(orderNumber)}`,
        {
          headers: {
            Accept: 'application/json',
            'X-Receipt-Token': receiptAccessToken,
          },
        }
      );

      if (orderRes.status === 404) {
        return Response.json(
          {
            error: 'Order could not be verified on the backend or receipt token is invalid.',
            code: 'order_not_found',
          },
          { status: 404 }
        );
      }

      if (!orderRes.ok) {
        return Response.json(
          {
            error: 'Unable to verify order details from the backend.',
            code: 'backend_order_error',
          },
          { status: 502 }
        );
      }

      backendOrder = (await orderRes.json()) as BackendOrderDto;
    } catch (err) {
      console.error('[payments/stripe] Failed to fetch authoritative order:', err);
      return Response.json(
        {
          error: 'Unable to reach the order backend to verify payment amount.',
          code: 'backend_order_unreachable',
        },
        { status: 502 }
      );
    }

    if (!backendOrder || backendOrder.orderNumber !== orderNumber) {
      return Response.json(
        { error: 'Order verification mismatch.', code: 'order_mismatch' },
        { status: 400 }
      );
    }

    if ((backendOrder.paymentMethod ?? '').toLowerCase() !== 'stripe') {
      return Response.json(
        {
          error: 'This order is not configured for online card payment.',
          code: 'not_stripe_order',
        },
        { status: 400 }
      );
    }

    const paymentStatus = (backendOrder.paymentStatus ?? '').toLowerCase();
    const orderStatus = (backendOrder.orderStatus ?? '').toLowerCase();

    if (paymentStatus === 'paid') {
      return Response.json(
        {
          error: 'This order has already been paid.',
          code: 'order_already_paid',
        },
        { status: 409 }
      );
    }

    if (
      paymentStatus === 'cancelled' ||
      paymentStatus === 'refunded' ||
      orderStatus === 'cancelled' ||
      orderStatus === 'refunded'
    ) {
      return Response.json(
        {
          error: 'This order is no longer eligible for payment.',
          code: 'order_ineligible',
        },
        { status: 409 }
      );
    }

    finalTotalEgp = Math.round(Number(backendOrder.finalTotalEgp));
    const orderItems = Array.isArray(backendOrder.items) ? backendOrder.items : [];

    if (orderItems.length === 1) {
      const first = orderItems[0];
      const parts = [first.productName || `Item #${first.fashionItemId}`];
      if (first.colorName) parts.push(first.colorName);
      if (first.size) parts.push(`Size ${first.size}`);
      sessionProductName = `${parts.join(' — ')} (×${first.quantity})`;
      sessionProductImage = first.imageUrl ?? null;
      primaryFashionItemId = String(first.fashionItemId);
      primarySize = first.size ?? null;
    } else if (orderItems.length > 1) {
      const totalUnits = orderItems.reduce((sum, i) => sum + (i.quantity || 1), 0);
      sessionProductName = `Try On Studio Order ${orderNumber} (${orderItems.length} items, ${totalUnits} units)`;
      sessionProductDescription = orderItems
        .map(
          (i) =>
            `${i.productName || `Item #${i.fashionItemId}`}${
              i.colorName ? ` (${i.colorName})` : ''
            }${i.size ? ` [${i.size}]` : ''} ×${i.quantity}`
        )
        .join(', ')
        .slice(0, 450);
      sessionProductImage = orderItems[0]?.imageUrl ?? null;
      primaryFashionItemId = String(orderItems[0].fashionItemId);
      primarySize = orderItems[0].size ?? null;
    }
  } else {
    // Legacy Single-Item Fallback Contract for external/mobile callers
    const fashionItemId = Number(body.fashionItemId);
    const variantId =
      body.variantId !== undefined && body.variantId !== null
        ? Number(body.variantId)
        : null;
    const size =
      typeof body.size === 'string' && body.size.trim()
        ? body.size.trim()
        : null;
    const quantity = Math.floor(Number(body.quantity));
    const verifiedDiscountEgp = Math.max(0, Number(body.verifiedDiscountEgp || 0));

    if (
      !Number.isInteger(fashionItemId) ||
      fashionItemId <= 0 ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    ) {
      return Response.json(
        { error: 'Invalid product or quantity for payment session.', code: 'invalid_line_item' },
        { status: 400 }
      );
    }

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
    finalTotalEgp = Math.max(0, subtotalEgp - clampedDiscountEgp);

    const labelParts = [itemDetail.name];
    if (matchedVariant?.colorName) labelParts.push(matchedVariant.colorName);
    if (size) labelParts.push(`Size ${size}`);
    sessionProductName = `${labelParts.join(' — ')} (×${quantity})`;
    sessionProductImage = matchedVariant?.imageUrl ?? null;
    primaryFashionItemId = String(itemDetail.id);
    primarySize = size;
  }

  // Stripe requires positive charge amount in piastres (1 EGP = 100 piastres)
  if (!Number.isFinite(finalTotalEgp) || finalTotalEgp <= 0) {
    return Response.json(
      { error: 'Final payable total is zero; online card payment is not needed.', code: 'zero_payable_total' },
      { status: 400 }
    );
  }

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', successUrl);
  params.set('cancel_url', cancelUrl);
  params.set('client_reference_id', orderNumber);
  params.set('metadata[orderNumber]', orderNumber);
  if (primaryFashionItemId) {
    params.set('metadata[fashionItemId]', primaryFashionItemId);
  }
  if (primarySize) {
    params.set('metadata[size]', primarySize);
  }
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', 'egp');
  params.set('line_items[0][price_data][unit_amount]', String(finalTotalEgp * 100));
  params.set('line_items[0][price_data][product_data][name]', sessionProductName);
  if (sessionProductDescription) {
    params.set(
      'line_items[0][price_data][product_data][description]',
      sessionProductDescription
    );
  }
  if (sessionProductImage) {
    params.set('line_items[0][price_data][product_data][images][0]', sessionProductImage);
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
