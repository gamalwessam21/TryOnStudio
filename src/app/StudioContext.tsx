import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fashionApi,
  formatGeneralApiError,
} from '../services/fashionApi';
import type {
  Category,
  FashionItem,
  FashionItemDetails,
  FashionVariant,
  HealthStatus,
  RackItem,
} from '../types/api';
import type { SwipeDirection } from '../features/tryon/swipeDetector';

export type HealthCheckState = 'checking' | 'healthy' | 'offline';

export interface StudioContextValue {
  // Backend health
  health: HealthStatus | null;
  healthState: HealthCheckState;
  refreshHealth: () => Promise<void>;

  // Categories & global sizes
  categories: Category[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  supportedSizes: string[];
  reloadCatalogMeta: () => Promise<void>;

  // Product list & filters
  selectedCategoryId: number | null;
  setSelectedCategoryId: (id: number | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  items: FashionItem[];
  allCatalogItems: FashionItem[];
  itemsLoading: boolean;
  itemsError: string | null;
  reloadItems: () => Promise<void>;

  // 360 Rack
  rackItems: RackItem[];
  rackLoading: boolean;
  rackError: string | null;
  reloadRack: () => Promise<void>;

  // Selected garment & variant
  selectedItemId: number | null;
  selectedItemDetails: FashionItemDetails | null;
  selectedVariant: FashionVariant | null;
  itemSizes: string[];
  detailsLoading: boolean;
  detailsError: string | null;
  outfitConfirmed: boolean;
  setOutfitConfirmed: (confirmed: boolean) => void;

  selectItem: (id: number, preferredVariantId?: number) => void;
  selectVariant: (variant: FashionVariant) => void;
  stepGarmentOrVariant: (direction: SwipeDirection) => Promise<{
    item: FashionItemDetails;
    variant: FashionVariant;
  } | null>;
  reloadSelectedDetails: () => Promise<void>;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Health state
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthState, setHealthState] = useState<HealthCheckState>('checking');

  // Categories & global sizes
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [supportedSizes, setSupportedSizes] = useState<string[]>([]);

  // Filters & catalog items
  const [selectedCategoryId, setSelectedCategoryIdState] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [items, setItems] = useState<FashionItem[]>([]);
  const [allCatalogItems, setAllCatalogItems] = useState<FashionItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState<boolean>(true);
  const [itemsError, setItemsError] = useState<string | null>(null);

  // Rack items
  const [rackItems, setRackItems] = useState<RackItem[]>([]);
  const [rackLoading, setRackLoading] = useState<boolean>(true);
  const [rackError, setRackError] = useState<string | null>(null);

  // Selected item details & variant
  const initialUrlItem = Number(searchParams.get('item'));
  const [selectedItemId, setSelectedItemId] = useState<number | null>(
    Number.isInteger(initialUrlItem) && initialUrlItem > 0 ? initialUrlItem : null
  );
  const [selectedItemDetails, setSelectedItemDetails] =
    useState<FashionItemDetails | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<FashionVariant | null>(null);
  const [itemSizes, setItemSizes] = useState<string[]>([]);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [outfitConfirmed, setOutfitConfirmed] = useState<boolean>(false);

  // Sequence guards to prevent stale responses
  const itemsReqSeq = useRef(0);
  const detailsReqSeq = useRef(0);
  const detailsAbortRef = useRef<AbortController | null>(null);
  const preferredVariantRef = useRef<number | undefined>(undefined);
  const catalogItemsRef = useRef<FashionItem[]>([]);

  // Debounce search input
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 240);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Sync URL ?item= parameter if user navigates with a query param
  useEffect(() => {
    const paramId = Number(searchParams.get('item'));
    if (
      Number.isInteger(paramId) &&
      paramId > 0 &&
      paramId !== selectedItemId
    ) {
      setSelectedItemId(paramId);
    }
  }, [searchParams, selectedItemId]);

  const refreshHealth = useCallback(async () => {
    setHealthState('checking');
    try {
      const res = await fashionApi.getHealth();
      setHealth(res);
      setHealthState('healthy');
    } catch {
      setHealthState('offline');
    }
  }, []);

