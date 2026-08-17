import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '../api/usageAnalytics';
import { useAuth } from '../auth/AuthContext';

// Fires one `page_view` usage event per route change. Gated on
// status === 'authenticated' — POST /tenant/usage-events requires a JWT, so
// firing from public/marketing routes (login, how-it-works) would just be a
// guaranteed-401 no-op; skipping them avoids the wasted request rather than
// relying solely on trackEvent's own swallowed-error handling.
export function useRouteTracking(): void {
  const location = useLocation();
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'authenticated') return;
    trackEvent('page_view', location.pathname, { route: location.pathname });
  }, [location.pathname, status]);
}
