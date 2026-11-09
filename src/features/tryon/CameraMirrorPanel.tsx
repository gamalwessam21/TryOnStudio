import {
  AlertTriangle,
  Camera,
  CameraOff,
  ChevronLeft,
  ChevronRight,
  FlipHorizontal2,
  Hand,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import type { CameraStatus } from '../../hooks/useCamera';
import type {
  TryOnErrorState,
  TryOnStatus,
} from './useDecartTryOn';
import type {
  GestureEngineStatus,
  GestureEventFeedback,
} from './useGestureNavigation';
import type { SwipeDirection } from './swipeDetector';
import type { SizeScanPhase } from '../size-scan/useSizeScan';
import { useLanguage } from '../../i18n/LanguageContext';

interface CameraMirrorPanelProps {
  cameraVideoRef: React.RefObject<HTMLVideoElement | null>;
  tryOnVideoRef: React.RefObject<HTMLVideoElement | null>;
  cameraStatus: CameraStatus;
  cameraError: string | null;
  mirrorView: boolean;
  onToggleMirror: () => void;
  onStartCamera: () => void;
  onStopCamera: () => void;

  tryOnStatus: TryOnStatus;
  hasRemoteStream: boolean;
  tryOnError: TryOnErrorState | null;
  onRetryTryOn: () => void;
  onDisconnectTryOn: () => void;
  onDismissTryOnError: () => void;

  gestureStatus: GestureEngineStatus;
  lastGesture: GestureEventFeedback | null;
  onStepGarment: (direction: SwipeDirection) => void;

  scanPhase: SizeScanPhase;
  countdownSeconds: number;
  capturedCount: number;
  totalFramesToCapture: number;

  selectedLabel?: string;
}

export function CameraMirrorPanel({
  cameraVideoRef,
  tryOnVideoRef,
  cameraStatus,
  cameraError,
  mirrorView,
  onToggleMirror,
  onStartCamera,
  onStopCamera,
  tryOnStatus,
  hasRemoteStream,
  tryOnError,
  onRetryTryOn,
  onDisconnectTryOn,
  onDismissTryOnError,
  gestureStatus,
  lastGesture,
  onStepGarment,
  scanPhase,
  countdownSeconds,
  capturedCount,
  totalFramesToCapture,
  selectedLabel,
}: CameraMirrorPanelProps) {
  const { t } = useLanguage();

  const isTryOnConnected =
    (tryOnStatus === 'connected' || tryOnStatus === 'switching_garment') &&
    hasRemoteStream;

  const isTryOnConnecting =
    tryOnStatus === 'fetching_token' ||
    tryOnStatus === 'connecting' ||
    (tryOnStatus === 'connected' && !hasRemoteStream);

  return (
    <section
      className="mirror-card"
      aria-label={t('mirrorTitle')}
    >
      {/* Video Stage */}
      <div className="mirror-stage">
        {/* Raw Camera Video (used for normal preview, MediaPipe gestures, and Size Scan) */}
        <video
          ref={cameraVideoRef}
          playsInline
          muted
          autoPlay
          aria-label="Live camera preview"
          className={`mirror-video ${mirrorView ? 'mirrored' : ''} ${
            cameraStatus !== 'live' || isTryOnConnected ? 'hidden' : ''
          }`}
        />

        {/* Separate Decart Virtual Try-On Remote Video Output */}
        <video
          ref={tryOnVideoRef}
          playsInline
          muted
          autoPlay
          aria-label="AI virtual try-on stream"
          className={`mirror-video ${!isTryOnConnected ? 'hidden' : ''}`}
        />
      </div>

      {/* Framing Corner Brackets */}
      {cameraStatus === 'live' && (
        <div className="mirror-brackets" aria-hidden="true">
          <span className="bracket tl" />
          <span className="bracket tr" />
          <span className="bracket bl" />
          <span className="bracket br" />
        </div>
      )}

      {/* Top Mirror Controls & Mode Badges */}
      <div className="mirror-top-bar">
        <div className="mirror-badge-group">
          {isTryOnConnected ? (
            <div className="mirror-status-pill tryon-active" role="status">
              <Sparkles size={14} aria-hidden="true" />
              <span>
                {tryOnStatus === 'switching_garment'
                  ? t('switchingGarment')
                  : t('virtualTryOnActive')}
              </span>
            </div>
          ) : isTryOnConnecting ? (
            <div className="mirror-status-pill tryon-active" role="status">
              <Loader2 size={14} className="spin" aria-hidden="true" />
              <span>
                {tryOnStatus === 'fetching_token'
                  ? t('requestingToken')
                  : t('connectingToService')}
              </span>
            </div>
          ) : cameraStatus === 'live' ? (
            <div className="mirror-status-pill live" role="status">
              <span className="status-dot" aria-hidden="true" />
              <span>{t('cameraPreviewOnly')}</span>
            </div>
          ) : cameraStatus === 'requesting' ? (
            <div className="mirror-status-pill" role="status">
              <Loader2 size={14} className="spin" aria-hidden="true" />
              <span>{t('waitingPermission')}</span>
            </div>
          ) : (
            <div className="mirror-status-pill" role="status">
              <CameraOff size={14} aria-hidden="true" />
              <span>{t('cameraOff')}</span>
            </div>
          )}

          {selectedLabel && cameraStatus === 'live' && (
            <div
              className="mirror-status-pill"
              title={`Selected garment: ${selectedLabel}`}
            >
              <span>{t('selectedOutfitTitle')}: <bdi>{selectedLabel}</bdi></span>
            </div>
          )}
        </div>

        <div className="mirror-badge-group">
          {cameraStatus === 'live' && !isTryOnConnected && (
            <button
              type="button"
              className="mirror-glass-btn"
              onClick={onToggleMirror}
              aria-pressed={mirrorView}
              title="Toggle mirror reflection view"
            >
              <FlipHorizontal2 size={15} aria-hidden="true" />
              <span>{mirrorView ? t('mirrorViewBtn') : t('standardView')}</span>
            </button>
          )}

          {(isTryOnConnected || isTryOnConnecting) && (
            <button
              type="button"
              className="mirror-glass-btn"
              onClick={onDisconnectTryOn}
              aria-label={t('endTryOn')}
            >
              <X size={15} aria-hidden="true" />
              <span>{t('endTryOn')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Recognized Hand-Swipe Toast */}
      {lastGesture && isTryOnConnected && (
        <div className="mirror-gesture-toast" role="status" aria-live="polite">
          {lastGesture.direction === 'next' ? t('swipeNext') : t('swipePrev')}
        </div>
      )}

      {/* Size Scan Countdown / Capture HUD inside Mirror */}
      {(scanPhase === 'countdown' ||
        scanPhase === 'capturing' ||
        scanPhase === 'uploading') && (
        <div className="mirror-scan-hud" role="status" aria-live="assertive">
          {scanPhase === 'countdown' && (
            <>
              <div className="mirror-countdown-number"><bdi>{countdownSeconds}</bdi></div>
              <div style={{ fontWeight: 700, fontSize: '1.08rem' }}>
                {t('stepBackInstruction')}
              </div>
              <div style={{ fontSize: '0.86rem', color: '#e2e8f0' }}>
                {t('standFacingInstruction')}
              </div>
            </>
          )}

          {scanPhase === 'capturing' && (
            <>
              <Loader2 size={46} className="spin" aria-hidden="true" />
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                {t('capturingHud', { current: capturedCount, total: totalFramesToCapture })}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
                {t('holdSteady')}
              </div>
            </>
          )}

          {scanPhase === 'uploading' && (
            <>
              <Loader2 size={46} className="spin" aria-hidden="true" />
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                {t('analyzingHud')}
              </div>
              <div style={{ fontSize: '0.84rem', color: '#e2e8f0', maxWidth: 340 }}>
                {t('analyzingDesc')}
              </div>
            </>
          )}
        </div>
      )}

      {/* Camera Off / Permission Guidance State */}
      {cameraStatus !== 'live' && (
        <div className="mirror-empty-state">
          <div className="mirror-empty-icon" aria-hidden="true">
            {cameraStatus === 'requesting' ? (
              <Loader2 size={30} className="spin" />
            ) : (
              <Camera size={30} />
            )}
          </div>
          <h2 className="mirror-empty-title">
            {cameraStatus === 'requesting'
              ? t('allowCameraTitle')
              : t('mirrorTitle')}
          </h2>
          <p className="mirror-empty-desc">
            {cameraStatus === 'requesting'
              ? t('allowCameraDesc')
              : t('cameraGuidanceDesc')}
          </p>

          {cameraError && (
            <div
              className="banner banner-error"
              role="alert"
              style={{ textAlign: 'start', width: '100%' }}
            >
              <AlertTriangle
                size={18}
                style={{ flexShrink: 0, marginTop: 2 }}
                aria-hidden="true"
              />
              <span>{cameraError}</span>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={onStartCamera}
            disabled={cameraStatus === 'requesting'}
          >
            <Camera size={18} aria-hidden="true" />
            <span>
              {cameraStatus === 'error' ? t('retryCameraAccess') : t('turnOnCamera')}
            </span>
          </button>
        </div>
      )}

      {/* Honest Decart Virtual Try-On Error Callout */}
      {tryOnError && (
        <div
          className={`mirror-overlay-banner ${
            tryOnError.isBackendKeyMissing ? 'warning' : ''
          }`}
          role="alert"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <AlertTriangle
                size={18}
                color={tryOnError.isBackendKeyMissing ? '#fbbf24' : '#f87171'}
                style={{ flexShrink: 0, marginTop: 2 }}
                aria-hidden="true"
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                  {tryOnError.title}
                </div>
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: '#cbd5e1',
                    marginTop: 2,
                    lineHeight: 1.45,
                  }}
                >
                  {tryOnError.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onDismissTryOnError}
              aria-label={t('dismissBanner')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                padding: 4,
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={onRetryTryOn}
            >
              <RefreshCw size={13} aria-hidden="true" />
              <span>{t('retryTryOn')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Mirror Controls */}
      <div className="mirror-bottom-bar">
        {cameraStatus === 'live' ? (
          <button
            type="button"
            className="mirror-glass-btn"
            onClick={onStopCamera}
          >
            <CameraOff size={15} aria-hidden="true" />
            <span>{t('turnOffCamera')}</span>
          </button>
        ) : (
          <span />
        )}

        {/* Gesture & Manual Garment Cycling Bar when Virtual Try-On is Connected */}
        {isTryOnConnected && (
          <div className="gesture-bar">
            <button
              type="button"
              className="gesture-step-btn"
              onClick={() => onStepGarment('prev')}
              disabled={tryOnStatus === 'switching_garment'}
              aria-label="Select previous garment or variant"
              title="Previous garment or color"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="gesture-bar-text">
              <Hand size={15} aria-hidden="true" />
              <span>
                {gestureStatus === 'ready'
                  ? t('swipeOrArrows')
                  : gestureStatus === 'loading'
                  ? t('loadingGestureTracker')
                  : t('useArrowsToSwitch')}
              </span>
            </span>

            <button
              type="button"
              className="gesture-step-btn"
              onClick={() => onStepGarment('next')}
              disabled={tryOnStatus === 'switching_garment'}
              aria-label="Select next garment or variant"
              title="Next garment or color"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
