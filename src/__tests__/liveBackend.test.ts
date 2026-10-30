// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ApiError, fashionApi } from '../services/fashionApi';

describe('Live Backend Integration Contract (https://clothesai3d.runasp.net)', () => {
  it(
    'verifies health, categories, products, details, variants, sizes, rack, size-check, and token error handling',
    async () => {
      const health = await fashionApi.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.products).toBeGreaterThanOrEqual(15);

      const categories = await fashionApi.getCategories();
      expect(categories.length).toBeGreaterThanOrEqual(4);

      const categoryItems = await fashionApi.getCategoryItems(categories[0].id);
      expect(categoryItems.length).toBeGreaterThan(0);

      const searchResults = await fashionApi.getFashionItems({ search: 'Darko' });
      expect(searchResults.some((i) => i.name.includes('Darko'))).toBe(true);

      const darkoId = searchResults[0].id;
      const details = await fashionApi.getFashionItemDetails(darkoId);
      expect(details.id).toBe(darkoId);
      expect(details.variants.length).toBeGreaterThan(0);

      const variants = await fashionApi.getFashionItemVariants(darkoId);
      expect(variants.length).toBe(details.variants.length);

      const allSizes = await fashionApi.getSizes();
      expect(allSizes).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']);

      const itemSizes = await fashionApi.getItemSizes(darkoId);
      expect(itemSizes).toEqual(details.availableSizes);

      // Darko Polo offers S, M, XXL -> checking L returns isAvailable: false + nearest M, XXL
      const checkL = await fashionApi.checkSize(darkoId, 'L');
      expect(checkL.isAvailable).toBe(false);
      expect(checkL.nearestAvailableSizes).toEqual(
        expect.arrayContaining(['M', 'XXL'])
      );

      const checkM = await fashionApi.checkSize(darkoId, 'M');
      expect(checkM.isAvailable).toBe(true);

      const rack = await fashionApi.getRackItems(6);
      expect(rack.length).toBeGreaterThan(0);
      expect(typeof rack[0].id).toBe('string');
      expect(Array.isArray(rack[0].frames)).toBe(true);

      // Verify /api/tryon/token either returns { apiKey, expiresAt } OR throws structured ApiError(502)
      try {
        const token = await fashionApi.getTryOnToken();
        expect(typeof token.apiKey).toBe('string');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(502);
      }

      // Verify /api/fashion-items/7/size-scan returns 409 for an item without sizes
      // Using minimal valid 1x1 PNG bytes repeated 8 times
      const minimalPng = Uint8Array.from([
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0,
        1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68,
        65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0,
        73, 69, 78, 68, 174, 66, 96, 130,
      ]);
      const eightBlankFrames = Array.from(
        { length: 8 },
        () => new Blob([minimalPng], { type: 'image/png' })
      );

      await expect(fashionApi.scanSize(7, eightBlankFrames)).rejects.toMatchObject({
        status: 409,
      });

      // Verify /api/fashion-items/1/size-scan with blank 1x1 images reaches AI size service (422 no_pose or 502)
      try {
        await fashionApi.scanSize(1, eightBlankFrames);
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect([400, 422, 502]).toContain(apiErr.status);
      }
    },
    45_000
  );
});

