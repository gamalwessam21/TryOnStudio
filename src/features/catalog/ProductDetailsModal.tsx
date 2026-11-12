import { useEffect, useState } from 'react';
import {
  Check,
  Minus,
  Plus,
  Rotate3d,
  Ruler,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  X,
} from 'lucide-react';
import type { FashionItemDetails, FashionVariant } from '../../types/api';
import { GarmentImage } from '../../components/GarmentImage';
import { formatDualPrice } from '../../utils/commerceHelpers';
import { useCommerce, MAX_LINE_QUANTITY } from '../../app/CommerceContext';
import { useLanguage } from '../../i18n/LanguageContext';

interface ProductDetailsModalProps {
  item: FashionItemDetails | null;
  loading?: boolean;
  error?: string | null;
  initialVariantId?: number | null;
  initialSize?: string | null;
  rackFrames?: string[];
  itemIndex?: number;
  totalItems?: number;
  onClose: () => void;
  onTryInStudio: (itemId: number, variantId?: number) => void;
  onOpenSizeGuide: (itemId: number) => void;
  onBuyNow: (params: {
    item: FashionItemDetails;
    variant: FashionVariant | null;
    size: string | null;
    quantity: number;
  }) => void;
}

export function ProductDetailsModal({
  item,
  loading = false,
  error = null,
  initialVariantId = null,
  initialSize = null,
  rackFrames = [],
  itemIndex,
  totalItems,
  onClose,
  onTryInStudio,
  onOpenSizeGuide,
  onBuyNow,
}: ProductDetailsModalProps) {
  const { language, t } = useLanguage();
  const { usdToEgpRate, addToCart, setCartDrawerOpen } = useCommerce();

  const [selectedVariant, setSelectedVariant] = useState<FashionVariant | null>(
    null
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(initialSize);
  const [quantity, setQuantity] = useState<number>(1);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<boolean>(false);

  // View angle state for items with 360° frames (Front = last frame, Back = frame 0, Spin = mouse-reactive)
  const [viewMode, setViewMode] = useState<'front' | 'back' | 'spin'>('front');
  const [spinFrameIdx, setSpinFrameIdx] = useState<number>(0);
  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({ rx: 0, ry: 0 });

  useEffect(() => {
    if (!item) return;
    const matchedVar =
      (initialVariantId !== null
        ? item.variants?.find((v) => v.id === initialVariantId)
        : undefined) ??
      item.variants?.[0] ??
      null;
    setSelectedVariant(matchedVar);

    const sizes = item.availableSizes ?? [];
    if (initialSize && sizes.includes(initialSize)) {
      setSelectedSize(initialSize);
    } else if (sizes.length > 0) {
      setSelectedSize(sizes[0]);
    } else {
      setSelectedSize(null);
    }
    setQuantity(1);
    setFeedbackMsg(null);
    setFeedbackError(false);
    setViewMode('front');
    if (rackFrames.length > 0) {
      setSpinFrameIdx(rackFrames.length - 1);
    }
  }, [item, initialVariantId, initialSize, rackFrames.length]);

  if (!item && !loading && !error) return null;

  const sizes = item?.availableSizes ?? [];
  const requiresSize = sizes.length > 0;
  const canPurchase = Boolean(item && (!requiresSize || selectedSize));
  const has360 = rackFrames.length > 1;

  function handleAddToCart() {
    if (!item) return;
    if (requiresSize && !selectedSize) {
      setFeedbackError(true);
      setFeedbackMsg(
        language === 'ar'
          ? 'يرجى اختيار المقاس أولاً.'
          : 'Please select a size first.'
      );
      return;
    }
    const res = addToCart({
      item,
      variant: selectedVariant,
      size: selectedSize,
      quantity,
    });
    setFeedbackError(!res.ok);
    setFeedbackMsg(res.message ?? null);
    if (res.ok) {
      // Match reference video (00:15-00:16): close sheet & open Cart Drawer immediately
      onClose();
      setCartDrawerOpen(true);
    }
  }

  function handleBuyNowClick() {
    if (!item) return;
    if (requiresSize && !selectedSize) {
      setFeedbackError(true);
      setFeedbackMsg(
        language === 'ar'
          ? 'يرجى اختيار المقاس أولاً.'
          : 'Please select a size first.'
      );
      return;
    }
    onBuyNow({
      item,
      variant: selectedVariant,
      size: selectedSize,
      quantity,
    });
  }

  function handleStageMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    setTilt({
      rx: (0.5 - ny) * 10,
      ry: (nx - 0.5) * 12,
    });

    if (has360 && viewMode === 'spin') {
      const idx = Math.max(
        0,
        Math.min(
          rackFrames.length - 1,
          Math.round(nx * (rackFrames.length - 1))
        )
      );
      setSpinFrameIdx(idx);
    }
  }

  function handleStageMouseLeave() {
    setTilt({ rx: 0, ry: 0 });
  }

  // Determine image URL to show in the studio sheet
  let displayImageUrl =
    selectedVariant?.imageUrl || item?.thumbnailUrl || '';
  if (has360 && item) {
    const firstVariantId = item.variants?.[0]?.id;
    const isDefaultVariant =
      !selectedVariant || selectedVariant.id === firstVariantId;
    if (isDefaultVariant || viewMode !== 'front') {
      if (viewMode === 'front') {
        displayImageUrl =
          rackFrames[rackFrames.length - 1] || displayImageUrl;
      } else if (viewMode === 'back') {
        displayImageUrl = rackFrames[0] || displayImageUrl;
      } else {
        displayImageUrl = rackFrames[spinFrameIdx] || displayImageUrl;
      }
    }
  }

  const indexLabel =
    typeof itemIndex === 'number' && typeof totalItems === 'number' && totalItems > 0
      ? `${String(itemIndex + 1).padStart(2, '0')} / ${String(totalItems).padStart(2, '0')}`
      : null;

  return (
    <div
      className="modal-backdrop editorial-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={item?.name || t('productDetailsTitle')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="editorial-sheet-card">
        {/* Top Bar: 01 / 15 Counter + Close × */}
        <div className="editorial-sheet-topbar">
          <div className="editorial-sheet-counter">
            {indexLabel && (
              <span className="editorial-counter-digits">
                <bdi>{indexLabel}</bdi>
              </span>
            )}
            <span className="editorial-category-tag">
              {item?.categoryName || t('productDetailsTitle')}
            </span>
          </div>

          <button
            type="button"
            className="editorial-close-btn"
            onClick={onClose}
            aria-label={t('closeModalBtn')}
          >
            <span>{t('closeModalBtn')}</span>
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 36, textAlign: 'center' }}>
            <div
              className="skeleton"
              style={{ width: '100%', height: 340, borderRadius: 18 }}
            />
          </div>
        ) : error ? (
          <div className="banner banner-error" style={{ margin: 20 }}>
            {error}
          </div>
        ) : item ? (
          <div className="editorial-sheet-grid">
            {/* Left Interactive Visual Stage */}
            <div
              className="editorial-visual-stage"
              onMouseMove={handleStageMouseMove}
              onMouseLeave={handleStageMouseLeave}
            >
              <div
                className="editorial-visual-figure"
                style={{
                  transform: `perspective(900px) rotateX(${tilt.rx.toFixed(
                    2
                  )}deg) rotateY(${tilt.ry.toFixed(2)}deg)`,
                }}
              >
                <GarmentImage
                  src={displayImageUrl}
                  alt={`${item.name} ${selectedVariant?.colorName ?? ''}`}
                  categoryName={item.categoryName}
                  aspectRatio="4/5"
                />
              </div>

              {/* Front / Back / 360° Toggle Pills (matches reference video 00:10-00:14) */}
              {has360 && (
                <div className="editorial-angle-pills">
                  <button
                    type="button"
                    className={`editorial-angle-pill ${
                      viewMode === 'front' ? 'active' : ''
                    }`}
                    onClick={() => {
                      setViewMode('front');
                      setSpinFrameIdx(rackFrames.length - 1);
                    }}
                  >
                    {language === 'ar' ? 'الأمام' : 'Front'}
                  </button>
                  <button
                    type="button"
                    className={`editorial-angle-pill ${
                      viewMode === 'back' ? 'active' : ''
                    }`}
                    onClick={() => {
                      setViewMode('back');
                      setSpinFrameIdx(0);
                    }}
                  >
                    {language === 'ar' ? 'الخلف' : 'Back'}
                  </button>
                  <button
                    type="button"
                    className={`editorial-angle-pill ${
                      viewMode === 'spin' ? 'active' : ''
                    }`}
                    onClick={() => setViewMode('spin')}
                  >
                    <Rotate3d size={13} aria-hidden="true" />
                    <span>360°</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right Editorial Details Column */}
            <div className="editorial-details-col">
              <div>
                <h2 className="editorial-product-title">
                  <bdi>{item.name}</bdi>
                </h2>
                <div className="editorial-product-price">
                  <bdi dir="ltr">
                    {formatDualPrice(item.price, usdToEgpRate, language)}
                  </bdi>
                </div>
              </div>

              <p className="editorial-product-desc">
                {item.description?.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim()}
              </p>

              {/* Color Variants */}
              {item.variants && item.variants.length > 0 && (
                <div className="editorial-field-block">
                  <div className="editorial-field-label">
                    <span>{t('selectVariantPrompt')}</span>
                    <span className="editorial-field-sub">
                      <bdi>{selectedVariant?.colorName}</bdi>
                    </span>
                  </div>
                  <div className="editorial-variant-list">
                    {item.variants.map((variant) => {
                      const active = selectedVariant?.id === variant.id;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => {
                            setSelectedVariant(variant);
                            setViewMode('front');
                            setFeedbackMsg(null);
                          }}
                          className={`editorial-variant-chip ${
                            active ? 'selected' : ''
                          }`}
                        >
                          <span
                            className="editorial-variant-dot"
                            style={{
                              background: variant.colorHex || '#cbd5e1',
                            }}
                          />
                          <span>
                            <bdi>{variant.colorName}</bdi>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Circular SIZE Selector Pills (matches reference video 00:12-00:14) */}
              <div className="editorial-field-block">
                <div className="editorial-field-label">
                  <span>{t('availableSizesLabel')}</span>
                  <button
                    type="button"
                    className="editorial-size-guide-btn"
                    onClick={() => {
                      onClose();
                      onOpenSizeGuide(item.id);
                    }}
                  >
                    <Ruler size={12} />
                    <span>{t('sizeGuide')}</span>
                  </button>
                </div>

                {sizes.length > 0 ? (
                  <div className="editorial-size-circles">
                    {sizes.map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        className={`editorial-size-circle ${
                          selectedSize === sz ? 'selected' : ''
                        }`}
                        onClick={() => {
                          setSelectedSize(sz);
                          setFeedbackMsg(null);
                        }}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {language === 'ar'
                      ? 'لا توجد مقاسات محددة مطلوبة لهذه القطعة.'
                      : 'Standard one-size item.'}
                  </span>
                )}
              </div>

              {/* Quantity Selector (1-20) */}
              <div className="editorial-qty-row">
                <span className="editorial-field-label" style={{ marginBottom: 0 }}>
                  {t('quantityLabel')} (1–{MAX_LINE_QUANTITY})
                </span>
                <div className="editorial-qty-stepper">
                  <button
                    type="button"
                    className="editorial-qty-btn"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="editorial-qty-val">{quantity}</span>
                  <button
                    type="button"
                    className="editorial-qty-btn"
                    disabled={quantity >= MAX_LINE_QUANTITY}
                    onClick={() =>
                      setQuantity((q) => Math.min(MAX_LINE_QUANTITY, q + 1))
                    }
                    aria-label="Increase quantity"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {feedbackMsg && (
                <div
                  className={`banner ${
                    feedbackError ? 'banner-error' : 'banner-info'
                  }`}
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {!feedbackError && <Check size={14} />}
                    <span>{feedbackMsg}</span>
                  </span>
                </div>
              )}

              {/* Primary Sleek Dark Pill "Add to cart" Button (matches video 00:14) */}
              <div className="editorial-actions-stack">
                <button
                  type="button"
                  className="editorial-add-cart-pill"
                  disabled={!canPurchase}
                  onClick={handleAddToCart}
                >
                  <ShoppingCart size={16} />
                  <span>{t('addToCart')}</span>
                </button>

                <div className="editorial-secondary-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      onClose();
                      onTryInStudio(item.id, selectedVariant?.id);
                    }}
                  >
                    <Sparkles size={15} />
                    <span>{t('tryOn')}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={!canPurchase}
                    onClick={handleBuyNowClick}
                  >
                    <ShoppingBag size={15} />
                    <span>{t('buyNow')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
