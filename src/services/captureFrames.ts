import { SIZE_SCAN_LIMITS } from './fashionApi';

export interface CaptureFramesOptions {
  /** Number of frames to capture (8–40, default 20) */
  count?: number;
  /** Total capture duration in milliseconds (default 3000ms) */
  durationMs?: number;
  /** Maximum width or height in pixels (default 1280px) */
  maxDimension?: number;
  /** Initial JPEG encoding quality (0..1, default 0.84) */
  quality?: number;
  /** Optional abort signal to cancel capture mid-way */
  signal?: AbortSignal;
  /** Progress callback invoked as each frame is captured */
  onProgress?: (captured: number, total: number) => void;
}

function waitMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Capture cancelled.', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Capture cancelled.', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) {
          reject(new Error('Failed to encode camera frame as JPEG.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Captures sequential un-mirrored JPEG frames directly from the raw camera
 * `<video>` element, resizing to a maximum dimension of 1280px and enforcing
 * per-frame (2 MB) and total (20 MB) upload size limits.
 */
export async function captureFrames(
  video: HTMLVideoElement,
  options: CaptureFramesOptions = {}
): Promise<Blob[]> {
  const {
    count = 20,
    durationMs = 3000,
    maxDimension = 1280,
    quality = 0.84,
    signal,
    onProgress,
  } = options;

  const clampedCount = Math.max(
    SIZE_SCAN_LIMITS.MIN_FRAMES,
    Math.min(SIZE_SCAN_LIMITS.MAX_FRAMES, Math.round(count))
  );

  const srcWidth = video.videoWidth;
  const srcHeight = video.videoHeight;

  if (!srcWidth || !srcHeight || video.readyState < 2) {
    throw new Error(
      'Camera video stream is not ready yet. Make sure your camera is turned on and displaying a live preview.'
    );
  }

  const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
  const targetWidth = Math.max(1, Math.round(srcWidth * scale));
  const targetHeight = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to initialize 2D canvas context for frame capture.');
  }

  const frames: Blob[] = [];
  let totalBytes = 0;
  const intervalMs = Math.max(40, Math.round(durationMs / clampedCount));

  // Keep safe headroom per frame so 20-40 frames never exceed 20 MB total.
  const targetMaxPerFrame = Math.min(
    SIZE_SCAN_LIMITS.MAX_FRAME_BYTES,
    Math.floor((SIZE_SCAN_LIMITS.MAX_TOTAL_BYTES * 0.9) / clampedCount)
  );

  for (let i = 0; i < clampedCount; i++) {
    if (signal?.aborted) {
      throw new DOMException('Capture cancelled.', 'AbortError');
    }

    if (video.paused || video.ended || !video.videoWidth) {
      throw new Error('Camera feed stopped during capture. Please keep the camera on and retry.');
    }

    // Draw raw un-mirrored video frame onto canvas
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

    let currentQuality = quality;
    let blob = await canvasToJpegBlob(canvas, currentQuality);

    // Compress further if needed to respect byte budgets
    while (blob.size > targetMaxPerFrame && currentQuality > 0.4) {
      currentQuality = Math.max(0.35, currentQuality - 0.15);
      blob = await canvasToJpegBlob(canvas, currentQuality);
    }

    if (blob.size > SIZE_SCAN_LIMITS.MAX_FRAME_BYTES) {
      throw new Error('A captured frame exceeded the maximum 2 MB image size limit.');
    }

    totalBytes += blob.size;
    if (totalBytes > SIZE_SCAN_LIMITS.MAX_TOTAL_BYTES) {
      throw new Error('Captured frames exceeded the 20 MB total upload size limit.');
    }

    frames.push(blob);
    onProgress?.(i + 1, clampedCount);

    if (i < clampedCount - 1) {
      await waitMs(intervalMs, signal);
    }
  }

  return frames;
}

