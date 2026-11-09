import { Check } from 'lucide-react';
import { useLanguage, type TranslationKey } from '../../i18n/LanguageContext';

interface WorkflowStepsRailProps {
  cameraLive: boolean;
  hasSelectedGarment: boolean;
  tryOnActive: boolean;
  outfitConfirmed: boolean;
  isScanningSize: boolean;
  hasSizeResult: boolean;
}

interface StepConfig {
  num: number;
  titleKey: TranslationKey;
  descKey: TranslationKey;
}

const STEP_CONFIGS: StepConfig[] = [
  { num: 1, titleKey: 'step1Title', descKey: 'step1Desc' },
  { num: 2, titleKey: 'step2Title', descKey: 'step2Desc' },
  { num: 3, titleKey: 'step3Title', descKey: 'step3Desc' },
  { num: 4, titleKey: 'step4Title', descKey: 'step4Desc' },
  { num: 5, titleKey: 'step5Title', descKey: 'step5Desc' },
  { num: 6, titleKey: 'step6Title', descKey: 'step6Desc' },
  { num: 7, titleKey: 'step7Title', descKey: 'step7Desc' },
];

export function WorkflowStepsRail({
  cameraLive,
  hasSelectedGarment,
  tryOnActive,
  outfitConfirmed,
  isScanningSize,
  hasSizeResult,
}: WorkflowStepsRailProps) {
  const { t } = useLanguage();

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
    <aside className="card steps-rail" aria-label={t('workflowTitle')}>
      <div className="steps-rail-header">
        <h2>{t('workflowTitle')}</h2>
        <p>{t('workflowSubtitle')}</p>
      </div>

      <ol className="steps-list">
        {STEP_CONFIGS.map((step) => {
          const state = getStepState(step.num);
          return (
            <li
              key={step.num}
              className={`step-item ${state === 'done' ? 'done' : ''} ${
                state === 'current' ? 'current' : ''
              }`}
            >
              <span className="step-num" aria-hidden="true">
                {state === 'done' ? <Check size={13} strokeWidth={3} /> : <bdi>{step.num}</bdi>}
              </span>
              <div>
                <div className="step-title">{t(step.titleKey)}</div>
                <div className="step-desc">{t(step.descKey)}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
