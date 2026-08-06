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

const mapPath = geoPath(geoEqualEarth().fitSize([MAP_W, MAP_H], WORLD_FC));

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
};

/** Resolve one of our names to its map path, or null if the map has no such country. */
export const countryPath = (name: string): string | null =>
  COUNTRY_BOX[MAP_ALIAS[name] ?? name]?.d || null;

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
