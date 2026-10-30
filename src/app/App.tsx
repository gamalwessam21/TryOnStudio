import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { StudioProvider } from './StudioContext';
import { Layout } from '../components/Layout';
import { StudioPage } from './pages/StudioPage';
import { BrowsePage } from './pages/BrowsePage';
import { SizeGuidePage } from './pages/SizeGuidePage';
import { HowItWorksPage } from './pages/HowItWorksPage';

export function App() {
  return (
    <BrowserRouter>
      <StudioProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<StudioPage />} />
            <Route path="browse" element={<BrowsePage />} />
            <Route path="size-guide" element={<SizeGuidePage />} />
            <Route path="how-it-works" element={<HowItWorksPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </StudioProvider>
    </BrowserRouter>
  );
}

