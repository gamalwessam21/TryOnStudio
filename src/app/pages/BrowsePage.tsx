import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Layers,
  RefreshCw,
  Ruler,
  Shirt,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { useStudio } from '../StudioContext';
import { useCommerce } from '../CommerceContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { GarmentImage } from '../../components/GarmentImage';
import { ClothingRack360 } from '../../features/catalog/ClothingRack360';
import { formatDualPrice } from '../../utils/commerceHelpers';
import { fashionApi } from '../../services/fashionApi';

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
  } = useStudio();
  const { usdToEgpRate, prepareCheckoutFromItem } = useCommerce();
  const { language, t } = useLanguage();

  const navigate = useNavigate();

  function openInStudio(id: number) {
    selectItem(id);
    navigate(`/?item=${id}`);
  }

  function openInSizeFinder(id: number) {
    selectItem(id);
    navigate(`/size-guide?item=${id}`);
  }

  async function handleQuickBuy(id: number) {
    selectItem(id);
    try {
      const details = await fashionApi.getFashionItemDetails(id);
      const defaultSize =
        details.availableSizes && details.availableSizes.length === 1
          ? details.availableSizes[0]
          : null;
      prepareCheckoutFromItem({
        item: details,
        variant: details.variants?.[0] ?? null,
        size: defaultSize,
        quantity: 1,
      });
      navigate('/checkout');
    } catch {
      navigate(`/?item=${id}`);
    }
  }

  return (
    <div className="browse-page">
      {/* Page Intro */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800 }}>
            Browse Clothing &amp; 360° Rack
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Explore all live garments from the Try On Studio catalog, rotate
            pieces in 360°, and open any item directly in the virtual mirror.
          </p>
        </div>
      </div>

      {/* 360 Interactive Rack */}
      <ClothingRack360
        rackItems={rackItems}
        loading={rackLoading}
        error={rackError}
        onRetry={() => void reloadRack()}
        onOpenInStudio={openInStudio}
      />

      {/* Full Catalog Section */}
      <section aria-label="Full clothing catalog">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 14,
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
              <span>All Categories</span>
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
                  {cat.itemCount} items
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
              Clear Search (&ldquo;{searchQuery}&rdquo;)
            </button>
          )}
        </div>

        {itemsError ? (
          <div className="banner banner-error">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{itemsError}</div>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => void reloadItems()}
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
          </div>
        ) : itemsLoading ? (
          <div className="catalog-full-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card catalog-card">
                <div
                  className="skeleton"
                  style={{ width: '100%', aspectRatio: '4/5' }}
                />
                <div
                  className="skeleton"
                  style={{ width: '70%', height: 18 }}
                />
                <div
                  className="skeleton"
                  style={{ width: '100%', height: 36 }}
                />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
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
            <h3>No clothing items matched your filter</h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategoryId(null);
              }}
            >
              Show All Clothing
            </button>
          </div>
        ) : (
          <div className="catalog-full-grid">
            {items.map((item) => (
              <article key={item.id} className="card catalog-card">
                <GarmentImage
                  src={item.thumbnailUrl}
                  alt={item.name}
                  categoryName={item.categoryName}
                  aspectRatio="4/5"
                />

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: 'var(--blue-600)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.categoryName}
                  </span>
                  <span className="product-variant-tag">
                    {item.variantCount}{' '}
                    {item.variantCount === 1 ? 'variant' : 'variants'}
                  </span>
                </div>

                <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>
                  {item.name}
                </h2>

                <p
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: 1.45,
                  }}
                >
                  {item.description}
                </p>

                <div
                  style={{
                    fontSize: '0.94rem',
                    fontWeight: 700,
                    marginTop: 'auto',
                    paddingTop: 4,
                    color: 'var(--accent)',
                  }}
                >
                  {formatDualPrice(item.price, usdToEgpRate, language)}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    style={{ flex: 1, minWidth: 105 }}
                    onClick={() => openInStudio(item.id)}
                  >
                    <Sparkles size={14} aria-hidden="true" />
                    <span>{t('tryOn')}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-accent"
                    style={{ flex: 1, minWidth: 95 }}
                    onClick={() => void handleQuickBuy(item.id)}
                    aria-label={`Buy ${item.name}`}
                  >
                    <ShoppingBag size={14} aria-hidden="true" />
                    <span>{t('buyNow')}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => openInSizeFinder(item.id)}
                    aria-label={`Check size for ${item.name}`}
                    title={t('sizeGuide')}
                  >
                    <Ruler size={14} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

