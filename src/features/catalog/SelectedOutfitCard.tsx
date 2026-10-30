import { AlertCircle, Check, RefreshCw, Shirt } from 'lucide-react';
import { GarmentImage } from '../../components/GarmentImage';
import type { FashionItemDetails, FashionVariant } from '../../types/api';
import { formatPrice } from '../../utils/garmentHelpers';

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
  onRetry,
}: SelectedOutfitCardProps) {
  const catalogSizes =
    supportedSizes.length > 0
      ? supportedSizes
      : ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  return (
    <section
      className="card bottom-card"
      aria-label="Selected garment and variant details"
    >
      <div className="bottom-card-header">
        <h2 className="bottom-card-title">
          <Shirt size={19} color="var(--blue-600)" aria-hidden="true" />
          <span>Selected Outfit</span>
        </h2>

        {outfitConfirmed && (
          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              color: 'var(--green-600)',
              background: 'var(--green-50)',
              border: '1px solid var(--green-border)',
              padding: '3px 9px',
              borderRadius: '999px',
            }}
          >
            Outfit Chosen
          </span>
        )}
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
            <span>Retry</span>
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
          Choose a garment from the catalog above to inspect its colors and
          manufactured sizes.
        </p>
      ) : (
        <>
          <div className="selected-outfit-body">
            <div className="selected-outfit-thumb">
              <GarmentImage
                src={variant?.imageUrl}
                alt={`${item.name}${
                  variant?.colorName ? ` — ${variant.colorName}` : ''
                }`}
                categoryName={item.categoryName}
                colorHex={variant?.colorHex}
                aspectRatio="4/5"
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
                  {item.name}
                </div>
                <div
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    marginTop: 2,
                  }}
                >
                  {formatPrice(item.price)}
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
                    Selected color variant
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

          {/* Offered / Manufactured Sizes */}
          <div>
            <div
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: 6,
              }}
            >
              Manufactured sizes:
            </div>
            {item.availableSizes.length > 0 ? (
              <div className="sizes-pill-row">
                {catalogSizes.map((sz) => {
                  const offered = item.availableSizes.includes(sz);
                  return (
                    <span
                      key={sz}
                      className={`size-chip ${offered ? '' : 'unoffered'}`}
                      title={
                        offered
                          ? `Manufactured in size ${sz}`
                          : `Not manufactured in size ${sz}`
                      }
                    >
                      {sz}
                    </span>
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
                Sizes aren&apos;t available for this item.
              </div>
            )}
          </div>

          <button
            type="button"
            className={`btn ${
              outfitConfirmed && !tryOnActive ? 'btn-secondary' : 'btn-navy'
            } btn-block`}
            onClick={onChooseOutfit}
            style={{ marginTop: 'auto' }}
          >
            <Check size={17} aria-hidden="true" />
            <span>
              {tryOnActive
                ? 'Choose This Outfit (Close Try-On)'
                : outfitConfirmed
                ? 'Outfit Selected for Size Scan'
                : 'Choose This Outfit'}
            </span>
          </button>
        </>
      )}
    </section>
  );
}

