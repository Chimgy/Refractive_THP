import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sparkline from '../components/Sparkline';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import * as projectsApi from '../api/projects';
import type { Project as MockProject } from '../data/mock';

const filters = ['All', 'In development', 'Live', 'Needs connection'];
const cols = '1.5fr 130px 118px 118px 150px 90px';

const toneColor: Record<MockProject['trendTone'], string> = {
  good: 'var(--good)',
  bad: 'var(--bad)',
  warn: 'var(--warn)',
};

function stagePill(stage: MockProject['stage']) {
  if (stage === 'live') return <span className="pill pill-live">LIVE</span>;
  if (stage === 'dev') return <span className="pill pill-dev">IN DEV</span>;
  return <span className="pill pill-partial">PARTIAL</span>;
}

// GitHub (dev-stage) and infra polling aren't wired up yet (project-plan.md
// section 4/section 5) — only the telemetry domain has anything real behind it right now.
// Every project from the real API renders as PARTIAL/TEL-only until those
// land; deployFreq/leadTime/trend stay blank rather than fabricated.
function toRow(p: projectsApi.Project): MockProject {
  return {
    id: p.id,
    name: p.name,
    repo: null,
    stage: 'partial',
    deployFreq: null,
    leadTime: null,
    sources: ['TEL'],
    trend: [],
    trendTone: 'warn',
  };
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [projects, setProjects] = useState<MockProject[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    projectsApi
      .list()
      .then((res) => {
        if (!cancelled) setProjects(res.map(toRow));
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = (projects ?? []).filter((p) => {
    const matchesQuery =
      !query ||
      p.name.includes(query.toLowerCase()) ||
      (p.repo ?? '').includes(query.toLowerCase());
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Live' && p.stage === 'live') ||
      (filter === 'In development' && p.stage === 'dev') ||
      (filter === 'Needs connection' && p.stage === 'partial');
    return matchesQuery && matchesFilter;
  });

  return (
    <div
      style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}
    >
      <SiteHeader />

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          padding: '28px 30px 20px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <h1
            style={{ font: '400 22px var(--sans)', letterSpacing: '-0.015em' }}
          >
            Projects
          </h1>
          <div
            style={{
              marginTop: 6,
              font: '400 12.5px var(--sans)',
              color: 'rgba(237,237,240,.45)',
            }}
          >
            {projects === null
              ? 'loading…'
              : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            style={{ height: 34, width: 230 }}
            placeholder="Search projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/projects/new')}
          >
            + New project
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '14px 30px',
          borderBottom: '1px solid rgba(255,255,255,.07)',
        }}
      >
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 11px',
              borderRadius: 6,
              font: `${f === filter ? 500 : 400} 11.5px var(--sans)`,
              background: f === filter ? 'var(--accent-soft)' : 'transparent',
              color:
                f === filter ? 'var(--accent-text)' : 'rgba(237,237,240,.5)',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div
        className="thead"
        style={{
          display: 'grid',
          gridTemplateColumns: cols,
          padding: '11px 30px',
        }}
      >
        <span>PROJECT</span>
        <span>STAGE</span>
        <span>DEPLOY FREQ</span>
        <span>LEAD TIME</span>
        <span>SOURCES</span>
        <span>TREND</span>
      </div>

      {rows.map((p) => (
        <div
          key={p.id}
          className="tr row-hover"
          style={{ gridTemplateColumns: cols, padding: '15px 30px' }}
          onClick={() => navigate(`/projects/${p.id}/dev`)}
        >
          <div>
            <div style={{ font: '500 13.5px var(--sans)' }}>{p.name}</div>
            <div
              className="mono"
              style={{ marginTop: 3, fontSize: 11, color: 'var(--faint)' }}
            >
              {p.repo ?? 'no repo linked'}
            </div>
          </div>
          <span style={{ justifySelf: 'start' }}>{stagePill(p.stage)}</span>
          <span
            className="mono"
            style={{
              fontSize: 12.5,
              color: p.deployFreq
                ? 'rgba(237,237,240,.75)'
                : 'rgba(237,237,240,.25)',
            }}
          >
            {p.deployFreq ?? '—'}
          </span>
          <span
            className="mono"
            style={{
              fontSize: 12.5,
              color: p.leadTime
                ? 'rgba(237,237,240,.75)'
                : 'rgba(237,237,240,.25)',
            }}
          >
            {p.leadTime ?? '—'}
          </span>
          <span
            className="mono"
            style={{ fontSize: 10.5, color: 'rgba(237,237,240,.45)' }}
          >
            {p.sources.join(' · ')}
          </span>
          {p.trend.length ? (
            <Sparkline points={p.trend} tone={toneColor[p.trendTone]} />
          ) : (
            <span
              className="mono"
              style={{ fontSize: 10.5, color: 'var(--accent-text)' }}
            >
              Link repo
            </span>
          )}
        </div>
      ))}

      {rows.length === 0 ? (
        <div
          style={{
            padding: '40px 30px',
            font: '400 13px var(--sans)',
            color: 'var(--muted)',
          }}
        >
          {loadFailed
            ? 'Failed to load projects.'
            : projects === null
              ? 'Loading projects…'
              : 'No projects match that filter.'}
        </div>
      ) : null}

      <SiteFooter />
    </div>
  );
}
