import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { StudioProvider } from './StudioContext';
import { CommerceProvider } from './CommerceContext';
import { LanguageProvider } from '../i18n/LanguageContext';
import { Layout } from '../components/Layout';
import { StudioPage } from './pages/StudioPage';
import { BrowsePage } from './pages/BrowsePage';
import { SizeGuidePage } from './pages/SizeGuidePage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { FashionAssistantPage } from './pages/FashionAssistantPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { ReceiptPage } from './pages/ReceiptPage';
import { LoyaltyPage } from './pages/LoyaltyPage';
import { CartPage } from './pages/CartPage';

export function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <StudioProvider>
          <CommerceProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<StudioPage />} />
                <Route path="studio" element={<StudioPage />} />
                <Route path="browse" element={<BrowsePage />} />
                <Route path="size-guide" element={<SizeGuidePage />} />
                <Route path="assistant" element={<FashionAssistantPage />} />
                <Route path="cart" element={<CartPage />} />
                <Route path="checkout" element={<CheckoutPage />} />
                <Route path="orders/:orderNumber" element={<ReceiptPage />} />
                <Route path="loyalty" element={<LoyaltyPage />} />
                <Route path="how-it-works" element={<HowItWorksPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </CommerceProvider>
        </StudioProvider>
      </BrowserRouter>
    </LanguageProvider>
  );
}

