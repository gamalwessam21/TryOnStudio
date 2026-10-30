import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  SwipeDetector,
  type PoseLandmarkPoint,
} from '../features/tryon/swipeDetector';
import {
  buildTryOnPrompt,
  formatPrice,
  getSizeScanEligibility,
  normalizeConfidence,
} from '../utils/garmentHelpers';
import {
  ApiError,
  fashionApi,
  formatSizeScanError,
  SIZE_SCAN_LIMITS,
} from '../services/fashionApi';

function createBasePose(): PoseLandmarkPoint[] {
  const pts: PoseLandmarkPoint[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0.99,
  }));
  // Shoulders (indices 11, 12): 0.2 width -> 200px on 1000px wide video
  pts[11] = { x: 0.4, y: 0.3, visibility: 0.99 };
  pts[12] = { x: 0.6, y: 0.3, visibility: 0.99 };
  // Hips (indices 23, 24) at y = 0.65
  pts[23] = { x: 0.45, y: 0.65, visibility: 0.99 };
  pts[24] = { x: 0.55, y: 0.65, visibility: 0.99 };
  // Left wrist resting low below hips so only right wrist (16) moves
  pts[15] = { x: 0.35, y: 0.8, visibility: 0.99 };
  pts[16] = { x: 0.6, y: 0.4, visibility: 0.99 };
  return pts;
}

describe('SwipeDetector (MediaPipe hand-swipe gesture engine)', () => {
  it('recognizes a right-screen swipe as "next" and enforces cooldown', () => {
    const detector = new SwipeDetector();
    // In mirrored view, decreasing raw x (0.65 -> 0.40) moves right on screen (+250px > 0.85 * 200px)
    const xs = [0.65, 0.58, 0.5, 0.4];
    let triggered: string | null = null;

    xs.forEach((rawX, i) => {
      const lm = createBasePose();
      lm[16] = { x: rawX, y: 0.4, visibility: 0.95 };
      const res = detector.update(lm, 1000, 720, 1000 + i * 120);
      if (res) triggered = res;
    });

    expect(triggered).toBe('next');
    expect(detector.isCoolingDown(1500)).toBe(true);

    // Immediate swipe during 1500ms cooldown must be ignored
    const xs2 = [0.4, 0.5, 0.58, 0.68];
    let secondTrigger: string | null = null;
    xs2.forEach((rawX, i) => {
      const lm = createBasePose();
      lm[16] = { x: rawX, y: 0.4, visibility: 0.95 };
      const res = detector.update(lm, 1000, 720, 1600 + i * 100);
      if (res) secondTrigger = res;
    });
    expect(secondTrigger).toBeNull();
  });

  it('recognizes a left-screen swipe as "prev"', () => {
    const detector = new SwipeDetector();
    // Increasing raw x (0.38 -> 0.64) moves left on screen (-260px)
    const xs = [0.38, 0.46, 0.55, 0.64];
    let triggered: string | null = null;

    xs.forEach((rawX, i) => {
      const lm = createBasePose();
      lm[16] = { x: rawX, y: 0.42, visibility: 0.95 };
      const res = detector.update(lm, 1000, 720, 5000 + i * 100);
      if (res) triggered = res;
    });

    expect(triggered).toBe('prev');
  });

  it('ignores wrist movements below the hip line or mostly vertical raises', () => {
    const detector = new SwipeDetector();
    const xs = [0.68, 0.58, 0.48, 0.38];

    // Below hip line (y = 0.78 > hipY 0.65)
    xs.forEach((rawX, i) => {
      const lm = createBasePose();
      lm[16] = { x: rawX, y: 0.78, visibility: 0.95 };
      expect(detector.update(lm, 1000, 720, 100 + i * 100)).toBeNull();
    });

    // Steep diagonal/vertical raise (|dy| comparable to |dx|)
    const ys = [0.6, 0.5, 0.35, 0.2];
    xs.forEach((rawX, i) => {
      const lm = createBasePose();
      lm[16] = { x: rawX, y: ys[i], visibility: 0.95 };
      expect(detector.update(lm, 1000, 720, 2000 + i * 100)).toBeNull();
    });
  });
});

