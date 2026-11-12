import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  MousePointerClick,
  MoveHorizontal,
  Rotate3d,
  Ruler,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';
import type { FashionItemDetails, FashionVariant, RackItem } from '../../types/api';
import { formatDualPrice } from '../../utils/commerceHelpers';
import { useCommerce } from '../../app/CommerceContext';
import { useLanguage } from '../../i18n/LanguageContext';

export interface EnrichedRackPiece extends RackItem {
  categoryName?: string;
  description?: string;
  variants?: FashionVariant[];
  selectedVariant?: FashionVariant | null;
  availableSizes?: string[];
  selectedSize?: string | null;
}

interface ClothingRack360Props {
  rackItems: EnrichedRackPiece[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenInStudio: (id: number, variantId?: number) => void;
  onInspectItem?: (id: number) => void;
  onSelectVariant?: (itemId: number, variantId: number) => void;
  onSelectSize?: (itemId: number, size: string) => void;
  onAddToCart?: (itemId: number) => void;
  onBuyNow?: (itemId: number) => void;
  onOpenSizeGuide?: (itemId: number) => void;
  itemDetailsCache?: Record<number, FashionItemDetails>;
}

/**
 * Computes the Y coordinate (in viewBox 0..560 space) along the quadratic catenary wire
 * for a normalized horizontal coordinate u in [0, 1].
 * SVG quadratic Bezier from (0, 66) through control point (500, 148) to (1000, 66)
 * has exact midpoint y(0.5) = 0.5*66 + 0.5*148 = 107.
 * Formula: y(u) = 66 + 164 * u * (1 - u)
 */
function getWireY(u: number): number {
  const clamped = Math.max(0, Math.min(1, u));
  return 66 + 164 * clamped * (1 - clamped);
}

/**
 * Computes the wire tangent angle in degrees at normalized horizontal coordinate u in [0, 1].
 */
function getWireSlopeDeg(u: number): number {
  const clamped = Math.max(0, Math.min(1, u));
  const dy = 164 * (1 - 2 * clamped);
  return (Math.atan2(dy, 1000) * 180) / Math.PI;
}

export function ClothingRack360({
  rackItems,
  loading,
  error,
  onRetry,
  onOpenInStudio,
  onInspectItem,
  onSelectVariant,
  onSelectSize,
  onAddToCart,
  onBuyNow,
  onOpenSizeGuide,
}: ClothingRack360Props) {
  const { language, t } = useLanguage();
  const { usdToEgpRate } = useCommerce();

  const [renderOffset, setRenderOffset] = useState<number>(0);
  const [swayDeg, setSwayDeg] = useState<number>(0);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [turnedIdx, setTurnedIdx] = useState<number | null>(null);
  const [turnProgressMap, setTurnProgressMap] = useState<Record<number, number>>(
    {}
  );
  const [mouseScrubRatio, setMouseScrubRatio] = useState<number | null>(null);
  const [mouseFollowEnabled, setMouseFollowEnabled] = useState<boolean>(true);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const stageRef = useRef<HTMLDivElement | null>(null);
  const targetOffsetRef = useRef<number>(0);
  const currentOffsetRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const isPointerDownRef = useRef<boolean>(false);
  const pointerStartXRef = useRef<number>(0);
  const pointerStartOffsetRef = useRef<number>(0);
  const pointerMovedRef = useRef<boolean>(false);
  const preloadedRef = useRef<Set<string>>(new Set());
  const turnedIdxRef = useRef<number | null>(null);

  useEffect(() => {
    turnedIdxRef.current = turnedIdx;
  }, [turnedIdx]);

  // Preload 360° frames in background so frame scrubbing & turning is instant
  const preloadAllFrames = useCallback(() => {
    if (typeof Image === 'undefined') return;
    for (const item of rackItems) {
      if (preloadedRef.current.has(item.id)) continue;
      preloadedRef.current.add(item.id);
      for (const frameUrl of item.frames ?? []) {
        if (frameUrl) {
          const img = new Image();
          img.src = frameUrl;
        }
      }
    }
  }, [rackItems]);

  // Initialize or clamp center item when rackItems list changes (e.g. category filter)
  useEffect(() => {
    if (rackItems.length === 0) return;
    const mid = Math.min(
      rackItems.length - 1,
      Math.max(0, Math.floor((rackItems.length - 1) / 2))
    );
    targetOffsetRef.current = mid;
    currentOffsetRef.current = mid;
    setRenderOffset(mid);
    setActiveIdx(mid);
    setTurnedIdx(mid);
    setTurnProgressMap({ [mid]: 1 });
  }, [rackItems.length]);

  // Smooth physics loop: interpolates rack glide, pendulum velocity sway, and 360° turn progress
  useEffect(() => {
    if (rackItems.length === 0) return;
    let rafId = 0;

    const tick = () => {
      const target = targetOffsetRef.current;
      const current = currentOffsetRef.current;
      const diff = target - current;

      velocityRef.current = velocityRef.current * 0.76 + diff * 0.14;
      const nextOffset =
        Math.abs(diff) < 0.001 && Math.abs(velocityRef.current) < 0.001
          ? target
          : current + velocityRef.current;

      currentOffsetRef.current = nextOffset;

      const targetSway = Math.max(
        -11,
        Math.min(11, -velocityRef.current * 42)
      );

      setRenderOffset(nextOffset);
      setSwayDeg((prev) =>
        Math.abs(prev - targetSway) < 0.05
          ? targetSway
          : prev * 0.8 + targetSway * 0.2
      );

      const nearest = Math.max(
        0,
        Math.min(rackItems.length - 1, Math.round(nextOffset))
      );
      setActiveIdx(nearest);

      setTurnProgressMap((prev) => {
        let changed = false;
        const next: Record<number, number> = { ...prev };
        for (let i = 0; i < rackItems.length; i++) {
          const currentProg = prev[i] ?? 0;
          const distFromCenter = Math.abs(i - nextOffset);
          const isTurned =
            turnedIdxRef.current === i || distFromCenter < 0.38;
          const goal = isTurned ? 1 : 0;
          if (Math.abs(currentProg - goal) > 0.008) {
            changed = true;
            next[i] = currentProg + (goal - currentProg) * 0.14;
          } else if (currentProg !== goal) {
            changed = true;
            next[i] = goal;
          }
        }
        return changed ? next : prev;
      });

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [rackItems.length]);

  const clampOffset = useCallback(
    (val: number) => {
      if (rackItems.length <= 1) return 0;
      return Math.max(-0.25, Math.min(rackItems.length - 0.75, val));
    },
    [rackItems.length]
  );

  // Move mouse across stage -> glides the rack and scrubs 360 frames smoothly
  function handleStageMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    preloadAllFrames();
    if (isPointerDownRef.current || rackItems.length === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;

    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    if (mouseFollowEnabled && rackItems.length > 1) {
      const padded = Math.max(0, Math.min(1, (normX - 0.07) / 0.86));
      const desiredOffset = padded * (rackItems.length - 1);
      targetOffsetRef.current = clampOffset(desiredOffset);

      const nearest = Math.max(
        0,
        Math.min(rackItems.length - 1, Math.round(desiredOffset))
      );
      setTurnedIdx(nearest);
    }

    setMouseScrubRatio(normX);
  }

  function handleStageMouseLeave() {
    setMouseScrubRatio(null);
    const snapped = Math.max(
      0,
      Math.min(rackItems.length - 1, Math.round(targetOffsetRef.current))
    );
    targetOffsetRef.current = snapped;
    setTurnedIdx(snapped);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    preloadAllFrames();
    isPointerDownRef.current = true;
    pointerMovedRef.current = false;
    pointerStartXRef.current = e.clientX;
    pointerStartOffsetRef.current = targetOffsetRef.current;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isPointerDownRef.current || rackItems.length <= 1) return;
    const deltaX = e.clientX - pointerStartXRef.current;
    if (Math.abs(deltaX) > 6) {
      pointerMovedRef.current = true;
    }
    const stageWidth = stageRef.current?.clientWidth || 900;
    const slotPx = Math.max(130, stageWidth * 0.2);
    const nextTarget = clampOffset(
      pointerStartOffsetRef.current - deltaX / slotPx
    );
    targetOffsetRef.current = nextTarget;
    const nearest = Math.max(
      0,
      Math.min(rackItems.length - 1, Math.round(nextTarget))
    );
    setTurnedIdx(nearest);
  }

  function handlePointerUp() {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    const snapped = Math.max(
      0,
      Math.min(rackItems.length - 1, Math.round(targetOffsetRef.current))
    );
    targetOffsetRef.current = snapped;
  }

  function stepRack(delta: number) {
    preloadAllFrames();
    const nextIdx = Math.max(
      0,
      Math.min(rackItems.length - 1, Math.round(targetOffsetRef.current) + delta)
    );
    targetOffsetRef.current = nextIdx;
    setTurnedIdx(nextIdx);
  }

  function handleGarmentClick(idx: number, piece: EnrichedRackPiece) {
    if (pointerMovedRef.current) return;
    preloadAllFrames();

    const numericId = Number(piece.id);
    const validId = Number.isInteger(numericId) && numericId > 0;
    const isAlreadyCenteredAndTurned =
      Math.abs(renderOffset - idx) < 0.35 && (turnProgressMap[idx] ?? 0) > 0.75;

    if (!isAlreadyCenteredAndTurned) {
      targetOffsetRef.current = idx;
      setTurnedIdx(idx);
      return;
    }

    if (validId) {
      if (onInspectItem) {
        onInspectItem(numericId);
      } else {
        onOpenInStudio(numericId, piece.selectedVariant?.id);
      }
    }
  }

  const activePiece: EnrichedRackPiece | undefined = useMemo(
    () => rackItems[activeIdx] ?? rackItems[0],
    [rackItems, activeIdx]
  );

  if (!loading && !error && rackItems.length === 0) {
    return null;
  }

  const activeNumericId = activePiece ? Number(activePiece.id) : NaN;
  const canOpenActive =
    Number.isInteger(activeNumericId) && activeNumericId > 0;
  const activeVariants = activePiece?.variants ?? [];
  const activeSizes = activePiece?.availableSizes ?? [];

  return (
    <section
      className="hanging-rack-shell"
      aria-label={t('rackTitle')}
    >
      {/* Top Editorial Header Bar (NEW COLLECTION | PREMIUM STREETWEAR) */}
      <div className="hanging-rack-topbar">
        <div className="hanging-rack-brand-strip">
          <span className="hanging-rack-kicker">
            {language === 'ar' ? 'تشكيلة جديدة' : 'NEW COLLECTION'}
          </span>
          <span className="hanging-rack-divider" aria-hidden="true">
            |
          </span>
          <span className="hanging-rack-subkicker">
            {language === 'ar'
              ? 'أزياء ستريت وير فاخرة 360°'
              : 'PREMIUM STREETWEAR'}
          </span>
        </div>

        <div className="hanging-rack-controls">
          <button
            type="button"
            className={`hanging-rack-mode-btn ${
              mouseFollowEnabled ? 'active' : ''
            }`}
            onClick={() => setMouseFollowEnabled((v) => !v)}
            title={
              language === 'ar'
                ? 'تفعيل أو إيقاف تحريك العلاقة مع حركة الماوس'
                : 'Toggle automatic rack glide on mouse movement'
            }
          >
            <MoveHorizontal size={13} aria-hidden="true" />
            <span>
              {language === 'ar'
                ? mouseFollowEnabled
                  ? 'تتبع الماوس: مفعل'
                  : 'تتبع الماوس: متوقف'
                : mouseFollowEnabled
                ? 'Mouse Glide: ON'
                : 'Mouse Glide: OFF'}
            </span>
          </button>

          <div className="hanging-rack-arrows">
            <button
              type="button"
              className="hanging-rack-arrow-btn"
              onClick={() => stepRack(-1)}
              disabled={loading || activeIdx <= 0}
              aria-label={language === 'ar' ? 'القطعة السابقة' : 'Previous garment'}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="hanging-rack-counter">
              <bdi>
                {String(activeIdx + 1).padStart(2, '0')} /{' '}
                {String(Math.max(1, rackItems.length)).padStart(2, '0')}
              </bdi>
            </span>
            <button
              type="button"
              className="hanging-rack-arrow-btn"
              onClick={() => stepRack(1)}
              disabled={loading || activeIdx >= rackItems.length - 1}
              aria-label={language === 'ar' ? 'القطعة التالية' : 'Next garment'}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="banner banner-error" style={{ margin: '18px 24px' }}>
          <div style={{ flex: 1 }}>{error}</div>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={onRetry}
          >
            {t('retryBtn')}
          </button>
        </div>
      ) : loading ? (
        <div className="hanging-rack-loading">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="hanging-rack-skeleton-item">
              <div className="skeleton" style={{ width: 64, height: 24, borderRadius: 999 }} />
              <div className="skeleton" style={{ width: 190, height: 250, borderRadius: 20 }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Interactive Curved Wire Stage */}
          <div
            ref={stageRef}
            className="hanging-rack-stage"
            onMouseMove={handleStageMouseMove}
            onMouseLeave={handleStageMouseLeave}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Ambient Studio Glow Layers */}
            <div className="hanging-rack-ambient-glow" aria-hidden="true" />

            {/* Curved Clothesline / Steel Rail SVG */}
            <svg
              className="hanging-rack-wire-svg"
              viewBox="0 0 1000 560"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="rackWireGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.45" />
                  <stop offset="20%" stopColor="#475569" stopOpacity="0.85" />
                  <stop offset="50%" stopColor="#1e293b" stopOpacity="0.95" />
                  <stop offset="80%" stopColor="#475569" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.45" />
                </linearGradient>
                <filter id="wireDropShadow" x="-5%" y="-20%" width="110%" height="160%">
                  <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.12" />
                </filter>
              </defs>
              <path
                d="M 0 70 Q 500 152 1000 70"
                fill="none"
                stroke="rgba(15, 23, 42, 0.07)"
                strokeWidth="3.5"
              />
              <path
                d="M 0 66 Q 500 148 1000 66"
                fill="none"
                stroke="url(#rackWireGrad)"
                strokeWidth="2.4"
                filter="url(#wireDropShadow)"
              />
            </svg>

            {/* Hanging Garment Items Along the Curved Wire */}
            <div className="hanging-rack-items-layer">
              {rackItems.map((piece, idx) => {
                const frames = piece.frames ?? [];
                const totalFrames = frames.length;
                const numericId = Number(piece.id);
                const validId = Number.isInteger(numericId) && numericId > 0;

                const rel = idx - renderOffset;
                const slotSpacing = rackItems.length <= 4 ? 0.21 : 0.165;
                const u = 0.5 + rel * slotSpacing;

                // Skip rendering items far off-screen for smooth 60fps performance
                if (u < -0.25 || u > 1.25) {
                  return null;
                }

                const wireY = getWireY(u);
                const wireTopPercent = (wireY / 560) * 100;
                const wireSlope = getWireSlopeDeg(u);

                const turnProg = turnProgressMap[idx] ?? 0;
                const isCentered = Math.abs(rel) < 0.42;

                let frameIdx = 0;
                if (totalFrames > 1) {
                  const sideBaseFrame = Math.min(
                    totalFrames - 1,
                    Math.max(2, Math.round(totalFrames * 0.18))
                  );
                  const frontFrame = totalFrames - 1;
                  const interpolatedFrame =
                    sideBaseFrame + (frontFrame - sideBaseFrame) * turnProg;

                  const mouseWave =
                    mouseScrubRatio !== null
                      ? Math.round((mouseScrubRatio - 0.5) * (isCentered ? 4 : 2))
                      : 0;

                  frameIdx = Math.max(
                    0,
                    Math.min(
                      totalFrames - 1,
                      Math.round(interpolatedFrame + mouseWave)
                    )
                  );
                }

                const currentSrc =
                  frames[frameIdx] || frames[frames.length - 1] || '';
                const imgKey = `${piece.id}-${frameIdx}-${piece.selectedVariant?.id ?? 'def'}`;
                const hasFailed = failedImages[imgKey];

                const distAbs = Math.abs(rel);
                const scale =
                  0.82 +
                  0.24 * Math.max(0, 1 - distAbs * 0.45) +
                  0.06 * turnProg;
                const zIndex = Math.round(50 - distAbs * 10 + turnProg * 15);
                const opacity =
                  u < -0.1 || u > 1.1
                    ? 0
                    : u < 0.03 || u > 0.97
                    ? 0.45
                    : 1;

                const totalSwayDeg =
                  swayDeg * (0.75 + 0.25 * (1 - Math.min(1, distAbs * 0.3))) +
                  wireSlope * 0.35 * (1 - turnProg);

                // For items with a single frame (or custom variant selected), apply 3D perspective Y-rotation
                // so they also hang at a sideways angle on the rack and smoothly turn to face front!
                const syntheticRotateY =
                  totalFrames <= 1
                    ? (1 - turnProg) * (rel < 0 ? 34 : -34) +
                      (mouseScrubRatio !== null ? (mouseScrubRatio - 0.5) * 14 : 0)
                    : 0;

                const egpFormatted = Math.round(
                  piece.price * usdToEgpRate
                ).toLocaleString();

                return (
                  <div
                    key={piece.id}
                    className={`hanging-garment-anchor ${
                      isCentered ? 'is-centered' : ''
                    } ${turnProg > 0.7 ? 'is-turned-front' : 'is-sideways'}`}
                    style={{
                      left: `${u * 100}%`,
                      top: `${wireTopPercent}%`,
                      zIndex,
                      opacity,
                      pointerEvents:
                        u < -0.05 || u > 1.05 ? 'none' : 'auto',
                    }}
                  >
                    {/* Floating Price Tag Pill above the wire */}
                    <button
                      type="button"
                      className={`hanging-price-pill ${
                        isCentered ? 'active' : ''
                      }`}
                      onClick={() => handleGarmentClick(idx, piece)}
                    >
                      <bdi dir="ltr">
                        ${piece.price} · {egpFormatted} EGP
                      </bdi>
                    </button>

                    {/* Metallic Hanger Hook clipped directly onto the wire */}
                    <div className="hanging-wire-hook" aria-hidden="true">
                      <span className="hanging-wire-pin" />
                      <svg
                        width="28"
                        height="26"
                        viewBox="0 0 28 26"
                        fill="none"
                        className="hanging-hook-svg"
                      >
                        <path
                          d="M14 2 C18.5 2 20 5.5 17 8.5 C15 10.5 14 12 14 15 M4 24 L14 15 L24 24"
                          stroke="#475569"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>

                    {/* Swinging Garment Body with Pendulum Physics & 360° Frame Scrubbing */}
                    <div
                      className="hanging-garment-pendulum"
                      style={{
                        transform: `translateX(-50%) rotate(${totalSwayDeg.toFixed(
                          2
                        )}deg) scale(${scale.toFixed(3)})`,
                      }}
                      onClick={() => handleGarmentClick(idx, piece)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${piece.name} — ${formatDualPrice(
                        piece.price,
                        usdToEgpRate,
                        language
                      )}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleGarmentClick(idx, piece);
                        }
                      }}
                    >
                      <div
                        className="hanging-garment-figure"
                        style={
                          syntheticRotateY !== 0
                            ? {
                                transform: `perspective(900px) rotateY(${syntheticRotateY.toFixed(
                                  1
                                )}deg)`,
                              }
                            : undefined
                        }
                      >
                        {currentSrc && !hasFailed ? (
                          <img
                            src={currentSrc}
                            alt={piece.name}
                            draggable={false}
                            className="hanging-garment-img"
                            onError={() =>
                              setFailedImages((prev) => ({
                                ...prev,
                                [imgKey]: true,
                              }))
                            }
                          />
                        ) : (
                          <div className="hanging-garment-fallback">
                            <Rotate3d size={28} />
                            <span>{piece.name}</span>
                          </div>
                        )}

                        <div
                          className="hanging-garment-shadow"
                          aria-hidden="true"
                        />
                      </div>

                      {/* Quick Floating Action Pill when centered & facing front */}
                      {isCentered && turnProg > 0.65 && (
                        <div
                          className="hanging-garment-quickbar"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {validId && onInspectItem && (
                            <button
                              type="button"
                              className="hanging-quick-btn primary"
                              onClick={() => onInspectItem(numericId)}
                            >
                              <Eye size={13} aria-hidden="true" />
                              <span>
                                {language === 'ar'
                                  ? 'التفاصيل والمقاس'
                                  : 'Look Closer'}
                              </span>
                            </button>
                          )}
                          {validId && (
                            <button
                              type="button"
                              className="hanging-quick-btn studio"
                              onClick={() =>
                                onOpenInStudio(
                                  numericId,
                                  piece.selectedVariant?.id
                                )
                              }
                            >
                              <Sparkles size={13} aria-hidden="true" />
                              <span>{t('tryOn')}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Stage HUD Overlay */}
            <div className="hanging-rack-footer">
              <div className="hanging-rack-footer-left">
                {activePiece && (
                  <div className="hanging-rack-active-meta">
                    <span className="hanging-rack-active-badge">
                      <Rotate3d size={13} aria-hidden="true" />
                      <span>
                        {activePiece.categoryName || '360°'}
                      </span>
                    </span>
                    <strong className="hanging-rack-active-name">
                      <bdi>{activePiece.name}</bdi>
                    </strong>
                    <span className="hanging-rack-active-price">
                      <bdi dir="ltr">
                        {formatDualPrice(
                          activePiece.price,
                          usdToEgpRate,
                          language
                        )}
                      </bdi>
                    </span>
                  </div>
                )}

                {/* Inline Color Swatches & Size Pills for the Active Hanging Garment */}
                {activePiece && canOpenActive && (activeVariants.length > 0 || activeSizes.length > 0) && (
                  <div className="hanging-rack-inline-options">
                    {activeVariants.length > 0 && onSelectVariant && (
                      <div className="hanging-rack-swatches">
                        {activeVariants.map((v) => {
                          const isSelected =
                            activePiece.selectedVariant?.id === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() =>
                                onSelectVariant(activeNumericId, v.id)
                              }
                              title={v.colorName}
                              aria-label={`${activePiece.name} — ${v.colorName}`}
                              className={`hanging-swatch-dot ${
                                isSelected ? 'selected' : ''
                              }`}
                              style={{
                                background: v.colorHex || '#cbd5e1',
                              }}
                            />
                          );
                        })}
                        {activePiece.selectedVariant?.colorName && (
                          <span className="hanging-swatch-label">
                            <bdi>{activePiece.selectedVariant.colorName}</bdi>
                          </span>
                        )}
                      </div>
                    )}

                    {activeSizes.length > 0 && onSelectSize && (
                      <div className="hanging-rack-sizes">
                        {activeSizes.map((sz) => {
                          const isSelected = activePiece.selectedSize === sz;
                          return (
                            <button
                              key={sz}
                              type="button"
                              className={`size-chip ${
                                isSelected ? 'selected' : ''
                              }`}
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 8px',
                                minWidth: 28,
                                height: 26,
                              }}
                              onClick={() =>
                                onSelectSize(activeNumericId, sz)
                              }
                            >
                              {sz}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <p className="hanging-rack-hint">
                  <MousePointerClick size={14} aria-hidden="true" />
                  <span>
                    {language === 'ar'
                      ? 'حرّك الماوس لتحريك العلاقة وتدوير القطع 360°. اضغط على أي قطعة لتستدير نحوك، واضغط مرة أخرى لعرض التفاصيل.'
                      : 'Move mouse or drag to glide rack. Click a piece to turn it, click again to look closer.'}
                  </span>
                </p>
              </div>

              <div className="hanging-rack-footer-right">
                <p className="hanging-rack-editorial-copy">
                  {(
                    activePiece?.description
                      ?.replace(/\\n/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim() ||
                    (language === 'ar'
                      ? 'مصممة بخامات قطنية فاخرة وقصّات عصرية تدوم طويلاً.'
                      : 'Crafted in heavyweight cotton. Cut for modern silhouettes. Made to last.')
                  )}
                </p>
                <div className="hanging-rack-footer-cta-row">
                  {canOpenActive && (
                    <button
                      type="button"
                      className="hanging-rack-studio-cta"
                      onClick={() =>
                        onOpenInStudio(
                          activeNumericId,
                          activePiece?.selectedVariant?.id
                        )
                      }
                    >
                      <Sparkles size={14} aria-hidden="true" />
                      <span>{t('tryOn')}</span>
                    </button>
                  )}
                  {canOpenActive && onAddToCart && (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      style={{ borderRadius: 999 }}
                      onClick={() => onAddToCart(activeNumericId)}
                    >
                      <ShoppingCart size={14} aria-hidden="true" />
                      <span>{t('addToCart')}</span>
                    </button>
                  )}
                  {canOpenActive && onBuyNow && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      style={{ borderRadius: 999 }}
                      onClick={() => onBuyNow(activeNumericId)}
                    >
                      <ShoppingBag size={14} aria-hidden="true" />
                      <span>{t('buyNow')}</span>
                    </button>
                  )}
                  {canOpenActive && onOpenSizeGuide && (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      style={{ borderRadius: 999 }}
                      onClick={() => onOpenSizeGuide(activeNumericId)}
                      title={t('sizeGuide')}
                    >
                      <Ruler size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
