import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SOURCE, ENDPOINT, validateDataset, normalizeDataset, renderReadme, fetchDataset, sync } from './sync.mjs';
const product = (id, year = 2026, weekNumber = 42) => ({ id, slug: `product-${id}`, name: `Product ${id}`, tagline: 'Useful tool', description: '<p>Full description</p>', websiteUrl: 'https://example.com', logoUrl: null, thumbnailUrl: '/media/image.webp', publishedAt: '2026-10-13T00:00:00.000Z', year, weekNumber });
const sponsor = (websiteUrl = 'https://example.com', startsAt = '2026-10-01') => ({ name: 'Sponsor', tagline: 'Sponsor description', websiteUrl, imageUrl: null, startsAt, endsAt: '2026-10-31' });
const fixture = () => ({ schemaVersion: 1, source: SOURCE, products: [product(1), product(2, 2025, 52), product(3)], sponsors: [] });
const template = '# Products\n{{STATS}}\n{{SPONSORS}}\n{{PRODUCTS}}\n';
const response = (data) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

test('orders permanent Batch weeks newest first, including year boundaries', () => {
  const data = fixture();
  data.products.push(product(4, 2026, 1));
  const rendered = renderReadme(data, template);
  assert.deepEqual(normalizeDataset(data).products.map((p) => p.id), [3, 1, 4, 2]);
  assert.ok(rendered.indexOf('### 2026-W42') < rendered.indexOf('### 2026-W01'));
  assert.ok(rendered.indexOf('### 2026-W01') < rendered.indexOf('### 2025-W52'));
  assert.match(rendered, /\[2026 · Week 42\]\(#2026-w42\)/);
  assert.match(rendered, /https:\/\/betterlaunch.app\/p\/product-1/);
});
test('sponsors precede weeks, deduplicated across tracking and www variants', () => {
  const data = fixture();
  data.sponsors = [sponsor('https://www.example.com/?utm_source=x'), sponsor('https://example.com/path', '2026-09-01'), sponsor('https://another.com')];
  const rendered = renderReadme(data, template);
  assert.match(rendered, /2 sponsors/);
  assert.equal((rendered.match(/Sponsor description/g) ?? []).length, 2);
  assert.ok(rendered.indexOf('## Sponsors') < rendered.indexOf('## Products by launch week'));
});
test('preserves Unicode product slugs in safe encoded detail links', () => {
  const data = fixture();
  data.products[0].slug = '海棠诗社';
  assert.match(renderReadme(data, template), /https:\/\/betterlaunch.app\/p\/%E6%B5%B7/);
});
test('rejects unknown public fields, private fields, duplicate IDs, invalid weeks and URLs', () => {
  for (const mutate of [
    (d) => { d.email = 'private@example.test'; },
    (d) => { d.products[0].stripePaymentId = 'private'; },
    (d) => { d.products.push(d.products[0]); },
    (d) => { d.products[0].websiteUrl = 'javascript:alert(1)'; },
    (d) => { d.products[0].websiteUrl = 'https://secret@example.com'; },
    (d) => { d.products[0].year = 2025; d.products[0].weekNumber = 53; },
    (d) => { d.products = []; },
    (d) => { d.sponsors = [sponsor()]; d.sponsors[0].startsAt = '2026-02-30'; },
  ]) { const data = fixture(); mutate(data); assert.throws(() => validateDataset(data)); }
});
test('escapes author Markdown and HTML in table cells', () => {
  const data = fixture();
  data.products[0].name = '<img src=x> [fake](https://evil.test) | **bold**\nrow';
  data.products[0].websiteUrl = 'https://example.com/with_(parens)';
  const rendered = renderReadme(data, template);
  assert.doesNotMatch(rendered, /<img|\[fake\]|\*\*bold\*\*/);
  assert.match(rendered, /&#124;/);
  assert.match(rendered, /with_%28parens%29/);
});
test('requests fixed HTTPS source with header secret and disables redirects', async () => {
  await fetchDataset('test-only-secret', async (url, options) => {
    assert.equal(url, ENDPOINT); assert.equal(options.redirect, 'error');
    assert.equal(options.headers['x-api-key'], 'test-only-secret');
    return response(fixture());
  });
});
test('retries 429/5xx and network errors; fails immediately on 401', async () => {
  let attempts = 0;
  await fetchDataset('test-key', async () => ++attempts < 3 ? new Response('', { status: 503 }) : response(fixture()), async () => {});
  assert.equal(attempts, 3);
  attempts = 0;
  await assert.rejects(fetchDataset('test-key', async () => { attempts++; return new Response('private-response', { status: 401 }); }, async () => {}), /HTTP 401/);
  assert.equal(attempts, 1);
  attempts = 0;
  await fetchDataset('test-key', async () => { if (++attempts === 1) throw new Error('secret'); return response(fixture()); }, async () => {});
  assert.equal(attempts, 2);
  const pauses = [];
  attempts = 0;
  await fetchDataset('test-key', async () => ++attempts === 1 ? new Response('', { status: 429, headers: { 'retry-after': '999' } }) : response(fixture()), async (ms) => pauses.push(ms));
  assert.deepEqual(pauses, [30000]);
});
test('rejects HTML, malformed JSON and unsupported schema responses', async () => {
  for (const res of [new Response('<html>error</html>'), new Response('{', { headers: { 'content-type': 'application/json' } }), response({ schemaVersion: 2 })]) {
    await assert.rejects(fetchDataset('test-key', async () => res));
  }
});
test('failed validation preserves both outputs; unchanged sync is byte-identical', async () => {
  const root = await mkdtemp(join(tmpdir(), 'betterlaunch-dataset-'));
  try {
    await mkdir(join(root, 'templates')); await mkdir(join(root, 'data'));
    await writeFile(join(root, 'templates/README.md'), template);
    await writeFile(join(root, 'README.md'), 'previous readme');
    await writeFile(join(root, 'data/dataset.json'), 'previous data');
    await assert.rejects(sync({ root, key: 'test-key', fetcher: async () => response({ ...fixture(), products: [] }) }));
    assert.equal(await readFile(join(root, 'README.md'), 'utf8'), 'previous readme');
    assert.equal(await readFile(join(root, 'data/dataset.json'), 'utf8'), 'previous data');
    await sync({ root, key: 'test-key', fetcher: async () => response(fixture()) });
    const first = await readFile(join(root, 'README.md'), 'utf8');
    const json = await readFile(join(root, 'data/dataset.json'), 'utf8');
    await sync({ root, key: 'test-key', fetcher: async () => response(fixture()) });
    assert.equal(await readFile(join(root, 'README.md'), 'utf8'), first);
    assert.equal(await readFile(join(root, 'data/dataset.json'), 'utf8'), json);
  } finally { await rm(root, { recursive: true, force: true }); }
});
