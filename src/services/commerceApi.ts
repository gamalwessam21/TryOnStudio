import { API_BASE_URL, ApiError } from './fashionApi';
import type { ApiErrorPayload } from '../types/api';
import type {
  AppLanguage,
  AssistantChatResponse,
  AssistantContextSnapshot,
  AssistantStatusResponse,
  CreateOrderPayload,
  LoyaltyAccountSummary,
  LoyaltyRules,
  LoyaltyVerifyConfirmResponse,
  LoyaltyVerifyRequestResponse,
  PersistedOrder,
  StripePlatformStatus,
  StripeSessionVerification,
} from '../types/commerce';

function resolveCommerceBaseUrl(): string {
  const custom = import.meta.env.VITE_COMMERCE_API_BASE_URL?.trim();
  if (custom) {
    return custom.replace(/\/+$/, '');
  }
  return API_BASE_URL;
}

export const COMMERCE_API_BASE_URL = resolveCommerceBaseUrl();

interface JsonRequestOptions {
  baseUrl?: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function jsonRequest<T>(
  path: string,
  options: JsonRequestOptions = {}
): Promise<T> {
  const {
    baseUrl = '',
    method = 'GET',
    body,
    headers: customHeaders = {},
    timeoutMs = 26_000,
    signal: externalSignal,
  } = options;

  const controller = new AbortController();
  let timedOut = false;
  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onAbort, { once: true });
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...customHeaders,
  };

  let fetchBody: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  } else if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    fetchBody = '{}';
  }

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: fetchBody,
      signal: controller.signal,
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson =
      contentType.includes('application/json') ||
      contentType.includes('text/json');

    let parsed: unknown = null;
    if (isJson) {
      parsed = await res.json().catch(() => null);
    } else {
      const text = await res.text().catch(() => '');
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }
      }
    }

    if (!res.ok) {
      const errData = (parsed ?? {}) as ApiErrorPayload;
      const validationMsg = errData.errors
        ? Object.values(errData.errors).flat().join(' ')
        : '';
      const serverMsg =
        errData.error?.trim() ||
        validationMsg ||
        `Request failed with status ${res.status}.`;
      throw new ApiError(
        serverMsg,
        res.status,
        errData.code ?? null,
        errData.errors ?? null
      );
    }

    return parsed as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (timedOut) {
        throw new ApiError(
          'The server took too long to respond. Please try again.',
          408
        );
      }
      throw err;
    }
    throw new ApiError(
      'Unable to reach the server. Please check your connection and try again.',
      0
    );
  } finally {
    globalThis.clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onAbort);
    }
  }
}

export function isBackendEndpointMissing(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 404 || err.status === 405);
}

