export interface PoseLandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export type SwipeDirection = 'next' | 'prev';

const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_WRIST = 15;
const R_WRIST = 16;
const L_HIP = 23;
const R_HIP = 24;

export interface SwipeDetectorConfig {
  windowMs?: number;
  minSweepShoulderRatio?: number;
  horizontalToVerticalRatio?: number;
  cooldownMs?: number;
  minVisibility?: number;
  minSamples?: number;
}

interface WristSample {
  t: number;
  x: number;
  y: number;
}

/**
 * Detects intentional horizontal hand-swipe gestures from MediaPipe Pose landmarks.
 *
 * Safeguards against false triggers:
 * 1. Wrist must be visible (`visibility >= 0.5`) and raised above the hip line.
 * 2. Horizontal travel must be at least `0.85 * shoulderWidth` within `700ms`.
 * 3. Horizontal displacement must be at least `2.0x` vertical displacement.
 * 4. Enforces a `1500ms` cooldown after every recognized swipe so holding a hand
 *    or returning the arm does not trigger continuous switching.
 */
export class SwipeDetector {
  private readonly windowMs: number;
  private readonly minSweep: number;
  private readonly hRatio: number;
  private readonly cooldownMs: number;
  private readonly minVis: number;
  private readonly minSamples: number;

  private readonly history: Record<number, WristSample[]> = {
    [L_WRIST]: [],
    [R_WRIST]: [],
  };

  private blockedUntil = 0;

  constructor(config: SwipeDetectorConfig = {}) {
    this.windowMs = config.windowMs ?? 700;
    this.minSweep = config.minSweepShoulderRatio ?? 0.85;
    this.hRatio = config.horizontalToVerticalRatio ?? 2.0;
    this.cooldownMs = config.cooldownMs ?? 1500;
    this.minVis = config.minVisibility ?? 0.5;
    this.minSamples = config.minSamples ?? 4;
  }

  public reset(): void {
    this.history[L_WRIST].length = 0;
    this.history[R_WRIST].length = 0;
  }

  public blockFor(durationMs: number, now: number = performance.now()): void {
    this.blockedUntil = Math.max(this.blockedUntil, now + durationMs);
    this.reset();
  }

  public isCoolingDown(now: number = performance.now()): boolean {
    return now < this.blockedUntil;
  }

  /**
   * Processes a single frame of normalized landmarks (0..1) from the raw
   * un-mirrored camera `<video>`.
   */
  public update(
    landmarks: PoseLandmarkPoint[] | undefined | null,
    videoWidth: number,
    videoHeight: number,
    now: number
  ): SwipeDirection | null {
    if (
      !landmarks ||
      landmarks.length <= R_HIP ||
      videoWidth <= 0 ||
      videoHeight <= 0
    ) {
      this.reset();
      return null;
    }

    if (now < this.blockedUntil) {
      return null;
    }

    // Mirror X so swiping toward the right side of the user's screen = +dx ("next")
    const toPixel = (pt: PoseLandmarkPoint) => ({
      x: (1 - pt.x) * videoWidth,
      y: pt.y * videoHeight,
      v: pt.visibility ?? 1,
    });

    const leftShoulder = toPixel(landmarks[L_SHOULDER]);
    const rightShoulder = toPixel(landmarks[R_SHOULDER]);
    const shoulderWidth = Math.hypot(
      leftShoulder.x - rightShoulder.x,
      leftShoulder.y - rightShoulder.y
    );

    if (shoulderWidth <= 8) {
      this.reset();
      return null;
    }

    const hipY =
      ((landmarks[L_HIP].y + landmarks[R_HIP].y) / 2) * videoHeight;

    for (const wristIdx of [L_WRIST, R_WRIST]) {
      const wristHistory = this.history[wristIdx];
      const wrist = toPixel(landmarks[wristIdx]);

      // Ignore low-confidence or resting hands below hip line
      if (wrist.v < this.minVis || wrist.y > hipY) {
        wristHistory.length = 0;
        continue;
      }

      wristHistory.push({ t: now, x: wrist.x, y: wrist.y });

      while (wristHistory.length > 0 && now - wristHistory[0].t > this.windowMs) {
        wristHistory.shift();
      }

      if (wristHistory.length < this.minSamples) {
        continue;
      }

      const first = wristHistory[0];
      const last = wristHistory[wristHistory.length - 1];
      const dx = last.x - first.x;
      const dy = last.y - first.y;

      if (
        Math.abs(dx) >= this.minSweep * shoulderWidth &&
        Math.abs(dx) >= this.hRatio * Math.abs(dy)
      ) {
        this.blockedUntil = now + this.cooldownMs;
        this.reset();
        return dx > 0 ? 'next' : 'prev';
      }
    }

    return null;
  }
}

