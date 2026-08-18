import { useCallback, useEffect, useState } from 'react';
import * as githubActivityApi from '../../api/githubActivity';
import WidgetShell from '../WidgetShell';
import type { DragHandleProps } from '../grid/DashboardGrid';
import type { WidgetInstance } from '../grid/types';
import type { GithubActivityConfig } from './config';

type Props = {
  instance: WidgetInstance<GithubActivityConfig>;
  projectId: string;
  onUpdate: (next: WidgetInstance<GithubActivityConfig>) => void;
  onRemove: (id: string) => void;
  dragHandleProps: DragHandleProps;
};

function Section({
  label,
  empty,
  children,
}: {
  label: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mono faint" style={{ fontSize: 11, marginBottom: 8 }}>
        {label}
      </div>
      {empty ? (
        <div className="mono faint" style={{ fontSize: 11 }}>
          Nothing recorded yet.
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// Real data, not a fake*.ts generator like every other widget in this
// folder — proof of concept for the GitHub webhook -> DB -> dashboard
// path, deliberately kept plain (no charts) per the "very basic" scope.
export default function GithubActivityWidget({
  instance,
  projectId,
  onUpdate,
  onRemove,
  dragHandleProps,
}: Props) {
  const [byAuthor, setByAuthor] = useState<githubActivityApi.CommitByAuthor[]>(
    [],
  );
  const [byDay, setByDay] = useState<githubActivityApi.CommitByDay[]>([]);
  const [branches, setBranches] = useState<githubActivityApi.GithubBranch[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    Promise.all([
      githubActivityApi.getCommitsByAuthor(projectId),
      githubActivityApi.getCommitsByDay(projectId),
      githubActivityApi.getBranches(projectId),
    ])
      .then(([authors, days, branchList]) => {
        setByAuthor(authors);
        setByDay(days);
        setBranches(branchList);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRename = useCallback(
    (title: string) => onUpdate({ ...instance, title }),
    [instance, onUpdate],
  );

  return (
    <WidgetShell
      title={instance.title}
      description={
        instance.description ?? 'Real data from the linked GitHub repo'
      }
      dragHandleProps={dragHandleProps}
      loading={loading}
      onRefresh={load}
      onRename={handleRename}
      onRemove={() => onRemove(instance.id)}
    >
      {failed ? (
        <div className="mono faint" style={{ fontSize: 11 }}>
          Failed to load — is a GitHub repo linked to this project?
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Section label="COMMITS PER AUTHOR" empty={byAuthor.length === 0}>
            {byAuthor.map((a) => (
              <div
                key={a.author}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12.5,
                  padding: '4px 0',
                }}
              >
                <span>{a.author}</span>
                <span className="mono">{a.count}</span>
              </div>
            ))}
          </Section>

          <Section label="COMMITS PER DAY" empty={byDay.length === 0}>
            {byDay.map((d) => (
              <div
                key={d.day}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12.5,
                  padding: '4px 0',
                }}
              >
                <span>{d.day}</span>
                <span className="mono">{d.count}</span>
              </div>
            ))}
          </Section>

          <Section label="BRANCHES" empty={branches.length === 0}>
            {branches.map((b) => (
              <div key={b.name} style={{ fontSize: 12.5, padding: '4px 0' }}>
                {b.name}
              </div>
            ))}
          </Section>
        </div>
      )}
    </WidgetShell>
  );
}
