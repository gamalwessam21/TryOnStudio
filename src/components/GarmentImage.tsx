import { useEffect, useState } from 'react';

interface GarmentImageProps {
  src?: string | null;
  alt: string;
  categoryName?: string | null;
  colorHex?: string | null;
  aspectRatio?: '4/5' | '3/4' | '1/1';
  className?: string;
  transparentBg?: boolean;
}

export function GarmentImage({
  src,
  alt,
  categoryName,
  colorHex,
  aspectRatio = '4/5',
  className = '',
  transparentBg = false,
}: GarmentImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
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
            src={validSrc}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
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
          <svg
            width="64"
            height="64"
            viewBox="0 0 80 80"
            fill="none"
            aria-hidden="true"
          >
            {isHoodieOrJacket ? (
              <path
                d="M28 16L20 22L10 38L18 44L24 34V64H56V34L62 44L70 38L60 22L52 16C49 21 45 23 40 23C35 23 31 21 28 16Z"
                fill={accentFill}
                fillOpacity="0.18"
                stroke={accentFill}
                strokeWidth="3"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d="M27 18L12 29L18 40L26 35V63H54V35L62 40L68 29L53 18C50 22.5 45.5 25 40 25C34.5 25 30 22.5 27 18Z"
                fill={accentFill}
                fillOpacity="0.18"
                stroke={accentFill}
                strokeWidth="3"
                strokeLinejoin="round"
              />
            )}
          </svg>
          <span style={{ fontSize: '0.74rem', fontWeight: 500 }}>
            Preview unavailable
          </span>
        </div>
      )}
    </div>
  );
}

