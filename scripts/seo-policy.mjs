import path from 'node:path';

export const SITE_ORIGIN = 'https://tjmcalc.com';
export const LAST_REVIEW_DATE = '2026-10-30';
export const MAIN_TJM_NET_ROUTE = '/tjm-en-salaire-net/';

const REVENUE_VARIANT_RE = /^\/revenus\/tjm-\d+-salaire-net\/$/;
const CANONICAL_OVERRIDES = new Map([
  ['/revenus/', MAIN_TJM_NET_ROUTE],
  ['/guides/convertir-tjm-en-salaire-net/', MAIN_TJM_NET_ROUTE],
  ['/guides/annoncer-une-hausse-de-tjm/', '/guides/augmenter-son-tjm/'],
  ['/guides/calculer-son-seuil-de-rentabilite-freelance/', '/outils/seuil-rentabilite-freelance/'],
  ['/guides/comment-justifier-son-tjm/', '/guides/negocier-son-tjm/'],
  ['/guides/comment-presenter-son-tjm-a-un-client/', '/guides/exemple-devis-freelance/'],
  ['/guides/convertir-salaire-en-tjm/', '/outils/salaire-cdi-vers-tjm/'],
  ['/guides/tjm-et-acre/', '/guides/micro-entreprise-cotisations-impot-tva/'],
  ['/guides/tjm-et-impot-sur-le-revenu/', '/guides/micro-entreprise-cotisations-impot-tva/'],
  ['/guides/tjm-et-plafond-micro-entreprise/', '/guides/micro-entreprise-cotisations-impot-tva/'],
  ['/guides/tjm-et-tva/', '/guides/micro-entreprise-cotisations-impot-tva/'],
  ['/guides/tjm-junior-confirme-senior/', '/barometre/'],
  ['/guides/tjm-mission-longue/', '/guides/negocier-son-tjm/'],
  ['/guides/tjm-teletravail/', '/barometre/'],
  ['/guides/tjm-ou-cdi/', '/outils/salaire-cdi-vers-tjm/']
]);

export function getConsolidationTarget(routeInput) {
  const route = normalizeRoute(routeInput);
  const amount = route.match(/^\/revenus\/tjm-(\d+)-salaire-net\/$/);
  if (amount) return `/?tjm=${Number(amount[1])}#form-card`;
  if (CANONICAL_OVERRIDES.has(route)) return CANONICAL_OVERRIDES.get(route);
  if (/^\/barometre\/[^/]+\/$/.test(route)) return '/barometre/';
  return null;
}

export function normalizeRoute(input) {
  if (!input) return '/';
  let route = String(input).trim();
  if (route.startsWith(SITE_ORIGIN)) route = new URL(route).pathname;
  route = route.split('#')[0].split('?')[0];
  if (!route.startsWith('/')) route = `/${route}`;
  route = route.replace(/\/index\.html$/, '/');
  if (route === '/index.html') return '/';
  if (route.endsWith('.html')) return route;
  return route.endsWith('/') ? route : `${route}/`;
}

export function routeFromHtmlFile(filePath, rootDir = process.cwd()) {
  const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (rel === '404.html') return '/404.html';
  if (rel.endsWith('/index.html')) return normalizeRoute(rel.slice(0, -'index.html'.length));
  return normalizeRoute(rel);
}

export function getSeoPolicy(routeInput) {
  const route = normalizeRoute(routeInput);
  if (route === '/404.html') {
    return {
      route,
      indexable: false,
      includeInSitemap: false,
      robots: 'noindex,follow',
      canonical: '',
      reason: 'technical-404'
    };
  }

  const target = getConsolidationTarget(route);
  const canonicalRoute = target ? normalizeRoute(target) : route;
  const lowValue = Boolean(target);
  const indexable = !lowValue;

  return {
    route,
    indexable,
    includeInSitemap: indexable,
    robots: indexable ? 'index,follow,max-image-preview:large' : 'noindex,follow',
    canonical: `${SITE_ORIGIN}${canonicalRoute}`,
    reason: lowValue ? 'consolidated-similar-content' : 'indexable-primary-content'
  };
}

export function getSitemapRoutes(routes) {
  return [...new Set(routes.map((route) => normalizeRoute(route)))]
    .filter((route) => getSeoPolicy(route).includeInSitemap)
    .sort((a, b) => a.localeCompare(b, 'fr'));
}

export function isRevenueVariant(routeInput) {
  return REVENUE_VARIANT_RE.test(normalizeRoute(routeInput));
}

