import { useRef } from 'react';
import {
  Camera,
  CameraOff,
  FlipHorizontal2,
  Loader2,
} from 'lucide-react';
import { useStudio } from '../StudioContext';
import { useCamera } from '../../hooks/useCamera';
import { useSizeScan } from '../../features/size-scan/useSizeScan';
import { SizeScanPanel } from '../../features/size-scan/SizeScanPanel';
import { SizeResultCard } from '../../features/size-scan/SizeResultCard';
import { GarmentImage } from '../../components/GarmentImage';
import {
  formatPrice,
  getSizeScanEligibility,
} from '../../utils/garmentHelpers';
import { useLanguage } from '../../i18n/LanguageContext';

export function SizeGuidePage() {
  const { t } = useLanguage();
  const {
    categories,
    allCatalogItems,
    items,
    supportedSizes,
    selectedItemId,
    selectedItemDetails,
    selectedVariant,
    selectItem,
  } = useStudio();

  const sizeScan = useSizeScan();
  const camera = useCamera(() => {
    sizeScan.cancelSizeScan();
  });
  const lastSecRef = useRef<number>(3);

  const catalogList = allCatalogItems.length > 0 ? allCatalogItems : items;
  const eligibility = getSizeScanEligibility(selectedItemDetails, categories);

  async function handleRunScan(countdownSec: number) {
    if (!selectedItemDetails || !eligibility.eligible) return;
    lastSecRef.current = countdownSec;

    if (camera.status !== 'live') {
      const stream = await camera.startCamera();
      if (!stream) return;
    }

    await sizeScan.startSizeScan(
      selectedItemDetails.id,
      camera.videoRef.current,
      countdownSec
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800 }}>
          {t('sizeGuideTitle')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {t('sizeGuideSubtitle')}
        </p>
      </div>

      {/* Product Picker Bar */}
      <section
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
        aria-label={t('selectedOutfitTitle')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {selectedItemDetails && (
            <div style={{ width: 58, flexShrink: 0 }}>
              <GarmentImage
                src={selectedVariant?.imageUrl || selectedItemDetails.thumbnailUrl}
                alt={selectedItemDetails.name}
                categoryName={selectedItemDetails.categoryName}
                aspectRatio="4/5"
                priority={true}
              />
            </div>
          )}
          <div>
            <label
              htmlFor="size-page-item-select"
              style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                marginBottom: 4,
              }}
            >
              {t('selectedOutfitTitle')}
            </label>
            <select
              id="size-page-item-select"
              value={selectedItemId ?? ''}
              onChange={(e) => selectItem(Number(e.target.value))}
              style={{
                height: 40,
                borderRadius: 10,
                border: '1px solid var(--border-strong)',
                padding: '0 12px',
                background: 'var(--bg-surface)',
                fontWeight: 600,
                minWidth: 250,
                maxWidth: '100%',
              }}
            >
              {catalogList.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} ({it.categoryName}) — {formatPrice(it.price)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedItemDetails && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {t('manufacturedSizesLabel')}: <bdi>{selectedItemDetails.name}</bdi>
            </span>
            {selectedItemDetails.availableSizes.length > 0 ? (
              <div className="sizes-pill-row">
                {selectedItemDetails.availableSizes.map((sz) => (
                  <span key={sz} className="size-chip">
                    <bdi>{sz}</bdi>
                  </span>
                ))}
              </div>
            ) : (
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--amber-700)',
                }}
              >
                {t('notInSelected')}
              </span>
            )}
          </div>
        )}
      </section>

      {/* Main Size Scan Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        {/* Dedicated Raw Camera Viewport */}
        <section
          className="mirror-card"
          style={{ minHeight: 420 }}
          aria-label={t('mirrorTitle')}
        >
          <div className="mirror-stage">
            <video
              ref={camera.videoRef}
              playsInline
              muted
              autoPlay
              className={`mirror-video ${camera.mirrorView ? 'mirrored' : ''} ${
                camera.status !== 'live' ? 'hidden' : ''
              }`}
            />
          </div>

          <div className="mirror-top-bar">
            <div
              className={`mirror-status-pill ${
                camera.status === 'live' ? 'live' : ''
              }`}
            >
              <span className="status-dot" aria-hidden="true" />
              <span>
                {camera.status === 'live'
                  ? t('cameraActive')
                  : t('cameraOff')}
              </span>
            </div>

            {camera.status === 'live' && (
              <button
                type="button"
                className="mirror-glass-btn"
                onClick={() => camera.setMirrorView((m) => !m)}
              >
                <FlipHorizontal2 size={14} aria-hidden="true" />
                <span>{camera.mirrorView ? t('mirrorViewBtn') : t('standardView')}</span>
              </button>
            )}
          </div>

          {(sizeScan.phase === 'countdown' ||
            sizeScan.phase === 'capturing' ||
            sizeScan.phase === 'uploading') && (
            <div className="mirror-scan-hud" role="status" aria-live="assertive">
              {sizeScan.phase === 'countdown' ? (
                <>
                  <div className="mirror-countdown-number">
                    <bdi>{sizeScan.countdownSeconds}</bdi>
                  </div>
                  <div style={{ fontWeight: 700 }}>
                    {t('stepBackInstruction')}
                  </div>
                </>
              ) : sizeScan.phase === 'capturing' ? (
                <>
                  <Loader2 size={42} className="spin" />
                  <div style={{ fontWeight: 700 }}>
                    {t('capturingHud', {
                      current: sizeScan.capturedCount,
                      total: sizeScan.totalFramesToCapture,
                    })}
                  </div>
                </>
              ) : (
                <>
                  <Loader2 size={42} className="spin" />
                  <div style={{ fontWeight: 700 }}>
                    {t('analyzingHud')}
                  </div>
                </>
              )}
            </div>
          )}

          {camera.status !== 'live' && (
            <div className="mirror-empty-state">
              <div className="mirror-empty-icon">
                <Camera size={28} />
              </div>
              <h2 className="mirror-empty-title">{t('mirrorTitle')}</h2>
              <p className="mirror-empty-desc">
                {t('cameraGuidanceDesc')}
              </p>
              {camera.errorMessage && (
                <div className="banner banner-error" role="alert">
                  {camera.errorMessage}
                </div>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void camera.startCamera()}
              >
                <Camera size={17} />
                <span>{t('turnOnCamera')}</span>
              </button>
            </div>
          )}

          {camera.status === 'live' && (
            <div className="mirror-bottom-bar">
              <button
                type="button"
                className="mirror-glass-btn"
                onClick={camera.stopCamera}
              >
                <CameraOff size={14} />
                <span>{t('turnOffCamera')}</span>
              </button>
            </div>
          )}
        </section>

        <SizeScanPanel
          item={selectedItemDetails}
          categories={categories}
          cameraLive={camera.status === 'live'}
          tryOnActive={false}
          phase={sizeScan.phase}
          countdownSeconds={sizeScan.countdownSeconds}
          countdownTotal={sizeScan.countdownTotal}
          capturedCount={sizeScan.capturedCount}
          totalFramesToCapture={sizeScan.totalFramesToCapture}
          onStartCamera={() => void camera.startCamera()}
          onTriggerScan={(sec) => void handleRunScan(sec)}
          onCancelScan={sizeScan.cancelSizeScan}
        />

        <SizeResultCard
          item={selectedItemDetails}
          supportedSizes={supportedSizes}
          phase={sizeScan.phase}
          scanResult={sizeScan.scanResult}
          scanError={sizeScan.scanError}
          scannedItemId={sizeScan.scannedItemId}
          canRetryScan={eligibility.eligible && !sizeScan.isScanning}
          onRetryScan={() => void handleRunScan(lastSecRef.current)}
        />
      </div>
    </div>
  );
}
