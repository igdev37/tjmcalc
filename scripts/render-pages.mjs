import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculateRevenue,
  compareStatuses,
  formatEuros,
  annualBudget,
  STATUS_LABELS
} from './calculator-core.mjs';
import {
  getSeoPolicy,
  getConsolidationTarget,
  getSitemapRoutes,
  LAST_REVIEW_DATE,
  MAIN_TJM_NET_ROUTE,
  routeFromHtmlFile,
  SITE_ORIGIN
} from './seo-policy.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reviewDateLabel = '30 octobre 2026';
const publishedDate = '2026-07-12';
const publishedDateLabel = '12 juillet 2026';

const sources = [
  {
    id: 'urssaf-pamc',
    category: 'Professions réglementées',
    name: 'Cotisations d’un auxiliaire médical',
    organization: 'Urssaf',
    url: 'https://www.urssaf.fr/accueil/independant/praticien-auxiliaire-medical/cotisations-auxiliaire-medical.html',
    consulted: LAST_REVIEW_DATE,
    consultedLabel: reviewDateLabel,
    published: 'Date non indiquée',
    verifies: 'existence du régime PAMC et logique de provisions et régularisations des cotisations',
    limits: 'les taux moyens du calculateur ne reproduisent ni les cotisations PAMC, ni la retraite propre à chaque profession'
  },
  {
    id: 'service-public-micro-activities',
    category: 'Activités et régimes',
    name: 'Déterminer la nature de l’activité d’une entreprise',
    organization: 'Service Public Entreprendre',
    url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F32887',
    consulted: LAST_REVIEW_DATE,
    consultedLabel: reviewDateLabel,
    published: '1er septembre 2024',
    verifies: 'distinction entre activité commerciale, artisanale et libérale, avec activités autorisées et exclues du régime micro',
    limits: 'ne remplace pas le contrôle du régime réellement applicable à une profession réglementée'
  },
  {
    id: 'urssaf-micro-2026',
    category: 'Cotisations sociales',
    name: 'Cotisations sociales d’un micro-entrepreneur',
    organization: 'Service Public Entreprendre',
    url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F36232',
    consulted: LAST_REVIEW_DATE,
    consultedLabel: reviewDateLabel,
    published: 'Date non indiquée',
    verifies: 'taux micro-sociaux par activité et assiette sur chiffre d’affaires ; la CFP est à financer séparément',
    limits: 'ne fournit pas de TJM de marché et ne couvre pas les arbitrages de société au réel'
  },
  {
    id: 'mon-entreprise-2026',
    category: 'Contrôle de cohérence',
    name: 'Simulateur officiel auto-entrepreneur',
    organization: 'Urssaf - Mon-entreprise',
    url: 'https://mon-entreprise.urssaf.fr/simulateurs/auto-entrepreneur',
    consulted: LAST_REVIEW_DATE,
    consultedLabel: reviewDateLabel,
    published: 'Mise à jour continue',
    verifies: 'outil officiel de comparaison permettant une vérification indépendante des simulations micro',
    limits: 'ne remplace pas une simulation exhaustive de tous les statuts TJMCalc'
  },
  {
    id: 'service-public-acre',
    category: 'Création d’activité',
    name: 'Aide à la création ou à la reprise d’une entreprise (Acre)',
    organization: 'Service Public Entreprendre',
    url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F11677',
    consulted: LAST_REVIEW_DATE,
    consultedLabel: reviewDateLabel,
    published: '1er juillet 2026',
    verifies: 'éligibilité, durée et réduction de 25 % pour les créations micro à compter du 1er juillet 2026',
    limits: 'la case du calculateur ne vérifie ni la date de création, ni la durée, ni l’éligibilité personnelle'
  },
  {
    id: 'impots-versement-liberatoire',
    category: 'Fiscalité',
    name: 'Conditions du versement libératoire',
    organization: 'Direction générale des Finances publiques',
    url: 'https://www.impots.gouv.fr/professionnel/questions/en-tant-que-micro-entrepreneur-sous-quelles-conditions-puis-je-opter-pour-l',
    consulted: LAST_REVIEW_DATE,
    consultedLabel: reviewDateLabel,
    published: '14 octobre 2026',
    verifies: 'pour une option en 2026, RFR 2024 limité à 29 315 € par part et autres conditions cumulatives',
    limits: 'le simulateur ne détermine pas l’éligibilité au versement libératoire'
  },
  {
    id: 'service-public-micro-fiscal',
    category: 'Fiscalité',
    name: 'Régime fiscal de la micro-entreprise',
    organization: 'Direction de l’information légale et administrative - Service-Public.fr',
    url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F23267',
    consulted: LAST_REVIEW_DATE,
    consultedLabel: reviewDateLabel,
    published: 'Mise à jour continue',
    verifies: 'abattements forfaitaires, versement libératoire, seuils et principes du régime micro-fiscal',
    limits: 'ne transforme pas les abattements fiscaux en frais réellement payés'
  },
  {
    id: 'service-public-tva',
    category: 'TVA',
    name: 'Franchise en base de TVA',
    organization: 'Direction de l’information légale et administrative - Service-Public.fr',
    url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F21746',
    consulted: LAST_REVIEW_DATE,
    consultedLabel: reviewDateLabel,
    published: 'Mise à jour continue',
    verifies: 'seuils de franchise, seuils majorés, date d’effet possible de la sortie de franchise',
    limits: 'ne calcule pas les taux réduits, opérations internationales ou cas sectoriels particuliers'
  },
  {
    id: 'service-public-legal-form-choice',
    category: 'Forme juridique',
    name: 'Création d’entreprise : choisir la forme juridique de votre entreprise',
    organization: 'Direction de l’information légale et administrative - Service-Public.fr',
    url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F23844',
    consulted: LAST_REVIEW_DATE,
    consultedLabel: reviewDateLabel,
    published: 'Mise à jour continue',
    verifies: 'critères généraux de choix entre entreprise individuelle, société unipersonnelle et société à plusieurs',
    limits: 'ne conseille pas une option adaptée à un foyer fiscal ou à un projet précis'
  },
  {
    id: 'service-public-legal-forms-directory',
    category: 'Forme juridique',
    name: 'Formes juridiques',
    organization: 'Direction de l’information légale et administrative - Service-Public.fr',
    url: 'https://entreprendre.service-public.gouv.fr/vosdroits/N32225',
    consulted: LAST_REVIEW_DATE,
    consultedLabel: reviewDateLabel,
    published: 'Mise à jour continue',
    verifies: 'fiches officielles par forme juridique : EI, EURL, SASU, SARL, SAS, SA, SNC, SCS et SCA',
    limits: 'ne chiffre pas le revenu net d’un freelance ni les arbitrages de rémunération'
  },
  {
    id: 'bofip-ir-2026',
    category: 'Impôt sur le revenu',
    name: 'Barème de l’impôt 2026 sur les revenus 2025',
    organization: 'Direction générale des Finances publiques - BOFiP',
    url: 'https://bofip.impots.gouv.fr/bofip/2491-PGP.html/identifiant=BOI-IR-LIQ-20-10-20260407',
    consulted: LAST_REVIEW_DATE,
    consultedLabel: reviewDateLabel,
    published: '7 avril 2026',
    verifies: 'tranches du barème progressif et principe du quotient familial',
    limits: 'ne couvre pas à lui seul décote, crédits, réductions, plafonnements et situations internationales'
  },
  {
    id: 'insee-independants-2024',
    category: 'Contexte statistique',
    name: 'Les revenus d’activité des non-salariés en 2024',
    organization: 'Insee',
    url: 'https://www.insee.fr/fr/statistiques/9013403',
    consulted: LAST_REVIEW_DATE,
    consultedLabel: reviewDateLabel,
    published: '30 juin 2026',
    verifies: 'contexte général sur les revenus des non-salariés et prudence sur les comparaisons',
    limits: 'ne fournit pas de TJM par métier, ni de conversion directe revenu vers prix de vente'
  },
  {
    id: 'bpifrance-pricing',
    category: 'Méthode de prix',
    name: 'Comment fixer mes prix ?',
    organization: 'Bpifrance Création',
    url: 'https://bpifrance-creation.fr/moment-de-vie/comment-fixer-mes-prix',
    consulted: LAST_REVIEW_DATE,
    consultedLabel: reviewDateLabel,
    published: 'Date non indiquée',
    verifies: 'articulation entre coût de revient, demande, concurrence et positionnement',
    limits: 'cadre général de tarification, sans fourchette TJM sectorielle'
  },
  {
    id: 'tjmcalc-editorial-estimates',
    category: 'Méthode éditoriale',
    name: 'Repères éditoriaux TJMCalc',
    organization: 'TJMCalc - IGdev',
    url: 'https://tjmcalc.com/methodologie/#fourchettes-metier',
    consulted: LAST_REVIEW_DATE,
    consultedLabel: reviewDateLabel,
    published: reviewDateLabel,
    verifies: 'origine des repères métier publiés et limites des simulations dérivées',
    limits: 'ne constitue ni un baromètre transactionnel ni une moyenne officielle'
  }
];

