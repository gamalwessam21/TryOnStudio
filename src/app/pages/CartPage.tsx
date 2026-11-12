import { ShoppingCart } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { CartContentView } from '../../features/cart/CartContentView';

export function CartPage() {
  const { t } = useLanguage();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1
          style={{
            fontSize: '1.45rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <ShoppingCart size={24} color="var(--blue-600)" aria-hidden="true" />
          <span>{t('cartTitle')}</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {t('cartSubtitle')}
        </p>
      </div>

      <CartContentView />
    </div>
  );
}

