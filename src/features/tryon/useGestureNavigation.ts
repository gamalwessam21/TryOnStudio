import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { SwipeDetector, type SwipeDirection } from './swipeDetector';

// Pinned to exact installed package version (@mediapipe/tasks-vision@1.2.0)
const MEDIAPIPE_WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm';
const POSE_MODEL_ASSET_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

export type GestureEngineStatus = 'inactive' | 'loading' | 'ready' | 'unavailable';

export interface GestureEventFeedback {
  direction: SwipeDirection;
  at: number;
}

interface UseGestureNavigationOptions {
  /** Active ONLY when virtual try-on session is connected */
  enabled: boolean;
  /** Raw camera video element (never the Decart output stream) */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Lock while a garment switch is already in flight */
  isSwitching: boolean;
  /** Callback invoked on recognized left/right hand swipe */
  onSwipe: (direction: SwipeDirection) => void;
}

export interface UseGestureNavigationResult {
  gestureStatus: GestureEngineStatus;
  gestureError: string | null;
  lastGesture: GestureEventFeedback | null;
}

export function useGestureNavigation({
  enabled,
  videoRef,
  isSwitching,
  onSwipe,
}: UseGestureNavigationOptions): UseGestureNavigationResult {
  const [gestureStatus, setGestureStatus] =
    useState<GestureEngineStatus>('inactive');
  const [gestureError, setGestureError] = useState<string | null>(null);
  const [lastGesture, setLastGesture] = useState<GestureEventFeedback | null>(
    null
  );

  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const detectorRef = useRef<SwipeDetector>(new SwipeDetector());
  const onSwipeRef = useRef(onSwipe);
  const isSwitchingRef = useRef(isSwitching);
  const lastVideoTimestampRef = useRef<number>(-1);

  onSwipeRef.current = onSwipe;
  isSwitchingRef.current = isSwitching;

  // Block gesture detector while garment switch is in progress
  useEffect(() => {
    if (isSwitching) {
      detectorRef.current.blockFor(1600);
    }
  }, [isSwitching]);

  // Clear transient feedback badge after 1.8s
  useEffect(() => {
    if (!lastGesture) return;
    const timer = window.setTimeout(() => {
      setLastGesture(null);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [lastGesture]);

  useEffect(() => {
    const detector = detectorRef.current;

    if (!enabled) {
      detector.reset();
      setGestureStatus('inactive');
      return;
    }

    let cancelled = false;
    let rafId: number | null = null;

    async function initAndRun() {
      try {
        if (!landmarkerRef.current) {
          setGestureStatus('loading');
          setGestureError(null);
          const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
          if (cancelled) return;

          landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: POSE_MODEL_ASSET_URL,
            },
            runningMode: 'VIDEO',
            numPoses: 1,
          });
          if (cancelled) return;
        }

        detector.reset();
        setGestureStatus('ready');

        const tick = () => {
          if (cancelled) return;

          const video = videoRef.current;
          const landmarker = landmarkerRef.current;

          if (
            video &&
            landmarker &&
            !isSwitchingRef.current &&
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            video.videoHeight > 0 &&
            !video.paused
          ) {
            const now = performance.now();
            // MediaPipe VIDEO mode requires strictly monotonically increasing timestamps
            const timestampMs =
              now > lastVideoTimestampRef.current
                ? now
                : lastVideoTimestampRef.current + 1;
            lastVideoTimestampRef.current = timestampMs;

            try {
              const result = landmarker.detectForVideo(video, timestampMs);
              const direction = detector.update(
                result.landmarks?.[0],
                video.videoWidth,
                video.videoHeight,
                now
              );
              if (direction) {
                setLastGesture({ direction, at: Date.now() });
                onSwipeRef.current(direction);
              }
            } catch {
              // Ignore transient frame detection errors
            }
          }

          rafId = window.requestAnimationFrame(tick);
        };

        rafId = window.requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        setGestureStatus('unavailable');
        setGestureError(
          err instanceof Error
            ? `Hand-gesture recognition unavailable (${err.message}). Manual garment controls remain active.`
            : 'Hand-gesture recognition could not be initialized. Manual controls remain active.'
        );
      }
    }

    void initAndRun();

    return () => {
      cancelled = true;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      detector.reset();
    };
  }, [enabled, videoRef]);

  // Release MediaPipe WASM resources on unmount
  useEffect(() => {
    return () => {
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch {
          // Ignore close errors on unmount
        }
        landmarkerRef.current = null;
      }
    };
  }, []);

  return {
    gestureStatus,
    gestureError,
    lastGesture,
  };
}

