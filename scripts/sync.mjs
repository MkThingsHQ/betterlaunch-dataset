import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';

export const SOURCE = 'https://betterlaunch.app';
export const ENDPOINT = `${SOURCE}/api/bot/dataset`;
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const text = (v) => typeof v === 'string';
const nonempty = (v) => text(v) && v.trim().length > 0;
const nullableText = (v) => v === null || text(v);
const integer = (v) => Number.isSafeInteger(v) && v > 0;
const date = (v) => nonempty(v) && Number.isFinite(Date.parse(v));
const day = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && date(v) && new Date(v).toISOString().slice(0, 10) === v;
const url = (v) => {
  try { return text(v) && ['https:', 'http:'].includes(new URL(v).protocol) && !new URL(v).username && !new URL(v).password; }
  catch { return false; }
};
const media = (v) => v === null || url(v) || (nonempty(v) && v.startsWith('/') && !v.startsWith('//'));
const schemas = {
  products: {
    id: integer, slug: (v) => nonempty(v) && /^[\p{L}\p{N}\p{M}]+(?:-[\p{L}\p{N}\p{M}]+)*$/u.test(v),
    name: nonempty, tagline: nullableText, description: nullableText,
    websiteUrl: url, logoUrl: media, thumbnailUrl: media, publishedAt: date,
    year: (v) => integer(v) && v >= 1970 && v <= 9999,
    weekNumber: (v) => integer(v) && v <= 53,
  },
  sponsors: {
    name: nonempty, tagline: text, websiteUrl: url, imageUrl: media,
    startsAt: day, endsAt: day,
  },
};
function assert(condition, message) { if (!condition) throw new Error(message); }
function keys(value) { return Object.keys(value).sort().join(','); }

export function validateWeek(year, weekNumber) {
  assert(integer(year) && year >= 1970 && year <= 9999 && integer(weekNumber) && weekNumber <= 53, 'Invalid ISO year or week number.');
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const thursday = new Date(Date.UTC(year, 0, 4 - ((jan4.getUTCDay() || 7) - 1) + (weekNumber - 1) * 7 + 3));
  assert(thursday.getUTCFullYear() === year, 'Invalid ISO week.');
  return { year, weekNumber };
}

export function currentWeek(now = new Date()) {
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const thursday = new Date(`${localDate}T00:00:00Z`);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const year = thursday.getUTCFullYear();
  const weekNumber = Math.ceil(((thursday - new Date(Date.UTC(year, 0, 1))) / 86400000 + 1) / 7);
  return validateWeek(year, weekNumber);
}

export function requestedWeek(year, weekNumber, now = new Date()) {
  const hasYear = year !== undefined && year !== '';
  const hasWeek = weekNumber !== undefined && weekNumber !== '';
  assert(hasYear === hasWeek, 'Provide both year and week number.');
  if (!hasYear) return currentWeek(now);
  assert(/^\d{4}$/.test(year) && /^\d{1,2}$/.test(weekNumber), 'Use a four-digit year and an integer week number.');
  return validateWeek(Number(year), Number(weekNumber));
}

/** Fail closed on unknown fields before any response enters the public repo. */
export function validateDataset(input) {
  assert(input && typeof input === 'object' && !Array.isArray(input), 'Invalid dataset.');
  assert(keys(input) === 'products,schemaVersion,source,sponsors', 'Unexpected dataset fields.');
  assert(input.schemaVersion === 1 && input.source === SOURCE, 'Unsupported dataset source or version.');
  const ids = new Set();
  const slugs = new Set();
  for (const [collection, schema] of Object.entries(schemas)) {
    assert(Array.isArray(input[collection]), `Missing ${collection}.`);
    for (const row of input[collection]) {
      assert(row && typeof row === 'object' && !Array.isArray(row) && keys(row) === keys(schema), `Unexpected ${collection} fields.`);
      for (const [field, check] of Object.entries(schema)) assert(check(row[field]), `Invalid ${collection}.${field}.`);
      if (collection === 'products') {
        assert(!ids.has(row.id) && !slugs.has(row.slug), 'Duplicate product identity.');
        ids.add(row.id); slugs.add(row.slug);
        validateWeek(row.year, row.weekNumber);
      } else assert(row.startsAt <= row.endsAt, 'Invalid sponsor date range.');
    }
  }
  return input;
}

export function normalizeDataset(input) {
  const data = validateDataset(input);
  return {
    schemaVersion: 1, source: SOURCE,
    products: [...data.products].sort((a, b) => b.year - a.year || b.weekNumber - a.weekNumber || Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || b.id - a.id),
    sponsors: [...data.sponsors].sort((a, b) => b.startsAt.localeCompare(a.startsAt) || a.websiteUrl.localeCompare(b.websiteUrl) || a.name.localeCompare(b.name) || a.endsAt.localeCompare(b.endsAt) || a.tagline.localeCompare(b.tagline) || String(a.imageUrl).localeCompare(String(b.imageUrl))),
  };
}

