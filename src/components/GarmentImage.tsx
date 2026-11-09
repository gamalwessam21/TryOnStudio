import { useEffect, useRef, useState } from 'react';

interface GarmentImageProps {
  src?: string | null;
  alt: string;
  categoryName?: string | null;
  colorHex?: string | null;
  aspectRatio?: '4/5' | '3/4' | '1/1';
  className?: string;
  transparentBg?: boolean;
  priority?: boolean;
}

export function GarmentImage({
  src,
  alt,
  categoryName,
  colorHex,
  aspectRatio = '4/5',
  className = '',
  transparentBg = false,
  priority = false,
}: GarmentImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setFailed(false);
    // If image is already cached or completed synchronously by the browser
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [src]);

  const validSrc = src && src.trim().length > 0 && !failed ? src.trim() : null;
  const accentFill =
    colorHex && /^#[0-9A-Fa-f]{3,8}$/.test(colorHex.trim())
      ? colorHex.trim()
      : '#3b82f6';
  const catLower = (categoryName || '').toLowerCase();
  const isHoodieOrJacket =
    catLower.includes('hoodie') ||
    catLower.includes('sweatshirt') ||
    catLower.includes('jacket');

  return (
    <div
      className={`garment-img-frame ${transparentBg ? 'transparent' : ''} ${className}`}
      style={{
        aspectRatio,
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
        borderRadius: '12px',
        backgroundColor: transparentBg ? 'transparent' : '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {validSrc ? (
        <>
          {!loaded && (
            <div
              className="skeleton"
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '12px',
              }}
            />
          )}
          <img
            ref={imgRef}
            src={validSrc}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            onLoad={() => setLoaded(true)}
            onError={() => {
              setFailed(true);
              setLoaded(false);
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              padding: transparentBg ? '4px' : '8px',
              opacity: loaded ? 1 : 0,
              transition: 'opacity 180ms ease-out',
            }}
          />
        </>
      ) : (
        <div
          role="img"
          aria-label={`${alt} placeholder illustration`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '16px',
            color: '#64748b',
            textAlign: 'center',
          }}
        >
          {isHoodieOrJacket ? (
            <svg
              width="54"
              height="54"
              viewBox="0 0 64 64"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path
                d="M20 16 C20 8, 44 8, 44 16 L54 26 L46 32 L40 24 L40 56 L24 56 L24 24 L18 32 L10 26 Z"
                fill={accentFill}
                fillOpacity="0.14"
              />
              <path d="M32 20 L32 56" />
              <path d="M26 38 C28 41, 36 41, 38 38" />
            </svg>
          ) : (
            <svg
              width="54"
              height="54"
              viewBox="0 0 64 64"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path
                d="M22 14 L27 20 C29 22, 35 22, 37 20 L42 14 L56 20 L50 32 L44 26 L44 56 L20 56 L20 26 L14 32 L8 20 Z"
                fill={accentFill}
                fillOpacity="0.14"
              />
            </svg>
          )}
          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              color: 'var(--text-muted, #64748b)',
            }}
          >
            {categoryName || 'Garment'}
          </span>
        </div>
      )}
    </div>
  );
}
