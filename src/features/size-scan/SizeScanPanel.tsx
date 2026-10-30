import { useState } from 'react';
import {
  Camera,
  Check,
  Info,
  Loader2,
  ScanLine,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { Category, FashionItemDetails } from '../../types/api';
import { getSizeScanEligibility } from '../../utils/garmentHelpers';
import type { SizeScanPhase } from './useSizeScan';

interface SizeScanPanelProps {
  item: FashionItemDetails | null;
  categories: Category[];
  cameraLive: boolean;
  tryOnActive: boolean;
  phase: SizeScanPhase;
  countdownSeconds: number;
  countdownTotal: number;
  capturedCount: number;
  totalFramesToCapture: number;
  onStartCamera: () => void;
  onTriggerScan: (countdownSec: number) => void;
  onCancelScan: () => void;
}

export function SizeScanPanel({
  item,
  categories,
  cameraLive,
  tryOnActive,
  phase,
  countdownSeconds,
  countdownTotal,
  capturedCount,
  totalFramesToCapture,
  onStartCamera,
  onTriggerScan,
  onCancelScan,
}: SizeScanPanelProps) {
  const [countdownChoice, setCountdownChoice] = useState<3 | 8>(3);

  const eligibility = getSizeScanEligibility(item, categories);
  const isScanning =
    phase === 'countdown' || phase === 'capturing' || phase === 'uploading';

  // Compute SVG progress ring dashoffset
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let progressRatio = 1;
  if (phase === 'countdown' && countdownTotal > 0) {
    progressRatio = countdownSeconds / countdownTotal;
  } else if (phase === 'capturing' && totalFramesToCapture > 0) {
    progressRatio = capturedCount / totalFramesToCapture;
  }
  const strokeDashoffset = circumference * (1 - Math.max(0, Math.min(1, progressRatio)));

  return (
    <section
      className="card bottom-card size-scan-card"
      aria-label="Find My Size camera body scan"
    >
      <div className="bottom-card-header">
        <h2 className="bottom-card-title">
          <ScanLine size={19} color="var(--purple-600)" aria-hidden="true" />
          <span>Find My Size</span>
        </h2>

        {eligibility.eligible && !isScanning && (
          <div
            role="group"
            aria-label="Countdown timer before capture"
            style={{
              display: 'inline-flex',
              background: '#ede9fe',
              borderRadius: '999px',
              padding: 2,
              gap: 2,
            }}
          >
            {([3, 8] as const).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setCountdownChoice(sec)}
                aria-pressed={countdownChoice === sec}
                style={{
                  border: 'none',
                  borderRadius: '999px',
                  padding: '3px 9px',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  background:
                    countdownChoice === sec ? 'var(--purple-600)' : 'transparent',
                  color: countdownChoice === sec ? '#ffffff' : 'var(--purple-700)',
                }}
              >
                {sec}s timer
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Positioning Instructions (exact documented wording + lighting tip) */}
      <p
        style={{
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.48,
        }}
      >
        Stand 1–2 metres away from the camera. Keep your entire body visible from
        head to feet, face the camera, and leave a small gap between your arms
        and body.{' '}
        <span style={{ color: 'var(--text-muted)' }}>
          Good lighting and a clear, unobstructed view improve accuracy.
        </span>
      </p>

      {/* Ring + Checklist */}
      <div className="scan-layout">
        <div className="scan-ring-box" aria-hidden="true">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#e9d5ff"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="var(--purple-600)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset 250ms ease' }}
            />
          </svg>
          <div className="scan-ring-center">
            {phase === 'countdown' ? (
              <>
                <span className="scan-ring-value">{countdownSeconds}</span>
                <span className="scan-ring-sub">seconds</span>
              </>
            ) : phase === 'capturing' ? (
              <>
                <span className="scan-ring-value">
                  {capturedCount}/{totalFramesToCapture}
                </span>
                <span className="scan-ring-sub">frames</span>
              </>
            ) : phase === 'uploading' ? (
              <>
                <Loader2
                  size={26}
                  className="spin"
                  color="var(--purple-600)"
                />
                <span className="scan-ring-sub" style={{ marginTop: 4 }}>
                  analyzing
                </span>
              </>
            ) : (
              <>
                <span className="scan-ring-value">{countdownChoice}</span>
                <span className="scan-ring-sub">sec timer</span>
              </>
            )}
          </div>
        </div>

        <ul className="pose-checklist">
          <li>
            <Check size={14} color="var(--green-600)" aria-hidden="true" />
            <span>Full body visible (head to feet)</span>
          </li>
          <li>
            <Check size={14} color="var(--green-600)" aria-hidden="true" />
            <span>Face the camera directly</span>
          </li>
          <li>
            <Check size={14} color="var(--green-600)" aria-hidden="true" />
            <span>Small gap between arms &amp; body</span>
          </li>
          <li>
            <Check size={14} color="var(--green-600)" aria-hidden="true" />
            <span>Stand still in bright lighting</span>
          </li>
        </ul>
      </div>

      {/* Exact Required Privacy Notice */}
      <div className="privacy-note">
        <ShieldCheck
          size={14}
          style={{
            display: 'inline',
            verticalAlign: '-2px',
            marginRight: 5,
            color: 'var(--purple-600)',
          }}
          aria-hidden="true"
        />
        To find your size, a few photos are sent to our server for analysis and
        are not stored.
      </div>

      {/* Action Control based on Eligibility & Camera State */}
      {!eligibility.eligible ? (
        <div
          className="banner banner-info"
          role="status"
          style={{ marginTop: 'auto' }}
        >
          <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{eligibility.reason}</span>
        </div>
      ) : isScanning ? (
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 'auto',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            className="btn btn-purple"
            disabled
            style={{ flex: 1 }}
          >
            <Loader2 size={17} className="spin" aria-hidden="true" />
            <span>
              {phase === 'countdown'
                ? `Starting in ${countdownSeconds}s...`
                : phase === 'capturing'
                ? `Capturing (${capturedCount}/${totalFramesToCapture})...`
                : 'Analyzing Size...'}
            </span>
          </button>
          <button
            type="button"
            className="btn btn-danger-outline"
            onClick={onCancelScan}
          >
            <X size={16} aria-hidden="true" />
            <span>Cancel</span>
          </button>
        </div>
      ) : !cameraLive ? (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={onStartCamera}
          style={{ marginTop: 'auto' }}
        >
          <Camera size={17} aria-hidden="true" />
          <span>Turn On Camera to Find Your Size</span>
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-purple btn-block"
          onClick={() => onTriggerScan(countdownChoice)}
          style={{ marginTop: 'auto' }}
        >
          <ScanLine size={18} aria-hidden="true" />
          <span>
            {tryOnActive
              ? 'Close Try-On & Scan My Size'
              : `Find My Size (${item?.name ?? 'Selected Top'})`}
          </span>
        </button>
      )}
    </section>
  );
}

