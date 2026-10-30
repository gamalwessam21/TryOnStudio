import { useState } from 'react';
import {
  AlertCircle,
  Check,
  Layers,
  Loader2,
  RefreshCw,
  Shirt,
  Sparkles,
} from 'lucide-react';
import { GarmentImage } from '../../components/GarmentImage';
import type {
  Category,
  FashionItem,
  FashionItemDetails,
  FashionVariant,
} from '../../types/api';
import { formatPrice } from '../../utils/garmentHelpers';
import type { TryOnStatus } from '../tryon/useDecartTryOn';

type SelectorTab = 'garments' | 'colors' | 'details';

interface GarmentSelectorPanelProps {
  categories: Category[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  selectedCategoryId: number | null;
  onSelectCategory: (id: number | null) => void;
  onRetryCategories: () => void;

  items: FashionItem[];
  itemsLoading: boolean;
  itemsError: string | null;
  onRetryItems: () => void;
  searchQuery: string;
  onClearSearch: () => void;

  selectedItemId: number | null;
  selectedItemDetails: FashionItemDetails | null;
  selectedVariant: FashionVariant | null;
  detailsLoading: boolean;
  onSelectItem: (id: number) => void;
  onSelectVariant: (variant: FashionVariant) => void;

  tryOnStatus: TryOnStatus;
  hasRemoteStream: boolean;
  onStartTryOn: () => void;
  onChooseOutfit: () => void;
}

function CategoryGlyph({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.includes('hoodie') || lower.includes('sweatshirt')) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M8 4L4 8L2 14L6 16L7 12V20H17V12L18 16L22 14L20 8L16 4C15 6 13.5 7 12 7C10.5 7 9 6 8 4Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (lower.includes('jacket')) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M8 4L4 7L3 18H8V20H16V18H21L20 7L16 4L12 8L8 4ZM12 8V20"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return <Shirt size={18} aria-hidden="true" />;
}

export function GarmentSelectorPanel({
  categories,
  categoriesLoading,
  categoriesError,
  selectedCategoryId,
  onSelectCategory,
  onRetryCategories,
  items,
  itemsLoading,
  itemsError,
  onRetryItems,
  searchQuery,
  onClearSearch,
  selectedItemId,
  selectedItemDetails,
  selectedVariant,
  detailsLoading,
  onSelectItem,
  onSelectVariant,
  tryOnStatus,
  hasRemoteStream,
  onStartTryOn,
  onChooseOutfit,
}: GarmentSelectorPanelProps) {
  const [activeTab, setActiveTab] = useState<SelectorTab>('garments');

  const isTryOnActive =
    (tryOnStatus === 'connected' || tryOnStatus === 'switching_garment') &&
    hasRemoteStream;
  const isTryOnBusy =
    tryOnStatus === 'fetching_token' ||
    tryOnStatus === 'connecting' ||
    tryOnStatus === 'switching_garment';

  const variants = selectedItemDetails?.variants ?? [];

  return (
    <section
      className="card selector-panel"
      aria-label="Clothing catalog and variant selector"
    >
      {/* Panel Tabs */}
      <div className="selector-tabs" role="tablist" aria-label="Garment selector tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'garments'}
          className={`selector-tab-btn ${activeTab === 'garments' ? 'active' : ''}`}
          onClick={() => setActiveTab('garments')}
        >
          Garments
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'colors'}
          className={`selector-tab-btn ${activeTab === 'colors' ? 'active' : ''}`}
          onClick={() => setActiveTab('colors')}
        >
          Colors ({variants.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'details'}
          className={`selector-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
      </div>

      {/* TAB 1: GARMENTS */}
      {activeTab === 'garments' && (
        <>
          {/* Dynamic Categories */}
          {categoriesError ? (
            <div className="banner banner-error" style={{ marginBottom: 10 }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>{categoriesError}</div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={onRetryCategories}
              >
                Retry
              </button>
            </div>
          ) : (
            <div
              className="category-pills"
              role="group"
              aria-label="Filter by clothing category"
            >
              <button
                type="button"
                className={`category-pill ${
                  selectedCategoryId === null ? 'active' : ''
                }`}
                onClick={() => onSelectCategory(null)}
              >
                <Layers size={17} aria-hidden="true" />
                <span>All</span>
              </button>

              {categoriesLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="skeleton"
                      style={{ width: 78, height: 58, flexShrink: 0 }}
                    />
                  ))
                : categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`category-pill ${
                        selectedCategoryId === cat.id ? 'active' : ''
                      }`}
                      onClick={() => onSelectCategory(cat.id)}
                    >
                      <CategoryGlyph name={cat.name} />
                      <span>{cat.name}</span>
                      <span className="category-pill-count">
                        {cat.itemCount} items
                      </span>
                    </button>
                  ))}
            </div>
          )}

          {/* Product Grid */}
          <div className="selector-scroll-area">
            {itemsError ? (
              <div className="banner banner-error">
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Catalog Unavailable</div>
                  <div>{itemsError}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={onRetryItems}
                >
                  <RefreshCw size={13} />
                  <span>Retry</span>
                </button>
              </div>
            ) : itemsLoading ? (
              <div className="selector-product-grid" aria-busy="true">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="product-mini-card"
                    aria-hidden="true"
                  >
                    <div
                      className="skeleton"
                      style={{ width: '100%', aspectRatio: '4/5' }}
                    />
                    <div
                      className="skeleton"
                      style={{ width: '80%', height: 14 }}
                    />
                    <div
                      className="skeleton"
                      style={{ width: '45%', height: 14 }}
                    />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '32px 16px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Shirt size={32} color="#94a3b8" />
                <div style={{ fontWeight: 600 }}>No matching garments found</div>
                <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                  {searchQuery
                    ? `No clothing items matched "${searchQuery}".`
                    : 'No items were returned for this category.'}
                </p>
                {(searchQuery || selectedCategoryId !== null) && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      onClearSearch();
                      onSelectCategory(null);
                    }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="selector-product-grid">
                {items.map((item) => {
                  const isSelected = item.id === selectedItemId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`product-mini-card ${
                        isSelected ? 'selected' : ''
                      }`}
                      onClick={() => onSelectItem(item.id)}
                      aria-pressed={isSelected}
                    >
                      {isSelected && (
                        <span
                          className="product-check-badge"
                          aria-label="Selected"
                        >
                          <Check size={13} strokeWidth={3} />
                        </span>
                      )}

                      <GarmentImage
                        src={item.thumbnailUrl}
                        alt={item.name}
                        categoryName={item.categoryName}
                        aspectRatio="4/5"
                      />

                      <div className="product-mini-title">{item.name}</div>

                      <div className="product-mini-meta">
                        <span className="product-mini-price">
                          {formatPrice(item.price)}
                        </span>
                        <span className="product-variant-tag">
                          {item.variantCount}{' '}
                          {item.variantCount === 1 ? 'color' : 'colors'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 2: COLORS / VARIANTS */}
      {activeTab === 'colors' && (
        <div className="selector-scroll-area">
          {detailsLoading ? (
            <div className="variant-list">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 180 }} />
              ))}
            </div>
          ) : !selectedItemDetails ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Select a garment first to browse its color variants.
            </p>
          ) : variants.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              No color variants were returned by the server for{' '}
              {selectedItemDetails.name}.
            </p>
          ) : (
            <div className="variant-list">
              {variants.map((variant) => {
                const isSelected = selectedVariant?.id === variant.id;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    className={`variant-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => onSelectVariant(variant)}
                    aria-pressed={isSelected}
                  >
                    <GarmentImage
                      src={variant.imageUrl}
                      alt={`${selectedItemDetails.name} in ${variant.colorName}`}
                      categoryName={selectedItemDetails.categoryName}
                      colorHex={variant.colorHex}
                      aspectRatio="4/5"
                    />
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 2,
                      }}
                    >
                      <span
                        className="swatch-dot"
                        style={{
                          backgroundColor: variant.colorHex || '#cbd5e1',
                        }}
                      />
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: '0.84rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {variant.colorName}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DETAILS */}
      {activeTab === 'details' && (
        <div
          className="selector-scroll-area"
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {detailsLoading ? (
            <div className="skeleton" style={{ height: 140 }} />
          ) : !selectedItemDetails ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Select a garment to inspect its full description and specifications.
            </p>
          ) : (
            <>
              <div>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--blue-600)',
                  }}
                >
                  {selectedItemDetails.categoryName}
                </span>
                <h3 style={{ fontSize: '1.1rem', marginTop: 2 }}>
                  {selectedItemDetails.name}
                </h3>
                <div
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginTop: 4,
                  }}
                >
                  {formatPrice(selectedItemDetails.price)}
                </div>
              </div>

              <p
                style={{
                  fontSize: '0.86rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.55,
                }}
              >
                {selectedItemDetails.description ||
                  'No product description provided by the catalog.'}
              </p>

              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  Manufactured Sizes
                </div>
                {selectedItemDetails.availableSizes.length > 0 ? (
                  <>
                    <div className="sizes-pill-row">
                      {selectedItemDetails.availableSizes.map((sz) => (
                        <span key={sz} className="size-chip">
                          {sz}
                        </span>
                      ))}
                    </div>
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginTop: 8,
                      }}
                    >
                      Note: Listed sizes indicate sizes manufactured for this
                      design, not live warehouse inventory stock.
                    </p>
                  </>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Sizes aren&apos;t available for this item (virtual try-on
                    showcase piece).
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Primary Try-On Action Footer */}
      <div className="selector-footer">
        {isTryOnActive ? (
          <button
            type="button"
            className="btn btn-navy btn-block"
            onClick={onChooseOutfit}
          >
            <Check size={18} aria-hidden="true" />
            <span>Choose This Outfit &amp; Close Try-On</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={onStartTryOn}
            disabled={!selectedItemDetails || !selectedVariant || isTryOnBusy}
          >
            {isTryOnBusy ? (
              <>
                <Loader2 size={18} className="spin" aria-hidden="true" />
                <span>
                  {tryOnStatus === 'fetching_token'
                    ? 'Requesting Token...'
                    : 'Connecting Try-On...'}
                </span>
              </>
            ) : (
              <>
                <Sparkles size={18} aria-hidden="true" />
                <span>Start Try-On</span>
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}

