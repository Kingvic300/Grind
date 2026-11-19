import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { MarketingLayout } from './components/MarketingLayout';
import { AppSkeleton } from './components/Loading';
import { useMe } from './lib/hooks';
import { Pages } from './pages/app/lazy';
import { JoinPage } from './pages/Join';
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
  if (me.isPending) return <AppSkeleton />;
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
          <Route path="join/:code" element={<JoinPage />} />
          <Route path="app" element={<AppShell />}>
            <Route index element={<Pages.overview />} />
            <Route path="hackathons" element={<Pages.list />} />
            <Route path="board" element={<Pages.board />} />
            <Route path="calendar" element={<Pages.calendar />} />
            <Route path="goals" element={<Pages.goals />} />
            <Route path="notes" element={<Pages.notes />} />
            <Route path="discover" element={<Pages.discover />} />
            <Route path="discover/:id" element={<Pages.listing />} />
            <Route path="team" element={<Pages.team />} />
            <Route path="sharing" element={<Navigate to="/app/team" replace />} />
            <Route path="settings" element={<Pages.settings />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
