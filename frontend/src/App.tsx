import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import RouteTracker from './analytics/RouteTracker';
import { AuthProvider, useAuth } from './auth/AuthContext';
import DashboardPage from './pages/DashboardPage';
import DocsPage from './pages/DocsPage';
import EmptyStatePage from './pages/EmptyStatePage';
import HowItWorksPage from './pages/HowItWorksPage';
import LoginPage from './pages/LoginPage';
import ProjectsPage from './pages/ProjectsPage';
import SignupPage from './pages/SignupPage';
import './styles/portal.css';
import MetricsPage from './pages/MetricsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RouteTracker />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100svh', display: 'grid', placeItems: 'center' }}>
      <span className="mono faint" style={{ fontSize: 12 }}>
        Loading…
      </span>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <LoadingScreen />;
  if (status !== 'authenticated') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'authenticated') return <Navigate to="/projects" replace />;
  return <>{children}</>;
}

// Every screen still renders from src/data/mock.ts except the auth forms,
// which hit the Nest backend via src/auth/AuthContext.
function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/signup"
        element={
          <RedirectIfAuthed>
            <SignupPage />
          </RedirectIfAuthed>
        }
      />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/metrics" element={<MetricsPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route
        path="/projects"
        element={
          <RequireAuth>
            <ProjectsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/projects/new"
        element={
          <RequireAuth>
            <EmptyStatePage />
          </RequireAuth>
        }
      />
      <Route
        path="/projects/:projectId"
        element={<Navigate to="dev" replace />}
      />
      <Route
        path="/projects/:projectId/:tab"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