const sourceById = new Map(sources.map((source) => [source.id, source]));

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function writeUtf8(relativePath, content) {
  const fullPath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

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

function minifyHtml(html) {
  return `${html.trim()}\n`;
}

function jsonLd(graph) {
  return `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': graph
  })}</script>`;
}

function sourceLinks(ids) {
  return ids.map((id) => {
    const source = sourceById.get(id);
    if (!source) throw new Error(`Unknown source id: ${id}`);
    return `<li><a href="/sources/#${source.id}">${escapeHtml(source.organization)} - ${escapeHtml(source.name)}</a><span>${escapeHtml(source.verifies)}</span></li>`;
  }).join('');
}

function header() {
  return `<header class="site-header"><div class="container header-inner">
    <a class="brand" href="/" aria-label="TJMCalc - Accueil">TJM<span>Calc</span></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">Menu</button>
    <nav id="primary-nav" class="primary-nav" aria-label="Navigation principale">
      <a class="nav-calculator" href="/#form-card">Calculateur</a><a href="/tjm/">Métiers</a><a href="/guides/">Guides</a><a href="/statuts/">Statuts</a><a href="/outils/">Outils</a><a href="/tjm-en-salaire-net/">TJM en net</a><a href="/barometre/">Comparer les tarifs</a>
    </nav>
    <button class="theme-toggle" type="button" aria-label="Changer de thème" title="Changer de thème">●</button>
  </div></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="container footer-grid"><div class="footer-about"><a class="brand" href="/">TJM<span>Calc</span></a><p>Des estimations pédagogiques pour mieux piloter une activité indépendante.</p><p class="footer-disclaimer">Les calculs sont indicatifs et ne remplacent pas un conseil comptable, fiscal ou juridique.</p></div><nav aria-label="Ressources"><p>Ressources</p><a href="/tjm/">TJM par métier</a><a href="/tjm-en-salaire-net/">TJM en net</a><a href="/guides/">Guides</a><a href="/statuts/">Statuts</a><a href="/outils/">Outils</a><a href="/barometre/">Baromètre</a></nav><nav aria-label="Informations"><p>À propos</p><a href="/methodologie/">Méthodologie</a><a href="/sources/">Sources</a><a href="/politique-editoriale/">Politique éditoriale</a><a href="/a-propos/">À propos</a><a href="/contact/">Contact</a><a href="/mentions-legales/">Mentions légales</a><a href="/politique-de-confidentialite/">Confidentialité</a></nav></div><div class="container footer-bottom"><span>© 2026 TJMCalc</span><a href="/">Ouvrir le calculateur</a></div></footer>`;
}

function pageShell({
  route,
  title,
  description,
  eyebrow = 'Informations',
  h1,
  lead,
  bodyClass = 'template-page',
  pageType = 'page',
  ogType = 'website',
  graph = [],
  children
}) {
  const policy = getSeoPolicy(route);
  const canonical = policy.canonical;
  const breadcrumb = [
    { name: 'Accueil', item: `${SITE_ORIGIN}/` },
    { name: h1, item: canonical }
  ];
  const baseGraph = [
    {
      '@type': 'WebPage',
      name: h1,
      description,
      url: canonical,
      dateModified: LAST_REVIEW_DATE,
      isPartOf: { '@type': 'WebSite', name: 'TJMCalc', url: `${SITE_ORIGIN}/` }
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumb.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.item
      }))
    }
  ];

  return minifyHtml(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${policy.robots}">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="96x96" href="/assets/favicon-96.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">
  <link rel="stylesheet" href="/assets/site.css">
  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme:light)">
  <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme:dark)">
  <meta property="og:type" content="${ogType}">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:site_name" content="TJMCalc">
  <meta property="og:title" content="${escapeHtml(h1)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${SITE_ORIGIN}/assets/og-tjmcalc.svg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="TJMCalc, calculateur de revenu freelance">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(h1)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${SITE_ORIGIN}/assets/og-tjmcalc.svg">
  ${jsonLd([...baseGraph, ...graph])}
</head>
<body data-page-type="${pageType}" class="${bodyClass}">
  <a class="skip-link" href="#contenu">Aller au contenu</a>
  ${header()}
  <main id="contenu" class="editorial-main">
    <div class="hero-band"><div class="container">
      <nav class="breadcrumb" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li><span aria-current="page">${escapeHtml(h1)}</span></li></ol></nav>
      <header class="page-hero"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(h1)}</h1><p class="lead">${escapeHtml(lead)}</p><div class="hero-meta"><span>Mis à jour le <time datetime="${LAST_REVIEW_DATE}">${reviewDateLabel}</time></span><span>Dernière vérification le <time datetime="${LAST_REVIEW_DATE}">${reviewDateLabel}</time></span></div></header>
    </div></div>
    <div class="container page-layout">
      ${children}
    </div>
  </main>
  ${footer()}
  <script src="/assets/site.js" defer></script>
