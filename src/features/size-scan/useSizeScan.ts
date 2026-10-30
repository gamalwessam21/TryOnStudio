import { useCallback, useEffect, useRef, useState } from 'react';
import { captureFrames } from '../../services/captureFrames';
import { fashionApi, formatSizeScanError } from '../../services/fashionApi';
import type { SizeScanResult } from '../../types/api';

export type SizeScanPhase =
  | 'idle'
  | 'countdown'
  | 'capturing'
  | 'uploading'
  | 'done'
  | 'error';

export interface FormattedScanError {
  title: string;
  message: string;
  recoveryHint?: string;
  code?: string | null;
}

export interface UseSizeScanResult {
  phase: SizeScanPhase;
  countdownSeconds: number;
  countdownTotal: number;
  capturedCount: number;
  totalFramesToCapture: number;
  scanResult: SizeScanResult | null;
  scanError: FormattedScanError | null;
  scannedItemId: number | null;
  isScanning: boolean;
  startSizeScan: (
    itemId: number,
    cameraVideo: HTMLVideoElement | null,
    countdownDurationSec?: number
  ) => Promise<void>;
  cancelSizeScan: () => void;
  resetSizeScan: () => void;
}

const TARGET_FRAMES = 20;
const CAPTURE_DURATION_MS = 3000;

export function useSizeScan(): UseSizeScanResult {
  const [phase, setPhase] = useState<SizeScanPhase>('idle');
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [countdownTotal, setCountdownTotal] = useState<number>(3);
  const [capturedCount, setCapturedCount] = useState<number>(0);
  const [scanResult, setScanResult] = useState<SizeScanResult | null>(null);
  const [scanError, setScanError] = useState<FormattedScanError | null>(null);
  const [scannedItemId, setScannedItemId] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const activeRunRef = useRef<boolean>(false);

  const clearTimers = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const cancelSizeScan = useCallback(() => {
    clearTimers();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    activeRunRef.current = false;
    setPhase('idle');
    setCountdownSeconds(0);
    setCapturedCount(0);
  }, [clearTimers]);

  const resetSizeScan = useCallback(() => {
    cancelSizeScan();
    setScanResult(null);
    setScanError(null);
    setScannedItemId(null);
  }, [cancelSizeScan]);

  const startSizeScan = useCallback(
    async (
      itemId: number,
      cameraVideo: HTMLVideoElement | null,
      countdownDurationSec = 3
    ): Promise<void> => {
      if (activeRunRef.current) {
        return; // Prevent duplicate scan submissions
      }

      if (!cameraVideo || cameraVideo.readyState < 2 || !cameraVideo.videoWidth) {
        setScanError({
          title: 'Camera Not Active',
          message:
            'Turn on your camera and wait for the live preview before starting a size scan.',
        });
        setPhase('error');
        return;
      }

      clearTimers();
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      activeRunRef.current = true;

      setScanResult(null);
      setScanError(null);
      setScannedItemId(itemId);
      setCapturedCount(0);

      const safeCountdown = Math.max(3, Math.min(10, Math.round(countdownDurationSec)));
      setCountdownTotal(safeCountdown);
      setCountdownSeconds(safeCountdown);
      setPhase('countdown');

      try {
        // Step 1: Countdown (e.g. 3, 2, 1)
        await new Promise<void>((resolve, reject) => {
          let remaining = safeCountdown;
          const onAbort = () => {
            clearTimers();
            reject(new DOMException('Scan cancelled.', 'AbortError'));
          };
          controller.signal.addEventListener('abort', onAbort, { once: true });

          countdownTimerRef.current = window.setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
              clearTimers();
              controller.signal.removeEventListener('abort', onAbort);
              setCountdownSeconds(0);
              resolve();
            } else {
              setCountdownSeconds(remaining);
            }
          }, 1000);
        });

        if (controller.signal.aborted) return;

        // Step 2: Capture ~20 resized JPEG frames over 3 seconds
        setPhase('capturing');
        const frames = await captureFrames(cameraVideo, {
          count: TARGET_FRAMES,
          durationMs: CAPTURE_DURATION_MS,
          maxDimension: 1280,
          quality: 0.84,
          signal: controller.signal,
          onProgress: (captured) => {
            setCapturedCount(captured);
          },
        });

        if (controller.signal.aborted) return;

        // Step 3: Upload multipart frames to backend (up to 65s timeout)
        setPhase('uploading');
        const result = await fashionApi.scanSize(itemId, frames, controller.signal);

        if (controller.signal.aborted) return;

        setScanResult(result);
        setPhase('done');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setPhase('idle');
          return;
        }
        setScanError(formatSizeScanError(err));
        setPhase('error');
      } finally {
        clearTimers();
        activeRunRef.current = false;
      }
    },
    [clearTimers]
  );

  useEffect(() => {
    return () => {
      clearTimers();
      abortControllerRef.current?.abort();
    };
  }, [clearTimers]);

  const isScanning =
    phase === 'countdown' || phase === 'capturing' || phase === 'uploading';

  return {
    phase,
    countdownSeconds,
    countdownTotal,
    capturedCount,
    totalFramesToCapture: TARGET_FRAMES,
    scanResult,
    scanError,
    scannedItemId,
    isScanning,
    startSizeScan,
    cancelSizeScan,
    resetSizeScan,
  };
}

