import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Maximize2, ShoppingCart, X } from 'lucide-react';
import { useCommerce } from '../../app/CommerceContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { CartContentView } from './CartContentView';

export function CartDrawer() {
  const { cartDrawerOpen, setCartDrawerOpen, cartTotalQuantity } = useCommerce();
  const { language, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  // Close drawer automatically if user navigates to dedicated /cart page
  useEffect(() => {
    if (location.pathname === '/cart' && cartDrawerOpen) {
      setCartDrawerOpen(false);
    }
  }, [location.pathname, cartDrawerOpen, setCartDrawerOpen]);

  useEffect(() => {
    if (!cartDrawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCartDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cartDrawerOpen, setCartDrawerOpen]);

  if (!cartDrawerOpen) {
    return null;
  }

  return (
    <div className="assistant-drawer-layer print-hide">
      <div
        className="assistant-drawer-backdrop"
        onClick={() => setCartDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside
        className="assistant-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t('cartTitle')}
      >
        <div
          className="assistant-drawer-topbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={18} color="var(--blue-600)" />
            <strong style={{ fontSize: '0.96rem' }}>
              {t('cartTitle')} ({cartTotalQuantity})
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => {
                setCartDrawerOpen(false);
                navigate('/cart');
              }}
            >
              <Maximize2 size={14} aria-hidden="true" />
              <span>
                {language === 'ar' ? 'فتح صفحة السلة' : 'Full Cart Page'}
              </span>
            </button>
            <button
              type="button"
              className="assistant-drawer-close"
              onClick={() => setCartDrawerOpen(false)}
              aria-label={t('closeModalBtn')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div
          style={{
            padding: 16,
            overflowY: 'auto',
            flex: 1,
          }}
        >
          <CartContentView
            compact
            onNavigateAway={() => setCartDrawerOpen(false)}
          />
        </div>
      </aside>
    </div>
  );
}

