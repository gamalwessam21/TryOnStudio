import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  Ruler,
} from 'lucide-react';
import {
  fashionApi,
  formatGeneralApiError,
} from '../../services/fashionApi';
import type {
  FashionItemDetails,
  SizeCheckResult,
  SizeScanResult,
} from '../../types/api';
import { normalizeConfidence } from '../../utils/garmentHelpers';
import type { FormattedScanError, SizeScanPhase } from './useSizeScan';

interface SizeResultCardProps {
  item: FashionItemDetails | null;
  supportedSizes: string[];
  phase: SizeScanPhase;
  scanResult: SizeScanResult | null;
  scanError: FormattedScanError | null;
  scannedItemId: number | null;
  canRetryScan: boolean;
  onRetryScan: () => void;
}

export function SizeResultCard({
  item,
  supportedSizes,
  phase,
  scanResult,
  scanError,
  scannedItemId,
  canRetryScan,
  onRetryScan,
}: SizeResultCardProps) {
  const [selectedCheckSize, setSelectedCheckSize] = useState<string>('M');
  const [checkLoading, setCheckLoading] = useState<boolean>(false);
  const [checkResult, setCheckResult] = useState<SizeCheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Reset manual size-check result when switching products
  useEffect(() => {
    setCheckResult(null);
    setCheckError(null);
  }, [item?.id]);

  const isScanForCurrentItem =
    scanResult !== null && item !== null && scannedItemId === item.id;
  const isErrorForCurrentItem =
    phase === 'error' &&
    scanError !== null &&
    (scannedItemId === null || scannedItemId === item?.id);

  const normalizedConf = normalizeConfidence(scanResult?.confidence);
  const isSingleSizeItem =
    scanResult?.confidence?.trim().toLowerCase() === 'n/a';

  const sizeOptions =
    supportedSizes.length > 0
      ? supportedSizes
      : ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  async function handleManualSizeCheck() {
    if (!item) return;
    setCheckLoading(true);
    setCheckError(null);
    try {
      const res = await fashionApi.checkSize(item.id, selectedCheckSize);
      setCheckResult(res);
    } catch (err) {
      setCheckError(
        formatGeneralApiError(
          err,
          'Could not check size availability right now.'
        )
      );
    } finally {
      setCheckLoading(false);
    }
  }

  return (
    <section
      className={`card bottom-card size-result-card ${
        isScanForCurrentItem ? 'has-result' : ''
      }`}
      aria-label="Your size recommendation and availability"
    >
      <div className="bottom-card-header">
        <h2 className="bottom-card-title">
          {isScanForCurrentItem ? (
            <CheckCircle2
              size={19}
              color="var(--green-600)"
              aria-hidden="true"
            />
          ) : (
            <Ruler size={19} color="var(--blue-600)" aria-hidden="true" />
          )}
          <span>Your Size &amp; Fit Check</span>
        </h2>

        {isScanForCurrentItem && canRetryScan && (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={onRetryScan}
          >
            <RefreshCw size={13} aria-hidden="true" />
            <span>Scan Again</span>
          </button>
        )}
      </div>

      {/* 1. Scan Result View */}
      {isScanForCurrentItem && scanResult ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="recommended-size-hero">
            <div className="size-badge-xl">
              {scanResult.borderline && scanResult.sizeRange
                ? scanResult.sizeRange
                : scanResult.size || '—'}
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                {scanResult.borderline && scanResult.sizeRange
                  ? `Between ${scanResult.sizeRange} (Primary: ${
                      scanResult.size ?? scanResult.sizeRange
                    })`
                  : `Recommended Size: ${scanResult.size ?? 'Unavailable'}`}
              </div>
              {scanResult.borderline && (
                <span
                  className="borderline-pill"
                  style={{ display: 'inline-block', marginTop: 4 }}
                >
                  Borderline fit — size up for a looser drape
                </span>
              )}
            </div>
          </div>

          {/* Confidence Indicator */}
          <div className="confidence-meter">
            <span>
              Confidence:{' '}
              <strong style={{ textTransform: 'capitalize' }}>
                {isSingleSizeItem ? 'Single-size item' : normalizedConf}
              </strong>
            </span>
            {normalizedConf !== 'unavailable' && (
              <span className="confidence-bars" aria-hidden="true">
                <span className={`confidence-seg filled ${normalizedConf}`} />
                <span
                  className={`confidence-seg ${
                    normalizedConf === 'medium' || normalizedConf === 'high'
                      ? `filled ${normalizedConf}`
                      : ''
                  }`}
                />
                <span
                  className={`confidence-seg ${
                    normalizedConf === 'high' ? 'filled high' : ''
                  }`}
                />
              </span>
            )}
          </div>

          {normalizedConf === 'low' && (
            <div className="banner banner-warning">
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                Confidence was low. For a more accurate recommendation, step
                1–2m back in bright lighting with head-to-feet visible and scan
                again.
              </span>
            </div>
          )}

          {isSingleSizeItem && (
            <div className="banner banner-info">
              <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                This item is only manufactured in one size ({scanResult.size}),
                so it was selected directly.
              </span>
            </div>
          )}

          {scanResult.alternative && (
            <div className="alt-size-box">
              <div>
                <div
                  style={{
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                  }}
                >
                  Alternative Manufactured Size
                </div>
                <div style={{ fontSize: '0.98rem', fontWeight: 700 }}>
                  {scanResult.alternative}
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.76rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Secondary fit option
              </span>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 7,
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}
          >
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Camera body scan is an estimate offered within this product&apos;s
              manufactured sizes (does not reflect live warehouse stock).
            </span>
          </div>
        </div>
      ) : isErrorForCurrentItem && scanError ? (
        /* 2. Scan Error View */
        <div
          className="banner banner-error"
          role="alert"
          style={{ flexDirection: 'column', gap: 8 }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700 }}>{scanError.title}</div>
              <div style={{ marginTop: 2 }}>{scanError.message}</div>
              {scanError.recoveryHint && (
                <div
                  style={{
                    marginTop: 5,
                    fontSize: '0.79rem',
                    opacity: 0.92,
                  }}
                >
                  Tip: {scanError.recoveryHint}
                </div>
              )}
            </div>
          </div>

          {canRetryScan && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={onRetryScan}
              style={{ alignSelf: 'flex-end' }}
            >
              <RefreshCw size={13} aria-hidden="true" />
              <span>Try Scan Again</span>
            </button>
          )}
        </div>
      ) : (
        /* 3. Idle Prompt before Scan */
        <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
          Run <strong>Find My Size</strong> to see your AI-estimated size here,
          or check whether a specific size is manufactured for the selected item
          below.
        </p>
      )}

      {/* Manual Size Availability Checker (/api/fashion-items/{id}/size-check) */}
      {item && (
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 12,
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Check Manufactured Size Offering
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label
              htmlFor="manual-size-check-select"
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
              }}
            >
              Size to check
            </label>
            <select
              id="manual-size-check-select"
              value={selectedCheckSize}
              onChange={(e) => setSelectedCheckSize(e.target.value)}
              style={{
                height: 36,
                borderRadius: 8,
                border: '1px solid var(--border-strong)',
                padding: '0 10px',
                background: 'var(--bg-surface)',
                fontWeight: 600,
                fontSize: '0.84rem',
                minWidth: 82,
              }}
            >
              {sizeOptions.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => void handleManualSizeCheck()}
              disabled={checkLoading}
            >
              {checkLoading ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <span>Check Size</span>
              )}
            </button>
          </div>

          {checkError && (
            <div className="banner banner-error" style={{ padding: '8px 10px' }}>
              <span>{checkError}</span>
            </div>
          )}

          {checkResult && (
            <div
              className={`banner ${
                checkResult.availableSizes.length === 0
                  ? 'banner-warning'
                  : checkResult.isAvailable
                  ? 'banner-success'
                  : 'banner-info'
              }`}
              style={{ padding: '9px 11px', flexDirection: 'column', gap: 4 }}
              role="status"
            >
              {checkResult.availableSizes.length === 0 ? (
                <span>Sizes aren&apos;t available for this item.</span>
              ) : checkResult.isAvailable ? (
                <>
                  <strong>
                    Size {checkResult.requestedSize} is manufactured for{' '}
                    {item.name}.
                  </strong>
                  <span style={{ fontSize: '0.76rem', opacity: 0.9 }}>
                    Indicates manufactured size offering (not live stock
                    inventory).
                  </span>
                </>
              ) : (
                <>
                  <strong>
                    Size {checkResult.requestedSize} is not manufactured for{' '}
                    {item.name}.
                  </strong>
                  {checkResult.nearestAvailableSizes.length > 0 && (
                    <span>
                      Nearest manufactured alternatives:{' '}
                      <strong>
                        {checkResult.nearestAvailableSizes.join(', ')}
                      </strong>
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

