import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Maximize2, Sparkles, X } from 'lucide-react';
import { useCommerce } from '../../app/CommerceContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { FashionAssistantPanel } from './FashionAssistantPanel';

export function AssistantFloatingDrawer() {
  const { assistantDrawerOpen, setAssistantDrawerOpen } = useCommerce();
  const { language, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  // Hide floating trigger when user is already on the dedicated full-page /assistant route
  const isDedicatedAssistantRoute = location.pathname === '/assistant';

  useEffect(() => {
    if (!assistantDrawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAssistantDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [assistantDrawerOpen, setAssistantDrawerOpen]);

  if (isDedicatedAssistantRoute) {
    return null;
  }

  return (
    <>
      {!assistantDrawerOpen && (
        <button
          type="button"
          className="assistant-fab print-hide"
          onClick={() => setAssistantDrawerOpen(true)}
          aria-label={t('openStylistBtn')}
        >
          <Sparkles size={18} aria-hidden="true" />
          <span>{t('openStylistBtn')}</span>
        </button>
      )}

      {assistantDrawerOpen && (
        <div className="assistant-drawer-layer print-hide">
          <div
            className="assistant-drawer-backdrop"
            onClick={() => setAssistantDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="assistant-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t('stylistTitle')}
          >
            <div className="assistant-drawer-topbar">
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setAssistantDrawerOpen(false);
                  navigate('/assistant');
                }}
              >
                <Maximize2 size={14} aria-hidden="true" />
                <span>
                  {language === 'ar' ? 'فتح في صفحة كاملة' : 'Full Page View'}
                </span>
              </button>
              <button
                type="button"
                className="assistant-drawer-close"
                onClick={() => setAssistantDrawerOpen(false)}
                aria-label={
                  language === 'ar' ? 'إغلاق المحادثة' : 'Close Fashion Assistant'
                }
              >
                <X size={18} />
              </button>
            </div>

            <FashionAssistantPanel
              compact
              onNavigateAway={() => setAssistantDrawerOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}

