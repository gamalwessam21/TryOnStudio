import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  Layers,
  RefreshCw,
  Shirt,
  ShoppingCart,
} from 'lucide-react';
import { useStudio } from '../StudioContext';
import { useCommerce } from '../CommerceContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  ClothingRack360,
  type EnrichedRackPiece,
} from '../../features/catalog/ClothingRack360';
import { ProductDetailsModal } from '../../features/catalog/ProductDetailsModal';
import { fashionApi } from '../../services/fashionApi';
import type { FashionItemDetails, FashionVariant } from '../../types/api';

export function BrowsePage() {
  const {
    categories,
    selectedCategoryId,
    setSelectedCategoryId,
    searchQuery,
    setSearchQuery,
    items,
    itemsLoading,
    itemsError,
    reloadItems,
    rackItems,
    rackLoading,
    rackError,
    reloadRack,
    selectItem,
    itemDetailsCache,
    ensureItemDetails,
  } = useStudio();
  const {
    prepareCheckoutFromItem,
    addToCart,
    setCartDrawerOpen,
    cartNotice,
    clearCartNotice,
  } = useCommerce();
  const { language, t } = useLanguage();

  const navigate = useNavigate();

  // Per-item selected variant and size overrides
  const [cardVariantMap, setCardVariantMap] = useState<Record<number, number>>(
    {}
  );
  const [cardSizeMap, setCardSizeMap] = useState<Record<number, string>>({});
  const [modalItemId, setModalItemId] = useState<number | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Lookup map of 360° frames by numeric item ID from /api/fashion-items/rack
  const rackFramesByItemId = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (const r of rackItems) {
      const numId = Number(r.id);
      if (
        Number.isInteger(numId) &&
        numId > 0 &&
        Array.isArray(r.frames) &&
        r.frames.length > 0
      ) {
        map[numId] = r.frames;
      }
    }
    return map;
  }, [rackItems]);

  // Background-enrich all catalog items with variants & sizes so they work directly on the rack
  useEffect(() => {
    let cancelled = false;
    async function enrichVisibleItems() {
      for (const item of items.slice(0, 20)) {
        if (cancelled) break;
        if (!itemDetailsCache[item.id]) {
          await ensureItemDetails(item.id);
        }
      }
    }
    if (items.length > 0) {
      void enrichVisibleItems();
    }
    return () => {
      cancelled = true;
    };
  }, [items, itemDetailsCache, ensureItemDetails]);

  // Merge all catalog items with 360° rack frames + variant/size details so ALL items hang on the rack
  const unifiedRackPieces = useMemo<EnrichedRackPiece[]>(() => {
    if (items.length > 0) {
      return items.map((item) => {
        const details = itemDetailsCache[item.id];
        const variants = details?.variants ?? [];
        const offeredSizes = details?.availableSizes ?? [];
        const activeVarId = cardVariantMap[item.id];
        const activeVariant =
          (activeVarId !== undefined
            ? variants.find((v) => v.id === activeVarId)
            : undefined) ??
          variants[0] ??
          null;
        const activeSize =
          cardSizeMap[item.id] ??
          (offeredSizes.length > 0 ? offeredSizes[0] : null);

        const rackFrames = rackFramesByItemId[item.id];
        const isDefaultVariant =
          activeVarId === undefined || activeVarId === variants[0]?.id;

        let frames: string[] = [];
        if (isDefaultVariant && rackFrames && rackFrames.length > 0) {
          frames = rackFrames;
        } else {
          const primaryImg =
            activeVariant?.imageUrl ||
            item.thumbnailUrl ||
            variants[0]?.imageUrl ||
            '';
          frames = primaryImg ? [primaryImg] : [];
        }

        return {
          id: String(item.id),
          name: item.name,
          price: item.price,
          frames,
          categoryName: item.categoryName,
          description: item.description,
          variants,
          selectedVariant: activeVariant,
          availableSizes: offeredSizes,
          selectedSize: activeSize,
        };
      });
    }

    // Fallback to raw rackItems if catalog items haven't populated yet
    if (selectedCategoryId === null && !searchQuery.trim()) {
      return rackItems.map((r) => ({ ...r }));
    }

    return [];
  }, [
    items,
    itemDetailsCache,
    cardVariantMap,
    cardSizeMap,
    rackFramesByItemId,
    selectedCategoryId,
    searchQuery,
    rackItems,
  ]);

  function openInStudio(id: number, preferredVariantId?: number) {
    selectItem(id, preferredVariantId ?? cardVariantMap[id]);
    navigate(`/?item=${id}`);
  }

  function openInSizeFinder(id: number) {
    selectItem(id, cardVariantMap[id]);
    navigate(`/size-guide?item=${id}`);
  }

  async function resolveDetails(id: number): Promise<FashionItemDetails> {
    const cached = itemDetailsCache[id];
    if (cached) return cached;
    const loaded = await ensureItemDetails(id);
    if (loaded) return loaded;
    return fashionApi.getFashionItemDetails(id);
  }

  async function handleOpenDetails(id: number) {
    setModalItemId(id);
    setModalError(null);
    if (!itemDetailsCache[id]) {
      setModalLoading(true);
      try {
        await resolveDetails(id);
      } catch {
        setModalError(
          language === 'ar'
            ? 'تعذر تحميل تفاصيل القطعة.'
            : 'Could not load product details.'
        );
      } finally {
        setModalLoading(false);
      }
    }
  }

  async function handleAddToCartFromRack(id: number) {
    try {
      const details = await resolveDetails(id);
      const chosenVariantId = cardVariantMap[id];
      const chosenVariant =
        (chosenVariantId !== undefined
          ? details.variants?.find((v) => v.id === chosenVariantId)
          : undefined) ??
        details.variants?.[0] ??
        null;
      const offeredSizes = details.availableSizes ?? [];
      const chosenSize =
        cardSizeMap[id] ?? (offeredSizes.length > 0 ? offeredSizes[0] : null);

      const res = addToCart({
        item: details,
        variant: chosenVariant,
        size: chosenSize,
        quantity: 1,
      });
      if (res.ok) {
        setCartDrawerOpen(true);
      }
    } catch {
      void handleOpenDetails(id);
    }
  }

  async function handleQuickBuy(id: number) {
    selectItem(id, cardVariantMap[id]);
    try {
      const details = await resolveDetails(id);
      const chosenVariantId = cardVariantMap[id];
      const chosenVariant =
        (chosenVariantId !== undefined
          ? details.variants?.find((v) => v.id === chosenVariantId)
          : undefined) ??
        details.variants?.[0] ??
        null;
      const offeredSizes = details.availableSizes ?? [];
      const chosenSize =
        cardSizeMap[id] ??
        (offeredSizes.length === 1
          ? offeredSizes[0]
          : offeredSizes[0] ?? null);

      prepareCheckoutFromItem({
        item: details,
        variant: chosenVariant,
        size: chosenSize,
        quantity: 1,
      });
      navigate('/checkout');
    } catch {
      navigate(`/?item=${id}`);
    }
  }

  function handleBuyNowFromModal(params: {
    item: FashionItemDetails;
    variant: FashionVariant | null;
    size: string | null;
    quantity: number;
  }) {
    setModalItemId(null);
    selectItem(params.item.id, params.variant?.id);
    prepareCheckoutFromItem(params);
    navigate('/checkout');
  }

  const activeModalItem =
    modalItemId !== null ? itemDetailsCache[modalItemId] ?? null : null;
  const activeModalIndex = useMemo(
    () =>
      modalItemId !== null
        ? unifiedRackPieces.findIndex((it) => Number(it.id) === modalItemId)
        : -1,
    [unifiedRackPieces, modalItemId]
  );

  const isRackLoading =
    itemsLoading && rackLoading && unifiedRackPieces.length === 0;
  const combinedError =
    unifiedRackPieces.length === 0 ? itemsError || rackError : null;

  return (
    <div className="browse-page">
      {/* Page Intro + Category Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800 }}>
            {t('browseTitle')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {t('browseSubtitle')}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div className="category-pills" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className={`category-pill ${
                selectedCategoryId === null ? 'active' : ''
              }`}
              onClick={() => setSelectedCategoryId(null)}
            >
              <Layers size={16} aria-hidden="true" />
              <span>{t('allCategories')}</span>
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`category-pill ${
                  selectedCategoryId === cat.id ? 'active' : ''
                }`}
                onClick={() => setSelectedCategoryId(cat.id)}
              >
                <Shirt size={16} aria-hidden="true" />
                <span>{cat.name}</span>
                <span className="category-pill-count">
                  <bdi>{cat.itemCount}</bdi>
                </span>
              </button>
            ))}
          </div>

          {searchQuery && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setSearchQuery('')}
            >
              {t('clearSearch')} (&ldquo;{searchQuery}&rdquo;)
            </button>
          )}
        </div>
      </div>

      {cartNotice && (
        <div
          className="banner banner-info"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Check size={16} />
            <span>{cartNotice}</span>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setCartDrawerOpen(true)}
            >
              <ShoppingCart size={14} />
              <span>{t('viewCartBtn')}</span>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={clearCartNotice}
            >
              {t('dismissBanner')}
            </button>
          </div>
        </div>
      )}

      {/* Empty Search / Filter State */}
      {!isRackLoading && !combinedError && unifiedRackPieces.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '42px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Shirt size={36} color="#94a3b8" />
          <h3>{t('noProductsFound')}</h3>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategoryId(null);
            }}
          >
            {t('resetFilters')}
          </button>
        </div>
      ) : combinedError ? (
        <div className="banner banner-error">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>{combinedError}</div>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              void reloadItems();
              void reloadRack();
            }}
          >
            <RefreshCw size={13} />
            <span>{t('retryBtn')}</span>
          </button>
        </div>
      ) : (
        /* Unified 360° Interactive Hanging Clothesline Rack containing ALL items */
        <ClothingRack360
          rackItems={unifiedRackPieces}
          loading={isRackLoading}
          error={combinedError}
          onRetry={() => {
            void reloadItems();
            void reloadRack();
          }}
          onOpenInStudio={openInStudio}
          onInspectItem={(id) => void handleOpenDetails(id)}
          onSelectVariant={(itemId, variantId) =>
            setCardVariantMap((prev) => ({ ...prev, [itemId]: variantId }))
          }
          onSelectSize={(itemId, size) =>
            setCardSizeMap((prev) => ({ ...prev, [itemId]: size }))
          }
          onAddToCart={(id) => void handleAddToCartFromRack(id)}
          onBuyNow={(id) => void handleQuickBuy(id)}
          onOpenSizeGuide={(id) => openInSizeFinder(id)}
          itemDetailsCache={itemDetailsCache}
        />
      )}

      <ProductDetailsModal
        item={activeModalItem}
        loading={modalLoading}
        error={modalError}
        initialVariantId={
          modalItemId !== null ? cardVariantMap[modalItemId] ?? null : null
        }
        initialSize={
          modalItemId !== null ? cardSizeMap[modalItemId] ?? null : null
        }
        rackFrames={
          modalItemId !== null ? rackFramesByItemId[modalItemId] ?? [] : []
        }
        itemIndex={activeModalIndex >= 0 ? activeModalIndex : undefined}
        totalItems={unifiedRackPieces.length}
        onClose={() => {
          setModalItemId(null);
          setModalError(null);
        }}
        onTryInStudio={(itemId, varId) => openInStudio(itemId, varId)}
        onOpenSizeGuide={(itemId) => openInSizeFinder(itemId)}
        onBuyNow={handleBuyNowFromModal}
      />
    </div>
  );
}
