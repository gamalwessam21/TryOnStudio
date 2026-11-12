import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  RefreshCw,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  X,
} from 'lucide-react';
import { GarmentImage } from '../../components/GarmentImage';
import type { FashionItemDetails, FashionVariant } from '../../types/api';
import { useCommerce } from '../../app/CommerceContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatDualPrice } from '../../utils/commerceHelpers';

interface SelectedOutfitCardProps {
  item: FashionItemDetails | null;
  variant: FashionVariant | null;
  supportedSizes: string[];
  loading: boolean;
  error: string | null;
  outfitConfirmed: boolean;
  tryOnActive: boolean;
  onSelectVariant: (variant: FashionVariant) => void;
  onChooseOutfit: () => void;
  onClearSelection?: () => void;
  onRetry: () => void;
}

export function SelectedOutfitCard({
  item,
  variant,
  supportedSizes,
  loading,
  error,
  outfitConfirmed,
  tryOnActive,
  onSelectVariant,
  onChooseOutfit,
  onClearSelection,
  onRetry,
}: SelectedOutfitCardProps) {
  const { language, t } = useLanguage();
  const {
    usdToEgpRate,
    selectedPurchaseSize,
    setSelectedPurchaseSize,
    prepareCheckoutFromItem,
    addToCart,
    setCartDrawerOpen,
  } = useCommerce();
  const navigate = useNavigate();
  const [cartFeedback, setCartFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const catalogSizes =
    supportedSizes.length > 0
      ? supportedSizes
      : ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  const activeImageSrc =
    variant?.imageUrl ||
    item?.thumbnailUrl ||
    item?.variants?.[0]?.imageUrl ||
    null;

  const resolveSelectedOrDefaultSize = (): string | null => {
    if (!item) return null;
    if (selectedPurchaseSize) return selectedPurchaseSize;
    if (item.availableSizes && item.availableSizes.length > 0) {
      return item.availableSizes[0];
    }
    return null;
  };

  const handleAddToCart = () => {
    if (!item) return;
    const chosenSize = resolveSelectedOrDefaultSize();
    if (chosenSize && !selectedPurchaseSize) {
      setSelectedPurchaseSize(chosenSize);
    }
    const res = addToCart({
      item,
      variant,
      size: chosenSize,
      quantity: 1,
    });
    if (res.message) {
      setCartFeedback({ ok: res.ok, message: res.message });
    }
  };

  const handleProceedToCheckout = () => {
    if (!item) return;
    const defaultSize = resolveSelectedOrDefaultSize();

    prepareCheckoutFromItem({
      item,
      variant,
      size: defaultSize,
      quantity: 1,
    });
    navigate('/checkout');
  };

  return (
    <section
      className="card bottom-card"
      aria-label={t('selectedOutfitTitle')}
    >
      <div
        className="bottom-card-header"
        style={{ flexWrap: 'wrap', gap: 8 }}
      >
        <h2 className="bottom-card-title" style={{ whiteSpace: 'nowrap' }}>
          <Shirt size={19} color="var(--blue-600)" aria-hidden="true" />
          <span>{t('selectedOutfitTitle')}</span>
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {outfitConfirmed && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.74rem',
                fontWeight: 700,
                color: 'var(--green-600)',
                background: 'var(--green-50)',
                border: '1px solid var(--green-border)',
                padding: '3px 9px',
                borderRadius: '999px',
                whiteSpace: 'nowrap',
              }}
            >
              <Check size={12} aria-hidden="true" />
              <span>{t('outfitChosen')}</span>
            </span>
          )}

          {item && onClearSelection && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => {
                setCartFeedback(null);
                onClearSelection();
              }}
              title={t('clearSelectionBtn')}
              aria-label={t('clearSelectionBtn')}
              style={{ padding: '4px 9px', fontSize: '0.74rem', whiteSpace: 'nowrap' }}
            >
              <X size={13} aria-hidden="true" />
              <span>{t('clearSelectionBtn')}</span>
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="banner banner-error">
          <AlertCircle size={17} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>{error}</div>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={onRetry}
          >
            <RefreshCw size={13} />
            <span>{t('retryBtn')}</span>
          </button>
        </div>
      ) : loading && !item ? (
        <div className="selected-outfit-body">
          <div className="skeleton" style={{ aspectRatio: '4/5' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="skeleton" style={{ height: 18, width: '75%' }} />
            <div className="skeleton" style={{ height: 16, width: '40%' }} />
            <div className="skeleton" style={{ height: 34, width: '100%' }} />
          </div>
        </div>
      ) : !item ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>
          {t('noOutfitSelected')}
        </p>
      ) : (
        <>
          <div className="selected-outfit-body">
            <div className="selected-outfit-thumb">
              <GarmentImage
                src={activeImageSrc}
                alt={`${item.name}${
                  variant?.colorName ? ` — ${variant.colorName}` : ''
                }`}
                categoryName={item.categoryName}
                colorHex={variant?.colorHex}
                aspectRatio="4/5"
                priority={true}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div
                  style={{
                    fontSize: '0.98rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  <bdi>{item.name}</bdi>
                </div>
                <div
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: 'var(--blue-600)',
                    marginTop: 2,
                  }}
                >
                  <bdi dir="ltr">{formatDualPrice(item.price, usdToEgpRate, language)}</bdi>
                </div>
              </div>

              {/* Color Swatches + Accessible Dropdown */}
              {item.variants.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {item.variants.map((v) => {
                      const isActive = variant?.id === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          className={`swatch-btn ${isActive ? 'active' : ''}`}
                          onClick={() => onSelectVariant(v)}
                          aria-label={`Select color ${v.colorName}`}
                          aria-pressed={isActive}
                          title={v.colorName}
                        >
                          <span
                            className="swatch-btn-inner"
                            style={{
                              backgroundColor: v.colorHex || '#cbd5e1',
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>

                  <label
                    htmlFor="studio-variant-select"
                    style={{
                      position: 'absolute',
                      width: 1,
                      height: 1,
                      overflow: 'hidden',
                      clip: 'rect(0,0,0,0)',
                    }}
                  >
                    {t('colorVariantLabel')}
                  </label>
                  <select
                    id="studio-variant-select"
                    value={variant?.id ?? ''}
                    onChange={(e) => {
                      const chosen = item.variants.find(
                        (v) => v.id === Number(e.target.value)
                      );
                      if (chosen) onSelectVariant(chosen);
                    }}
                    style={{
                      height: 36,
                      borderRadius: 9,
                      border: '1px solid var(--border-subtle)',
                      padding: '0 10px',
                      background: 'var(--bg-surface-subtle)',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                      fontSize: '0.84rem',
                    }}
                  >
                    {item.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.colorName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Offered / Manufactured Sizes with click-to-pick for checkout */}
          <div>
            <div
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: 6,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{t('manufacturedSizesLabel')}:</span>
              {selectedPurchaseSize && (
                <span style={{ color: 'var(--blue-600)', fontWeight: 700 }}>
                  <bdi>{selectedPurchaseSize}</bdi>
                </span>
              )}
            </div>
            {item.availableSizes.length > 0 ? (
              <div className="sizes-pill-row">
                {catalogSizes.map((sz) => {
                  const offered = item.availableSizes.includes(sz);
                  const isSelected = selectedPurchaseSize === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      disabled={!offered}
                      className={`size-chip ${offered ? '' : 'unoffered'} ${
                        isSelected ? 'active' : ''
                      }`}
                      onClick={() => offered && setSelectedPurchaseSize(sz)}
                      title={
                        offered
                          ? `Size ${sz}`
                          : `Not manufactured in size ${sz}`
                      }
                      style={{ cursor: offered ? 'pointer' : 'not-allowed' }}
                    >
                      <bdi>{sz}</bdi>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                }}
              >
                {t('notInSelected')}
              </div>
            )}
          </div>

          {cartFeedback && (
            <div
              className={`banner ${
                cartFeedback.ok ? 'banner-info' : 'banner-error'
              }`}
              style={{
                padding: '8px 10px',
                fontSize: '0.79rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span>{cartFeedback.message}</span>
              {cartFeedback.ok && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setCartDrawerOpen(true)}
                >
                  {t('viewCartBtn')}
                </button>
              )}
            </div>
          )}

          {/* Action Rows: Row 1 (Choose/Undo + Add to Cart), Row 2 (Full-width Buy Now) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginTop: 'auto',
            }}
          >
            <div className="selected-outfit-actions-row">
              <button
                type="button"
                className={`btn ${
                  outfitConfirmed && !tryOnActive ? 'btn-secondary' : 'btn-navy'
                }`}
                onClick={onChooseOutfit}
                aria-pressed={outfitConfirmed}
                title={
                  outfitConfirmed && !tryOnActive
                    ? `${t('outfitConfirmed')} — ${t('undoOutfitConfirm')}`
                    : undefined
                }
                style={{
                  width: '100%',
                  minWidth: 0,
                  padding: '0 10px',
                  overflow: 'hidden',
                }}
              >
                {outfitConfirmed && !tryOnActive ? (
                  <X size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                ) : (
                  <Check size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                )}
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tryOnActive
                    ? t('closeTryOn')
                    : outfitConfirmed
                    ? t('undoOutfitConfirm')
                    : t('chooseOutfit')}
                </span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddToCart}
                style={{
                  width: '100%',
                  minWidth: 0,
                  padding: '0 10px',
                  overflow: 'hidden',
                }}
              >
                <ShoppingCart size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('addToCart')}
                </span>
              </button>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleProceedToCheckout}
              style={{ width: '100%' }}
            >
              <ShoppingBag size={16} aria-hidden="true" />
              <span>{t('buyNow')}</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
