import { useState } from 'react';
import DashboardPage from './pages/DashboardPage';
import EmptyStatePage from './pages/EmptyStatePage';
import LoginPage from './pages/LoginPage';
import ProjectsPage from './pages/ProjectsPage';
import './styles/portal.css';

type Route = 'login' | 'projects' | 'dashboard' | 'empty';

// Screen switching is local state on purpose — swap for a router (or the real
// auth guard) once routing lands. Every screen renders from src/data/mock.ts.
export default function App() {
  const [route, setRoute] = useState<Route>('login');

  if (route === 'login') return <LoginPage onSignIn={() => setRoute('projects')} />;
  if (route === 'empty') return <EmptyStatePage onDone={() => setRoute('dashboard')} />;
  if (route === 'projects') {
    return (
      <ProjectsPage
        onOpenProject={() => setRoute('dashboard')}
        onNewProject={() => setRoute('empty')}
      />
    );
  }
  return (
    <DashboardPage
      onProjects={() => setRoute('projects')}
      onNewProject={() => setRoute('empty')}
    />
  );
}