</body>
</html>`);
}

function conversionRows() {
  const tjms = [300, 450, 600, 800, 1000];
  return tjms.map((tjm) => {
    const r15 = calculateRevenue({ tjm, days: 15, status: 'micro', microType: 'liberale' });
    const r18 = calculateRevenue({ tjm, days: 18, status: 'micro', microType: 'liberale' });
    const r20 = calculateRevenue({ tjm, days: 20, status: 'micro', microType: 'liberale' });
    return `<tr><td><strong>${tjm} €</strong></td><td class="number">${formatEuros(r15.revenue)}</td><td class="number">${formatEuros(r15.netBeforeIncomeTax)}</td><td class="number">${formatEuros(r18.revenue)}</td><td class="number">${formatEuros(r18.netBeforeIncomeTax)}</td><td class="number">${formatEuros(r20.revenue)}</td><td class="number">${formatEuros(r20.netBeforeIncomeTax)}</td></tr>`;
  }).join('');
}

function statusRows(tjm, days, expenses) {
  return compareStatuses({ tjm, days, expenses, microType: 'liberale' }).map((row) => (
    `<tr><td>${escapeHtml(row.label)}</td><td class="number">${Math.round(row.rate * 100)} %</td><td class="number">${formatEuros(row.revenue)}</td><td class="number">${formatEuros(row.expenses)}</td><td class="number">${formatEuros(row.charges)}</td><td class="number">${formatEuros(row.netBeforeIncomeTax)}</td></tr>`
  )).join('');
}

function renderMainTjmNetPage() {
  const example = calculateRevenue({
    tjm: 450,
    days: 18,
    status: 'micro',
    microType: 'liberale',
    expenses: 500
  });
  const noExpenseExample = calculateRevenue({
    tjm: 450,
    days: 18,
    status: 'micro',
    microType: 'liberale',
    expenses: 0
  });
  const graph = [
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Comment convertir un TJM en salaire net ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'On multiplie le TJM par les jours facturés pour obtenir le chiffre d’affaires, puis on retire les frais éventuels, les cotisations estimées et l’impôt selon les paramètres du foyer.'
          }
        },
        {
          '@type': 'Question',
          name: 'Pourquoi le résultat est-il une estimation ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Les cotisations, la fiscalité, les frais, l’ACRE, la TVA et la régularité commerciale varient selon la situation. TJMCalc affiche donc une méthode et des limites plutôt qu’une promesse de revenu exact.'
          }
        }
      ]
    },
    {
      '@type': 'WebApplication',
      name: 'Calculateur TJM en salaire net',
      url: `${SITE_ORIGIN}${MAIN_TJM_NET_ROUTE}`,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      browserRequirements: 'JavaScript',
      inLanguage: 'fr-FR'
    }
  ];

  const children = `<article class="article-content trust-content">
    <section class="tool-panel" aria-labelledby="calculateur-title">
      <div class="section-heading"><p class="section-kicker">Calculateur principal</p><h2 id="calculateur-title">Simuler votre TJM avec les hypothèses complètes</h2></div>
      <p class="field-hint">Le simulateur ci-dessous est le même moteur que celui de l’accueil, chargé en mode intégré. Il permet d’ajuster TJM, jours, activité, statut, frais, ACRE et options fiscales.</p>
      <iframe class="calculator-embed-frame" src="/?embed=1" title="Calculateur TJM vers salaire net freelance" loading="lazy"></iframe>
      <p class="field-hint">Les résultats restent des estimations informatives : vérifiez une décision fiscale, sociale ou juridique auprès d’un professionnel ou de l’administration compétente.</p>
    </section>
    <section class="content-section card" id="tableau-conversion"><h2>Tableau de conversion TJM en revenu net</h2><p>Ce tableau utilise l’hypothèse micro-BNC du calculateur, sans ACRE et sans impôt sur le revenu. Il sert à comparer les ordres de grandeur ; votre statut, vos frais et votre foyer fiscal peuvent modifier le résultat.</p><div class="table-wrap"><table><caption>Conversions indicatives avant impôt sur le revenu</caption><thead><tr><th>TJM HT</th><th class="number">CA 15 j</th><th class="number">Net 15 j</th><th class="number">CA 18 j</th><th class="number">Net 18 j</th><th class="number">CA 20 j</th><th class="number">Net 20 j</th></tr></thead><tbody>${conversionRows()}</tbody></table></div></section>
    <section class="content-section card" id="comparaison-statuts"><h2>Comparer chiffre d’affaires, charges et net selon le statut</h2><p>À TJM et jours identiques, le statut change l’assiette, le taux moyen de charges et le traitement des frais. L’exemple ci-dessous retient 450 € de TJM, 18 jours facturés et 500 € de frais professionnels mensuels.</p><div class="table-wrap"><table><caption>Simulation pédagogique à 450 € sur 18 jours, avant impôt sur le revenu</caption><thead><tr><th>Statut</th><th class="number">Taux utilisé</th><th class="number">CA mensuel</th><th class="number">Frais retenus</th><th class="number">Charges estimées</th><th class="number">Net avant IR</th></tr></thead><tbody>${statusRows(450, 18, 500)}</tbody></table></div><p class="callout-info">En micro-entreprise, les frais diminuent le disponible mais pas l’assiette des cotisations. En EI/EURL, ils sont retirés avant le taux moyen simplifié. En SASU et portage, les mécanismes réels peuvent différer selon rémunération, protection et frais de gestion.</p></section>
    <section class="content-section card" id="methode"><h2>Méthode de calcul utilisée</h2><ol><li><strong>Chiffre d’affaires mensuel :</strong> TJM hors taxe × jours facturés.</li><li><strong>Frais professionnels :</strong> retirés du disponible ; non déductibles de l’assiette micro dans ce modèle.</li><li><strong>Cotisations :</strong> taux micro selon activité, ou taux moyens pédagogiques pour EI, EURL, SASU et portage.</li><li><strong>Impôt :</strong> calculé dans le simulateur principal à partir du barème 2026, des parts fiscales et des autres revenus saisis.</li><li><strong>TVA :</strong> signalée comme trésorerie collectée, jamais comme revenu.</li></ol><p>La même logique est documentée dans la <a href="/methodologie/">méthodologie complète</a> et contrôlée avec les sources listées plus bas.</p></section>
    <section class="content-section card" id="exemple-detaille"><h2>Exemple entièrement expliqué : 450 € sur 18 jours</h2><p>Avec un TJM de 450 € et 18 jours facturés, le chiffre d’affaires mensuel est <strong>${formatEuros(example.revenue)}</strong>. En micro-BNC, sans ACRE, le taux utilisé est 25,6 % : les cotisations estimées représentent <strong>${formatEuros(example.charges)}</strong>.</p><p>Si l’activité supporte aussi 500 € de frais mensuels, le revenu disponible avant impôt ressort à <strong>${formatEuros(example.netBeforeIncomeTax)}</strong>. Sans ces frais, la même simulation afficherait <strong>${formatEuros(noExpenseExample.netBeforeIncomeTax)}</strong> avant impôt.</p><p class="callout-warning">Ce résultat n’est pas un salaire garanti. Il suppose un mois à 18 jours vendus, aucun retard de paiement, aucun changement de régime, et ne couvre pas les cotisations minimales, CFE, assurance, prévoyance, retraite complémentaire spécifique ou arbitrages de rémunération en société.</p></section>
    <section class="content-section card" id="limites"><h2>Limites et hypothèses à vérifier</h2><ul><li>les taux de société et de portage sont des moyennes pédagogiques, pas une liquidation sociale exacte ;</li><li>le simulateur ne remplace pas Mon-entreprise, l’Urssaf, l’administration fiscale ou un expert-comptable ;</li><li>la sortie de franchise TVA dépend du chiffre d’affaires historique et de l’activité ;</li><li>les jours non facturés doivent être construits sur l’année, pas seulement sur un mois favorable ;</li><li>les professions réglementées peuvent avoir des régimes incompatibles avec certains choix.</li></ul></section>
    <section class="trust-panel" id="sources"><div><h2>Sources officielles utilisées</h2><ul class="source-list">${sourceLinks(['urssaf-micro-2026', 'mon-entreprise-2026', 'service-public-micro-fiscal', 'service-public-tva', 'bofip-ir-2026'])}</ul><a href="/sources/">Consulter le répertoire complet</a></div><div><h2>Revue et responsabilité</h2><p>Dernière vérification : <time datetime="${LAST_REVIEW_DATE}">${reviewDateLabel}</time>. Responsable éditorial : <a href="/a-propos/">TJMCalc - IGdev</a>.</p><p>Les simulations sont informatives et doivent être remplacées par vos chiffres avant une décision.</p><a href="/contact/#signaler-correction">Signaler une correction</a></div></section>
    <section class="content-section faq-block card" aria-labelledby="faq-title"><div class="section-heading"><p class="section-kicker">FAQ</p><h2 id="faq-title">Questions fréquentes</h2></div><details><summary>Quel nombre de jours facturés retenir ?<span aria-hidden="true">+</span></summary><p>Testez au moins 15, 18 et 20 jours mensuels, puis revenez à une capacité annuelle. Les congés, la prospection, l’administration, la formation et les intercontrats réduisent le nombre réellement vendu.</p></details><details><summary>Le net affiché est-il avant ou après impôt ?<span aria-hidden="true">+</span></summary><p>Les tableaux statiques sont avant impôt sur le revenu. Le calculateur intégré peut afficher une estimation après impôt lorsque les paramètres fiscaux sont renseignés.</p></details><details><summary>Comment tester un autre TJM ?<span aria-hidden="true">+</span></summary><p>Modifiez le montant dans le calculateur, puis gardez les mêmes jours et frais pour comparer. Le tableau de conversion ci-dessus permet aussi de repérer l’effet de plusieurs tarifs dans des hypothèses identiques.</p></details></section>
    <aside class="related card" aria-labelledby="guides-title"><div class="section-heading"><p class="section-kicker">Guides recommandés</p><h2 id="guides-title">Approfondir la décision</h2></div><div class="related-grid"><a class="related-card" href="/guides/comment-calculer-son-tjm/"><span class="related-category">Méthode</span><strong>Calculer son TJM</strong><small>Construire un prix à partir du revenu cible, des frais et des jours vendables.</small><span class="related-arrow" aria-hidden="true">→</span></a><a class="related-card" href="/guides/nombre-de-jours-facturables/"><span class="related-category">Capacité</span><strong>Prévoir les jours facturables</strong><small>Transformer le calendrier en capacité commerciale réaliste.</small><span class="related-arrow" aria-hidden="true">→</span></a><a class="related-card" href="/guides/frais-professionnels-dans-le-tjm/"><span class="related-category">Frais</span><strong>Intégrer les frais</strong><small>Distinguer achats refacturés, coûts récurrents et dépenses de structure.</small><span class="related-arrow" aria-hidden="true">→</span></a><a class="related-card" href="/statuts/quel-statut-pour-freelance/"><span class="related-category">Statut</span><strong>Choisir un statut</strong><small>Comparer simplicité, protection, frais réels et obligations.</small><span class="related-arrow" aria-hidden="true">→</span></a></div></aside>
  </article>`;

  return pageShell({
    route: MAIN_TJM_NET_ROUTE,
    title: 'TJM en salaire net : calculateur, tableau et méthode | TJMCalc',
    description: 'Convertissez un TJM en revenu net avec calculateur, tableaux de scénarios, comparaison de statuts, méthode, limites et sources officielles.',
    eyebrow: 'Conversion TJM',
    h1: 'TJM en salaire net',
    lead: 'Un calculateur, des scénarios lisibles et une méthode transparente pour comprendre ce qui reste entre chiffre d’affaires, charges, frais et impôt.',
    bodyClass: 'template-page template-tjm-net-main',
    pageType: 'tool',
    graph,
    children
  });
}

function renderAboutPage() {
  const children = `<article class="article-content trust-content">
    <section class="content-section editorial-section"><h2>Objectif du site</h2><p>TJMCalc aide les freelances, indépendants et porteurs de projet à comprendre le passage entre un taux journalier, un chiffre d’affaires, des cotisations, des frais et un revenu disponible. Le site privilégie les hypothèses visibles plutôt qu’un résultat présenté comme certain.</p><p>L’outil s’adresse aux personnes qui veulent préparer un devis, comparer un statut ou vérifier si un rythme de facturation couvre réellement leurs besoins.</p></section>
    <section class="content-section editorial-section"><h2>Éditeur et responsabilité éditoriale</h2><p>Le site est un projet personnel édité sous le nom <strong>IGdev</strong>. Vous pouvez joindre l’éditeur depuis la <a href="/contact/#coordonnees">page contact</a>.</p><p>Les simulations et les articles sont pédagogiques. IGdev ne revendique aucune qualification d’expert-comptable ou de conseiller fiscal, ni affiliation avec une administration.</p></section>
    <section class="content-section editorial-section"><h2>Production des contenus</h2><p>Les contenus sont construits à partir du calculateur, de sources officielles, de scénarios pédagogiques et de repères éditoriaux signalés comme tels. Une page peut être générée depuis un modèle, mais elle ne doit rester indexable que si elle apporte un contexte, des limites, des sources ou une aide de décision propres à l’intention de recherche.</p><p>Les chiffres de marché non sourcés comme moyenne officielle sont évités. Quand une donnée n’est qu’un repère TJMCalc, elle est nommée comme estimation éditoriale.</p></section>
    <section class="content-section editorial-section"><h2>Limites du service</h2><p>TJMCalc ne fournit pas de conseil comptable, fiscal, social, juridique ou médical. Les résultats dépendent des paramètres saisis, du statut, des frais, de l’ACRE, de la TVA, du foyer fiscal, de l’historique de chiffre d’affaires et des règles applicables à chaque activité.</p><p>Avant une décision engageante, comparez les résultats avec les simulateurs officiels et un professionnel compétent.</p></section>
    <section class="content-section editorial-section"><h2>Contact</h2><p>Les coordonnées disponibles dans le projet sont publiées sur la page <a href="/contact/#coordonnees">contact</a>. Utilisez-les pour signaler une erreur, une source périmée, une page trop proche d’une autre ou une difficulté d’accessibilité.</p></section>
  </article>`;

  return pageShell({
    route: '/a-propos/',
    title: 'À propos de TJMCalc, éditeur et limites | TJMCalc',
    description: 'Projet personnel IGdev : objectif de TJMCalc, production des contenus, contact et limites des simulations.',
    h1: 'À propos de TJMCalc',
    lead: 'Qui édite TJMCalc, comment les contenus sont produits et quelles limites garder en tête avant d’utiliser une simulation.',
    children
  });
}

function renderMethodologyPage() {
  const children = `<article class="article-content trust-content">
    <section class="content-section editorial-section"><h2>Formule de base</h2><p>La base commune est simple : <strong>TJM hors taxe × jours facturés = chiffre d’affaires mensuel</strong>. Le simulateur retire ensuite les frais, les cotisations estimées et, lorsque l’utilisateur renseigne les options fiscales, une estimation d’impôt sur le revenu.</p><p>La TVA collectée n’est jamais comptée comme revenu. Elle est signalée séparément lorsque le chiffre d’affaires annuel projeté dépasse les seuils de franchise applicables.</p></section>
    <section class="content-section editorial-section"><h2>Statuts comparés</h2><div class="table-wrap"><table><caption>Taux pédagogiques utilisés par les calculs statiques</caption><thead><tr><th>Statut</th><th class="number">Taux ou logique</th><th>Traitement des frais</th><th>Limite principale</th></tr></thead><tbody><tr><td>Micro-entreprise</td><td class="number">12,3 % à 25,6 % selon activité</td><td>diminuent le disponible mais pas l’assiette sociale</td><td>les plafonds, exclusions et options fiscales doivent être vérifiés</td></tr><tr><td>EI / EURL / SARL</td><td class="number">42 %</td><td>retirés avant le taux moyen simplifié</td><td>les cotisations réelles sont progressives</td></tr><tr><td>SASU / SAS</td><td class="number">55 %</td><td>approximation sur rémunération assimilée salariée</td><td>IS, dividendes et arbitrage salaire ne sont pas modélisés finement</td></tr><tr><td>Portage salarial</td><td class="number">52 %</td><td>frais non modélisés dans les outils simples</td><td>les frais de gestion et politiques de portage varient</td></tr></tbody></table></div></section>
    <section class="content-section editorial-section"><h2>Jours non facturés</h2><p>Les jours non facturés regroupent congés, prospection, administration, formation, avant-vente, retards de démarrage, intercontrats et imprévus. Les pages TJMCalc testent souvent 15, 18 et 20 jours par mois pour montrer la sensibilité, mais une décision robuste doit repartir du nombre annuel réellement vendable.</p><p>Une mission longue peut augmenter le remplissage, mais elle ne supprime pas le risque de dépendance commerciale ni les périodes de renégociation.</p></section>
    <section class="content-section editorial-section"><h2>Charges, impôt et TVA</h2><p>Les cotisations micro sont appliquées au chiffre d’affaires selon l’activité déclarée. Les autres statuts utilisent des taux moyens pédagogiques, parce que les régimes réels dépendent de tranches, options, rémunération, protection et cotisations minimales.</p><p>L’impôt sur le revenu utilise le barème 2026 sur les revenus 2025 dans le simulateur principal, avec quotient familial, autres revenus et décote simplifiée. Les crédits, réductions, plafonnements, revenus exceptionnels et cas internationaux ne sont pas exhaustifs.</p><p>La franchise TVA repose sur les seuils de l’activité et l’historique de chiffre d’affaires. Le simulateur signale le risque de dépassement, sans déterminer une date d’effet certaine.</p></section>
    <section class="content-section editorial-section"><h2>Budget annuel et réserve</h2><p>Le <a href="/outils/budget-annuel-freelance/">budget annuel micro</a> utilise la formule (revenu annuel avant IR + frais annuels + réserve) ÷ (1 − taux micro-social) ÷ jours encaissés. Le résultat est arrondi au centime supérieur. L’ACRE, la CFP, la CFE, l’IR et les taxes annexes ne sont pas calculés dans cet outil. Les frais sont conservés même lorsqu’ils dépassent le CA ; le disponible peut donc être négatif.</p><p>Dans les outils simples, le portage conserve une hypothèse de retenue globale de 52 %, sans modélisation des remboursements de frais. Cette retenue ne doit pas être assimilée à des frais de gestion de 52 %.</p></section>
    <section class="content-section editorial-section" id="fourchettes-metier"><h2>Origine et limites des montants des fiches métier</h2><p>Les montants affichés par niveau dans les fiches métier sont des hypothèses éditoriales de simulation. Les bornes de certaines tables sont obtenues en appliquant une variation de 15 % à un montant central. Aucun panel représentatif de contrats ou de factures ne justifie de les présenter comme un prix de marché, une moyenne ou des quantiles observés.</p><p>Ces valeurs servent à tester l’effet d’un tarif sur le budget. Elles ne prouvent pas qu’un client acceptera ce tarif. Pour une comparaison commerciale, utilisez une <a href="/barometre/">grille de prestations comparables</a> avec des sources datées et un périmètre explicite.</p></section>
    <section class="content-section editorial-section"><h2>Révision des paramètres</h2><p>Les dates de consultation des sources indiquent le contrôle des règles citées. Les guides conservent leur propre date de modification : une reconstruction technique du site ne constitue pas une nouvelle vérification de tous leurs contenus.</p></section>
    <section class="trust-panel" id="sources"><div><h2>Sources liées à la méthode</h2><ul class="source-list">${sourceLinks(['urssaf-micro-2026', 'service-public-micro-fiscal', 'service-public-tva', 'bofip-ir-2026', 'mon-entreprise-2026'])}</ul></div><div><h2>Limites générales</h2><p>Le modèle ne couvre pas toutes les aides, professions réglementées, conventions, retraites, mutuelles, crédits d’impôt, dividendes, cotisations minimales ou situations internationales.</p><a href="/sources/">Voir les sources détaillées</a></div></section>
  </article>`;

  return pageShell({
    route: '/methodologie/',
    title: 'Méthodologie du calculateur TJM | TJMCalc',
    description: 'Formules, hypothèses, statuts comparés, jours non facturés, charges, impôt, TVA, sources et limites du modèle TJMCalc.',
    h1: 'Méthodologie du calculateur TJM',
    lead: 'Comment les calculs sont réalisés, quelles hypothèses sont appliquées et où le modèle doit être remplacé par une vérification personnalisée.',
    children
  });
}

function renderSourcesPage() {
  const sourceCards = sources.map((source) => (
    `<article class="source-record" id="${source.id}"><div><p class="section-kicker">${escapeHtml(source.category)}</p><h2>${escapeHtml(source.name)}</h2><p><strong>${escapeHtml(source.organization)}</strong></p></div><dl><div><dt>Vérifie</dt><dd>${escapeHtml(source.verifies)}</dd></div><div><dt>Consultée</dt><dd><time datetime="${source.consulted}">${escapeHtml(source.consultedLabel)}</time></dd></div><div><dt>Publication</dt><dd>${escapeHtml(source.published)}</dd></div><div><dt>Limite</dt><dd>${escapeHtml(source.limits)}</dd></div></dl><a href="${escapeHtml(source.url)}" rel="external">Consulter la source</a></article>`
  )).join('');
  const children = `<article class="article-content trust-content">
    <section class="content-section editorial-section"><h2>Comment lire cette page</h2><p>Chaque source indique l’organisme, ce qu’elle permet de vérifier, son lien, sa date de consultation et ses limites. TJMCalc privilégie les administrations et organismes publics pour les règles sociales, fiscales et statistiques.</p><p class="callout-warning"><strong>Une source officielle sur les cotisations ne devient pas une source officielle de TJM.</strong> Les repères métier publiés par TJMCalc restent éditoriaux lorsqu’aucun jeu de factures comparable n’est disponible.</p></section>
    <section class="source-directory" aria-label="Répertoire des sources">${sourceCards}</section>
    <section class="content-section editorial-section"><h2>Règle de mise à jour</h2><p>Les sources sont revues au minimum une fois par an et lors d’un changement réglementaire identifié. Une source inaccessible, contradictoire ou trop ancienne bloque l’ajout d’un chiffre présenté comme actuel.</p><p>Pour proposer une correction, indiquez l’URL concernée, la source, la date et l’effet attendu via la page <a href="/contact/#signaler-correction">contact</a>.</p></section>
  </article>`;

  return pageShell({
    route: '/sources/',
    title: 'Sources officielles et références | TJMCalc',
    description: 'Répertoire structuré des sources utilisées pour les cotisations, la micro-entreprise, la TVA, l’impôt et les limites éditoriales.',
    h1: 'Sources officielles et références',
    lead: 'Les organismes, liens et dates de consultation utilisés pour vérifier les hypothèses du calculateur.',
    children
  });
}

function renderEditorialPolicyPage() {
  const children = `<article class="article-content trust-content">
    <section class="content-section editorial-section"><h2>Principes de rédaction</h2><p>Les contenus doivent répondre à une question réelle : calculer un revenu, comparer deux hypothèses, comprendre une limite ou préparer une décision. Les textes ajoutés uniquement pour varier des mots-clés, remplir une page ou produire des dizaines de variantes ne doivent pas être indexés.</p><p>Les exemples sont nommés comme simulations pédagogiques. Aucun témoignage, avis, client, diplôme, expert ou statistique n’est inventé.</p></section>
    <section class="content-section editorial-section"><h2>Vérification des informations</h2><p>Les règles sociales, fiscales et administratives sont rapprochées de sources officielles quand elles existent : Urssaf, Service-Public.fr, BOFiP, impots.gouv.fr, Insee ou simulateurs publics. Les repères éditoriaux TJMCalc sont séparés des données officielles.</p><p>Quand un chiffre ne peut pas être vérifié correctement, il est soit supprimé, soit présenté comme hypothèse à tester.</p></section>
    <section class="content-section editorial-section"><h2>Mises à jour</h2><p>Les paramètres sociaux et fiscaux sont relus au minimum une fois par an et après tout changement identifié. Les pages modifiées affichent une date de dernière vérification. Le sitemap ne doit inclure que les pages que TJMCalc souhaite voir apparaître dans les résultats de recherche.</p></section>
    <section class="content-section editorial-section"><h2>Automatisation et regroupement</h2><p>Des scripts génèrent les tableaux et maintiennent les liens et métadonnées. Les variantes qui ne changent qu’un montant et les anciens guides trop répétitifs sont regroupés avec une ressource centrale. Les anciennes adresses redirigent vers cette ressource pour tous les visiteurs, avec le TJM conservé lorsqu’il est présent. Elles ne figurent plus dans le sitemap ni dans le flux de guides.</p><p>Les dates de modification suivent les changements de contenu. Reconstruire les fichiers ne permet pas de présenter tous les articles comme nouvellement vérifiés.</p></section>
    <section class="content-section editorial-section"><h2>Signalement des erreurs</h2><p>Une erreur peut être signalée via <a href="/contact/#signaler-correction">la page contact</a>. Le signalement idéal précise l’URL, la phrase ou valeur concernée, la source de correction, la date de consultation et la conséquence utilisateur.</p></section>
  </article>`;

  return pageShell({
    route: '/politique-editoriale/',
    title: 'Politique éditoriale | TJMCalc',
    description: 'Rédaction, vérification, mises à jour, automatisation et correction des contenus TJMCalc.',
    h1: 'Politique éditoriale',
    lead: 'Comment TJMCalc rédige, vérifie, met à jour et corrige ses contenus sans présenter les simulations comme des certitudes.',
    children
  });
}

function renderRedirectPage(route, target) {
  const canonical = getSeoPolicy(route).canonical;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ouvrir la ressource TJMCalc</title><meta name="description" content="Cette ancienne adresse mène à la ressource consolidée et au calculateur TJMCalc.">
<meta name="robots" content="noindex,follow"><link rel="canonical" href="${canonical}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(target)}"><link rel="stylesheet" href="/assets/site.css"></head>
<body><main class="container editorial-main"><h1>Retrouvez votre simulation</h1><p>Cette ressource a été regroupée avec le calculateur et sa méthode.</p><p><a href="${escapeHtml(target)}">Ouvrir la ressource à jour</a></p></main></body></html>\n`;
}

