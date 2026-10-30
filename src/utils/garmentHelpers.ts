import type {
  Category,
  FashionItemDetails,
  FashionVariant,
  SizeScanConfidence,
} from '../types/api';

const ELIGIBLE_TOP_KEYWORDS = [
  't-shirt',
  't-shirts',
  'tee',
  'polo',
  'polo shirts',
  'hoodie',
  'hoodies',
  'sweatshirt',
  'sweatshirts',
  'jacket',
  'jackets',
];

/**
 * Determines whether a category represents an upper-body garment (top)
 * supported by the AI camera-based size scanner.
 */
export function isTopCategory(
  categoryName?: string | null,
  categorySlug?: string | null
): boolean {
  const combined = `${categoryName ?? ''} ${categorySlug ?? ''}`.toLowerCase();
  if (!combined.trim()) return false;
  return ELIGIBLE_TOP_KEYWORDS.some((kw) => combined.includes(kw));
}

export interface SizeScanEligibility {
  eligible: boolean;
  reason?: string;
}

/**
 * Checks whether a specific product supports camera-based size scanning.
 * Requires both an eligible top category AND at least one manufactured size.
 */
export function getSizeScanEligibility(
  item: FashionItemDetails | null,
  categories?: Category[]
): SizeScanEligibility {
  if (!item) {
    return {
      eligible: false,
      reason: 'Select a clothing item first to check size scan support.',
    };
  }

  const matchedCategory = categories?.find((c) => c.id === item.categoryId);
  const topEligible = isTopCategory(
    item.categoryName || matchedCategory?.name,
    matchedCategory?.slug
  );

  if (!topEligible) {
    return {
      eligible: false,
      reason:
        'Camera size scanning supports tops only (T-Shirts, Polo Shirts, Hoodies, and Jackets).',
    };
  }

  if (!item.availableSizes || item.availableSizes.length === 0) {
    return {
      eligible: false,
      reason: "Sizes aren't available for this item.",
    };
  }

  return { eligible: true };
}

/**
 * Builds an accurate Decart virtual try-on prompt using the backend's
 * `tryOnPrompt` when provided, or a clean non-fabricated fallback derived
 * strictly from the selected item's category, color, and name.
 */
export function buildTryOnPrompt(
  item: Pick<FashionItemDetails, 'name' | 'categoryName'>,
  variant: Pick<FashionVariant, 'colorName' | 'tryOnPrompt'>
): string {
  const customPrompt = variant.tryOnPrompt?.trim();
  if (customPrompt) {
    return customPrompt;
  }

  const catLower = (item.categoryName || '').toLowerCase();
  let garmentNoun = 'top';
  if (catLower.includes('polo')) {
    garmentNoun = 'polo shirt';
  } else if (catLower.includes('hoodie') || catLower.includes('sweatshirt')) {
    garmentNoun = 'hoodie';
  } else if (catLower.includes('jacket')) {
    garmentNoun = 'jacket';
  } else if (catLower.includes('t-shirt') || catLower.includes('tee')) {
    garmentNoun = 't-shirt';
  }

  const colorPart = variant.colorName?.trim() ? `${variant.colorName.trim()} ` : '';
  const namePart = item.name?.trim() ? ` (${item.name.trim()})` : '';

  return `Substitute the current top with a ${colorPart}${garmentNoun}${namePart}.`;
}

export function formatPrice(price: number | null | undefined): string {
  if (typeof price !== 'number' || Number.isNaN(price)) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

export type NormalizedConfidence = 'high' | 'medium' | 'low' | 'unavailable';

export function normalizeConfidence(
  confidence: SizeScanConfidence | null | undefined
): NormalizedConfidence {
  if (!confidence) return 'unavailable';
  const normalized = confidence.trim().toLowerCase();
  if (normalized === 'high') return 'high';
  if (normalized === 'medium' || normalized === 'med') return 'medium';
  if (normalized === 'low') return 'low';
  return 'unavailable';
}

