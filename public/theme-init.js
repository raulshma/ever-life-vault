(function () {
  try {
    var stored = localStorage.getItem('themeMode');
    var mode = stored || 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Always clear previous state
    document.documentElement.classList.remove('amoled');

    var isDark = mode === 'dark' || mode === 'amoled' || (mode === 'system' && prefersDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
      if (mode === 'amoled') {
        document.documentElement.classList.add('amoled');
      }
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();