function renderAnnualBudgetPage() {
  const example = annualBudget({ monthlyTarget: 3000, monthlyExpenses: 500, billableDays: 180, reserveMonths: 1 });
  const children = `<article class="article-content trust-content">
    <section class="tool-panel" aria-labelledby="budget-title"><h2 id="budget-title">Financer douze mois avec vos jours réellement vendables</h2>
      <p>Ce budget est destiné à une activité en micro-entreprise. Le revenu souhaité est un disponible <strong>avant impôt sur le revenu</strong>. Les jours sans facturation sont déjà pris en compte par votre capacité annuelle : ne les retirez pas une deuxième fois.</p>
      <form data-tool="annualBudget" aria-label="Budget annuel micro-entrepreneur"><div class="tool-grid">
        <div class="tool-field"><label for="target">Disponible mensuel souhaité avant IR (€)</label><input id="target" type="number" value="3000" min="0" step="100" inputmode="decimal"></div>
        <div class="tool-field"><label for="expenses">Frais professionnels par mois (€)</label><input id="expenses" type="number" value="500" min="0" step="50" inputmode="decimal"></div>
        <div class="tool-field"><label for="annual-days">Jours facturés et encaissés sur l’année</label><input id="annual-days" type="number" value="180" min="0" max="366" step="1" inputmode="numeric"></div>
        <div class="tool-field"><label for="reserve-months">Réserve en plus du revenu annuel (mois de revenu)</label><input id="reserve-months" type="number" value="1" min="0" max="24" step="0.5" inputmode="decimal"></div>
        <div class="tool-field"><label for="micro-type">Catégorie de cotisations micro-sociales</label><select id="micro-type"><option value="liberale">BNC hors Cipav — 25,6 %</option><option value="service">Services BIC — 21,2 %</option><option value="cipav">BNC relevant de la Cipav — 23,2 %</option><option value="vente">Vente de marchandises — 12,3 %</option></select></div>
      </div><output id="tool-result" class="tool-result" aria-live="polite"></output>
      <p><button id="download-budget" class="button" type="button" disabled>Télécharger mon budget en CSV</button></p></form>
      <noscript><p>Activez JavaScript pour modifier le budget et exporter vos hypothèses. Le cas détaillé ci-dessous reste lisible sans JavaScript.</p></noscript>
    </section>
    <section class="content-section editorial-section"><h2>Pourquoi raisonner à l’année ?</h2><p>Un mois de mission complet peut sembler confortable alors que le tarif ne finance ni les congés ni le temps nécessaire pour trouver le prochain client. Pour décider, le besoin personnel porte sur douze mois ; la facturation, elle, porte uniquement sur les jours que vous pensez vendre et encaisser.</p><p>Construisez d’abord votre capacité avec le <a href="/outils/jours-facturables/">calculateur de jours facturables</a>. Retirez séparément vos congés, votre administratif, votre formation et une hypothèse d’intercontrat. Une journée de prospection n’est pas une journée vendue. Si une mission couvre plusieurs mois, comptez uniquement les jours réellement contractualisés, puis testez une hypothèse moins favorable.</p></section>
    <section class="content-section card" id="cas-detaille"><h2>Cas détaillé : 3 000 € par mois, 500 € de frais, 180 jours</h2><p>Il s’agit d’un exemple fictif de budget en micro-BNC hors Cipav, sans ACRE, sans versement libératoire, pour une année complète au même taux de cotisations. Ce cas ne décrit aucun tarif de marché.</p><ol><li>Le revenu personnel cible est de 3 000 × 12 = <strong>36 000 €</strong> avant IR.</li><li>Les dépenses de l’activité sont de 500 × 12 = <strong>6 000 €</strong>.</li><li>Une réserve supplémentaire d’un mois de revenu représente <strong>3 000 €</strong>. Elle ne remplace pas les congés déjà retirés du calendrier.</li><li>Après 25,6 % de cotisations sur le CA, il faut conserver 45 000 €. Le CA à encaisser est donc 45 000 ÷ 0,744 = <strong>60 483,87 €</strong>.</li><li>Réparti sur 180 jours, ce besoin donne <strong>${example.tjm.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} HT par jour</strong>, arrondi au centime supérieur.</li></ol><p>À ce tarif, la facturation représente environ ${formatEuros(example.revenue)} sur l’année. Les cotisations sont d’environ ${formatEuros(example.charges)}. Les 6 000 € de dépenses et la réserve de 3 000 € sont ensuite retirés : il reste environ 36 000 € avant impôt sur le revenu et prélèvements annexes.</p><p>Avec le même budget mais seulement 150 jours vendus, le besoin passe à 403,23 € HT par jour. Une remise à 300 € ne se finance donc pas simplement en travaillant « un peu plus » : il faudrait environ 202 jours encaissés pour le même budget. Vérifiez si votre calendrier et votre portefeuille clients le permettent.</p></section>
    <section class="content-section editorial-section"><h2>La formule et le traitement des frais</h2><p><code>CA nécessaire = (revenu annuel + frais annuels + réserve) ÷ (1 − taux micro-social)</code></p><p><code>TJM HT = CA nécessaire ÷ jours annuels encaissés</code></p><p>En micro, les frais ne diminuent pas le chiffre d’affaires soumis aux cotisations. Acheter un ordinateur ou payer un abonnement réduit votre disponible, même si ce coût n’est pas déductible de l’assiette sociale. Le budget conserve également les frais lorsque le chiffre d’affaires est nul ou insuffisant : un mois déficitaire ne devient pas artificiellement un mois à zéro.</p><p>La réserve est de l’argent mis de côté après les cotisations, pas une dépense déductible. Si vous disposez déjà de la trésorerie souhaitée, saisissez zéro pour ne pas la financer de nouveau dans l’année.</p></section>
    <section class="content-section editorial-section"><h2>Utiliser le CSV pour suivre votre activité</h2><p>L’export contient la date de simulation, les jours retenus, le tarif, le CA, les cotisations estimées, les frais et la réserve. Il se crée dans votre navigateur. Conservez une copie de votre prévision puis comparez-la chaque mois aux encaissements et dépenses réels.</p><p>Si vos jours vendus diminuent, modifiez la capacité plutôt que de supposer que les mois restants seront tous pleins. Si vos dépenses augmentent, mettez à jour leur moyenne annuelle. Ce suivi permet de décider quand ajuster le prochain devis ou renforcer la trésorerie.</p></section>
    <section class="content-section editorial-section"><h2>Ce budget ne calcule pas</h2><ul><li>l’impôt sur le revenu du foyer et le versement libératoire ;</li><li>la contribution à la formation professionnelle (CFP), la CFE et les taxes éventuellement applicables ; ajoutez une provision adaptée dans les frais ;</li><li>l’ACRE, les activités mixtes, les régimes spécifiques ou l’outre-mer ;</li><li>la date de sortie de franchise de TVA ou du régime micro ;</li><li>les délais de paiement, impayés, stocks et investissements financés à crédit.</li></ul><p>Le TJM obtenu est le seuil de votre scénario avant ces éléments. Le prix vendu dépend aussi de votre prestation, de son périmètre et du client. Une activité rentable peut nécessiter un autre régime ou une autre structure de coûts.</p></section>
    <section class="trust-panel"><div><h2>Vérifier les règles utilisées</h2><ul class="source-list">${sourceLinks(['urssaf-micro-2026', 'service-public-micro-fiscal', 'service-public-tva'])}</ul></div><div><h2>Poursuivre le calcul</h2><p>Le <a href="/">calculateur principal</a> permet une estimation mensuelle avec paramètres fiscaux. Consultez la <a href="/methodologie/">méthode</a> pour comprendre les écarts entre statuts et <a href="/contact/#signaler-correction">signalez une anomalie</a> avec vos seules hypothèses de calcul.</p></div></section>
  </article>`;
  return pageShell({ route: '/outils/budget-annuel-freelance/', title: 'Budget annuel freelance : TJM, frais et réserve | TJMCalc', description: 'Construisez un budget annuel micro-entrepreneur : jours réellement vendables, revenu cible, frais, réserve, scénarios et export CSV local.', eyebrow: 'Budget micro-entreprise', h1: 'Quel TJM finance votre année ?', lead: 'Un budget transparent pour financer douze mois de revenu avec une capacité facturable réaliste, et tester ce qui change quand vous vendez moins de jours.', pageType: 'tool', children }).replace('</body>', '<script type="module" src="/assets/tools.js"></script>\n</body>');
}