export async function fetchDataset(key, fetcher = fetch, pause = (ms) => new Promise((r) => setTimeout(r, ms)), week = currentWeek()) {
  assert(nonempty(key), 'BETTERLAUNCH_API_KEY is required.');
  validateWeek(week.year, week.weekNumber);
  const endpoint = new URL(ENDPOINT);
  endpoint.searchParams.set('year', String(week.year));
  endpoint.searchParams.set('weekNumber', String(week.weekNumber));
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetcher(endpoint.href, { headers: { 'x-api-key': key, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(90_000) });
    } catch {
      if (attempt === 2) throw new Error('BetterLaunch request failed (network, redirect, or timeout).');
      await pause(2000 * (attempt + 1)); continue;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      const seconds = Number(response.headers.get('retry-after')) || 2 * (attempt + 1);
      await response.body?.cancel();
      await pause(Math.min(30, Math.max(1, seconds)) * 1000); continue;
    }
    assert(response.ok, `BetterLaunch API returned HTTP ${response.status}.`);
    assert((response.headers.get('content-type') ?? '').includes('application/json'), 'Expected JSON response.');
    const body = await response.text();
    assert(body.length <= 30_000_000, 'Dataset exceeds the size limit.');
    let parsed;
    try { parsed = JSON.parse(body); } catch { throw new Error('Invalid JSON response.'); }
    const data = normalizeDataset(parsed);
    assert(data.products.every((p) => p.year === week.year && p.weekNumber === week.weekNumber), 'API returned products outside the requested week.');
    return data;
  }
}

export function cell(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().replace(/[&<>\\|\[\]`*_~]/g, (c) => `&#${c.charCodeAt(0)};`);
}
function link(label, target) {
  const absolute = new URL(target, SOURCE).href.replace(/[()|<>\s\\]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
  return `[${cell(label)}](${absolute})`;
}
export function uniqueSponsors(placements) {
  const seen = new Set();
  return placements.filter((placement) => {
    const identity = new URL(placement.websiteUrl).hostname.toLowerCase().replace(/^www\./, '');
    if (seen.has(identity)) return false;
    seen.add(identity); return true;
  });
}
export function renderReadme(input, template, week) {
  const data = normalizeDataset(input);
  const sponsors = uniqueSponsors(data.sponsors);
  const sponsorRows = sponsors.map((s) => `| ${link(s.name, s.websiteUrl)} | ${cell(s.tagline) || '—'} |`).join('\n');
  const sponsorsBlock = `## Sponsors\n\nProducts that have supported BetterLaunch, including past sponsors.\n\n${sponsors.length ? `| Product | Description |\n| --- | --- |\n${sponsorRows}` : 'No sponsor placements have started yet.'}`;
  const weeks = new Map();
  for (const product of data.products) {
    const identity = `${product.year}-W${String(product.weekNumber).padStart(2, '0')}`;
    if (!weeks.has(identity)) weeks.set(identity, []);
    weeks.get(identity).push(product);
  }
  const toc = [...weeks].map(([week, rows]) => `- [${week.replace('-W', ' · Week ')}](#${week.toLowerCase()}) (${rows.length})`).join('\n');
  const sections = [...weeks].map(([week, rows]) => {
    const productRows = rows.map((p) => `| ${link(p.name, `/p/${p.slug}`)} | ${cell(p.tagline) || '—'} | ${link('Website', p.websiteUrl)} |`).join('\n');
    return `### ${week}\n\n| Product | Description | Website |\n| --- | --- | --- |\n${productRows}`;
  }).join('\n\n');
  const weekLabel = week ? `${week.year}-W${String(week.weekNumber).padStart(2, '0')}` : null;
  const productsBlock = weekLabel
    ? `## Products for ${weekLabel}\n\n${sections || 'No products have launched for this week yet.'}`
    : `## Products by launch week\n\n${toc}\n\n${sections || 'No products have been synced yet.'}`;
  return template.replace('{{STATS}}', `**${data.products.length} products · ${weeks.size} launch weeks · ${sponsors.length} sponsors**`)
    .replace('{{SPONSORS}}', sponsorsBlock).replace('{{PRODUCTS}}', productsBlock);
}

export async function sync({ root = ROOT, key = process.env.BETTERLAUNCH_API_KEY, fromFile, fetcher = fetch, week = currentWeek() } = {}) {
  validateWeek(week.year, week.weekNumber);
  const data = fromFile ? normalizeDataset(JSON.parse(await readFile(resolve(fromFile), 'utf8'))) : await fetchDataset(key, fetcher, undefined, week);
  assert(data.products.every((p) => p.year === week.year && p.weekNumber === week.weekNumber), 'Dataset contains products outside the requested week.');
  const template = await readFile(resolve(root, 'templates/README.md'), 'utf8');
  const readme = renderReadme(data, template, week);
  assert(!/\{\{(?:STATS|SPONSORS|PRODUCTS)\}\}/.test(readme), 'Unresolved template marker.');
  await mkdir(resolve(root, 'data'), { recursive: true });
  const outputs = [['README.md', readme], ['data/dataset.json', `${JSON.stringify(data, null, 2)}\n`]];
  // Complete fetch/validation/render first. Commit only after the process succeeds.
  for (const [name, content] of outputs) await writeFile(resolve(root, `${name}.tmp`), content);
  for (const [name] of outputs) await rename(resolve(root, `${name}.tmp`), resolve(root, name));
  console.log(`Rendered ${data.products.length} products and ${uniqueSponsors(data.sponsors).length} sponsors.`);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const { values } = parseArgs({ options: { 'from-file': { type: 'string' }, year: { type: 'string' }, 'week-number': { type: 'string' } } });
    const week = requestedWeek(values.year ?? process.env.DATASET_YEAR, values['week-number'] ?? process.env.DATASET_WEEK_NUMBER);
    await sync({ fromFile: values['from-file'], week });
  } catch (error) { console.error(error instanceof Error ? error.message : 'Dataset sync failed.'); process.exitCode = 1; }
}
