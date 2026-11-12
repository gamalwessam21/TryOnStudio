import { Link } from 'react-router-dom';
import {
  Camera,
  Hand,
  Ruler,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export function HowItWorksPage() {
  const { t } = useLanguage();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        maxWidth: 1080,
      }}
    >
      <div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800 }}>
          {t('howTitle')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          {t('howSubtitle')}
        </p>
      </div>

      <div className="how-it-works-grid">
        <section className="card bottom-card">
          <div className="bottom-card-title">
            <Camera size={20} color="var(--blue-600)" aria-hidden="true" />
            <span>{t('howStep1Title')}</span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            {t('howStep1Desc')}
          </p>
        </section>

        <section className="card bottom-card">
          <div className="bottom-card-title">
            <Sparkles size={20} color="var(--purple-600)" aria-hidden="true" />
            <span>{t('howStep2Title')}</span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            {t('howStep2Desc')}
          </p>
        </section>

        <section className="card bottom-card">
          <div className="bottom-card-title">
            <Hand size={20} color="var(--blue-600)" aria-hidden="true" />
            <span>{t('howStep3Title')}</span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            {t('howStep3Desc')}
          </p>
        </section>

        <section className="card bottom-card">
          <div className="bottom-card-title">
            <Ruler size={20} color="var(--green-600)" aria-hidden="true" />
            <span>{t('howStep4Title')}</span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            {t('howStep4Desc')}
          </p>
        </section>
      </div>

      <section className="card bottom-card">
        <div className="bottom-card-title">
          <ShieldCheck size={20} color="var(--purple-600)" aria-hidden="true" />
          <span>{t('privacyTransparency')}</span>
        </div>
        <ul
          style={{
            margin: 0,
            paddingInlineStart: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: '0.87rem',
            color: 'var(--text-secondary)',
          }}
        >
          <li>{t('privacyScanPoint')}</li>
          <li>{t('privacyTryOnPoint')}</li>
          <li>{t('privacyInventoryPoint')}</li>
        </ul>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <Link to="/" className="btn btn-primary">
            {t('openStudioBtn')}
          </Link>
          <Link to="/browse" className="btn btn-secondary">
            {t('browseRackBtn')}
          </Link>
        </div>
      </section>
    </div>
  );
}