describe('Garment & Size Scan Helpers', () => {
  it('validates top category & availableSizes eligibility accurately', () => {
    expect(
      getSizeScanEligibility({
        id: 1,
        name: 'Monospace Tee',
        description: '',
        price: 20,
        categoryId: 1,
        categoryName: 'T-Shirts',
        variants: [],
        availableSizes: ['S', 'M', 'L'],
      })
    ).toEqual({ eligible: true });

    // Item with no sizes (e.g. Decart showcase item)
    expect(
      getSizeScanEligibility({
        id: 7,
        name: 'Decart T-Shirt',
        description: '',
        price: 45,
        categoryId: 1,
        categoryName: 'T-Shirts',
        variants: [],
        availableSizes: [],
      })
    ).toEqual({
      eligible: false,
      reason: "Sizes aren't available for this item.",
    });

    // Non-top category
    expect(
      getSizeScanEligibility({
        id: 99,
        name: 'Classic Chinos',
        description: '',
        price: 55,
        categoryId: 9,
        categoryName: 'Pants',
        variants: [],
        availableSizes: ['M', 'L'],
      })
    ).toEqual({
      eligible: false,
      reason:
        'Camera size scanning supports tops only (T-Shirts, Polo Shirts, Hoodies, and Jackets).',
    });
  });

  it('uses backend tryOnPrompt when provided and clean fallback when null', () => {
    expect(
      buildTryOnPrompt(
        { name: 'Decart Hoodie', categoryName: 'Hoodies & Sweatshirts' },
        {
          colorName: 'Navy Blue',
          tryOnPrompt: 'Substitute the current top with a navy blue hoodie.',
        }
      )
    ).toBe('Substitute the current top with a navy blue hoodie.');

    expect(
      buildTryOnPrompt(
        { name: 'Darko Polo', categoryName: 'Polo Shirts' },
        { colorName: 'Navy Blue', tryOnPrompt: null }
      )
    ).toBe('Substitute the current top with a Navy Blue polo shirt (Darko Polo).');
  });

  it('formats USD prices and confidence levels cleanly', () => {
    expect(formatPrice(44.99)).toBe('$44.99');
    expect(normalizeConfidence('HIGH')).toBe('high');
    expect(normalizeConfidence('low')).toBe('low');
    expect(normalizeConfidence('n/a')).toBe('unavailable');
  });
});

describe('Size Scan Upload Validation & Error Mapping', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enforces minimum (8) and maximum (40) frame count limits', async () => {
    const tooFew = Array.from(
      { length: 5 },
      () => new Blob(['abc'], { type: 'image/jpeg' })
    );
    await expect(fashionApi.scanSize(1, tooFew)).rejects.toThrow(/between 8 and 40/);

    const tooMany = Array.from(
      { length: 41 },
      () => new Blob(['abc'], { type: 'image/jpeg' })
    );
    await expect(fashionApi.scanSize(1, tooMany)).rejects.toThrow(/between 8 and 40/);
  });

  it('enforces single-frame 2 MB limit before uploading', async () => {
    const oversized = new Blob(
      [new Uint8Array(SIZE_SCAN_LIMITS.MAX_FRAME_BYTES + 10)],
      { type: 'image/jpeg' }
    );
    const frames = [
      oversized,
      ...Array.from({ length: 8 }, () => new Blob(['ok'], { type: 'image/jpeg' })),
    ];
    await expect(fashionApi.scanSize(1, frames)).rejects.toThrow(/2 MB/);
  });

  it('sends multipart FormData with repeated "frames" field and no manual Content-Type', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          size: 'M',
          alternative: 'L',
          borderline: true,
          sizeRange: 'M-L',
          confidence: 'high',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const validFrames = Array.from(
      { length: 10 },
      () => new Blob(['jpeg-bytes'], { type: 'image/jpeg' })
    );

    const res = await fashionApi.scanSize(1, validFrames);
    expect(res.size).toBe('M');
    expect(res.borderline).toBe(true);
    expect(res.sizeRange).toBe('M-L');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
    expect(init?.body).toBeInstanceOf(FormData);
    const sentFrames = (init?.body as FormData).getAll('frames');
    expect(sentFrames).toHaveLength(10);
  });

  it('maps documented size-scan HTTP error codes (422, 409, 502, 429, 400, 404)', () => {
    const err422 = formatSizeScanError(
      new ApiError('Please step back so your feet are visible.', 422, 'too_close')
    );
    expect(err422.message).toContain('Please step back');
    expect(err422.code).toBe('too_close');
    expect(err422.recoveryHint).toContain('1–2 metres');

    const err409 = formatSizeScanError(
      new ApiError('Item has no sizes', 409)
    );
    expect(err409.message).toBe("Sizes aren't available for this item.");

    const err502 = formatSizeScanError(
      new ApiError('Bad gateway', 502)
    );
    expect(err502.message).toBe(
      "We couldn't determine your size right now. Please try again later."
    );
  });
});

