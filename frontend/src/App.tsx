import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import DashboardPage from './pages/DashboardPage';
import EmptyStatePage from './pages/EmptyStatePage';
import HowItWorksPage from './pages/HowItWorksPage';
import LoginPage from './pages/LoginPage';
import ProjectsPage from './pages/ProjectsPage';
import SignupPage from './pages/SignupPage';
import './styles/portal.css';

type Route = 'login' | 'signup' | 'how' | 'projects' | 'dashboard' | 'empty';

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}

// Screen switching is local state on purpose — swap for a real router once
// routing lands. Every screen still renders from src/data/mock.ts except the
// auth forms, which now hit the Nest backend via src/auth/AuthContext.
function Routes() {
  const { status, logout } = useAuth();
  const [route, setRoute] = useState<Route>('login');

  if (status === 'loading') {
    return (
      <div
        style={{ minHeight: '100svh', display: 'grid', placeItems: 'center' }}
      >
        <span className="mono faint" style={{ fontSize: 12 }}>
          Loading…
        </span>
      </div>
    );
  }

  if (status !== 'authenticated') {
    if (route === 'signup') {
      return (
        <SignupPage
          onSignUp={() => setRoute('empty')}
          onSignIn={() => setRoute('login')}
          onHowItWorks={() => setRoute('how')}
        />
      );
    }
    if (route === 'how') {
      return (
        <HowItWorksPage
          onSignIn={() => setRoute('login')}
          onBack={() => setRoute('login')}
        />
      );
    }
    return (
      <LoginPage
        onSignIn={() => setRoute('projects')}
        onRegister={() => setRoute('signup')}
        onHowItWorks={() => setRoute('how')}
      />
    );
  }

  if (route === 'how') {
    return (
      <HowItWorksPage
        onSignIn={() => setRoute('login')}
        onBack={() => setRoute('projects')}
      />
    );
  }
  if (route === 'empty')
    return <EmptyStatePage onDone={() => setRoute('dashboard')} />;
  if (route === 'dashboard') {
    return (
      <DashboardPage
        onProjects={() => setRoute('projects')}
        onNewProject={() => setRoute('empty')}
        onHowItWorks={() => setRoute('how')}
        onSignOut={() => {
          void logout();
          setRoute('login');
        }}
      />
    );
  }
  return (
    <ProjectsPage
      onOpenProject={() => setRoute('dashboard')}
      onNewProject={() => setRoute('empty')}
    />
  );
}
