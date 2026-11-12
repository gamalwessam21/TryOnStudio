import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Camera,
  Gift,
  Globe,
  HelpCircle,
  Menu,
  RefreshCw,
  Ruler,
  Search,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  X,
} from 'lucide-react';
import { useStudio } from '../app/StudioContext';
import { useCommerce } from '../app/CommerceContext';
import { useLanguage } from '../i18n/LanguageContext';
import { AssistantFloatingDrawer } from '../features/assistant/AssistantFloatingDrawer';
import { CartDrawer } from '../features/cart/CartDrawer';

export function Layout() {
  const {
    searchQuery,
    setSearchQuery,
    health,
    healthState,
    refreshHealth,
  } = useStudio();
  const {
    checkoutDraft,
    cartCheckoutReady,
    cartTotalQuantity,
    setCartDrawerOpen,
  } = useCommerce();
  const { language, setLanguage, t } = useLanguage();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Allow Escape key to close mobile drawer
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (
      value.trim().length > 0 &&
      location.pathname !== '/' &&
      location.pathname !== '/browse'
    ) {
      navigate('/');
    }
  };

  return (
    <div className="app-shell">
      <a href="#main-workspace" className="skip-link">
        {language === 'ar' ? 'تخطي إلى مساحة العمل الرئيسية' : 'Skip to main workspace'}
      </a>

      <div
        className={`sidebar-backdrop ${mobileNavOpen ? 'open' : ''}`}
        onClick={() => setMobileNavOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${mobileNavOpen ? 'open' : ''}`}
        aria-label="Primary navigation"
      >
        <div>
          <div className="sidebar-brand">
            <div className="sidebar-logo" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4a2.5 2.5 0 0 0-2.5 2.5c0 1.08.69 2 1.65 2.35L12 9.2V11L4.2 15.8A2.2 2.2 0 0 0 3 17.75C3 19 4.02 20 5.28 20h13.44C19.98 20 21 19 21 17.75c0-.8-.44-1.54-1.2-1.95L12 11"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div className="sidebar-brand-title">{t('brandTitle')}</div>
              <div className="sidebar-brand-subtitle">
                {t('brandSubtitle')}
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? 'active' : ''}`
              }
            >
              <Camera size={18} aria-hidden="true" />
              <span>{t('navStudio')}</span>
            </NavLink>

            <NavLink
              to="/browse"
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? 'active' : ''}`
              }
            >
              <Shirt size={18} aria-hidden="true" />
              <span>{t('navBrowse')}</span>
            </NavLink>

            <NavLink
              to="/size-guide"
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? 'active' : ''}`
              }
            >
              <Ruler size={18} aria-hidden="true" />
              <span>{t('navSizeGuide')}</span>
            </NavLink>

            <NavLink
              to="/assistant"
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? 'active' : ''}`
              }
            >
              <Sparkles size={18} aria-hidden="true" />
              <span>{t('navAssistant')}</span>
            </NavLink>

            <NavLink
              to="/loyalty"
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? 'active' : ''}`
              }
            >
              <Gift size={18} aria-hidden="true" />
              <span>{t('navLoyalty')}</span>
            </NavLink>

            <NavLink
              to="/cart"
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? 'active' : ''}`
              }
            >
              <ShoppingCart size={18} aria-hidden="true" />
              <span>{t('navCart')}</span>
              {cartTotalQuantity > 0 && (
                <span
                  className="nav-badge"
                  aria-label={`${cartTotalQuantity} items in cart`}
                >
                  <bdi>{cartTotalQuantity}</bdi>
                </span>
              )}
            </NavLink>

            <NavLink
              to="/checkout"
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? 'active' : ''}`
              }
            >
              <ShoppingBag size={18} aria-hidden="true" />
              <span>{t('navCheckout')}</span>
              {((cartCheckoutReady && cartTotalQuantity > 0) || checkoutDraft) && (
                <span className="nav-badge" aria-label="Items ready for checkout">
                  <bdi>
                    {cartCheckoutReady && cartTotalQuantity > 0
                      ? cartTotalQuantity
                      : checkoutDraft?.quantity ?? 1}
                  </bdi>
                </span>
              )}
            </NavLink>

            <NavLink
              to="/how-it-works"
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? 'active' : ''}`
              }
            >
              <HelpCircle size={18} aria-hidden="true" />
              <span>{t('navHowItWorks')}</span>
            </NavLink>
          </nav>
        </div>

        <div className="sidebar-promo-card">
          <div className="sidebar-promo-badge">
            <Sparkles size={13} aria-hidden="true" />
            <span>{language === 'ar' ? 'المرآة الذكية والقياس' : 'AI Fit & Mirror'}</span>
          </div>
          <div className="sidebar-promo-title">
            {language === 'ar' ? 'قياس ذكي وتجربة فورية' : 'Smart Size & Live Try-On'}
          </div>
          <p className="sidebar-promo-desc">
            {language === 'ar'
              ? 'جرّب الملابس مباشرة عبر المرآة الذكية، بدّل الألوان بإيماءات اليد، واعرف مقاسك الأنسب بالكاميرا.'
              : 'Try garments live over WebRTC, swipe variants hands-free, and scan your recommended top size with your camera.'}
          </p>
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="top-header">
          <div className="header-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div className="header-search-wrap" role="search">
              <Search
                size={16}
                className="header-search-icon"
                aria-hidden="true"
              />
              <input
                type="search"
                className="header-search-input"
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="header-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search query"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="header-right">
            <button
              type="button"
              className="lang-switcher-btn"
              onClick={() => setCartDrawerOpen(true)}
              aria-label={`${t('navCart')} (${cartTotalQuantity})`}
              title={t('navCart')}
              style={{ position: 'relative' }}
            >
              <ShoppingCart size={15} aria-hidden="true" />
              <span>{t('navCart')}</span>
              {cartTotalQuantity > 0 && (
                <span
                  className="nav-badge"
                  style={{
                    marginInlineStart: 4,
                    padding: '1px 6px',
                    fontSize: '0.72rem',
                  }}
                >
                  <bdi>{cartTotalQuantity}</bdi>
                </span>
              )}
            </button>

            <button
              type="button"
              className="lang-switcher-btn"
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              aria-label={
                language === 'en'
                  ? 'Switch language to Arabic'
                  : 'التحويل إلى اللغة الإنجليزية'
              }
              title={
                language === 'en'
                  ? 'Switch to العربية'
                  : 'Switch to English'
              }
            >
              <Globe size={15} aria-hidden="true" />
              <span>{language === 'en' ? 'العربية' : 'English'}</span>
            </button>

            <button
              type="button"
              onClick={() => void refreshHealth()}
              className={`api-status-pill ${
                healthState === 'healthy'
                  ? 'healthy'
                  : healthState === 'offline'
                  ? 'offline'
                  : ''
              }`}
              title={
                healthState === 'healthy'
                  ? `Backend online (${health?.products ?? 0} catalog items, AI size service: ${health?.aiSizeService ?? 'unknown'}). Click to re-check.`
                  : 'Click to verify backend connection'
              }
              aria-label="Check backend API health status"
            >
              <span className="status-dot" aria-hidden="true" />
              <span className="api-status-label-text">
                {healthState === 'checking'
                  ? t('checkingApi')
                  : healthState === 'healthy'
                  ? t('apiOnline')
                  : t('apiOffline')}
              </span>
              <RefreshCw
                size={13}
                className={healthState === 'checking' ? 'spin' : ''}
                aria-hidden="true"
              />
            </button>
          </div>
        </header>

        <main id="main-workspace" className="main-content">
          <Outlet />
        </main>
      </div>

      <CartDrawer />
      <AssistantFloatingDrawer />
    </div>
  );
}

