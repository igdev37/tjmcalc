import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSeoPolicy,
  getConsolidationTarget,
  getSitemapRoutes,
  MAIN_TJM_NET_ROUTE,
  SITE_ORIGIN
} from './seo-policy.mjs';

test('revenue amount variants are noindex and canonicalized to the calculator', () => {
  const policy = getSeoPolicy('/revenus/tjm-450-salaire-net/');
  assert.equal(policy.indexable, false);
  assert.equal(policy.includeInSitemap, false);
  assert.equal(policy.robots, 'noindex,follow');
  assert.equal(policy.canonical, `${SITE_ORIGIN}/`);
});

test('repetitive tax guides share one substantive guide and never form redirect chains', () => {
  for (const route of ['/guides/tjm-et-acre/', '/guides/tjm-et-tva/', '/guides/tjm-et-impot-sur-le-revenu/', '/guides/tjm-et-plafond-micro-entreprise/']) {
    const target = getConsolidationTarget(route);
    assert.equal(target, '/guides/micro-entreprise-cotisations-impot-tva/');
    assert.equal(getConsolidationTarget(target), null);
    assert.equal(getSeoPolicy(route).includeInSitemap, false);
  }
});

test('the main TJM net page is indexable and self-canonical', () => {
  const policy = getSeoPolicy(MAIN_TJM_NET_ROUTE);
  assert.equal(policy.indexable, true);
  assert.equal(policy.includeInSitemap, true);
  assert.equal(policy.robots, 'index,follow,max-image-preview:large');
  assert.equal(policy.canonical, `${SITE_ORIGIN}${MAIN_TJM_NET_ROUTE}`);
});

test('legacy duplicate guide is consolidated out of the index', () => {
  const policy = getSeoPolicy('/guides/convertir-tjm-en-salaire-net/');
  assert.equal(policy.indexable, false);
  assert.equal(policy.includeInSitemap, false);
  assert.equal(policy.canonical, `${SITE_ORIGIN}${MAIN_TJM_NET_ROUTE}`);
});

test('sitemap routes exclude noindex pages', () => {
  const routes = getSitemapRoutes([
    '/',
    MAIN_TJM_NET_ROUTE,
    '/revenus/',
    '/revenus/tjm-900-salaire-net/',
    '/guides/comment-calculer-son-tjm/'
  ]);
  assert.deepEqual(routes, [
    '/',
    '/guides/comment-calculer-son-tjm/',
    MAIN_TJM_NET_ROUTE
  ]);
});

test('legacy amount URLs preserve the amount in a direct calculator destination', () => {
  assert.equal(getConsolidationTarget('/revenus/tjm-950-salaire-net/'), '/?tjm=950#form-card');
  assert.equal(getConsolidationTarget('/revenus/'), MAIN_TJM_NET_ROUTE);
  assert.equal(getConsolidationTarget('/barometre/tjm-developpeurs/'), '/barometre/');
  assert.equal(getSeoPolicy('/barometre/tjm-developpeurs/').includeInSitemap, false);
  assert.equal(getConsolidationTarget('/outils/budget-annuel-freelance/'), null);
});

