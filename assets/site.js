(() => {
  const root = document.documentElement;
  const stored = localStorage.getItem('tjmcalc-theme');
  if (stored === 'light' || stored === 'dark') root.dataset.theme = stored;
  const themeButton = document.querySelector('.theme-toggle');
  themeButton?.addEventListener('click', () => {
    const darkNow = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme:dark)').matches);
    root.dataset.theme = darkNow ? 'light' : 'dark';
    localStorage.setItem('tjmcalc-theme', root.dataset.theme);
  });
  const navButton = document.querySelector('.nav-toggle');
  const nav = document.querySelector('#primary-nav');
  navButton?.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    navButton.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.protected-email[data-contact]').forEach(link => {
    const values = link.dataset.contact.split(',').map(value => Number(value));
    if (!values.length || values.some(value => !Number.isInteger(value))) return;
    const address = String.fromCharCode(...values);
    link.href = `mailto:${address}`;
    link.textContent = address;
    link.removeAttribute('data-contact');
  });
})();