export const commerceApi = {
  /**
   * Checks server-side Gemini assistant readiness without exposing any credentials.
   */
  getAssistantStatus(signal?: AbortSignal): Promise<AssistantStatusResponse> {
    return jsonRequest<AssistantStatusResponse>('/api/assistant/chat', {
      baseUrl: '',
      signal,
    });
  },

  /**
   * Sends session chat history + safe garment/catalog context to the server-side
   * Google Gemini endpoint (/api/assistant/chat).
   */
  sendAssistantMessage(
    params: {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      language: AppLanguage;
      context?: AssistantContextSnapshot;
    },
    signal?: AbortSignal
  ): Promise<AssistantChatResponse> {
    return jsonRequest<AssistantChatResponse>('/api/assistant/chat', {
      baseUrl: '',
      method: 'POST',
      body: params,
      timeoutMs: 32_000,
      signal,
    });
  },

  /**
   * Queries Vercel server-side Stripe Sandbox readiness & USD->EGP conversion rate.
   */
  getStripePlatformStatus(signal?: AbortSignal): Promise<StripePlatformStatus> {
    return jsonRequest<StripePlatformStatus>('/api/payments/stripe', {
      baseUrl: '',
      signal,
    });
  },

  /**
   * Verifies a Stripe Checkout session server-side using STRIPE_SECRET_KEY.
   */
  verifyStripeSession(
    sessionId: string,
    signal?: AbortSignal
  ): Promise<StripeSessionVerification> {
    return jsonRequest<StripeSessionVerification>(
      `/api/payments/stripe?sessionId=${encodeURIComponent(sessionId)}`,
      {
        baseUrl: '',
        signal,
      }
    );
  },

  /**
   * Creates a hosted Stripe Checkout session for an already-persisted backend order.
   */
  createStripeCheckoutSession(
    params: {
      orderNumber: string;
      fashionItemId: number;
      variantId: number | null;
      size: string | null;
      quantity: number;
      verifiedDiscountEgp: number;
      idempotencyKey: string;
    },
    signal?: AbortSignal
  ): Promise<{ sessionId: string; checkoutUrl: string; mode: string }> {
    return jsonRequest<{ sessionId: string; checkoutUrl: string; mode: string }>(
      '/api/payments/stripe',
      {
        baseUrl: '',
        method: 'POST',
        body: params,
        signal,
      }
    );
  },

  /**
   * Persists a new order on the authoritative backend with an Idempotency-Key header.
   */
  createOrder(
    payload: CreateOrderPayload,
    idempotencyKey: string,
    signal?: AbortSignal
  ): Promise<PersistedOrder> {
    return jsonRequest<PersistedOrder>('/api/orders', {
      baseUrl: COMMERCE_API_BASE_URL,
      method: 'POST',
      body: payload,
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      signal,
    });
  },

  /**
   * Re-fetches a persisted order & digital receipt from the backend.
   */
  getOrder(
    orderNumber: string,
    receiptAccessToken?: string | null,
    signal?: AbortSignal
  ): Promise<PersistedOrder> {
    const headers: Record<string, string> = {};
    if (receiptAccessToken) {
      headers['X-Receipt-Token'] = receiptAccessToken;
    }
    return jsonRequest<PersistedOrder>(
      `/api/orders/${encodeURIComponent(orderNumber)}`,
      {
        baseUrl: COMMERCE_API_BASE_URL,
        headers,
        signal,
      }
    );
  },

  /**
   * Notifies the backend to verify and record a completed Stripe Checkout session against the order.
   */
  confirmOrderStripeSession(
    orderNumber: string,
    sessionId: string,
    signal?: AbortSignal
  ): Promise<PersistedOrder> {
    return jsonRequest<PersistedOrder>(
      `/api/orders/${encodeURIComponent(orderNumber)}/verify-payment`,
      {
        baseUrl: COMMERCE_API_BASE_URL,
        method: 'POST',
        body: { sessionId },
        signal,
      }
    );
  },

  /**
   * Fetches configurable loyalty earning & redemption rules from the backend.
   */
  getLoyaltyRules(signal?: AbortSignal): Promise<LoyaltyRules> {
    return jsonRequest<LoyaltyRules>('/api/loyalty/rules', {
      baseUrl: COMMERCE_API_BASE_URL,
      signal,
    });
  },

  /**
   * Initiates customer identity verification (OTP / verification code) before allowing
   * access to or redemption of an existing points balance.
   */
  requestLoyaltyVerification(
    phone: string,
    signal?: AbortSignal
  ): Promise<LoyaltyVerifyRequestResponse> {
    return jsonRequest<LoyaltyVerifyRequestResponse>(
      '/api/loyalty/verify-request',
      {
        baseUrl: COMMERCE_API_BASE_URL,
        method: 'POST',
        body: { phone },
        signal,
      }
    );
  },

  /**
   * Confirms the verification code and obtains a short-lived customer loyalty token + ledger summary.
   */
  confirmLoyaltyVerification(
    phone: string,
    code: string,
    signal?: AbortSignal
  ): Promise<LoyaltyVerifyConfirmResponse> {
    return jsonRequest<LoyaltyVerifyConfirmResponse>(
      '/api/loyalty/verify-confirm',
      {
        baseUrl: COMMERCE_API_BASE_URL,
        method: 'POST',
        body: { phone, code },
        signal,
      }
    );
  },

  /**
   * Fetches authoritative points balance and ledger activity using a verified customer token.
   */
  getLoyaltyAccount(
    verificationToken: string,
    signal?: AbortSignal
  ): Promise<LoyaltyAccountSummary> {
    return jsonRequest<LoyaltyAccountSummary>('/api/loyalty/account', {
      baseUrl: COMMERCE_API_BASE_URL,
      headers: {
        Authorization: `Bearer ${verificationToken}`,
      },
      signal,
    });
  },
};

