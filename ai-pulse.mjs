#!/usr/bin/env node

// ╔═══════════════════════════════════════════════════════════════╗
// ║  AI Pulse v1.0.0 — AI 行业 Top 30 名人动态追踪 CLI           ║
// ║  Zero dependencies. Pure Node.js. Ship fast.                 ║
// ║  Inspired by Peter Steinberger's CLI-first philosophy.       ║
// ╚═══════════════════════════════════════════════════════════════╝

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import { URL, fileURLToPath } from 'node:url';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 1. ANSI Terminal Colors & Styling
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const isColorSupported = process.stdout.isTTY && process.env.TERM !== 'dumb';

const c = {
  reset:   (s) => isColorSupported ? `\x1b[0m${s}\x1b[0m` : s,
  bold:    (s) => isColorSupported ? `\x1b[1m${s}\x1b[0m` : s,
  dim:     (s) => isColorSupported ? `\x1b[2m${s}\x1b[0m` : s,
  italic:  (s) => isColorSupported ? `\x1b[3m${s}\x1b[0m` : s,
  red:     (s) => isColorSupported ? `\x1b[31m${s}\x1b[0m` : s,
  green:   (s) => isColorSupported ? `\x1b[32m${s}\x1b[0m` : s,
  yellow:  (s) => isColorSupported ? `\x1b[33m${s}\x1b[0m` : s,
  blue:    (s) => isColorSupported ? `\x1b[34m${s}\x1b[0m` : s,
  magenta: (s) => isColorSupported ? `\x1b[35m${s}\x1b[0m` : s,
  cyan:    (s) => isColorSupported ? `\x1b[36m${s}\x1b[0m` : s,
  white:   (s) => isColorSupported ? `\x1b[37m${s}\x1b[0m` : s,
  gray:    (s) => isColorSupported ? `\x1b[90m${s}\x1b[0m` : s,
  bgCyan:  (s) => isColorSupported ? `\x1b[46m\x1b[30m${s}\x1b[0m` : s,
  bgYellow:(s) => isColorSupported ? `\x1b[43m\x1b[30m${s}\x1b[0m` : s,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 2. Box Drawing & Table Utilities
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function box(text, { color = c.cyan, title = '', width = 62 } = {}) {
  const lines = text.split('\n');
  const inner = width - 4;
  const top = title
    ? `╭─ ${title} ${'─'.repeat(Math.max(0, inner - title.length - 2))}╮`
    : `╭${'─'.repeat(width - 2)}╮`;
  const bottom = `╰${'─'.repeat(width - 2)}╯`;
  const padded = lines.map((l) => {
    const visible = stripAnsi(l);
    const pad = Math.max(0, inner - visible.length);
    return `│ ${l}${' '.repeat(pad)} │`;
  });
  return [color(top), ...padded.map(color), color(bottom)].join('\n');
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function padRight(str, len) {
  const visible = stripAnsi(str);
  const pad = Math.max(0, len - visible.length);
  return str + ' '.repeat(pad);
}

function truncate(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}

function table(headers, rows, colWidths) {
  const sep = c.gray('│');
  const hline = c.gray('├' + colWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤');
  const topline = c.gray('┌' + colWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐');
  const botline = c.gray('└' + colWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘');

  const formatRow = (cells) =>
    sep + ' ' + cells.map((cell, i) => padRight(String(cell), colWidths[i])).join(' ' + sep + ' ') + ' ' + sep;

  const headerRow = formatRow(headers.map(h => c.bold(c.white(h))));

  const output = [topline, headerRow, hline];
  for (const row of rows) {
    output.push(formatRow(row));
  }
  output.push(botline);
  return output.join('\n');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 3. Spinner Utility
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function createSpinner(text) {
  let i = 0;
  let interval = null;
  return {
    start() {
      if (!isColorSupported) { process.stdout.write(text + '\n'); return this; }
      interval = setInterval(() => {
        process.stdout.write(`\r${c.cyan(SPINNER_FRAMES[i++ % SPINNER_FRAMES.length])} ${text}`);
      }, 80);
      return this;
    },
    update(newText) { text = newText; },
    succeed(msg) {
      if (interval) clearInterval(interval);
      process.stdout.write(`\r${c.green('✓')} ${msg}\n`);
    },
    fail(msg) {
      if (interval) clearInterval(interval);
      process.stdout.write(`\r${c.red('✗')} ${msg}\n`);
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 4. AI Leaders Database — Top 30
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CATEGORY = {
  ceo:        { label: 'CEO/高管',     color: c.red },
  researcher: { label: '研究者',       color: c.cyan },
  engineer:   { label: '工程师',       color: c.blue },
  creator:    { label: '创作者/开源',  color: c.magenta },
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PEOPLE_FILE = join(__dirname, 'data', 'people.json');

function loadPeople() {
  try {
    const raw = JSON.parse(readFileSync(PEOPLE_FILE, 'utf-8'));
    if (!Array.isArray(raw)) return [];
    return raw.map((p) => ({ ...p, feeds: Array.isArray(p.feeds) ? p.feeds : [] }));
  } catch {
    return [];
  }
}

const PEOPLE = loadPeople();

// AI 行业新闻 RSS 源（用于补充追踪）
const NEWS_FEEDS = [
  { url: 'https://openai.com/blog/rss.xml',   name: 'OpenAI Blog' },
  { url: 'https://www.anthropic.com/rss.xml',  name: 'Anthropic Blog' },
  { url: 'https://blog.google/technology/ai/rss/', name: 'Google AI Blog' },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 5. Cache System (~/.ai-pulse/cache.json)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CACHE_DIR = join(homedir(), '.ai-pulse');
const CACHE_FILE = join(CACHE_DIR, 'cache.json');
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

function loadCache() {
  ensureCacheDir();
  if (!existsSync(CACHE_FILE)) return {};
  try { return JSON.parse(readFileSync(CACHE_FILE, 'utf-8')); } catch { return {}; }
}

function saveCache(store) {
  ensureCacheDir();
  writeFileSync(CACHE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function getCached(key) {
  const store = loadCache();
  const entry = store[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { delete store[key]; saveCache(store); return null; }
  return entry.data;
}

function setCache(key, data) {
  const store = loadCache();
  store[key] = { data, ts: Date.now() };
  saveCache(store);
}

function clearAllCache() {
  saveCache({});
}

function getCacheStats() {
  const store = loadCache();
  const entries = Object.keys(store).length;
  let sizeKB = 0;
  if (existsSync(CACHE_FILE)) {
    sizeKB = Math.round(readFileSync(CACHE_FILE, 'utf-8').length / 1024);
  }
  return { entries, sizeKB };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 6. RSS Feed Fetcher & Parser (Zero-dependency XML parsing)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

function extractTag(xml, tag) {
  // Try <tag>...</tag> and <tag ...>...</tag>
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function extractAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const m = xml.match(re);
  return m ? m[1] : '';
}

function parseRssFeed(xml) {
  const items = [];
  const feedTitle = extractTag(xml, 'title') || 'Unknown';

  // RSS 2.0 items
  const rssItems = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const raw of rssItems.slice(0, 15)) {
    items.push({
      title: stripHtml(extractTag(raw, 'title')) || '(无标题)',
      link: extractTag(raw, 'link') || '',
      date: extractTag(raw, 'pubDate') || extractTag(raw, 'dc:date') || '',
      snippet: truncate(stripHtml(extractTag(raw, 'description') || extractTag(raw, 'content:encoded') || ''), 200),
      source: stripHtml(feedTitle),
    });
  }

  // Atom entries
  if (items.length === 0) {
    const atomItems = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    for (const raw of atomItems.slice(0, 15)) {
      items.push({
        title: stripHtml(extractTag(raw, 'title')) || '(无标题)',
        link: extractAttr(raw, 'link', 'href') || extractTag(raw, 'link') || '',
        date: extractTag(raw, 'published') || extractTag(raw, 'updated') || '',
        snippet: truncate(stripHtml(extractTag(raw, 'summary') || extractTag(raw, 'content') || ''), 200),
        source: stripHtml(feedTitle),
      });
    }
  }

  return items;
}

// ── Proxy-aware HTTP client ──
function getProxyUrl() {
  return process.env.https_proxy || process.env.HTTPS_PROXY ||
         process.env.http_proxy || process.env.HTTP_PROXY ||
         process.env.ALL_PROXY || null;
}

function proxyGet(targetUrl, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const proxyUrl = getProxyUrl();
    const target = new URL(targetUrl);

    const timer = setTimeout(() => { reject(new Error('timeout')); }, timeoutMs);

    function onResponse(res) {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        clearTimeout(timer);
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, text: data });
      });
      res.on('error', (e) => { clearTimeout(timer); reject(e); });
    }

    const headers = {
      'User-Agent': 'AI-Pulse/1.0',
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    };

    if (proxyUrl) {
      // Use HTTP CONNECT tunnel through proxy
      const proxy = new URL(proxyUrl);
      const connectReq = http.request({
        host: proxy.hostname,
        port: parseInt(proxy.port) || 7890,
        method: 'CONNECT',
        path: `${target.hostname}:${target.port || (target.protocol === 'https:' ? 443 : 80)}`,
      });

      connectReq.on('connect', (res, socket) => {
        if (res.statusCode !== 200) {
          clearTimeout(timer);
          reject(new Error(`Proxy CONNECT failed: ${res.statusCode}`));
          return;
        }

        if (target.protocol === 'https:') {
          const tlsSocket = tls.connect({ socket, servername: target.hostname }, () => {
            const getReq = https.request({
              hostname: target.hostname,
              path: target.pathname + target.search,
              method: 'GET',
              headers,
              socket: tlsSocket,
              agent: false,
            }, onResponse);
            getReq.on('error', (e) => { clearTimeout(timer); reject(e); });
            getReq.end();
          });
          tlsSocket.on('error', (e) => { clearTimeout(timer); reject(e); });
        } else {
          const getReq = http.request({
            hostname: target.hostname,
            path: target.pathname + target.search,
            method: 'GET',
            headers,
            socket,
            agent: false,
          }, onResponse);
          getReq.on('error', (e) => { clearTimeout(timer); reject(e); });
          getReq.end();
        }
      });

      connectReq.on('error', (e) => { clearTimeout(timer); reject(e); });
      connectReq.end();
    } else {
      // No proxy - direct request
      const mod = target.protocol === 'https:' ? https : http;
      const req = mod.get(targetUrl, { headers }, onResponse);
      req.on('error', (e) => { clearTimeout(timer); reject(e); });
    }
  });
}

async function fetchFeed(url, personId) {
  const cacheKey = `feed:${url}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const resp = await proxyGet(url);
    if (!resp.ok) return [];
    const items = parseRssFeed(resp.text).map((item) => ({
      ...item,
      personId,
      personName: personId ? PEOPLE.find(p => p.id === personId)?.name : undefined,
    }));

    setCache(cacheKey, items);
    return items;
  } catch {
    return [];
  }
}

async function fetchAllFeeds(feedList, onProgress) {
  const progress = { total: feedList.length, completed: 0, failed: 0 };

  const results = await Promise.allSettled(
    feedList.map(async ({ url, personId }) => {
      const items = await fetchFeed(url, personId);
      if (items.length === 0) progress.failed++;
      progress.completed++;
      onProgress?.(progress);
      return items;
    }),
  );

  const allItems = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // Sort by date descending
  allItems.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return allItems;
}

// Match news items to people by name
function matchItemsToPeople(items) {
  return items.map((item) => {
    if (item.personId) return item;
    const text = `${item.title} ${item.snippet}`.toLowerCase();
    for (const p of PEOPLE) {
      const names = [p.name.toLowerCase(), p.cn, ...p.name.toLowerCase().split(' ')].filter(n => n.length > 3);
      if (names.some(n => text.includes(n))) {
        return { ...item, personId: p.id, personName: p.name };
      }
    }
    return item;
  });
}

function getAllFeedUrls(includeNews = true) {
  const urls = [];
  for (const p of PEOPLE) {
    for (const f of p.feeds) urls.push({ url: f, personId: p.id });
  }
  if (includeNews) {
    for (const nf of NEWS_FEEDS) urls.push({ url: nf.url });
  }
  return urls;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 7. Time Formatting
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function timeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = Date.now();
    const diff = now - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const months = Math.floor(days / 30);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 30) return `${days} 天前`;
    if (months < 12) return `${months} 个月前`;
    return `${Math.floor(months / 12)} 年前`;
  } catch {
    return dateStr;
  }
}

function todayStr() {
  return new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 8. Display Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function showBanner() {
  console.log('');
  console.log(box(
    c.bold(c.cyan('⚡ AI Pulse v1.0.0')) + '\n' +
    c.gray('追踪 AI 行业 Top 30 名人最新动态') + '\n' +
    c.dim("Inspired by Peter Steinberger's CLI-first philosophy"),
    { color: c.cyan }
  ));
}

function showPeopleTable(list) {
  const widths = [3, 24, 20, 10, 2];
  const headers = ['#', '姓名', '机构 / 职位', '类别', ''];
  const rows = list.map((p, i) => {
    const catInfo = CATEGORY[p.cat];
    return [
      c.gray(`${i + 1}`),
      c.bold(truncate(p.name, 14)) + ' ' + c.gray(truncate(p.cn, 10)),
      truncate(p.org, 13) + ' ' + c.gray(truncate(p.role, 6)),
      catInfo.color(catInfo.label),
      p.flag,
    ];
  });
  console.log(table(headers, rows, widths));
  console.log(c.gray(`\n  共 ${list.length} 人\n`));
}

function showPersonCard(person) {
  const catInfo = CATEGORY[person.cat];
  const lines = [
    c.bold(c.white(person.name)) + c.gray(` (${person.cn})`),
    '',
    c.gray('机构:  ') + c.white(person.org),
    c.gray('职位:  ') + c.white(person.role),
    c.gray('类别:  ') + catInfo.color(catInfo.label),
    c.gray('国家:  ') + person.flag,
    '',
    c.gray('简介:  ') + c.white(person.bio),
  ];
  if (person.x) lines.push(c.gray('X:     ') + c.cyan(`@${person.x}`));
  if (person.feeds.length > 0) {
    lines.push(c.gray('订阅源: ') + c.green(`${person.feeds.length} 个 RSS feed`));
  } else {
    lines.push(c.gray('订阅源: ') + c.yellow('暂无 RSS'));
  }
  console.log('');
  console.log(box(lines.join('\n'), { title: '👤 人物详情', color: c.cyan }));
}

function showFeedItems(items, limit = 20) {
  const display = items.slice(0, limit);
  if (display.length === 0) {
    console.log(c.yellow('\n  暂无获取到动态，请检查网络后重试\n'));
    return;
  }

  console.log(c.bold(c.cyan(`\n  📰 获取到 ${items.length} 条动态，显示最新 ${display.length} 条:\n`)));

  for (const item of display) {
    console.log(c.gray('  ' + '─'.repeat(56)));
    console.log('  ' + c.bold(c.white(`📝 ${truncate(item.title, 52)}`)));

    const parts = [];
    if (item.personName) parts.push(c.cyan(`👤 ${item.personName}`));
    parts.push(c.gray(truncate(item.source, 20)));
    if (item.date) parts.push(c.gray(`📅 ${timeAgo(item.date)}`));
    console.log('  ' + parts.join(c.gray(' · ')));

    if (item.snippet) console.log('  ' + c.gray(truncate(item.snippet, 70)));
    if (item.link) console.log('  ' + c.dim(`🔗 ${item.link}`));
    console.log('');
  }
}

function showDigest(items) {
  const grouped = new Map();
  const ungrouped = [];

  for (const item of items) {
    if (item.personId && item.personName) {
      if (!grouped.has(item.personName)) grouped.set(item.personName, []);
      grouped.get(item.personName).push(item);
    } else {
      ungrouped.push(item);
    }
  }

  console.log('');
  console.log(box(
    c.bold(c.white('📋 AI Pulse 每日简报')) + '\n' + c.gray(todayStr()),
    { color: c.yellow },
  ));

  for (const [name, personItems] of grouped) {
    console.log(c.bold(c.cyan(`\n  ━━━ ${name} ━━━`)));
    for (const item of personItems.slice(0, 5)) {
      console.log(c.white(`    • ${truncate(item.title, 50)}`));
      if (item.date) console.log(c.gray(`      ${timeAgo(item.date)} · ${truncate(item.source, 25)}`));
    }
  }

  if (ungrouped.length > 0) {
    console.log(c.bold(c.yellow(`\n  ━━━ 其他 AI 行业动态 ━━━`)));
    for (const item of ungrouped.slice(0, 10)) {
      console.log(c.white(`    • ${truncate(item.title, 50)}`));
      if (item.date) console.log(c.gray(`      ${timeAgo(item.date)} · ${truncate(item.source, 25)}`));
    }
  }

  console.log(c.gray(`\n  共追踪到 ${grouped.size} 位名人的 ${items.length} 条动态\n`));
}

function showCategoryLegend() {
  const items = Object.values(CATEGORY).map(cat => cat.color(`● ${cat.label}`));
  console.log(c.gray('  类别: ') + items.join(c.gray(' | ')));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 9. People Search Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function findPerson(query) {
  const q = query.toLowerCase();
  return PEOPLE.find(p =>
    p.id.includes(q) || p.name.toLowerCase().includes(q) ||
    p.cn.includes(q) || p.org.toLowerCase().includes(q)
  );
}

function searchPeople(query) {
  const q = query.toLowerCase();
  return PEOPLE.filter(p =>
    p.name.toLowerCase().includes(q) || p.cn.includes(q) ||
    p.org.toLowerCase().includes(q) || p.bio.includes(q) ||
    p.role.toLowerCase().includes(q) || p.cat.includes(q)
  );
}

function filterByCategory(cat) {
  return PEOPLE.filter(p => p.cat === cat);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 10. CLI Commands
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0] || '';
  const positional = [];
  const flags = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (args[i].startsWith('-')) {
      const key = args[i].slice(1);
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(args[i]);
    }
  }

  return { cmd, positional, flags };
}

function showHelp() {
  showBanner();
  console.log(c.white('  可用命令:\n'));
  console.log(c.cyan('    list') + c.gray('                           列出 Top 30 AI 名人'));
  console.log(c.cyan('    list --cat ceo') + c.gray('                 按类别筛选 (ceo/researcher/engineer/creator)'));
  console.log(c.cyan('    info <name>') + c.gray('                    查看某人详情 (支持英文名/中文名)'));
  console.log(c.cyan('    latest') + c.gray('                         获取所有名人最新动态'));
  console.log(c.cyan('    latest --person sam') + c.gray('            只看某人的动态'));
  console.log(c.cyan('    latest --limit 10') + c.gray('              限制显示条数'));
  console.log(c.cyan('    latest --no-news') + c.gray('               不包含新闻源'));
  console.log(c.cyan('    digest') + c.gray('                         生成每日简报'));
  console.log(c.cyan('    search <query>') + c.gray('                 搜索名人'));
  console.log(c.cyan('    cache') + c.gray('                          查看缓存状态'));
  console.log(c.cyan('    cache --clear') + c.gray('                  清除缓存'));
  console.log(c.cyan('    help') + c.gray('                           显示此帮助'));
  console.log('');
  console.log(c.gray('  示例:'));
  console.log(c.dim('    node ai-pulse.mjs list'));
  console.log(c.dim('    node ai-pulse.mjs info "peter steinberger"'));
  console.log(c.dim('    node ai-pulse.mjs latest --person karpathy'));
  console.log(c.dim('    node ai-pulse.mjs digest'));
  console.log('');
}

// ── Command: list ──
function cmdList(flags) {
  showBanner();
  let result = PEOPLE;
  if (flags.cat || flags.category) {
    const cat = flags.cat || flags.category;
    if (!CATEGORY[cat]) {
      console.log(c.red(`  ❌ 无效类别: ${cat}`));
      console.log(c.gray(`  可选: ${Object.keys(CATEGORY).join(', ')}\n`));
      return;
    }
    result = filterByCategory(cat);
  }
  if (result.length === 0) {
    console.log(c.yellow('  未找到匹配的人物\n'));
    return;
  }
  showPeopleTable(result);
  showCategoryLegend();
}

// ── Command: info ──
async function cmdInfo(positional) {
  const name = positional.join(' ');
  if (!name) {
    console.log(c.red('\n  ❌ 请提供名人姓名，例如: info "Sam Altman"\n'));
    return;
  }
  const person = findPerson(name);
  if (!person) {
    console.log(c.red(`\n  ❌ 未找到 "${name}"，请尝试其他关键词`));
    console.log(c.gray('  提示: 使用 list 查看完整列表\n'));
    return;
  }
  showPersonCard(person);

  if (person.feeds.length > 0) {
    const spinner = createSpinner('获取最新动态...').start();
    const feedList = person.feeds.map(url => ({ url, personId: person.id }));
    const items = await fetchAllFeeds(feedList);
    spinner.succeed(`获取到 ${items.length} 条动态`);
    showFeedItems(items, 5);
  }
}

// ── Command: latest ──
async function cmdLatest(flags) {
  showBanner();
  const limit = parseInt(flags.limit || flags.l || '20', 10);
  const includeNews = !flags['no-news'];
  let feedList;

  if (flags.person || flags.p) {
    const name = flags.person || flags.p;
    const person = findPerson(name);
    if (!person) {
      console.log(c.red(`\n  ❌ 未找到 "${name}"\n`));
      return;
    }
    if (person.feeds.length === 0) {
      console.log(c.yellow(`\n  ⚠️  ${person.name} 暂无可用的 RSS 订阅源\n`));
      return;
    }
    feedList = person.feeds.map(url => ({ url, personId: person.id }));
  } else {
    feedList = getAllFeedUrls(includeNews);
  }

  const spinner = createSpinner(`正在从 ${feedList.length} 个源获取最新动态...`).start();

  let items = await fetchAllFeeds(feedList, (p) => {
    spinner.update(`正在获取... (${p.completed}/${p.total}${p.failed > 0 ? `, ${p.failed} 失败` : ''})`);
  });

  items = matchItemsToPeople(items);
  spinner.succeed(`获取完成! 共 ${items.length} 条动态`);
  showFeedItems(items, limit);
}

// ── Command: digest ──
async function cmdDigest() {
  const feedList = getAllFeedUrls(true);
  const spinner = createSpinner('正在生成今日简报...').start();

  let items = await fetchAllFeeds(feedList);
  items = matchItemsToPeople(items);

  spinner.succeed('简报生成完成!');
  showDigest(items);
}

// ── Command: search ──
function cmdSearch(positional) {
  const query = positional.join(' ');
  if (!query) {
    console.log(c.red('\n  ❌ 请提供搜索关键词\n'));
    return;
  }
  const results = searchPeople(query);
  if (results.length === 0) {
    console.log(c.yellow(`\n  未找到与 "${query}" 相关的名人`));
    console.log(c.gray('  提示: 试试英文名、中文名或机构名\n'));
    return;
  }
  console.log(c.cyan(`\n  🔍 找到 ${results.length} 个结果:\n`));
  showPeopleTable(results);
}

// ── Command: cache ──
function cmdCache(flags) {
  if (flags.clear) {
    clearAllCache();
    console.log(c.green('\n  ✅ 缓存已清除\n'));
    return;
  }
  const stats = getCacheStats();
  console.log(c.cyan('\n  📊 缓存状态:'));
  console.log(c.gray(`  条目: ${stats.entries} | 大小: ${stats.sizeKB} KB`));
  console.log(c.gray('  使用 cache --clear 清除缓存\n'));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// § 11. Main Entry Point
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main() {
  const { cmd, positional, flags } = parseArgs(process.argv);

  if (flags.help || flags.h) { showHelp(); return; }

  switch (cmd) {
    case 'list':   cmdList(flags); break;
    case 'info':   await cmdInfo(positional); break;
    case 'latest': await cmdLatest(flags); break;
    case 'digest': await cmdDigest(); break;
    case 'search': cmdSearch(positional); break;
    case 'cache':  cmdCache(flags); break;
    case 'help':   showHelp(); break;
    case '':       showHelp(); break;
    default:
      console.log(c.red(`\n  ❌ 未知命令: ${cmd}`));
      console.log(c.gray('  使用 help 查看所有可用命令\n'));
  }
}

main().catch((err) => {
  console.error(c.red(`\n  ❌ 错误: ${err.message}\n`));
  process.exit(1);
});