function renderMicroGuide() {
  return pageShell({ route: '/guides/micro-entreprise-cotisations-impot-tva/', title: 'Micro-entreprise : distinguer cotisations, IR et TVA | TJMCalc', description: 'Un cas chiffré pour séparer cotisations micro-sociales, frais, ACRE, impôt sur le revenu, TVA et plafonds de la micro-entreprise en 2026.', eyebrow: 'Comprendre un revenu micro', h1: 'Cotisations, impôt et TVA : trois calculs différents', lead: 'La somme facturée, l’assiette fiscale et le disponible ne correspondent pas au même montant. Ce guide les sépare avec des hypothèses que vous pouvez vérifier.', pageType: 'guide', children: `<article class="article-content trust-content">
    <section class="content-section editorial-section"><h2>Commencer par quatre montants distincts</h2><p>Le chiffre d’affaires hors taxe correspond aux recettes de l’activité. Les cotisations micro-sociales sont calculées sur ce chiffre d’affaires selon la catégorie déclarée. Les frais professionnels réduisent ce qu’il vous reste, sans diminuer cette assiette sociale. L’impôt sur le revenu dépend ensuite du régime fiscal choisi et de votre foyer.</p><p>La TVA suit un autre mécanisme : lorsqu’elle est applicable, la somme collectée pour l’administration ne constitue pas votre revenu. Ne la mélangez ni au tarif hors taxe ni à la réserve destinée à payer vos cotisations.</p></section>
    <section class="content-section card"><h2>Cas fictif : 50 000 € de CA et 6 000 € de frais</h2><p>Le scénario retient une activité libérale BNC hors Cipav au taux micro-social 2026 de 25,6 %, sans ACRE et sans versement libératoire. Il suppose que le régime micro s’applique et ne modélise ni activité mixte ni régime particulier.</p><div class="table-wrap"><table><caption>Calcul annuel avant impôt et prélèvements annexes</caption><tbody><tr><th scope="row">CA hors taxe encaissé</th><td class="number">50 000 €</td></tr><tr><th scope="row">Cotisations : 50 000 × 25,6 %</th><td class="number">12 800 €</td></tr><tr><th scope="row">Frais payés</th><td class="number">6 000 €</td></tr><tr><th scope="row">Disponible avant IR, CFP et CFE</th><td class="number">31 200 €</td></tr><tr><th scope="row">Base fiscale micro-BNC : 50 000 × 66 %</th><td class="number">33 000 €</td></tr></tbody></table></div><p>Les 33 000 € de base fiscale ne sont pas de l’argent disponible. Ils proviennent de l’abattement fiscal de 34 %, qui remplace la déduction des frais réels pour ce régime. Il ne faut donc pas déduire une seconde fois les 6 000 € de dépenses et les 12 800 € de cotisations de cette base forfaitaire.</p><p>À titre de projection, avec une seule part, aucun autre revenu, aucun avantage fiscal et le barème 2026 sur les revenus 2025, l’impôt brut sur 33 000 € serait d’environ 3 004 €. Il resterait alors environ 28 196 €, avant CFP, CFE et autres prélèvements éventuels. Ce croisement de paramètres sert à comprendre le calcul : il ne constitue pas une déclaration fiscale des revenus 2026, dont le barème définitif peut différer.</p></section>
    <section class="content-section editorial-section" id="cotisations"><h2>Le taux social dépend de l’activité, pas du métier affiché sur un devis</h2><p>Pour 2026, le modèle utilise 12,3 % pour la vente de marchandises, 21,2 % pour les services BIC, 25,6 % pour les activités libérales BNC hors Cipav et 23,2 % pour les activités relevant de la Cipav. Ces catégories ne couvrent pas toutes les situations. L’intitulé commercial de votre prestation ne suffit pas à identifier votre régime.</p><p>La contribution à la formation professionnelle et les taxes éventuelles ne sont pas ajoutées à ces taux dans TJMCalc. Une simulation qui applique uniquement le taux micro-social n’est donc pas un montant exhaustif à payer à l’administration. Vérifiez votre déclaration Urssaf et provisionnez les autres échéances.</p><p>Dans le cas à 50 000 €, augmenter les frais annuels de 6 000 à 10 000 € réduit le disponible avant IR de 31 200 à 27 200 €. Les cotisations restent de 12 800 €. C’est pourquoi une activité avec beaucoup d’achats peut nécessiter une autre comparaison qu’un simple classement des taux.</p></section>
    <section class="content-section editorial-section" id="acre"><h2>ACRE : comparer le démarrage et le fonctionnement durable</h2><p>Pour les créations micro à compter du 1er juillet 2026, l’hypothèse ACRE du calculateur retient une réduction de 25 % des cotisations habituelles, pendant la période de droit. L’éligibilité et les démarches sont à vérifier auprès de l’Urssaf ; les créations antérieures ne sont pas modélisées par cette case.</p><p>À 5 000 € de recettes mensuelles en BNC hors Cipav, les cotisations du scénario passent de 1 280 € à 960 €, soit 320 € d’écart. Les frais professionnels ne diminuent pas pour autant. Un prix qui ne fonctionne que pendant l’aide risque de devenir insuffisant à son terme.</p><p>Construisez donc votre tarif durable sans aide, puis utilisez l’écart temporaire pour une réserve, un investissement ou une période de démarrage. Si le droit s’arrête en cours d’année, appliquez les taux à chacune des périodes concernées, plutôt qu’une réduction sur douze mois par défaut.</p></section>
    <section class="content-section editorial-section" id="impot"><h2>Barème progressif et versement libératoire</h2><p>Au régime micro classique, l’abattement dépend de l’activité et le revenu fiscal obtenu rejoint les autres revenus du foyer. Le nombre de parts et les autres revenus modifient alors l’impôt. Le calculateur compare le foyer avec et sans l’activité pour estimer le supplément d’impôt attribuable à celle-ci.</p><p>Le versement libératoire, si vous avez valablement opté et remplissez les conditions, applique un taux directement au CA : 1 % pour la vente, 1,7 % pour les services BIC et 2,2 % pour le BNC. À 50 000 € de BNC, cela représente 1 100 €. Cette comparaison isolée ne suffit pas à décider d’une option : les conditions d’accès et les effets sur les autres revenus doivent être examinés.</p><p>Pour une option au titre de 2026, la DGFiP indique un RFR 2024 limité à 29 315 € par part, en plus des autres conditions. Cocher l’option dans une simulation ne vérifie ni votre RFR ni la validité de votre demande. Le calculateur ne traite pas non plus exhaustivement les interactions du versement libératoire avec les autres revenus du foyer.</p></section>
    <section class="content-section editorial-section" id="tva"><h2>Franchise de TVA et plafond micro : deux contrôles à faire séparément</h2><p>Les plafonds généraux de CA du régime micro indiqués pour 2026 à 2028 sont de 203 100 € pour la vente de marchandises et de 83 600 € pour les services et professions libérales, hors cas particuliers. La vérification du régime dépend notamment de l’historique des recettes et des règles propres à l’activité.</p><p>La franchise en base de TVA possède ses propres seuils et règles de sortie. Une activité peut donc rester en micro tout en devenant redevable de la TVA. Pour une prestation soumise au taux standard, un tarif de 500 € HT devient 600 € TTC lorsque la TVA de 20 % s’applique. Les 100 € collectés ne sont pas un supplément de revenu.</p><p>Avant un devis ou un franchissement de seuil, vérifiez la fiche officielle de TVA avec vos chiffres de l’année précédente et de l’année en cours. Une projection de CA annuel ne détermine pas à elle seule la date exacte à laquelle vos factures doivent changer. Les opérations exonérées, internationales ou soumises à un taux réduit demandent un contrôle distinct.</p></section>
    <section class="content-section editorial-section"><h2>Passer du guide à votre prévision</h2><ol><li>Identifiez la catégorie sociale et fiscale réellement applicable.</li><li>Listez vos recettes hors taxe encaissées et vos frais payés séparément.</li><li>Comparez une période sans aide et, si applicable, la période ACRE.</li><li>Estimez l’impôt du foyer avec les autres revenus et le régime fiscal retenu.</li><li>Réservez la TVA, les cotisations et les autres échéances avant d’utiliser le solde.</li></ol><p>Utilisez le <a href="/outils/budget-annuel-freelance/">budget annuel</a> pour financer votre année et le <a href="/">calculateur principal</a> pour tester vos hypothèses mensuelles. Pour un choix fiscal ou un changement de régime, faites confirmer les règles applicables à votre situation.</p></section>
    <section class="trust-panel"><div><h2>Sources et date de contrôle</h2><ul class="source-list">${sourceLinks(['urssaf-micro-2026', 'service-public-acre', 'impots-versement-liberatoire', 'service-public-micro-fiscal', 'service-public-tva', 'bofip-ir-2026'])}</ul></div><div><h2>Limites du cas</h2><p>Aucune activité mixte, aide autre que le scénario ACRE, situation internationale, cotisation particulière, crédit d’impôt ou déduction spécifique n’est calculé. Les exemples sont fictifs et ne mesurent pas un revenu de marché.</p></div></section>
  </article>` });
}

