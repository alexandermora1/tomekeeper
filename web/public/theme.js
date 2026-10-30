// Sets data-theme and data-script on <html> before the page is drawn (see index.html).
// The same rules live in src/theme/preferences.ts; keep them in step.
(function () {
  var root = document.documentElement;
  var theme = null;
  var script = null;
  try {
    theme = localStorage.getItem('tomekeeper.theme');
    script = localStorage.getItem('tomekeeper.script');
  } catch (e) {}
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-script', script === 'plain' ? 'plain' : 'decorative');
})();
