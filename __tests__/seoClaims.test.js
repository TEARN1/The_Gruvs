/**
 * __tests__/seoClaims.test.js
 * The static pages search engines read must not claim what the app does not
 * do (escrow, "verified" or "certified" providers, invented prices), finished
 * events must drop out, and robots.txt must apply to every crawler.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('search pages say only what is true', () => {
  const sources = ['scripts/build-seo-hubs.js', 'scripts/gen-sitemap.js', 'web/index.html', 'public/founder.html', 'public/press.html', 'src/utils/seo.js'];

  test.each(sources)('%s makes no escrow, verified, certified or "official" claims', (file) => {
    const text = read(file);
    expect(text).not.toMatch(/escrow|\bverified\b|\bcertified\b|\bofficial\b|\bpremier\b|aggregateRating|fraud-proof/i);
  });

  test('service pages carry no invented starting prices', () => {
    const text = read('scripts/build-seo-hubs.js');
    expect(text).not.toMatch(/\$\{(escapeHtml\()?s\.rate/);
    expect(text).not.toMatch(/priceRange/);
  });

  test('every service page is noindex until it lists real providers', () => {
    const dir = path.join(root, 'public', 'services');
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name, 'index.html');
      if (!fs.existsSync(file)) continue;
      expect(fs.readFileSync(file, 'utf8')).toContain('<meta name="robots" content="noindex');
    }
    expect(read('public/sitemap.xml')).not.toContain('https://thegruvs.com/services');
  });

  test('robots.txt has one group, for every crawler, and lists the sitemaps', () => {
    for (const file of ['public/robots.txt', 'web/robots.txt']) {
      const robots = read(file);
      expect(robots.match(/^User-agent:/gm)).toEqual(['User-agent:']);
      expect(robots).toContain('User-agent: *');
      expect(robots).toContain('Sitemap: https://thegruvs.com/sitemap.xml');
    }
  });
});

describe('finished events', () => {
  const { pruneEndedEventPages } = require('../scripts/build-seo-hubs.js');

  test('pages for events that are over are removed; hubs and upcoming events stay', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gruvs-events-'));
    const page = (name, html) => {
      fs.mkdirSync(path.join(dir, name));
      fs.writeFileSync(path.join(dir, name, 'index.html'), html);
    };
    const id = '5cfcdb06-0fd2-4022-be16-fbc8ef91398e';
    page(`old-show-pretoria-${id}`, '{"startDate": "2026-01-10T20:00"}');
    page(`new-show-pretoria-${id.replace('5', '6')}`, '{"startDate": "2027-01-10T20:00"}');
    page('johannesburg', '{"startDate": "2026-01-10T20:00"}');

    expect(pruneEndedEventPages(dir, '2026-11-25')).toBe(1);
    expect(fs.readdirSync(dir).sort()).toEqual(['johannesburg', `new-show-pretoria-${id.replace('5', '6')}`]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('no committed event page is for an event that is over', () => {
    const dir = path.join(root, 'public', 'events');
    const today = new Date().toISOString().slice(0, 10);
    const ended = fs
      .readdirSync(dir)
      .filter((n) => /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(n))
      .filter((n) => {
        const f = path.join(dir, n, 'index.html');
        const start = fs.existsSync(f) && (fs.readFileSync(f, 'utf8').match(/"startDate":\s*"(\d{4}-\d{2}-\d{2})/) || [])[1];
        return start && start < today;
      });
    expect(ended).toEqual([]);
  });
});
