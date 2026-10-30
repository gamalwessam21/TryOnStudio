import type {
  ApiErrorPayload,
  Category,
  FashionItem,
  FashionItemDetails,
  FashionVariant,
  HealthStatus,
  RackItem,
  SizeCheckResult,
  SizeScanErrorCode,
  SizeScanResult,
  TryOnToken,
} from '../types/api';

const DEFAULT_TIMEOUT_MS = 25_000;
const SIZE_SCAN_TIMEOUT_MS = 65_000;

export const SIZE_SCAN_LIMITS = {
  MIN_FRAMES: 8,
  MAX_FRAMES: 40,
  MAX_FRAME_BYTES: 2 * 1024 * 1024, // 2 MB per image
  MAX_TOTAL_BYTES: 20 * 1024 * 1024, // 20 MB total upload
} as const;

function resolveBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!raw) {
    return 'https://clothesai3d.runasp.net';
  }
  return raw.replace(/\/+$/, '');
}

export const API_BASE_URL = resolveBaseUrl();

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: SizeScanErrorCode | null;
  public readonly validationErrors: Record<string, string[]> | null;

  constructor(
    message: string,
    status: number,
    code: SizeScanErrorCode | null = null,
    validationErrors: Record<string, string[]> | null = null
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.validationErrors = validationErrors;
  }
}

/**
 * Formats size-scan API errors into clear, documented user-facing guidance
 * without exposing internal server details.
 */
export function formatSizeScanError(err: unknown): {
  title: string;
  message: string;
  recoveryHint?: string;
  code?: string | null;
} {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return {
      title: 'Scan Cancelled',
      message: 'The size scan was cancelled or timed out.',
      recoveryHint: 'When ready, stand 1–2 metres back and try scanning again.',
    };
  }

  if (err instanceof ApiError) {
    switch (err.status) {
      case 422: {
        const codeHints: Record<string, string> = {
          no_pose:
            'Make sure you are standing in front of the camera in good lighting with your whole body in view.',
          too_close:
            'Step further back (1–2 metres away) or tilt your camera slightly so both your head and feet are visible.',
          turned:
            'Face the camera directly with your shoulders square and leave a small gap between your arms and body.',
          bad_height:
            'Ensure your full body from the top of your head down to your feet is unobstructed in the frame.',
        };
        const hint =
          (err.code && codeHints[err.code]) ||
          'Stand 1–2 metres back, keep your full body from head to feet visible, and face the camera directly.';
        return {
          title: 'Adjust Your Position',
          message:
            err.message ||
            'We could not clearly detect your full body posture from those frames.',
          recoveryHint: hint,
          code: err.code,
        };
      }
      case 400:
        return {
          title: 'Images Could Not Be Processed',
          message:
            'The captured camera frames could not be processed. Please make sure your camera is active and try again.',
          recoveryHint: 'Try restarting the scan while standing still in good lighting.',
        };
      case 404:
        return {
          title: 'Product Not Found',
          message: 'The selected clothing item could not be found on the server.',
          recoveryHint: 'Please select an available item from the catalog and try again.',
        };
      case 409:
        return {
          title: 'Sizes Unavailable',
          message: "Sizes aren't available for this item.",
        };
      case 429:
        return {
          title: 'Too Many Requests',
          message:
            'Too many size scan requests were made in a short period. Please wait a minute before trying again.',
        };
      case 502:
      case 503:
      case 504:
        return {
          title: 'Size Service Unavailable',
          message: "We couldn't determine your size right now. Please try again later.",
          recoveryHint:
            'The upstream AI size service may be waking up or temporarily offline.',
        };
      default:
        return {
          title: 'Size Scan Failed',
          message: "We couldn't determine your size right now. Please try again later.",
        };
    }
  }

  if (err instanceof Error) {
    return {
      title: 'Size Scan Issue',
      message: err.message,
    };
  }

  return {
    title: 'Size Scan Failed',
    message: "We couldn't determine your size right now. Please try again later.",
  };
}

/**
 * Formats general API errors into concise, user-safe messages.
 */
export function formatGeneralApiError(err: unknown, fallbackMessage: string): string {
  if (err instanceof ApiError) {
    if (err.status === 0) {
      return 'Unable to reach the Try On Studio server. Check your internet connection or CORS configuration.';
    }
    if (err.status === 429) {
      return 'Too many requests right now. Please wait a moment and try again.';
    }
    if (err.status >= 500) {
      return err.message || fallbackMessage;
    }
    if (err.validationErrors) {
      const details = Object.values(err.validationErrors).flat().join(' ');
      if (details) return details;
    }
    return err.message || fallbackMessage;
  }
  return fallbackMessage;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  formData?: FormData;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function createCombinedSignal(
  timeoutMs: number,
  externalSignal?: AbortSignal
): { signal: AbortSignal; cleanup: () => void; didTimeout: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;

  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const cleanup = () => {
    globalThis.clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  };

  return {
    signal: controller.signal,
    cleanup,
    didTimeout: () => timedOut,
  };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    formData,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
  } = options;

  const { signal, cleanup, didTimeout } = createCombinedSignal(timeoutMs, externalSignal);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  let fetchBody: BodyInit | undefined;
  if (formData) {
    // Do NOT set Content-Type manually for FormData; browser injects multipart boundary.
    fetchBody = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  } else if (method === 'POST') {
    // IIS/ASP.NET rejects bodyless POST requests without Content-Length (HTTP 411).
    headers['Content-Type'] = 'application/json';
    fetchBody = '{}';
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: fetchBody,
      signal,
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json') || contentType.includes('text/json');

    let parsed: unknown = null;
    if (isJson) {
      parsed = await response.json().catch(() => null);
    } else {
      const text = await response.text().catch(() => '');
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }
      }
    }

    if (!response.ok) {
      const errData = (parsed ?? {}) as ApiErrorPayload;
      const validationMsg = errData.errors
        ? Object.values(errData.errors).flat().join(' ')
        : '';
      const serverMessage =
        errData.error?.trim() ||
        validationMsg ||
        `Request failed with status ${response.status}.`;

      throw new ApiError(
        serverMessage,
        response.status,
        errData.code ?? null,
        errData.errors ?? null
      );
    }

    return parsed as T;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (didTimeout()) {
        throw new ApiError(
          'The server took too long to respond. Please try again.',
          408
        );
      }
      throw err;
    }
    throw new ApiError(
      'Network error while connecting to the Try On Studio backend.',
      0
    );
  } finally {
    cleanup();
  }
}

