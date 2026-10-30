// Modèle pédagogique commun aux tableaux et aux outils du site.
export const MICRO_RATES = { vente: 0.123, service: 0.212, liberale: 0.256, cipav: 0.232 };
export const STATUS_RATES = { micro: null, ei: 0.42, eurl: 0.42, sarl: 0.42, sasu: 0.55, sas: 0.55, portage: 0.52 };
export const STATUS_LABELS = { micro: 'Micro-entreprise', ei: 'Entreprise individuelle', eurl: 'EURL', sarl: 'SARL', sasu: 'SASU', sas: 'SAS', portage: 'Portage salarial' };

export function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function formatEuros(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(Number(value) || 0));
}

export function resolveContributionRate(status, microType = 'liberale', acre = false) {
  if (status === 'micro') {
    const rate = MICRO_RATES[microType] ?? MICRO_RATES.liberale;
    // Hypothèse ACRE des créations à compter du 1er juillet 2026 seulement.
    return acre ? rate * 0.75 : rate;
  }
  return STATUS_RATES[status] ?? STATUS_RATES.ei;
}

export function calculateRevenue({ tjm, days, status = 'micro', microType = 'liberale', expenses = 0, acre = false }) {
  const safeTjm = nonNegative(tjm);
  const safeDays = nonNegative(days);
  const revenue = safeTjm * safeDays;
  // Une dépense ne disparaît pas quand elle dépasse le chiffre d'affaires.
  const safeExpenses = status === 'portage' ? 0 : nonNegative(expenses);
  const rate = resolveContributionRate(status, microType, acre);
  const contributionBase = status === 'micro' ? revenue : Math.max(0, revenue - safeExpenses);
  const charges = contributionBase * rate;
  const netBeforeIncomeTax = revenue - safeExpenses - charges;
  return { tjm: safeTjm, days: safeDays, status, microType, rate, revenue, annualRevenue: revenue * 12, expenses: safeExpenses, charges, netBeforeIncomeTax, annualNetBeforeIncomeTax: netBeforeIncomeTax * 12 };
}

export function solveTjm({ target, days, status = 'micro', expenses = 0, microType = 'liberale', acre = false }) {
  const safeDays = nonNegative(days);
  if (!safeDays) return null;
  const rate = resolveContributionRate(status, microType, acre);
  const costs = status === 'portage' ? 0 : nonNegative(expenses);
  const need = nonNegative(target);
  const revenue = status === 'micro' ? (need + costs) / (1 - rate) : need / (1 - rate) + costs;
  return revenue / safeDays;
}

export function compareStatuses(params) {
  return ['micro', 'ei', 'eurl', 'sasu', 'portage'].map(status => ({ ...calculateRevenue({ ...params, status }), label: STATUS_LABELS[status] }));
}

export function annualBudget({ monthlyTarget, monthlyExpenses, billableDays, reserveMonths = 0, microType = 'liberale' }) {
  const annualTarget = nonNegative(monthlyTarget) * 12;
  const annualExpenses = nonNegative(monthlyExpenses) * 12;
  const reserve = nonNegative(monthlyTarget) * nonNegative(reserveMonths);
  const rate = resolveContributionRate('micro', microType);
  const revenueNeeded = (annualTarget + annualExpenses + reserve) / (1 - rate);
  const days = nonNegative(billableDays);
  const tjm = days ? Math.ceil((revenueNeeded / days) * 100 - 1e-9) / 100 : null;
  const revenue = tjm === null ? 0 : tjm * days;
  const charges = revenue * rate;
  return { annualTarget, annualExpenses, reserve, rate, revenueNeeded, days, tjm, revenue, charges, available: revenue - charges - annualExpenses - reserve, microLimit: microType === 'vente' ? 203100 : 83600 };
}
