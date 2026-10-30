import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getSeoPolicy,
  getConsolidationTarget,
  routeFromHtmlFile,
  SITE_ORIGIN
} from './seo-policy.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walkHtml(dir = rootDir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'scripts') return [];
      return walkHtml(full);
    }
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function matchOne(html, regex) {
  return (html.match(regex) || [])[1] || '';
}

function strip(html) {
  return (html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function collectIds(html) {
  return [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
}

function routeExists(route, routes) {
  if (route.endsWith('.html')) return routes.has(route);
  return routes.has(route.endsWith('/') ? route : `${route}/`);
}

const errors = [];
const files = walkHtml();
const routes = new Set(files.map((file) => routeFromHtmlFile(file, rootDir)));

for (const file of files) {
  const route = routeFromHtmlFile(file, rootDir);
  const html = read(file);
  const policy = getSeoPolicy(route);
  const consolidation = getConsolidationTarget(route);
  if (consolidation) {
    if (!html.includes('http-equiv="refresh"')) errors.push(`${route}: missing consolidation redirect`);
    if (getConsolidationTarget(consolidation)) errors.push(`${route}: redirect chain`);
    if (html.includes('adsbygoogle')) errors.push(`${route}: ads on a redirect page`);
  }
  if (/\[À compléter|\bTODO\b|\blorem ipsum\b/i.test(html)) errors.push(`${route}: unfinished content`);
  if (policy.indexable && html.includes('Posez cette donnée explicitement')) errors.push(`${route}: repetitive draft guide remains indexable`);
  const title = strip(matchOne(html, /<title>([\s\S]*?)<\/title>/i));
  const description = matchOne(html, /<meta\s+name="description"\s+content="([^"]*)"/i);
  const robots = matchOne(html, /<meta\s+name="robots"\s+content="([^"]*)"/i);
  const canonical = matchOne(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i);
  const h1Count = (html.match(/<h1\b/gi) || []).length;

  if (route !== '/404.html') {
    if (!title) errors.push(`${route}: missing title`);
    if (!description) errors.push(`${route}: missing meta description`);
    if (h1Count !== 1) errors.push(`${route}: expected exactly one h1, found ${h1Count}`);
    if (robots !== policy.robots) errors.push(`${route}: robots "${robots}" does not match policy "${policy.robots}"`);
    if (canonical !== policy.canonical) errors.push(`${route}: canonical "${canonical}" does not match policy "${policy.canonical}"`);
  }

  const ids = collectIds(html);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length) errors.push(`${route}: duplicate ids ${[...new Set(duplicateIds)].join(', ')}`);

  for (const match of html.matchAll(/\shref="([^"]+)"/g)) {
    const href = match[1];
    if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) continue;
    if (href.startsWith('/?') || href.startsWith('?')) continue;
    const urlPath = href.split('#')[0].split('?')[0];
    if (!urlPath || urlPath === '/') continue;
    if (path.extname(urlPath)) {
      const target = path.join(rootDir, urlPath.replace(/^\//, ''));
      if (!fs.existsSync(target)) errors.push(`${route}: missing linked asset ${href}`);
      continue;
    }
    if (!routeExists(urlPath, routes)) errors.push(`${route}: broken internal link ${href}`);
  }

  for (const match of html.matchAll(/\ssrc="([^"]+)"/g)) {
    const src = match[1];
    if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('/?') || src.startsWith('?')) continue;
    if (!src.startsWith('/')) continue;
    const target = path.join(rootDir, src.replace(/^\//, ''));
    if (!fs.existsSync(target)) errors.push(`${route}: missing asset ${src}`);
  }
}

const sitemap = read(path.join(rootDir, 'sitemap.xml'));
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const sitemapSet = new Set(sitemapUrls);

for (const route of routes) {
  const policy = getSeoPolicy(route);
  const loc = `${SITE_ORIGIN}${route}`;
  if (route === '/404.html') continue;
  if (policy.includeInSitemap && !sitemapSet.has(loc)) errors.push(`${route}: missing from sitemap`);
  if (!policy.includeInSitemap && sitemapSet.has(loc)) errors.push(`${route}: noindex route is present in sitemap`);
}

for (const loc of sitemapUrls) {
  const route = new URL(loc).pathname;
  if (!routeExists(route, routes)) errors.push(`sitemap: ${loc} has no local HTML file`);
  const policy = getSeoPolicy(route);
  if (!policy.includeInSitemap) errors.push(`sitemap: ${loc} violates SEO policy`);
}

const home = read(path.join(rootDir, 'index.html'));
for (const requiredId of ['form-card', 'tjm-number', 'jours-input', 'statut-select', 'results-card']) {
  if (!home.includes(`id="${requiredId}"`)) errors.push(`home: calculator id ${requiredId} missing`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Validated ${files.length} HTML files and ${sitemapUrls.length} sitemap URLs.`);
