(() => {
  const KEY = 'jarvis.activePage.v1';
  const pages = () => new Set([...document.querySelectorAll('.page[id]')].map(x => x.id));
  const valid = id => !!id && pages().has(id);
  const hashPage = () => {
    const raw = decodeURIComponent(location.hash.replace(/^#\/?/, '').split('?')[0]);
    return valid(raw) ? raw : null;
  };
  const storedPage = () => {
    try {
      const v = localStorage.getItem(KEY);
      return valid(v) ? v : null;
    } catch { return null; }
  };
  const preferredPage = () => hashPage() || storedPage() || 'chat';
  const persist = id => {
    if (!valid(id)) return;
    try { localStorage.setItem(KEY, id); } catch {}
  };
  const setHash = (id, push = false) => {
    const target = '#/' + encodeURIComponent(id);
    if (location.hash === target) return;
    const fn = push ? history.pushState : history.replaceState;
    fn.call(history, { jarvisPage: id }, '', location.pathname + location.search + target);
  };

  const originalSwitchPage = window.switchPage;
  if (typeof originalSwitchPage !== 'function') return;

  let startupRedirectPending = true;
  let internalNavigation = false;

  window.switchPage = function(id, options = {}) {
    let target = valid(id) ? id : 'chat';

    // app.js always asks for chat after authentication. On first startup only,
    // replace that default with the user's last valid page/hash instead.
    if (startupRedirectPending && target === 'chat') {
      startupRedirectPending = false;
      target = preferredPage();
    } else if (startupRedirectPending) {
      startupRedirectPending = false;
    }

    const result = originalSwitchPage(target);
    persist(target);
    if (!internalNavigation) setHash(target, !!options.push);
    return result;
  };

  function navigateFromHistory() {
    const target = hashPage() || storedPage() || 'chat';
    if (!valid(target)) return;
    internalNavigation = true;
    try { window.switchPage(target); }
    finally { internalNavigation = false; }
  }

  // Replace the click handlers installed by app.js so tab changes also update
  // browser history while still using the same page loader logic.
  document.querySelectorAll('[data-page]').forEach(el => {
    el.onclick = event => {
      if (event) event.preventDefault();
      window.switchPage(el.dataset.page, { push: true });
    };
  });

  window.addEventListener('popstate', navigateFromHistory);
  window.addEventListener('hashchange', navigateFromHistory);
  window.addEventListener('pageshow', () => {
    // bfcache/page restore can otherwise show a stale active class.
    const target = preferredPage();
    const current = document.querySelector('.page.active')?.id;
    if (target && current && target !== current) navigateFromHistory();
  });
  window.addEventListener('beforeunload', () => {
    const current = document.querySelector('.page.active')?.id;
    if (current) persist(current);
  });

  // If authentication was already restored before this script executed,
  // synchronize once without forcing a page change while login is visible.
  queueMicrotask(() => {
    if (!document.querySelector('#app')?.classList.contains('hidden')) {
      const target = preferredPage();
      const current = document.querySelector('.page.active')?.id;
      if (target && target !== current) navigateFromHistory();
      else if (current) { persist(current); setHash(current, false); }
    }
  });
})();
