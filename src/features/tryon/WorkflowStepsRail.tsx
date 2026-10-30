import { Check } from 'lucide-react';

interface WorkflowStepsRailProps {
  cameraLive: boolean;
  hasSelectedGarment: boolean;
  tryOnActive: boolean;
  outfitConfirmed: boolean;
  isScanningSize: boolean;
  hasSizeResult: boolean;
}

const STEPS = [
  {
    num: 1,
    title: 'Turn on camera',
    desc: 'Allow camera access and start your mirror session.',
  },
  {
    num: 2,
    title: 'Select garment',
    desc: 'Choose your favorite top and color variant.',
  },
  {
    num: 3,
    title: 'Start try-on',
    desc: 'Connect to Decart to see yourself wearing it.',
  },
  {
    num: 4,
    title: 'Swipe to change',
    desc: 'Swipe left or right with your hand to switch.',
  },
  {
    num: 5,
    title: 'Choose this outfit',
    desc: 'Confirm your garment and return to raw camera.',
  },
  {
    num: 6,
    title: 'Get my size',
    desc: 'Step 1–2m back while 20 frames are analyzed.',
  },
  {
    num: 7,
    title: 'See your size',
    desc: 'View your recommended size and alternatives.',
  },
];

export function WorkflowStepsRail({
  cameraLive,
  hasSelectedGarment,
  tryOnActive,
  outfitConfirmed,
  isScanningSize,
  hasSizeResult,
}: WorkflowStepsRailProps) {
  function getStepState(num: number): 'done' | 'current' | 'upcoming' {
    switch (num) {
      case 1:
        return cameraLive ? 'done' : 'current';
      case 2:
        if (!hasSelectedGarment) return cameraLive ? 'current' : 'upcoming';
        return 'done';
      case 3:
        if (tryOnActive || outfitConfirmed || hasSizeResult) return 'done';
        return cameraLive && hasSelectedGarment ? 'current' : 'upcoming';
      case 4:
        if (outfitConfirmed || hasSizeResult) return 'done';
        return tryOnActive ? 'current' : 'upcoming';
      case 5:
        if (outfitConfirmed || hasSizeResult) return 'done';
        return tryOnActive ? 'current' : 'upcoming';
      case 6:
        if (hasSizeResult) return 'done';
        if (isScanningSize || (cameraLive && outfitConfirmed)) return 'current';
        return 'upcoming';
      case 7:
        return hasSizeResult ? 'done' : 'upcoming';
      default:
        return 'upcoming';
    }
  }

  return (
    <aside className="card steps-rail" aria-label="How it works steps">
      <div className="steps-rail-header">
        <h2>How it works</h2>
        <p>Get your fit in 7 guided steps</p>
      </div>

      <ol className="steps-list">
        {STEPS.map((step) => {
          const state = getStepState(step.num);
          return (
            <li
              key={step.num}
              className={`step-item ${state === 'done' ? 'done' : ''} ${
                state === 'current' ? 'current' : ''
              }`}
            >
              <span className="step-num" aria-hidden="true">
                {state === 'done' ? <Check size={13} strokeWidth={3} /> : step.num}
              </span>
              <div>
                <div className="step-title">{step.title}</div>
                <div className="step-desc">{step.desc}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

