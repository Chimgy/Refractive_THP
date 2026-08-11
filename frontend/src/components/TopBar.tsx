import ProfileMenu from './ProfileMenu';

type Props = {
  projectName: string;
  subtitle: string;
  onProjects: () => void;
  onNewProject: () => void;
  onHowItWorks?: () => void;
  onSignOut?: () => void;
};

export default function TopBar({
  projectName,
  subtitle,
  onProjects,
  onNewProject,
  onHowItWorks,
  onSignOut,
}: Props) {
  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div className="brand-dot" />
        <button
          type="button"
          className="btn"
          style={{ height: 30, gap: 8 }}
          onClick={onProjects}
        >
          {projectName}
          <span className="mono faint" style={{ fontSize: 10 }}>⌄</span>
        </button>
        <span className="mono faint" style={{ fontSize: 11.5 }}>{subtitle}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" className="btn" style={{ height: 30 }} onClick={onNewProject}>
          + New project
        </button>
        <button type="button" className="btn btn-primary" style={{ height: 30 }}>
          Refresh
        </button>
        <ProfileMenu onHowItWorks={onHowItWorks} onSignOut={onSignOut} />
      </div>
    </div>
  );
}