  const reloadCatalogMeta = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const [cats, sizes, fullCatalog] = await Promise.all([
        fashionApi.getCategories(),
        fashionApi.getSizes().catch(() => [] as string[]),
        fashionApi.getFashionItems().catch(() => [] as FashionItem[]),
      ]);
      setCategories(cats);
      setSupportedSizes(sizes);
      if (fullCatalog.length > 0) {
        setAllCatalogItems(fullCatalog);
      }
      setHealthState('healthy');
    } catch (err) {
      setCategoriesError(
        formatGeneralApiError(err, 'Failed to load clothing categories from the server.')
      );
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const reloadRack = useCallback(async () => {
    setRackLoading(true);
    setRackError(null);
    try {
      const data = await fashionApi.getRackItems(8);
      setRackItems(data);
    } catch (err) {
      setRackError(
        formatGeneralApiError(err, 'Could not load 360° garment rack items.')
      );
    } finally {
      setRackLoading(false);
    }
  }, []);

  const reloadItems = useCallback(async () => {
    const seq = ++itemsReqSeq.current;
    setItemsLoading(true);
    setItemsError(null);

    try {
      let result: FashionItem[];
      // Use /api/categories/{id}/fashion-items when filtering strictly by category without search,
      // and /api/fashion-items?categoryId=&search= when searching or browsing all items.
      if (selectedCategoryId !== null && !debouncedSearch) {
        result = await fashionApi.getCategoryItems(selectedCategoryId);
      } else {
        result = await fashionApi.getFashionItems({
          categoryId: selectedCategoryId,
          search: debouncedSearch,
        });
      }

      if (seq !== itemsReqSeq.current) return;

      setItems(result);
      catalogItemsRef.current = result;
      if (selectedCategoryId === null && !debouncedSearch) {
        setAllCatalogItems(result);
      }

      // Auto-select the first available item on initial load if none selected yet
      setSelectedItemId((prev) => {
        if (prev !== null) return prev;
        return result.length > 0 ? result[0].id : null;
      });
    } catch (err) {
      if (seq !== itemsReqSeq.current) return;
      setItemsError(
        formatGeneralApiError(err, 'Could not load clothing items from the catalog.')
      );
    } finally {
      if (seq === itemsReqSeq.current) {
        setItemsLoading(false);
      }
    }
  }, [selectedCategoryId, debouncedSearch]);

  const fetchItemDetails = useCallback(
    async (
      id: number,
      preferredVariantId?: number
    ): Promise<{ item: FashionItemDetails; variant: FashionVariant } | null> => {
      detailsAbortRef.current?.abort();
      const controller = new AbortController();
      detailsAbortRef.current = controller;
      const seq = ++detailsReqSeq.current;

      setDetailsLoading(true);
      setDetailsError(null);

      try {
        const [details, explicitVariants, explicitSizes] = await Promise.all([
          fashionApi.getFashionItemDetails(id, controller.signal),
          fashionApi
            .getFashionItemVariants(id, controller.signal)
            .catch(() => null),
          fashionApi.getItemSizes(id, controller.signal).catch(() => null),
        ]);

        if (seq !== detailsReqSeq.current) return null;

        const mergedVariants =
          details.variants && details.variants.length > 0
            ? details.variants
            : explicitVariants ?? [];
        const mergedSizes =
          explicitSizes !== null
            ? explicitSizes
            : details.availableSizes ?? [];

        const matchingCatalogItem = catalogItemsRef.current.find((i) => i.id === id);
        const resolvedThumbnailUrl =
          details.thumbnailUrl ??
          matchingCatalogItem?.thumbnailUrl ??
          mergedVariants[0]?.imageUrl ??
          null;

        const normalizedDetails: FashionItemDetails = {
          ...details,
          thumbnailUrl: resolvedThumbnailUrl,
          variants: mergedVariants,
          availableSizes: mergedSizes,
        };

        const chosenVariant =
          (preferredVariantId !== undefined
            ? mergedVariants.find((v) => v.id === preferredVariantId)
            : undefined) ??
          mergedVariants[0] ??
          null;

        setSelectedItemDetails(normalizedDetails);
        setSelectedVariant(chosenVariant);
        setItemSizes(mergedSizes);

        if (chosenVariant) {
          return { item: normalizedDetails, variant: chosenVariant };
        }
        return null;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return null;
        }
        if (seq !== detailsReqSeq.current) return null;
        setDetailsError(
          formatGeneralApiError(err, 'Could not load details for the selected garment.')
        );
        return null;
      } finally {
        if (seq === detailsReqSeq.current) {
          setDetailsLoading(false);
        }
      }
    },
    []
  );

  // Initial load of health, categories, sizes, and rack
  useEffect(() => {
    void refreshHealth();
    void reloadCatalogMeta();
    void reloadRack();
  }, [refreshHealth, reloadCatalogMeta, reloadRack]);

  // Reload items whenever category or debounced search changes
  useEffect(() => {
    void reloadItems();
  }, [reloadItems]);

  // Load selected item details whenever selectedItemId changes
  useEffect(() => {
    if (selectedItemId === null) return;
    const prefVar = preferredVariantRef.current;
    preferredVariantRef.current = undefined;
    void fetchItemDetails(selectedItemId, prefVar);
  }, [selectedItemId, fetchItemDetails]);

  const setSelectedCategoryId = useCallback((id: number | null) => {
    setSelectedCategoryIdState(id);
  }, []);

  const selectItem = useCallback(
    (id: number, preferredVariantId?: number) => {
      preferredVariantRef.current = preferredVariantId;
      setOutfitConfirmed(false);
      setSelectedItemId(id);

      // Update ?item= query param cleanly if already present
      if (searchParams.has('item')) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('item', String(id));
        setSearchParams(nextParams, { replace: true });
      }
    },
    [searchParams, setSearchParams]
  );

  const selectVariant = useCallback((variant: FashionVariant) => {
    setOutfitConfirmed(false);
    setSelectedVariant(variant);
  }, []);

  const reloadSelectedDetails = useCallback(async () => {
    if (selectedItemId !== null) {
      await fetchItemDetails(selectedItemId, selectedVariant?.id);
    }
  }, [selectedItemId, selectedVariant?.id, fetchItemDetails]);

  /**
   * Cycles to the next or previous variant/product within the current garment's
   * category (wrapping around seamlessly). Used by MediaPipe hand-swipe gestures
   * and manual Next/Previous studio controls.
   */
  const stepGarmentOrVariant = useCallback(
    async (
      direction: SwipeDirection
    ): Promise<{ item: FashionItemDetails; variant: FashionVariant } | null> => {
      if (!selectedItemDetails) return null;

      const variants = selectedItemDetails.variants ?? [];
      if (variants.length > 1 && selectedVariant) {
        const currentVarIdx = variants.findIndex((v) => v.id === selectedVariant.id);
        const nextVarIdx =
          direction === 'next' ? currentVarIdx + 1 : currentVarIdx - 1;

        if (nextVarIdx >= 0 && nextVarIdx < variants.length) {
          const targetVar = variants[nextVarIdx];
          setOutfitConfirmed(false);
          setSelectedVariant(targetVar);
          return { item: selectedItemDetails, variant: targetVar };
        }
      }

      // Otherwise move to the next/previous item in the same category (or active list)
      const sourcePool =
        allCatalogItems.length > 0 ? allCatalogItems : items;
      const sameCategoryPool = sourcePool.filter(
        (it) => it.categoryId === selectedItemDetails.categoryId
      );
      const pool = sameCategoryPool.length > 0 ? sameCategoryPool : sourcePool;

      if (pool.length === 0) return null;

      const currentIdx = pool.findIndex((it) => it.id === selectedItemDetails.id);
      const safeIdx = currentIdx >= 0 ? currentIdx : 0;
      const nextItemIdx =
        direction === 'next'
          ? (safeIdx + 1) % pool.length
          : (safeIdx - 1 + pool.length) % pool.length;

      const targetItem = pool[nextItemIdx];
      if (targetItem.id === selectedItemDetails.id) {
        if (variants.length > 0) {
          const wrapVar =
            direction === 'next' ? variants[0] : variants[variants.length - 1];
          setSelectedVariant(wrapVar);
          return { item: selectedItemDetails, variant: wrapVar };
        }
        return null;
      }

      setOutfitConfirmed(false);
      setSelectedItemId(targetItem.id);
      const loaded = await fetchItemDetails(targetItem.id);
      if (loaded && direction === 'prev' && loaded.item.variants.length > 1) {
        const lastVar = loaded.item.variants[loaded.item.variants.length - 1];
        setSelectedVariant(lastVar);
        return { item: loaded.item, variant: lastVar };
      }
      return loaded;
    },
    [selectedItemDetails, selectedVariant, allCatalogItems, items, fetchItemDetails]
  );

  const value = useMemo<StudioContextValue>(
    () => ({
      health,
      healthState,
      refreshHealth,
      categories,
      categoriesLoading,
      categoriesError,
      supportedSizes,
      reloadCatalogMeta,
      selectedCategoryId,
      setSelectedCategoryId,
      searchQuery,
      setSearchQuery,
      items,
      allCatalogItems,
      itemsLoading,
      itemsError,
      reloadItems,
      rackItems,
      rackLoading,
      rackError,
      reloadRack,
      selectedItemId,
      selectedItemDetails,
      selectedVariant,
      itemSizes,
      detailsLoading,
      detailsError,
      outfitConfirmed,
      setOutfitConfirmed,
      selectItem,
      selectVariant,
      stepGarmentOrVariant,
      reloadSelectedDetails,
    }),
    [
      health,
      healthState,
      refreshHealth,
      categories,
      categoriesLoading,
      categoriesError,
      supportedSizes,
      reloadCatalogMeta,
      selectedCategoryId,
      setSelectedCategoryId,
      searchQuery,
      items,
      allCatalogItems,
      itemsLoading,
      itemsError,
      reloadItems,
      rackItems,
      rackLoading,
      rackError,
      reloadRack,
      selectedItemId,
      selectedItemDetails,
      selectedVariant,
      itemSizes,
      detailsLoading,
      detailsError,
      outfitConfirmed,
      selectItem,
      selectVariant,
      stepGarmentOrVariant,
      reloadSelectedDetails,
    ]
  );

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) {
    throw new Error('useStudio must be used inside a <StudioProvider>.');
  }
  return ctx;
}

