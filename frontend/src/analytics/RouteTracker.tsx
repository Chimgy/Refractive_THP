import { useRouteTracking } from '../hooks/useRouteTracking';

// Mounted once, inside <BrowserRouter> (needs router context for
// useLocation) and inside <AuthProvider> (needs auth status). Renders
// nothing — a pure side-effect component, same shape as this codebase
// doesn't otherwise have yet but matches the "mount a tracker near the
// router root" pattern from standard RUM/analytics libraries.
export default function RouteTracker() {
  useRouteTracking();
  return null;
}