export const fashionApi = {
  getHealth(signal?: AbortSignal): Promise<HealthStatus> {
    return request<HealthStatus>('/api/health', { signal });
  },

  getCategories(signal?: AbortSignal): Promise<Category[]> {
    return request<Category[]>('/api/categories', { signal });
  },

  getCategoryItems(categoryId: number, signal?: AbortSignal): Promise<FashionItem[]> {
    return request<FashionItem[]>(
      `/api/categories/${encodeURIComponent(String(categoryId))}/fashion-items`,
      { signal }
    );
  },

  getFashionItems(
    params?: { categoryId?: number | null; search?: string },
    signal?: AbortSignal
  ): Promise<FashionItem[]> {
    const query = new URLSearchParams();
    if (params?.categoryId !== undefined && params.categoryId !== null) {
      query.set('categoryId', String(params.categoryId));
    }
    const trimmedSearch = params?.search?.trim();
    if (trimmedSearch) {
      query.set('search', trimmedSearch);
    }
    const qs = query.toString();
    return request<FashionItem[]>(`/api/fashion-items${qs ? `?${qs}` : ''}`, { signal });
  },

  getFashionItemDetails(id: number, signal?: AbortSignal): Promise<FashionItemDetails> {
    return request<FashionItemDetails>(
      `/api/fashion-items/${encodeURIComponent(String(id))}`,
      { signal }
    );
  },

  getFashionItemVariants(id: number, signal?: AbortSignal): Promise<FashionVariant[]> {
    return request<FashionVariant[]>(
      `/api/fashion-items/${encodeURIComponent(String(id))}/variants`,
      { signal }
    );
  },

  getRackItems(take = 6, signal?: AbortSignal): Promise<RackItem[]> {
    const clampedTake = Math.max(1, Math.min(20, Math.floor(take)));
    return request<RackItem[]>(`/api/fashion-items/rack?take=${clampedTake}`, { signal });
  },

  getSizes(signal?: AbortSignal): Promise<string[]> {
    return request<string[]>('/api/sizes', { signal });
  },

  getItemSizes(id: number, signal?: AbortSignal): Promise<string[]> {
    return request<string[]>(
      `/api/fashion-items/${encodeURIComponent(String(id))}/sizes`,
      { signal }
    );
  },

  checkSize(id: number, size: string, signal?: AbortSignal): Promise<SizeCheckResult> {
    return request<SizeCheckResult>(
      `/api/fashion-items/${encodeURIComponent(String(id))}/size-check`,
      {
        method: 'POST',
        body: { size: size.trim() },
        signal,
      }
    );
  },

  /**
   * Fetches a short-lived (~2 min) Decart client token from the backend.
   * Never persisted to localStorage or sessionStorage.
   */
  getTryOnToken(signal?: AbortSignal): Promise<TryOnToken> {
    return request<TryOnToken>('/api/tryon/token', {
      method: 'POST',
      signal,
    });
  },

  /**
   * Uploads 8–40 JPEG/PNG frames to the AI body size scan endpoint.
   * Validates frame counts and byte limits before initiating upload.
   */
  async scanSize(
    id: number,
    frames: Blob[],
    signal?: AbortSignal
  ): Promise<SizeScanResult> {
    if (
      frames.length < SIZE_SCAN_LIMITS.MIN_FRAMES ||
      frames.length > SIZE_SCAN_LIMITS.MAX_FRAMES
    ) {
      throw new Error(
        `Size scan requires between ${SIZE_SCAN_LIMITS.MIN_FRAMES} and ${SIZE_SCAN_LIMITS.MAX_FRAMES} captured frames (received ${frames.length}).`
      );
    }

    let totalBytes = 0;
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      if (!frame || frame.size === 0) {
        throw new Error(`Captured frame #${i + 1} was empty. Please retry the scan.`);
      }
      if (frame.size > SIZE_SCAN_LIMITS.MAX_FRAME_BYTES) {
        throw new Error(
          `Captured frame #${i + 1} exceeds the 2 MB single-image limit. Please retry.`
        );
      }
      totalBytes += frame.size;
    }

    if (totalBytes > SIZE_SCAN_LIMITS.MAX_TOTAL_BYTES) {
      throw new Error(
        'Captured frames exceed the 20 MB total upload limit. Please retry the scan.'
      );
    }

    const formData = new FormData();
    frames.forEach((blob, index) => {
      formData.append('frames', blob, `frame-${String(index).padStart(2, '0')}.jpg`);
    });

    return request<SizeScanResult>(
      `/api/fashion-items/${encodeURIComponent(String(id))}/size-scan`,
      {
        method: 'POST',
        formData,
        timeoutMs: SIZE_SCAN_TIMEOUT_MS,
        signal,
      }
    );
  },
};