function renderPriceComparisonPage() {
  return pageShell({ route: '/barometre/', title: 'Comparer des tarifs freelance avec méthode | TJMCalc', description: 'Une grille de comparaison des devis, des critères de source et un cas détaillé pour confronter des tarifs freelance sans inventer de moyenne de marché.', eyebrow: 'Comparer des propositions', h1: 'Comparer des tarifs freelance avec méthode', lead: 'Deux tarifs journaliers ne décrivent pas toujours la même prestation. Voici comment construire une comparaison que vous pouvez vérifier.', children: `<article class="article-content trust-content">
    <section class="content-section editorial-section"><h2>Ce que vous trouverez ici</h2><p>TJMCalc ne dispose pas d’un panel documenté de contrats ou de factures permettant de publier un baromètre représentatif. Les anciennes pages par famille sont regroupées ici. Les montants des fiches métier servent à tester des scénarios ; ils ne mesurent ni une médiane ni un prix effectivement négocié.</p><p>Pour préparer votre tarif, partez de votre <a href="/outils/budget-annuel-freelance/">budget annuel</a>, puis confrontez ce seuil à des propositions comparables. Le budget répond à « ce prix finance-t-il mon activité ? ». La comparaison répond à « quelles différences de prestation expliquent les écarts ? ».</p></section>
    <section class="content-section card"><h2>Une grille pour rendre les devis comparables</h2><div class="table-wrap"><table><caption>Informations à recueillir avant de comparer deux prix</caption><thead><tr><th>Critère</th><th>À relever</th><th>Conséquence sur la comparaison</th></tr></thead><tbody><tr><th scope="row">Période et zone</th><td>Date du devis, lieu, télétravail et déplacements</td><td>Un prix ancien ou une présence sur site ne se comparent pas sans ajustement.</td></tr><tr><th scope="row">Périmètre</th><td>Livrables, nombre de variantes, exclusions et recette</td><td>Un prix plus élevé peut inclure davantage de travail vérifiable.</td></tr><tr><th scope="row">Unité de facturation</th><td>Heures par jour, jours engagés, forfait ou régie</td><td>Le prix par jour ne dit rien du coût final si la durée diffère.</td></tr><tr><th scope="row">Responsabilité</th><td>Autonomie, maintenance, assurance et contraintes</td><td>Une astreinte ou une garantie ajoute une obligation.</td></tr><tr><th scope="row">Frais et taxes</th><td>HT, achats, licences, déplacements, TVA</td><td>Ramenez les propositions à un périmètre de coût identique.</td></tr><tr><th scope="row">Conditions</th><td>Acompte, échéance de paiement, annulation et exclusivité</td><td>La trésorerie et le risque commercial peuvent changer à prix égal.</td></tr></tbody></table></div><p><a href="/assets/grille-comparaison-devis.csv" download>Télécharger la grille vierge de comparaison (CSV)</a></p></section>
    <section class="content-section editorial-section"><h2>Cas fictif : 450 € contre 550 € par jour</h2><p>La proposition A annonce 450 € par jour pour dix jours de réalisation. La recette et la documentation ne sont pas incluses. La proposition B annonce 550 € par jour pour huit jours, documentation et recette comprises. Les totaux sont respectivement de 4 500 € et 4 400 € HT.</p><p>Le tarif journalier de B est plus élevé, mais son total annoncé est inférieur. Cela ne prouve pas qu’il s’agit du meilleur choix : demandez le même livrable, les mêmes critères d’acceptation et les mêmes modalités de correction. Si A nécessite ensuite trois jours de recette, son coût serait de 5 850 € HT à tarif inchangé. Si B a sous-estimé la complexité, demandez qui supporte les jours supplémentaires.</p><p>La comparaison devient utile lorsque le client comprend le périmètre, le coût et le risque, plutôt que lorsqu’il classe simplement des TJM du plus bas au plus haut.</p></section>
    <section class="content-section editorial-section"><h2>Comment apprécier un chiffre publié ailleurs ?</h2><p>Avant de reprendre une moyenne, vérifiez la période observée, le nombre de participants, la définition du métier et le type de prix. Un tarif affiché sur un profil peut différer du tarif signé. Une enquête auprès de répondants volontaires ne représente pas automatiquement tous les indépendants.</p><p>Demandez si le chiffre mélange missions courtes et longues, intermédiaires et clients directs, factures et simples déclarations. Si la méthode ou la taille du panel manque, conservez le chiffre comme piste de discussion et évitez de le présenter comme le tarif du marché.</p><p>Les statistiques de revenu des non-salariés de l’Insee apportent un contexte économique, mais un revenu mensuel ne se convertit pas en TJM sans connaître les jours vendus, les frais et le régime social.</p></section>
    <section class="trust-panel"><div><h2>Références</h2><ul class="source-list">${sourceLinks(['bpifrance-pricing', 'insee-independants-2024'])}</ul></div><div><h2>Mettre la méthode en pratique</h2><p><a href="/guides/exemple-devis-freelance/">Préparer un devis</a>, <a href="/guides/negocier-son-tjm/">négocier son TJM</a> ou tester le <a href="/outils/budget-annuel-freelance/">budget annuel</a>.</p></div></section>
  </article>` });
}

