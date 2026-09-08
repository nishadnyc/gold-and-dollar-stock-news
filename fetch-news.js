// Fetches top news for Gold and the US Dollar from Google News RSS
// and writes the result to news.json. No API key required.

const fs = require('fs');
const path = require('path');

const FEEDS = [
  {
    key: 'gold',
    label: 'Gold',
    query: 'gold price OR gold market OR XAU',
  },
  {
    key: 'dollar',
    label: 'Dollar',
    query: 'US dollar index OR USD forex OR DXY',
  },
];

const ITEMS_PER_CATEGORY = 10;

function buildFeedUrl(query) {
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

function decodeEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripCdata(str) {
  const m = str.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return decodeEntities(m ? m[1] : str).trim();
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? stripCdata(m[1]) : '';
}

function parseItems(xml) {
  const items = [];
  const itemBlocks = xml.split('<item>').slice(1);
  for (const raw of itemBlocks) {
    const block = raw.split('</item>')[0];
    const rawTitle = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const sourceTag = extractTag(block, 'source');

    // Google News titles are usually "Headline - Source Name"
    let title = rawTitle;
    let source = sourceTag;
    const dashIdx = rawTitle.lastIndexOf(' - ');
    if (!source && dashIdx !== -1) {
      title = rawTitle.slice(0, dashIdx).trim();
      source = rawTitle.slice(dashIdx + 3).trim();
    }

    items.push({ title, link, source, pubDate });
  }
  return items;
}

async function fetchCategory(feed) {
  const url = buildFeedUrl(feed.query);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsFetcher/1.0)' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${feed.label} feed: ${res.status}`);
  }
  const xml = await res.text();
  return parseItems(xml).slice(0, ITEMS_PER_CATEGORY);
}

// Best-effort: pull the article's own og:description/meta description so we
// can show a real synopsis instead of just the headline. Not every site
// exposes one (JS-rendered pages, bot blocking) so this can come back empty.
async function fetchSummary(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsFetcher/1.0)' },
    });
    if (!res.ok) return '';
    const html = await res.text();
    const og = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const std = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const raw = og?.[1] || std?.[1] || '';
    const clean = decodeEntities(raw).replace(/\s+/g, ' ').trim();
    return clean.length > 300 ? clean.slice(0, 297) + '…' : clean;
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

async function enrich(items) {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      summary: await fetchSummary(item.link),
    }))
  );
}

async function main() {
  const result = {
    updatedAt: new Date().toISOString(),
  };

  for (const feed of FEEDS) {
    try {
      const items = await fetchCategory(feed);
      result[feed.key] = await enrich(items);
    } catch (err) {
      console.error(err.message);
      result[feed.key] = [];
    }
  }

  const outPath = path.join(__dirname, '..', 'news.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
