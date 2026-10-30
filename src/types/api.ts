export interface HealthStatus {
  status: string | null;
  database: string | null;
  storage: string | null;
  products: number | null;
  mediaFiles: number | null;
  missingFiles: number | null;
  aiSizeService: string | null;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  itemCount: number;
}

export interface FashionItem {
  id: number;
  name: string;
  description: string;
  price: number;
  categoryId: number;
  categoryName: string;
  thumbnailUrl: string;
  variantCount: number;
}

export interface FashionVariant {
  id: number;
  colorName: string;
  colorHex: string;
  imageUrl: string;
  tryOnPrompt: string | null;
}

export interface FashionItemDetails {
  id: number;
  name: string;
  description: string;
  price: number;
  categoryId: number;
  categoryName: string;
  variants: FashionVariant[];
  availableSizes: string[];
}

export interface RackItem {
  id: string;
  name: string;
  price: number;
  frames: string[];
}

export interface SizeCheckResult {
  fashionItemId: number;
  requestedSize: string;
  isAvailable: boolean;
  availableSizes: string[];
  nearestAvailableSizes: string[];
}

export type SizeScanConfidence = 'high' | 'medium' | 'low' | 'n/a' | string;

export interface SizeScanResult {
  size: string | null;
  alternative: string | null;
  borderline: boolean;
  sizeRange: string | null;
  confidence: SizeScanConfidence | null;
}

export interface TryOnToken {
  apiKey: string;
  expiresAt: string;
}

export type SizeScanErrorCode =
  | 'no_pose'
  | 'too_close'
  | 'turned'
  | 'bad_height'
  | string;

export interface ApiErrorPayload {
  error?: string | null;
  errors?: Record<string, string[]> | null;
  code?: SizeScanErrorCode | null;
}

