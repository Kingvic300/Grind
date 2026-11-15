import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { MarketingLayout } from './components/MarketingLayout';
import { useMe } from './lib/hooks';
import { BoardPage } from './pages/app/Board';
import { CalendarPage } from './pages/app/Calendar';
import { ListPage } from './pages/app/List';
import { OverviewPage } from './pages/app/Overview';
import { SettingsPage } from './pages/app/Settings';
import { AboutPage } from './pages/marketing/About';
import { AuthPage } from './pages/marketing/Auth';
import { FeaturesPage } from './pages/marketing/Features';
import { LandingPage } from './pages/marketing/Landing';
import { PricingPage } from './pages/marketing/Pricing';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Sends logged-out visitors to the login page, and remembers where they were going. */
function RequireAuth() {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) return <div className="page-loading" role="status">Loading Grind</div>;
  if (!me.data) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="features" element={<FeaturesPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="signup" element={<AuthPage mode="signup" />} />
        <Route element={<RequireAuth />}>
          <Route path="app" element={<AppShell />}>
            <Route index element={<OverviewPage />} />
            <Route path="hackathons" element={<ListPage />} />
            <Route path="board" element={<BoardPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