function renderGuideEditorialInfo(route) {
  return `<section class="trust-panel editorial-info" id="editorial-info"><div><h2>Informations éditoriales</h2><p>Responsable éditorial : <a href="/a-propos/">TJMCalc - IGdev</a>. Publication : <time datetime="${publishedDate}">${publishedDateLabel}</time>. Dernière mise à jour et vérification : <time datetime="${LAST_REVIEW_DATE}">${reviewDateLabel}</time>.</p><p>La méthode consiste à relier la recommandation du guide aux mêmes hypothèses que le calculateur : TJM hors taxe, jours facturés, frais, statut, impôt et limites de la période.</p></div><div><h2>Sources et limites</h2><ul class="source-list">${sourceLinks(['urssaf-micro-2026', 'service-public-micro-fiscal', 'service-public-tva', 'bofip-ir-2026'])}</ul><p>Les situations particulières, plafonds, aides, conventions, professions réglementées et arbitrages de société doivent être vérifiés séparément.</p></div></section>`;
}

function renderStatusEditorialInfo() {
  return `<section class="trust-panel editorial-info" id="editorial-info"><div><h2>Informations éditoriales</h2><p>Responsable éditorial : <a href="/a-propos/">TJMCalc - IGdev</a>. Publication : <time datetime="${publishedDate}">${publishedDateLabel}</time>. Dernière mise à jour et vérification : <time datetime="${LAST_REVIEW_DATE}">${reviewDateLabel}</time>.</p><p>La comparaison des statuts reprend les mêmes hypothèses que le calculateur : TJM hors taxe, jours facturés, frais, activité, cotisations moyennes, impôt et TVA lorsque ces paramètres sont disponibles.</p></div><div><h2>Sources et limites</h2><ul class="source-list">${sourceLinks(['service-public-legal-form-choice', 'service-public-legal-forms-directory', 'urssaf-micro-2026', 'service-public-micro-fiscal', 'service-public-tva', 'bofip-ir-2026'])}</ul><p>Les pages statuts ne remplacent pas un choix juridique, fiscal ou social personnalisé. Les cotisations minimales, dividendes, conventions, aides, retraite et cas réglementés doivent être vérifiés séparément.</p></div></section>`;
}

function updateGuideArticle(html, route) {
  const policy = getSeoPolicy(route);
  if (!route.startsWith('/guides/') || route === '/guides/' || !policy.indexable) return html;
  let next = html;
  if (next.includes('id="editorial-info"')) return next;
  const insertion = renderGuideEditorialInfo(route);
  if (next.includes('<section class="content-section faq-block')) {
    return next.replace('<section class="content-section faq-block', `${insertion}<section class="content-section faq-block`);
  }
  return next.replace('</article>', `${insertion}</article>`);
}

function updateStatusArticle(html, route) {
  const policy = getSeoPolicy(route);
  if (!route.startsWith('/statuts/') || route === '/statuts/' || !policy.indexable) return html;
  let next = html;
  if (next.includes('id="editorial-info"')) return next;
  const insertion = renderStatusEditorialInfo();
  if (next.includes('<section class="content-section faq-block')) {
    return next.replace('<section class="content-section faq-block', `${insertion}<section class="content-section faq-block`);
  }
  return next.replace('</article>', `${insertion}</article>`);
}

function updateHomePage() {
  const homePath = path.join(rootDir, 'index.html');
  let html = fs.readFileSync(homePath, 'utf8');
  const example = calculateRevenue({
    tjm: 450,
    days: 18,
    status: 'micro',
    microType: 'liberale',
    expenses: 500
  });
  const noExpenseExample = calculateRevenue({
    tjm: 450,
    days: 18,
    status: 'micro',
    microType: 'liberale',
    expenses: 0
  });
  const homeEditorial = `<section class="home-editorial container" aria-labelledby="explorer-tjm">
    <h2 id="explorer-tjm">Comprendre votre TJM avant de décider</h2>
    <p class="subtitle">TJMCalc s’adresse aux freelances, consultants, artisans et professions indépendantes qui veulent convertir un tarif journalier en revenu estimé. L’outil se distingue par des hypothèses visibles, des sources officielles et des avertissements sur ce que le calcul ne couvre pas.</p>
    <div class="card-grid">
      <article class="link-card"><h3>Présentation</h3><p>Le simulateur calcule un chiffre d’affaires, des cotisations estimées, des frais et un net avant ou après impôt selon vos paramètres. Les résultats restent des estimations, car vos frais réels, votre foyer fiscal, votre protection et vos obligations peuvent modifier le montant final.</p></article>
      <article class="link-card"><h3>Méthodologie</h3><p>Les données prises en compte sont le TJM, les jours facturés, l’activité, le statut, les frais, l’ACRE, la TVA et le barème d’impôt. Le modèle ne couvre pas toutes les cotisations minimales, aides, conventions, dividendes, crédits d’impôt ou cas internationaux. Les paramètres sont revus au minimum chaque année.</p></article>
      <article class="link-card"><h3>Différences clés</h3><p>Le chiffre d’affaires est le montant facturé. Le revenu brut est le montant restant avant fiscalité personnelle dans les scénarios simples. Le revenu net disponible dépend ensuite des cotisations, frais, impôt et réserves à prévoir.</p></article>
    </div>
    <div class="card-grid">
      <article class="link-card"><h3>Exemple à 450 €</h3><p>À 450 € sur 18 jours, le chiffre d’affaires mensuel est ${formatEuros(example.revenue)}. En micro-BNC sans ACRE, les cotisations estimées sont ${formatEuros(example.charges)}. Avec 500 € de frais mensuels, le disponible avant impôt est ${formatEuros(example.netBeforeIncomeTax)} ; sans ces frais, il serait ${formatEuros(noExpenseExample.netBeforeIncomeTax)}.</p></article>
      <article class="link-card"><h3>Limites de l’exemple</h3><p>Il suppose 18 jours vendus sur le mois, aucune sortie de franchise TVA, aucun retard de paiement et un statut micro-BNC. Il ne remplace pas une validation Urssaf, fiscale ou comptable.</p></article>
      <article class="link-card"><h3>Sources principales</h3><p>Les contrôles s’appuient sur l’Urssaf, Mon-entreprise, Service-Public.fr, le BOFiP, impots.gouv.fr et l’Insee. Le détail est maintenu dans le <a href="/sources/">répertoire des sources</a>.</p></article>
    </div>
    <h2>Guides recommandés</h2>
    <div class="card-grid">
      <article class="link-card"><h3><a href="/outils/budget-annuel-freelance/">Financer une année complète</a></h3><p>Calculez un TJM à partir de votre revenu, de vos frais, de vos jours vendables et d’une réserve. Comparez trois capacités et exportez le budget en CSV.</p></article>
      <article class="link-card"><h3><a href="/tjm-en-salaire-net/">TJM en salaire net</a></h3><p>La page centrale pour comparer plusieurs TJM, jours facturés, statuts, sources et limites.</p></article>
      <article class="link-card"><h3><a href="/guides/comment-calculer-son-tjm/">Calculer son TJM</a></h3><p>Une méthode annuelle qui part du revenu cible, des frais et des jours vendables.</p></article>
      <article class="link-card"><h3><a href="/guides/nombre-de-jours-facturables/">Jours facturables</a></h3><p>Transformer le calendrier en capacité réaliste avant de fixer un tarif.</p></article>
      <article class="link-card"><h3><a href="/guides/frais-professionnels-dans-le-tjm/">Frais professionnels</a></h3><p>Identifier les dépenses à financer par le TJM sans confondre frais et revenu.</p></article>
      <article class="link-card"><h3><a href="/statuts/quel-statut-pour-freelance/">Choisir un statut</a></h3><p>Comparer micro, EI, EURL, SASU et portage avec des limites explicites.</p></article>
      <article class="link-card"><h3><a href="/methodologie/">Méthodologie</a></h3><p>Lire les formules, hypothèses, sources et limites utilisées par le calculateur.</p></article>
    </div>
  </section>`;

  html = html.replace(
    /<section class="home-editorial container" aria-labelledby="explorer-tjm">[\s\S]*?<\/section>\s*(?=\s*<section class="faq">)/,
    homeEditorial
  );
  html = html.replace(
    '<meta name="description" content="Calculez votre revenu net freelance à partir de votre TJM. Simulateur gratuit pour plus de 60 activités, en micro, société ou portage.">',
    '<meta name="description" content="Calculez votre revenu net freelance à partir de votre TJM avec hypothèses visibles, comparaison de statuts, méthode, limites et sources officielles.">\n<meta name="robots" content="index,follow,max-image-preview:large">'
  );
  html = html.replaceAll('href="/revenus/"', 'href="/tjm-en-salaire-net/"');
  html = addEditorialPolicyToFooter(html);
  fs.writeFileSync(homePath, html, 'utf8');
}

