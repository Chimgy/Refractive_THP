import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type {
  GeometryCollection,
  Topology,
} from 'topojson-specification';
// Vite bundles this as a plain JSON asset (~100KB) — see
// tsconfig.app.json's resolveJsonModule. Natural Earth data via the
// topojson maintainers' `world-atlas` package (ISC license, public domain
// source), keyed by ISO 3166-1 numeric country codes.
import worldTopology from 'world-atlas/countries-110m.json';
import { ALPHA2_TO_NUMERIC, fallbackCountryLabel } from '../lib/iso-country';

type CountryProperties = { name: string };

const WIDTH = 480;
const HEIGHT = 250;

const countries = feature(
  worldTopology as unknown as Topology,
  (worldTopology as unknown as Topology).objects
    .countries as GeometryCollection<CountryProperties>,
);

const NUMERIC_TO_NAME = new Map(
  countries.features.map((f) => [String(f.id), f.properties?.name ?? String(f.id)]),
);

// Display name for a `countries` breakdown key (alpha-2, or one of
// Cloudflare's two non-ISO codes) — used by the ranked list next to the map,
// which needs a label even for codes the map itself can't plot.
export function countryName(alpha2: string): string {
  const numeric = ALPHA2_TO_NUMERIC[alpha2];
  const name = numeric ? NUMERIC_TO_NAME.get(numeric) : undefined;
  return name ?? fallbackCountryLabel(alpha2);
}

const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], countries);
const path = geoPath(projection);

// No-data track color matches every other empty bar/track in this app
// (BarRow/ColumnBars in MetricsPage.tsx); the top end matches --accent, the
// same "how much" language those bars already use elsewhere.
const EMPTY_FILL = 'rgba(255,255,255,.06)';
const FILL_STEPS = [
  'rgba(123,92,224,.22)',
  'rgba(123,92,224,.4)',
  'rgba(123,92,224,.62)',
  'rgba(123,92,224,.85)',
  '#7b5ce0',
];

function fillFor(count: number, max: number): string {
  if (count <= 0 || max <= 0) return EMPTY_FILL;
  const step = Math.min(
    FILL_STEPS.length - 1,
    Math.floor((count / max) * FILL_STEPS.length),
  );
  return FILL_STEPS[step];
}

export default function WorldMap({
  data,
}: {
  data: { key: string; count: number }[];
}) {
  const byNumeric = new Map<string, number>();
  for (const { key, count } of data) {
    const numeric = ALPHA2_TO_NUMERIC[key];
    if (numeric) byNumeric.set(numeric, (byNumeric.get(numeric) ?? 0) + count);
  }
  const max = Math.max(0, ...byNumeric.values());

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {countries.features.map((f) => {
        const id = String(f.id);
        const count = byNumeric.get(id) ?? 0;
        return (
          <path
            key={id}
            d={path(f) ?? undefined}
            fill={fillFor(count, max)}
            stroke="rgba(255,255,255,.08)"
            strokeWidth={0.5}
          >
            <title>
              {f.properties?.name ?? id}
              {count > 0 ? ` — ${count.toLocaleString()}` : ''}
            </title>
          </path>
        );
      })}
    </svg>
  );
}
