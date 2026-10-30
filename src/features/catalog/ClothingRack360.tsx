import { useRef, useState } from 'react';
import { Rotate3d, Sparkles } from 'lucide-react';
import type { RackItem } from '../../types/api';
import { formatPrice } from '../../utils/garmentHelpers';

interface RackPieceCardProps {
  piece: RackItem;
  onTryOn: (numericId: number) => void;
}

function RackPieceCard({ piece, onTryOn }: RackPieceCardProps) {
  const frames = piece.frames ?? [];
  // Frames are ordered: [0] = back, [last] = front facing viewer
  const initialIndex = frames.length > 0 ? frames.length - 1 : 0;
  const [frameIndex, setFrameIndex] = useState<number>(initialIndex);
  const [imgFailed, setImgFailed] = useState<boolean>(false);
  const dragStartXRef = useRef<number | null>(null);
  const dragStartFrameRef = useRef<number>(initialIndex);

  const numericId = Number(piece.id);
  const canOpenInStudio = Number.isInteger(numericId) && numericId > 0;

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (frames.length <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartXRef.current = e.clientX;
    dragStartFrameRef.current = frameIndex;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStartXRef.current === null || frames.length <= 1) return;
    const deltaX = e.clientX - dragStartXRef.current;
    const step = Math.round(deltaX / 10);
    const nextIdx =
      (((dragStartFrameRef.current + step) % frames.length) + frames.length) %
      frames.length;
    setFrameIndex(nextIdx);
  }

  function handlePointerUp() {
    dragStartXRef.current = null;
  }

  const currentSrc = frames[frameIndex] || '';

  return (
    <article className="rack-card">
      <div
        className="rack-stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title="Drag left or right to rotate 360°"
      >
        {currentSrc && !imgFailed ? (
          <img
            src={currentSrc}
            alt={`${piece.name} — rotation angle ${frameIndex + 1} of ${
              frames.length
            }`}
            draggable={false}
            onError={() => setImgFailed(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              padding: 8,
            }}
          />
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
            }}
          >
            360° preview unavailable
          </div>
        )}

        {frames.length > 1 && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'rgba(15, 23, 42, 0.72)',
              color: '#ffffff',
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Rotate3d size={12} aria-hidden="true" />
            <span>Drag 360°</span>
          </span>
        )}
      </div>

      {frames.length > 1 && (
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={frameIndex}
          onChange={(e) => setFrameIndex(Number(e.target.value))}
          aria-label={`Rotate ${piece.name} 360 degrees`}
          style={{ width: '100%', accentColor: 'var(--blue-600)' }}
        />
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>{piece.name}</h3>
        <span
          style={{
            fontSize: '0.86rem',
            fontWeight: 700,
            color: 'var(--text-secondary)',
          }}
        >
          {formatPrice(piece.price)}
        </span>
      </div>

      <button
        type="button"
        className="btn btn-sm btn-primary btn-block"
        disabled={!canOpenInStudio}
        onClick={() => {
          if (canOpenInStudio) onTryOn(numericId);
        }}
      >
        <Sparkles size={14} aria-hidden="true" />
        <span>Try It On</span>
      </button>
    </article>
  );
}

interface ClothingRack360Props {
  rackItems: RackItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenInStudio: (id: number) => void;
}

export function ClothingRack360({
  rackItems,
  loading,
  error,
  onRetry,
  onOpenInStudio,
}: ClothingRack360Props) {
  if (!loading && !error && rackItems.length === 0) {
    return null;
  }

  return (
    <section
      className="card rack-section"
      aria-label="Interactive 360 degree clothing rack"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.14rem', fontWeight: 700 }}>
            360° Interactive Clothing Rack
          </h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Drag horizontally or use the slider to inspect garments from every
            angle before opening in Try On Studio.
          </p>
        </div>
      </div>

      {error ? (
        <div className="banner banner-error">
          <div style={{ flex: 1 }}>{error}</div>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={onRetry}
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="rack-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 320 }} />
          ))}
        </div>
      ) : (
        <div className="rack-grid">
          {rackItems.map((piece) => (
            <RackPieceCard
              key={piece.id}
              piece={piece}
              onTryOn={onOpenInStudio}
            />
          ))}
        </div>
      )}
    </section>
  );
}

