import { generateIdempotencyKey } from './commerceHelpers';

// Idempotency keys are not secrets. Each order's key (the one sent with POST /api/orders) is
// remembered by order number, so a Stripe retry reuses the same key as the order creation.
// Receipt access tokens and loyalty verification tokens are never stored here.
const STORAGE_KEY = 'tryonstudio_order_idempotency_keys';
const MAX_ENTRIES = 50;

type KeyMap = Record<string, string>;

function readMap(): KeyMap {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return {};
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as KeyMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: KeyMap): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const kept = Object.entries(map).slice(-MAX_ENTRIES);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Storage unavailable: the key still applies to the current request.
  }
}

export function rememberOrderIdempotencyKey(orderNumber: string, idempotencyKey: string): void {
  const map = readMap();
  delete map[orderNumber];
  map[orderNumber] = idempotencyKey;
  writeMap(map);
}

export function getOrderIdempotencyKey(orderNumber: string): string | null {
  const value = readMap()[orderNumber];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Returns the key used when this order was created. Only generates a new key when none is known.
export function getOrCreateOrderIdempotencyKey(orderNumber: string): string {
  const existing = getOrderIdempotencyKey(orderNumber);
  if (existing) return existing;
  const created = generateIdempotencyKey();
  rememberOrderIdempotencyKey(orderNumber, created);
  return created;
}