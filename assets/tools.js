import { calculateRevenue, solveTjm, resolveContributionRate, annualBudget, nonNegative, formatEuros as euro } from './calculator.mjs';

const number = id => nonNegative(document.getElementById(id)?.value);
const result = document.querySelector('#tool-result');
const form = document.querySelector('[data-tool]');
let budget = null;

function render() {
  if (!form || !result) return;
  const mode = form.dataset.tool;
  const status = document.querySelector('#status')?.value || 'micro';
  const days = number('days');
  const expenses = number('expenses');
  const note = status === 'portage' ? '<p>Les remboursements de frais ne sont pas modélisés en portage. Le taux de 52 % regroupe des cotisations et des frais de gestion estimés.</p>' : '';
  if (['salaryToTjm', 'netToTjm', 'breakEven'].includes(mode)) {
    const target = mode === 'salaryToTjm' ? number('salary') + number('benefits') / 12 : number('target');
    const divisor = mode === 'breakEven' ? number('tjm') : days;
    const value = solveTjm({ target, days: divisor, status, expenses });
    if (value === null) {
      result.innerHTML = '<span>Simulation impossible</span><p>Renseignez un nombre de jours ou un TJM supérieur à zéro pour calculer votre objectif.</p>';
      return;
    }
    const output = mode === 'breakEven' ? `${Math.ceil(value)} jours facturés` : `${(Math.ceil(value * 100 - 1e-9) / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} HT / jour`;
    result.innerHTML = `<span>${mode === 'breakEven' ? 'Seuil mensuel estimé' : 'TJM nécessaire avant impôt'}</span><strong>${output}</strong><p>Objectif : ${euro(target)} disponibles par mois, après ${status === 'portage' ? 'les retenues estimées' : `${euro(expenses)} de frais et les cotisations estimées`}. Taux utilisé : ${(resolveContributionRate(status) * 100).toLocaleString('fr-FR')} %.</p>${note}`;
  } else if (mode === 'tjmToHourly') {
    const hours = number('hours');
    result.innerHTML = hours ? `<span>Taux horaire équivalent</span><strong>${euro(number('tjm') / hours)} / h</strong><p>Une journée correspond ici à ${hours.toLocaleString('fr-FR')} heures facturables.</p>` : '<span>Simulation impossible</span><p>La durée de la journée doit être supérieure à zéro.</p>';
  } else if (mode === 'hourlyToTjm') {
    result.innerHTML = `<span>TJM équivalent</span><strong>${euro(number('hourly') * number('hours'))}</strong><p>Précisez la durée contractuelle de la journée dans votre proposition.</p>`;
  } else if (mode === 'billableDays') {
    const available = Math.max(0, number('working') - number('vacation') - number('admin') - number('training') - number('bench'));
    result.innerHTML = `<span>Capacité annuelle estimée</span><strong>${available} jours facturables</strong><p>Soit ${(available / 12).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} jours par mois en moyenne. Vérifiez que chaque journée n’est retirée qu’une seule fois.</p>`;
  } else if (mode === 'statusCompare') {
    const labels = { micro: 'Micro-entreprise BNC hors Cipav', ei: 'EI', eurl: 'EURL', sasu: 'SASU', portage: 'Portage salarial' };
    result.innerHTML = `<span>Comparaison mensuelle avant impôt</span><strong>${euro(number('tjm') * days)} de CA</strong><div class="table-wrap"><table><thead><tr><th>Statut</th><th class="number">Disponible estimé</th><th class="number">Taux utilisé</th></tr></thead><tbody>${Object.keys(labels).map(id => `<tr><td>${labels[id]}</td><td class="number">${euro(calculateRevenue({ tjm: number('tjm'), days, status: id, expenses }).netBeforeIncomeTax)}</td><td class="number">${(resolveContributionRate(id) * 100).toLocaleString('fr-FR')} %</td></tr>`).join('')}</tbody></table></div><p>Les frais diminuent le disponible en micro sans réduire les cotisations. En portage, les remboursements de frais sont exclus du modèle.</p>`;
  } else if (mode === 'annualBudget') {
    const params = { monthlyTarget: number('target'), monthlyExpenses: expenses, billableDays: number('annual-days'), reserveMonths: number('reserve-months'), microType: document.getElementById('micro-type').value };
    budget = annualBudget(params);
    document.getElementById('download-budget').disabled = budget.tjm === null;
    if (budget.tjm === null) {
      result.innerHTML = '<span>Aucun jour facturable</span><p>Ajoutez des jours facturables pour calculer un tarif. Sans facturation, le besoin doit être financé par une autre ressource.</p>';
      return;
    }
    const rows = [['Revenu annuel visé avant impôt', budget.annualTarget], ['Frais annuels', budget.annualExpenses], ['Réserve supplémentaire', budget.reserve], ['CA annuel à encaisser', budget.revenue], ['Cotisations estimées', budget.charges], ['Disponible après frais et réserve, avant IR', budget.available]];
    const sensitivity = [...new Set([Math.max(1, params.billableDays - 30), params.billableDays, params.billableDays + 30])];
    result.innerHTML = `<span>TJM minimum du budget annuel, hors taxe</span><strong>${budget.tjm.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} / jour</strong><p>Pour ${budget.days} jours encaissés sur l’année, avec ${(budget.rate * 100).toLocaleString('fr-FR')} % de cotisations micro-sociales, sans ACRE.</p><h3>Le financement de votre année</h3><dl class="budget-breakdown">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${euro(value)}</dd></div>`).join('')}</dl><div class="table-wrap"><table><caption>Si votre capacité change, à budget identique</caption><thead><tr><th>Jours / an</th><th>TJM HT nécessaire</th></tr></thead><tbody>${sensitivity.map(count => `<tr><td>${count}</td><td>${annualBudget({ ...params, billableDays: count }).tjm.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td></tr>`).join('')}</tbody></table></div><p>${budget.revenue > budget.microLimit ? `Le CA projeté dépasse ${euro(budget.microLimit)} : vérifiez les conditions du régime micro, l’historique de vos recettes et la TVA avant d’utiliser ce scénario.` : 'La franchise de TVA a ses propres seuils : un CA sous le plafond micro ne garantit pas une facturation sans TVA.'} L’impôt sur le revenu, la CFP et les taxes éventuelles restent à financer séparément.</p>`;
  }
}

form?.addEventListener('submit', event => event.preventDefault());
form?.addEventListener('input', render);
form?.addEventListener('change', render);
document.getElementById('download-budget')?.addEventListener('click', () => {
  if (!budget || budget.tjm === null) return;
  const data = [['Budget TJMCalc avant impôt', 'Valeur'], ['Date de simulation', new Date().toISOString().slice(0, 10)], ['Jours facturables', budget.days], ['TJM HT', budget.tjm], ['CA annuel', budget.revenue], ['Cotisations', budget.charges], ['Frais annuels', budget.annualExpenses], ['Réserve', budget.reserve], ['Disponible annuel avant IR', budget.available], ['Taux micro-social', budget.rate], ['Limites', 'Hors IR, CFP, TVA et taxes annexes; sans ACRE']];
  const csv = '\uFEFF' + data.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'budget-annuel-tjmcalc.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
render();
