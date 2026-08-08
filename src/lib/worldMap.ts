// Precomputed world map geometry, shared by the Travel History tool and the landing preview.
// The projection runs once at module load, offline — world-atlas is a bundled package, not a
// fetch. Extracted here so the two consumers don't each project the whole world.
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import worldTopo from 'world-atlas/countries-110m.json' with { type: 'json' };

/* eslint-disable @typescript-eslint/no-explicit-any -- topojson ships no useful types */
const WORLD_FC: any = feature(worldTopo as any, (worldTopo as any).objects.countries);

export const MAP_W = 800;
export const MAP_H = 388;

const projection = geoEqualEarth().fitSize([MAP_W, MAP_H], WORLD_FC);
const mapPath = geoPath(projection);

export const COUNTRY_PATHS: { name: string; d: string }[] = WORLD_FC.features.map((f: any) => ({
  name: f.properties.name,
  d: mapPath(f) || '',
}));

/** Per-country path plus bounding box, for drawing a single-country silhouette. */
export const COUNTRY_BOX: Record<string, { d: string; box: [number, number, number, number] }> = {};
WORLD_FC.features.forEach((f: any) => {
  const d = mapPath(f) || '';
  const b = mapPath.bounds(f);
  COUNTRY_BOX[f.properties.name] = { d, box: [b[0][0], b[0][1], b[1][0] - b[0][0], b[1][1] - b[0][1]] };
});
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Where our country names differ from world-atlas naming. */
export const MAP_ALIAS: Record<string, string> = {
  'United States': 'United States of America',
  'Czech Republic': 'Czechia',
  'Bosnia and Herzegovina': 'Bosnia and Herz.',
  'Central African Republic': 'Central African Rep.',
  'DR Congo': 'Dem. Rep. Congo',
  'Dominican Republic': 'Dominican Rep.',
  'Equatorial Guinea': 'Eq. Guinea',
  Eswatini: 'eSwatini',
  'Ivory Coast': "Côte d'Ivoire",
  'North Macedonia': 'Macedonia',
  'Solomon Islands': 'Solomon Is.',
  'South Sudan': 'S. Sudan',
  'Western Sahara': 'W. Sahara',
};

/** Resolve one of our names to its map path, or null if the map has no such country. */
export const countryPath = (name: string): string | null =>
  COUNTRY_BOX[MAP_ALIAS[name] ?? name]?.d || null;

/**
 * Countries the 110m world-atlas outline is too coarse to draw — microstates and small
 * islands. [lon, lat] so the map can still fly to them and drop a pin.
 */
export const SMALL_COUNTRY_POINTS: Record<string, [number, number]> = {
  Andorra: [1.52, 42.51],
  'Antigua and Barbuda': [-61.8, 17.06],
  Bahrain: [50.55, 26.07],
  Barbados: [-59.54, 13.19],
  'Cape Verde': [-23.61, 15.12],
  Comoros: [43.33, -11.65],
  Dominica: [-61.37, 15.41],
  Grenada: [-61.68, 12.12],
  'Hong Kong': [114.17, 22.32],
  Kiribati: [173.03, 1.87],
  Liechtenstein: [9.55, 47.17],
  Macau: [113.54, 22.2],
  Maldives: [73.51, 4.18],
  Malta: [14.44, 35.9],
  'Marshall Islands': [171.18, 7.13],
  Mauritius: [57.55, -20.35],
  Micronesia: [158.21, 6.92],
  Monaco: [7.42, 43.74],
  Nauru: [166.93, -0.52],
  Palau: [134.58, 7.51],
  'Saint Kitts and Nevis': [-62.78, 17.36],
  'Saint Lucia': [-60.98, 13.91],
  'Saint Vincent and the Grenadines': [-61.29, 12.98],
  Samoa: [-172.1, -13.76],
  'San Marino': [12.46, 43.94],
  'Sao Tome and Principe': [6.61, 0.19],
  Seychelles: [55.49, -4.68],
  Singapore: [103.82, 1.35],
  Tonga: [-175.2, -21.18],
  Tuvalu: [179.19, -8.52],
  'Vatican City': [12.45, 41.9],
};

/**
 * Where to fly the map for a country: its own outline when the atlas draws one, otherwise a
 * pinned point. `null` only for names we know nothing about.
 */
export function mapTarget(name: string): { box: [number, number, number, number]; point?: [number, number] } | null {
  const drawn = COUNTRY_BOX[MAP_ALIAS[name] ?? name];
  if (drawn?.d) return { box: drawn.box };

  const lonLat = SMALL_COUNTRY_POINTS[name];
  if (!lonLat) return null;

  const p = projection(lonLat);
  if (!p) return null;
  const r = 6; // a box big enough that the zoom lands on a readable neighbourhood, not one pixel
  return { box: [p[0] - r, p[1] - r, r * 2, r * 2], point: [p[0], p[1]] };
}

/**
 * A viewBox framing just these countries, so a map of four Asian countries doesn't waste
 * four-fifths of its area on empty Atlantic. Falls back to the whole world if none resolve.
 *
 * `padRatio` is relative to the larger side, and the result keeps the map's aspect ratio so
 * the SVG never distorts.
 */
export function viewBoxFor(names: string[], padRatio = 0.35): string {
  const boxes = names
    .map((name) => COUNTRY_BOX[MAP_ALIAS[name] ?? name]?.box)
    .filter((box): box is [number, number, number, number] => Boolean(box));

  if (!boxes.length) return `0 0 ${MAP_W} ${MAP_H}`;

  const minX = Math.min(...boxes.map((b) => b[0]));
  const minY = Math.min(...boxes.map((b) => b[1]));
  const maxX = Math.max(...boxes.map((b) => b[0] + b[2]));
  const maxY = Math.max(...boxes.map((b) => b[1] + b[3]));

  const pad = Math.max(maxX - minX, maxY - minY) * padRatio;
  let x = minX - pad;
  let y = minY - pad;
  let width = maxX - minX + pad * 2;
  let height = maxY - minY + pad * 2;

  // Match the map's aspect ratio by growing the short side, never cropping the long one.
  const ratio = MAP_W / MAP_H;
  if (width / height < ratio) {
    const target = height * ratio;
    x -= (target - width) / 2;
    width = target;
  } else {
    const target = width / ratio;
    y -= (target - height) / 2;
    height = target;
  }

  return `${x.toFixed(1)} ${y.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)}`;
}