function improveToolExplanation(html, route) {
  const guides = {
    '/outils/revenu-net-vers-tjm/': {
      title: 'Financer le revenu visé et les dépenses',
      method: 'En micro-BNC hors Cipav, sans ACRE, le calcul est (revenu cible + frais) ÷ 0,744 ÷ jours facturés. Les cotisations portent sur le CA ; retirer les frais après avoir calculé le tarif conduirait à sous-financer le revenu. Pour les statuts au réel du modèle, la formule simplifiée est (revenu cible ÷ (1 − taux moyen) + frais) ÷ jours.',
      example: 'Pour 3 500 € disponibles avant IR, 300 € de frais et 18 jours vendus, il faut 3 800 ÷ 0,744 ÷ 18 = 283,75… €, arrondis à 283,76 € HT par jour. Avec 500 € de frais, le besoin passe à 298,69 €. Si aucun jour n’est vendu, aucun tarif ne finance le mois : l’outil affiche une impossibilité plutôt que zéro euro.'
    },
    '/outils/seuil-rentabilite-freelance/': {
      title: 'Combien de jours couvrent vos besoins ?',
      method: 'En micro-BNC hors Cipav sans ACRE, un jour à 500 € laisse 372 € après 25,6 % de cotisations, avant frais et IR. Le seuil en jours est (revenu mensuel cible + frais mensuels) ÷ (TJM × 0,744), arrondi au jour entier supérieur. Les frais ne sont pas déduits du CA soumis aux cotisations.',
      example: 'Avec 3 500 € de revenu cible et 500 € de frais mensuels, il faut financer 4 000 €. À 500 € HT par jour, 10 jours laissent seulement 3 220 € après les frais. Onze jours laissent 3 592 € avant IR et prélèvements annexes : le seuil du scénario est donc de 11 jours. Ce résultat suppose que les factures sont encaissées ; il ne traite pas les délais de paiement.'
    },
    '/outils/salaire-cdi-vers-tjm/': {
      title: 'Comparer deux situations sur une année complète',
      method: 'Saisissez le salaire mensuel net avant prélèvement à la source que vous souhaitez remplacer. Annualisez les avantages que vous voulez financer vous-même : prime, mutuelle ou équipement, en évitant de compter deux fois une prime déjà comprise dans votre revenu cible. Les jours correspondent à une moyenne annuelle : 180 jours vendables font 15 jours par mois, même si les mois de mission sont plus chargés.',
      example: 'Cas fictif en micro-BNC hors Cipav, sans ACRE : remplacer 3 000 € de revenu mensuel avant IR, ajouter 2 400 € d’avantages par an et financer 500 € de frais par mois nécessite (3 000 + 200 + 500) ÷ 0,744 ÷ 15 = 331,55 € HT par jour pour 180 jours vendus par an. Avec seulement 150 jours sur l’année, le seuil monte à 397,85 €. Ni ce tarif ni le revenu cible n’incluent l’IR, la CFP ou la CFE ; prévoyez une provision adaptée.',
      extra: '<h3>Ce qu’un écart de revenu ne mesure pas</h3><p>Le CDI et l’activité indépendante diffèrent par le risque commercial, les droits au chômage, le financement de la retraite, la couverture des arrêts de travail et le temps de gestion. Le tarif calculé finance un budget ; il ne transforme pas ces protections en garanties équivalentes. Comparez aussi le préavis de fin de mission, le délai de paiement et la concentration du chiffre d’affaires sur un seul client.</p><p>Confrontez le scénario à un <a href="/outils/budget-annuel-freelance/">budget avec réserve</a> et gardez une hypothèse de capacité prudente. Les avantages annuels ajoutés ici sont une somme à financer, pas un calcul fiscal de leur équivalence exacte.</p>'
    }
  };
  const copy = guides[route];
  if (!copy) return html;
  let next = html.replace(/<section class="content-section card" id="methode-de-calcul">[\s\S]*?<\/section>/, `<section class="content-section card" id="methode-de-calcul"><h2>${copy.title}</h2><p>${copy.method}</p>${copy.extra || ''}</section>`);
  next = next.replace(/<section class="content-section card" id="exemple-d-utilisation">[\s\S]*?<\/section>/, `<section class="content-section card" id="exemple-d-utilisation"><h2>Cas chiffré et limites</h2><p>${copy.example}</p><p>En portage, ce modèle exclut les remboursements de frais : demandez une simulation à la société de portage. Les autres statuts utilisent des taux moyens et ne reconstituent pas les cotisations réelles.</p></section>`);
  return next.replace(/"dateModified":"[^"]+"/g, `"dateModified":"${LAST_REVIEW_DATE}"`).replace(/Mis à jour le <time datetime="[^"]+">[^<]+<\/time>/, `Mis à jour le <time datetime="${LAST_REVIEW_DATE}">${reviewDateLabel}</time>`);
}

function addEditorialPolicyToFooter(html) {
  if (html.includes('href="/politique-editoriale/"')) return html;
  return html.replaceAll(
    '<a href="/politique-de-confidentialite/">Confidentialité</a>',
    '<a href="/politique-editoriale/">Politique éditoriale</a><a href="/politique-de-confidentialite/">Confidentialité</a>'
  );
}

function applySeoMeta(html, route) {
  const policy = getSeoPolicy(route);
  let next = html;
  if (/<meta\s+name="robots"[^>]*>/i.test(next)) {
    next = next.replace(/<meta\s+name="robots"[^>]*>/i, `<meta name="robots" content="${policy.robots}">`);
  } else if (/<meta\s+name="description"[^>]*>/i.test(next)) {
    next = next.replace(/(<meta\s+name="description"[^>]*>)/i, `$1\n  <meta name="robots" content="${policy.robots}">`);
  }
  if (policy.canonical) {
    if (/<link\s+rel="canonical"[^>]*>/i.test(next)) {
      next = next.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${policy.canonical}">`);
    } else {
      next = next.replace(/(<meta\s+name="robots"[^>]*>)/i, `$1\n  <link rel="canonical" href="${policy.canonical}">`);
    }
    next = next.replace(/<meta\s+property="og:url"\s+content="[^"]*">/i, `<meta property="og:url" content="${policy.canonical}">`);
  }
  return next;
}

function applyGlobalHtmlUpdates() {
  for (const file of walkHtml()) {
    const route = routeFromHtmlFile(file, rootDir);
    const target = getConsolidationTarget(route);
    if (target) {
      fs.writeFileSync(file, renderRedirectPage(route, target), 'utf8');
      continue;
    }
    let html = fs.readFileSync(file, 'utf8');
    html = html.replace(/href="(\/[^\"]*)"/g, (match, href) => {
      const destination = getConsolidationTarget(href);
      return destination ? `href="${escapeHtml(destination)}"` : match;
    });
    html = html.replace(/href="\/revenus\/tjm-(\d+)-salaire-net\/"/g, (_, amount) => `href="/?tjm=${amount}#form-card"`);
    html = html.replaceAll('href="/barometre/">Baromètre</a>', 'href="/barometre/">Comparer les tarifs</a>');
    html = html.replaceAll('href="/sources/#urssaf-cipav-2026"', 'href="/sources/#urssaf-micro-2026"');
    html = html.replaceAll('<script src="/assets/tools.js" defer></script>', '<script type="module" src="/assets/tools.js"></script>');
    if (route === '/outils/' && !html.includes('href="/outils/budget-annuel-freelance/"')) {
      html = html.replace('<div class="card-grid">', '<div class="card-grid"><article class="link-card"><h2><a href="/outils/budget-annuel-freelance/">Budget annuel et réserve</a></h2><p>Financer douze mois de revenu avec vos jours réellement vendables : frais, réserve, scénarios et export CSV.</p></article>');
    }
    if (route === '/guides/' && !html.includes('href="/guides/micro-entreprise-cotisations-impot-tva/"')) {
      html = html.replace('<div class="card-grid">', '<div class="card-grid"><article class="link-card"><h2><a href="/guides/micro-entreprise-cotisations-impot-tva/">Cotisations, IR et TVA en micro</a></h2><p>Un cas à 50 000 € de CA, le traitement des frais, l’ACRE et les seuils : distinguer chaque calcul.</p></article>');
    }
    html = html.replaceAll('href="/revenus/"', 'href="/tjm-en-salaire-net/"');
    html = html.replaceAll('href="/guides/convertir-tjm-en-salaire-net/"', 'href="/tjm-en-salaire-net/"');
    html = addEditorialPolicyToFooter(html);
    html = applySeoMeta(html, route);
    html = updateGuideArticle(html, route);
    html = updateStatusArticle(html, route);
    html = improveToolExplanation(html, route);
    fs.writeFileSync(file, html, 'utf8');
  }
}

function renderGuideFeed() {
  const items = walkHtml().map(file => ({ file, route: routeFromHtmlFile(file, rootDir) }))
    .filter(({ route }) => route.startsWith('/guides/') && route !== '/guides/' && getSeoPolicy(route).indexable)
    .map(({ file, route }) => {
      const html = fs.readFileSync(file, 'utf8');
      const title = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, '') || 'Guide TJMCalc';
      const date = html.match(/"datePublished":"(\d{4}-\d{2}-\d{2})"/)?.[1];
      return `<item><title>${escapeHtml(title)}</title><link>${SITE_ORIGIN}${route}</link><guid>${SITE_ORIGIN}${route}</guid>${date ? `<pubDate>${new Date(`${date}T12:00:00Z`).toUTCString()}</pubDate>` : ''}</item>`;
    });
  writeUtf8('guides/feed.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Guides TJMCalc</title><link>${SITE_ORIGIN}/guides/</link><description>Méthodes et cas pratiques pour piloter son activité.</description><language>fr</language>${items.join('')}</channel></rss>\n`);
}

function renderSitemap() {
  const routes = walkHtml()
    .map((file) => routeFromHtmlFile(file, rootDir))
    .filter((route) => route !== '/404.html');
  const sitemapRoutes = getSitemapRoutes(routes);
  const body = sitemapRoutes.map((route) => {
    const file = path.join(rootDir, route === '/' ? 'index.html' : `${route.slice(1)}index.html`);
    const html = fs.readFileSync(file, 'utf8');
    const modified = html.match(/"dateModified":"(\d{4}-\d{2}-\d{2})"/)?.[1] || html.match(/<time datetime="(\d{4}-\d{2}-\d{2})"/)?.[1];
    return `  <url><loc>${SITE_ORIGIN}${route}</loc>${modified ? `<lastmod>${modified}</lastmod>` : ''}</url>`;
  }).join('\n');
  writeUtf8('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
}

writeUtf8('tjm-en-salaire-net/index.html', renderMainTjmNetPage());
writeUtf8('a-propos/index.html', renderAboutPage());
writeUtf8('methodologie/index.html', renderMethodologyPage());
writeUtf8('sources/index.html', renderSourcesPage());
writeUtf8('politique-editoriale/index.html', renderEditorialPolicyPage());
writeUtf8('outils/budget-annuel-freelance/index.html', renderAnnualBudgetPage());
writeUtf8('barometre/index.html', renderPriceComparisonPage());
writeUtf8('guides/micro-entreprise-cotisations-impot-tva/index.html', renderMicroGuide());
updateHomePage();
applyGlobalHtmlUpdates();
renderSitemap();
renderGuideFeed();

console.log('Pages rendered and SEO policy applied.');
