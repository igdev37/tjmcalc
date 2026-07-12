const rates = { micro:0.256, ei:0.42, eurl:0.42, sasu:0.55, portage:0.52 };
const euro = value => new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR', maximumFractionDigits:0 }).format(Math.round(value || 0));
const number = id => Number(document.querySelector(`#${id}`)?.value) || 0;
const result = document.querySelector('#tool-result');
const form = document.querySelector('[data-tool]');

function net(tjm, days, status, expenses = 0) {
  const revenue = Math.max(0, tjm * days);
  const deductible = status === 'micro' || status === 'portage' ? 0 : Math.min(Math.max(0, expenses), revenue);
  return (revenue - deductible) * (1 - rates[status]);
}

function solve(target, days, status, expenses = 0) {
  if (!days) return 0;
  return (target / (1 - rates[status]) + (status === 'micro' || status === 'portage' ? 0 : expenses)) / days;
}

function render() {
  if (!form || !result) return;
  const mode = form.dataset.tool;
  const status = document.querySelector('#status')?.value || 'micro';
  if (mode === 'salaryToTjm') {
    const salary = number('salary');
    const benefits = number('benefits');
    const days = number('days');
    const target = salary + benefits / 12;
    result.innerHTML = `<span>TJM indicatif à viser</span><strong>${euro(solve(target, days, status, number('expenses')))}</strong><p>Objectif freelance retenu : ${euro(target)} nets avant impôt par mois, avantages annualisés inclus.</p>`;
  } else if (mode === 'netToTjm') {
    const target = number('target');
    result.innerHTML = `<span>TJM nécessaire avant impôt</span><strong>${euro(solve(target, number('days'), status, number('expenses')))}</strong><p>Calcul avec un taux de charges pédagogique de ${Math.round(rates[status] * 100)} %.</p>`;
  } else if (mode === 'tjmToHourly') {
    const hours = Math.max(.5, number('hours'));
    result.innerHTML = `<span>Taux horaire équivalent</span><strong>${euro(number('tjm') / hours)} / h</strong><p>Une journée est ici définie comme ${hours.toLocaleString('fr-FR')} heures facturables.</p>`;
  } else if (mode === 'hourlyToTjm') {
    result.innerHTML = `<span>TJM équivalent</span><strong>${euro(number('hourly') * number('hours'))}</strong><p>Précisez toujours la durée contractuelle de la journée dans votre proposition.</p>`;
  } else if (mode === 'breakEven') {
    const tjm = number('tjm');
    const target = number('target');
    const expenses = number('expenses');
    const needed = tjm ? Math.ceil((target / (1 - rates[status]) + (status === 'micro' || status === 'portage' ? 0 : expenses)) / tjm) : 0;
    result.innerHTML = `<span>Seuil mensuel estimé</span><strong>${needed} jours facturés</strong><p>À ${euro(tjm)} par jour, pour couvrir ${euro(target)} nets avant impôt${expenses ? ` et ${euro(expenses)} de frais` : ''}.</p>`;
  } else if (mode === 'billableDays') {
    const available = Math.max(0, number('working') - number('vacation') - number('admin') - number('training') - number('bench'));
    result.innerHTML = `<span>Capacité annuelle réaliste</span><strong>${available} jours facturables</strong><p>Soit ${(available / 12).toLocaleString('fr-FR', { maximumFractionDigits:1 })} jours par mois en moyenne.</p>`;
  } else if (mode === 'statusCompare') {
    const tjm = number('tjm');
    const days = number('days');
    const expenses = number('expenses');
    const labels = { micro:'Micro-entreprise', ei:'EI', eurl:'EURL', sasu:'SASU', portage:'Portage salarial' };
    result.innerHTML = `<span>Comparaison mensuelle avant impôt</span><strong>${euro(tjm * days)} de CA</strong><div class="table-wrap"><table><thead><tr><th>Statut</th><th class="number">Net estimé</th><th class="number">Taux utilisé</th></tr></thead><tbody>${Object.keys(labels).map(id => `<tr><td>${labels[id]}</td><td class="number">${euro(net(tjm, days, id, expenses))}</td><td class="number">${Math.round(rates[id] * 100)} %</td></tr>`).join('')}</tbody></table></div>`;
  }
}

form?.addEventListener('input', render);
form?.addEventListener('change', render);
render();
