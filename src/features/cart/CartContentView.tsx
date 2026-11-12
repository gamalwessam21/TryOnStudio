import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Gift,
  Minus,
  Plus,
  Shirt,
  ShoppingBag,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  useCommerce,
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
} from '../../app/CommerceContext';
import { useStudio } from '../../app/StudioContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { GarmentImage } from '../../components/GarmentImage';
import {
  calculateLoyaltyPointsEarned,
  convertUsdToEgp,
  formatDualPrice,
  formatEgp,
} from '../../utils/commerceHelpers';
import type { FashionVariant } from '../../types/api';

interface CartContentViewProps {
  compact?: boolean;
  onNavigateAway?: () => void;
}

export function CartContentView({
  compact = false,
  onNavigateAway,
}: CartContentViewProps) {
  const { language, t } = useLanguage();
  const {
    usdToEgpRate,
    loyaltyRules,
    loyaltyAccount,
    cartItems,
    cartTotalQuantity,
    cartNotice,
    clearCartNotice,
    updateCartItemQuantity,
    updateCartItemSize,
    updateCartItemVariant,
    syncCartItemCatalogData,
    removeCartItem,
    clearCart,
    startCartCheckout,
  } = useCommerce();
  const { itemDetailsCache, ensureItemDetails, selectItem } = useStudio();
  const navigate = useNavigate();

  const [validatingCatalog, setValidatingCatalog] = useState<boolean>(false);
  const [missingProductIds, setMissingProductIds] = useState<
    Record<number, boolean>
  >({});

  const uniqueItemIdsKey = Array.from(
    new Set(cartItems.map((c) => c.fashionItemId))
  )
    .sort((a, b) => a - b)
    .join(',');

  // Validate all cart items against live catalog details & sync authoritative prices/variants/sizes
  useEffect(() => {
    let cancelled = false;
    async function validateLines() {
      if (!uniqueItemIdsKey) return;
      const uniqueIds = uniqueItemIdsKey.split(',').map(Number);

      setValidatingCatalog(true);
      const missing: Record<number, boolean> = {};
      for (const id of uniqueIds) {
        if (cancelled) return;
        const details = itemDetailsCache[id] ?? (await ensureItemDetails(id));
        if (cancelled) return;
        if (!details) {
          missing[id] = true;
        } else {
          syncCartItemCatalogData(id, details);
        }
      }
      if (!cancelled) {
        setMissingProductIds(missing);
        setValidatingCatalog(false);
      }
    }
    void validateLines();
    return () => {
      cancelled = true;
    };
  }, [
    uniqueItemIdsKey,
    itemDetailsCache,
    ensureItemDetails,
    syncCartItemCatalogData,
  ]);

  if (cartItems.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: compact ? '28px 18px' : '48px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--bg-surface-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--blue-600)',
          }}
        >
          <ShoppingBag size={26} />
        </div>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
          {t('cartEmptyTitle')}
        </h2>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.88rem',
            maxWidth: 420,
          }}
        >
          {t('cartEmptyDesc')}
        </p>
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onNavigateAway?.();
              navigate('/browse');
            }}
          >
            <Shirt size={16} />
            <span>{t('navBrowse')}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              onNavigateAway?.();
              navigate('/');
            }}
          >
            <Sparkles size={16} />
            <span>{t('navStudio')}</span>
          </button>
        </div>
      </div>
    );
  }

  // Evaluate line validity & compute authoritative subtotal from catalog price when available
  const evaluatedLines = cartItems.map((line) => {
    const details = itemDetailsCache[line.fashionItemId];
    const isProductMissing = Boolean(missingProductIds[line.fashionItemId]);
    const offeredVariants: FashionVariant[] =
      details?.variants ??
      (line.variants?.map((v) => ({
        ...v,
        tryOnPrompt: null,
      })) ||
        []);
    const offeredSizes = details?.availableSizes ?? line.availableSizes ?? [];

    const isVariantInvalid =
      !isProductMissing &&
      Boolean(
        details &&
          offeredVariants.length > 0 &&
          line.variantId !== null &&
          !offeredVariants.some((v) => v.id === line.variantId)
      );
    const isSizeInvalid =
      !isProductMissing &&
      offeredSizes.length > 0 &&
      (!line.size || !offeredSizes.includes(line.size));

    const authoritativeUsd = details ? details.price : line.unitPriceUsd;
    const unitPriceEgp = convertUsdToEgp(authoritativeUsd, usdToEgpRate);
    const lineTotalEgp = unitPriceEgp * line.quantity;

    return {
      line,
      details,
      offeredVariants,
      offeredSizes,
      isProductMissing,
      isVariantInvalid,
      isSizeInvalid,
      hasIssue: isProductMissing || isVariantInvalid || isSizeInvalid,
      authoritativeUsd,
      unitPriceEgp,
      lineTotalEgp,
    };
  });

  const hasInvalidLines = evaluatedLines.some((l) => l.hasIssue);
  const subtotalEgp = evaluatedLines.reduce(
    (sum, l) => sum + (l.isProductMissing ? 0 : l.lineTotalEgp),
    0
  );
  const estimatedPoints = calculateLoyaltyPointsEarned(
    subtotalEgp,
    loyaltyRules
  );

  const handleProceedToCheckout = () => {
    if (hasInvalidLines) return;
    startCartCheckout();
    onNavigateAway?.();
    navigate('/checkout');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {cartNotice && (
        <div
          className="banner banner-warning"
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <span>{cartNotice}</span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={clearCartNotice}
          >
            {t('dismissBanner')}
          </button>
        </div>
      )}

      {hasInvalidLines && (
        <div className="banner banner-error" role="alert">
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div>
            {language === 'ar'
              ? 'بعض المنتجات في سلتك تحتاج إلى اختيار مقاس أو لون صالح أو إزالتها قبل المتابعة لإتمام الشراء.'
              : 'One or more cart lines require a valid size/color selection or removal before proceeding to checkout.'}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <strong>{cartItems.length}</strong> / {MAX_CART_LINES}{' '}
          {language === 'ar' ? 'سطر منتجات' : 'product lines'} •{' '}
          <strong>{cartTotalQuantity}</strong>{' '}
          {language === 'ar' ? 'إجمالي القطع' : 'total units'}
          {validatingCatalog && (
            <span style={{ marginInlineStart: 8, color: 'var(--text-muted)' }}>
              ({language === 'ar' ? 'جاري التحقق...' : 'Verifying catalog...'})
            </span>
          )}
        </div>

        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={clearCart}
        >
          <Trash2 size={14} />
          <span>{t('clearCartBtn')}</span>
        </button>
      </div>

      {/* Cart Lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {evaluatedLines.map(
          ({
            line,
            offeredVariants,
            offeredSizes,
            isProductMissing,
            isVariantInvalid,
            isSizeInvalid,
            hasIssue,
            authoritativeUsd,
            lineTotalEgp,
          }) => (
            <article
              key={line.lineKey}
              className="card"
              style={{
                padding: 14,
                border: hasIssue
                  ? '1.5px solid var(--red-500, #ef4444)'
                  : '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div className="cart-line-item-grid">
                <div
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    selectItem(line.fashionItemId, line.variantId ?? undefined);
                    onNavigateAway?.();
                    navigate(`/?item=${line.fashionItemId}`);
                  }}
                >
                  <GarmentImage
                    src={line.imageUrl}
                    alt={line.name}
                    categoryName={line.categoryName}
                    colorHex={line.colorHex ?? undefined}
                    aspectRatio="4/5"
                  />
                </div>

                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: 'var(--blue-600)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {line.categoryName}
                      </div>
                      <h3 style={{ fontSize: '0.96rem', fontWeight: 700 }}>
                        <bdi>{line.name}</bdi>
                      </h3>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <bdi dir="ltr">
                          {formatDualPrice(
                            authoritativeUsd,
                            usdToEgpRate,
                            language
                          )}
                        </bdi>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => removeCartItem(line.lineKey)}
                      aria-label={`${t('removeItemBtn')} ${line.name}`}
                      title={t('removeItemBtn')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Inline Variant Picker */}
                  {offeredVariants.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {t('tabColors')}:
                      </span>
                      <select
                        aria-label={`Color for ${line.name}`}
                        value={line.variantId ?? ''}
                        onChange={(e) => {
                          const targetVar = offeredVariants.find(
                            (v) => v.id === Number(e.target.value)
                          );
                          if (targetVar) {
                            updateCartItemVariant(line.lineKey, targetVar);
                          }
                        }}
                        style={{
                          height: 30,
                          borderRadius: 7,
                          border: isVariantInvalid
                            ? '1.5px solid #ef4444'
                            : '1px solid var(--border-strong)',
                          padding: '0 8px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          background: 'var(--bg-surface)',
                        }}
                      >
                        {isVariantInvalid && (
                          <option value="">
                            {language === 'ar'
                              ? 'اختر لوناً صالحاً'
                              : 'Select valid color'}
                          </option>
                        )}
                        {offeredVariants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.colorName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Inline Size Picker */}
                  {offeredSizes.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {t('sizeCol')}:
                      </span>
                      <div className="sizes-pill-row">
                        {offeredSizes.map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            className={`size-chip ${
                              line.size === sz ? 'selected active' : ''
                            }`}
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 8px',
                              minWidth: 28,
                            }}
                            onClick={() => updateCartItemSize(line.lineKey, sz)}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quantity & Line Subtotal */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                      marginTop: 2,
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        disabled={line.quantity <= 1}
                        onClick={() =>
                          updateCartItemQuantity(
                            line.lineKey,
                            line.quantity - 1
                          )
                        }
                        aria-label={`Decrease quantity for ${line.name}`}
                      >
                        <Minus size={12} />
                      </button>
                      <span
                        style={{
                          minWidth: 26,
                          textAlign: 'center',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                        }}
                      >
                        <bdi>{line.quantity}</bdi>
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        disabled={line.quantity >= MAX_LINE_QUANTITY}
                        onClick={() =>
                          updateCartItemQuantity(
                            line.lineKey,
                            line.quantity + 1
                          )
                        }
                        aria-label={`Increase quantity for ${line.name}`}
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    <div
                      style={{
                        fontSize: '0.92rem',
                        fontWeight: 800,
                        color: 'var(--accent)',
                      }}
                    >
                      <bdi dir="ltr">{formatEgp(lineTotalEgp, language)}</bdi>
                    </div>
                  </div>
                </div>
              </div>

              {hasIssue && (
                <div
                  className="banner banner-error"
                  style={{ padding: '7px 10px', fontSize: '0.78rem' }}
                >
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  <span>
                    {isProductMissing
                      ? language === 'ar'
                        ? 'هذا المنتج لم يعد متوفراً في الكتالوج. يرجى حذفه من السلة.'
                        : 'This product is no longer available in the catalog. Please remove it.'
                      : isVariantInvalid
                      ? language === 'ar'
                        ? 'اللون المحدد لم يعد متوفراً. يرجى اختيار لون آخر.'
                        : 'Selected color variant is no longer offered. Please choose another color.'
                      : isSizeInvalid
                      ? language === 'ar'
                        ? 'يرجى اختيار مقاس متاح لهذه القطعة قبل إتمام الشراء.'
                        : 'Please select an offered size for this item before checkout.'
                      : ''}
                  </span>
                </div>
              )}
            </article>
          )
        )}
      </div>

      {/* Cart Summary Footer */}
      <div
        className="card"
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: 'var(--bg-surface-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.95rem',
          }}
        >
          <span style={{ fontWeight: 600 }}>{t('subtotal')}</span>
          <strong style={{ fontSize: '1.08rem', color: 'var(--accent)' }}>
            <bdi dir="ltr">{formatEgp(subtotalEgp, language)}</bdi>
          </strong>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.82rem',
            color: 'var(--green-600)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Gift size={14} />
            <span>{t('loyaltyPointsEarned')}</span>
          </span>
          <strong>
            <bdi>+{estimatedPoints}</bdi>{' '}
            {language === 'ar' ? 'نقطة' : 'pts'}
          </strong>
        </div>

        {loyaltyAccount && loyaltyAccount.currentBalance > 0 && (
          <div
            style={{
              fontSize: '0.79rem',
              color: 'var(--blue-600)',
              fontWeight: 600,
            }}
          >
            {language === 'ar'
              ? `رصيدك الموثق: ${loyaltyAccount.currentBalance} نقطة (خصم متاح حتى ${formatEgp(
                  loyaltyAccount.availableDiscountEgp,
                  language
                )} عند الدفع).`
              : `Verified balance: ${loyaltyAccount.currentBalance} pts (up to ${formatEgp(
                  loyaltyAccount.availableDiscountEgp,
                  language
                )} discount at checkout).`}
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={hasInvalidLines || cartItems.length === 0}
          onClick={handleProceedToCheckout}
          style={{ marginTop: 4 }}
        >
          <ShoppingBag size={16} />
          <span>{t('proceedToCheckout')}</span>
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
