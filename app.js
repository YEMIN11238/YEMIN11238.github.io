(() => {
  'use strict';
  const root = document.documentElement;
  const bootScreen = document.getElementById('boot-screen');
  const desktop = document.getElementById('desktop');
  const enterButton = document.getElementById('enter-desktop');
  const skipButton = document.getElementById('skip-boot');
  const restartButton = document.getElementById('restart-button');
  const themeButton = document.getElementById('theme-toggle');
  const mainWindow = document.getElementById('main-content');
  const documentArea = mainWindow.querySelector('.window-content');
  const views = [...document.querySelectorAll('.view')];
  const rows = [...document.querySelectorAll('.boot-row')];
  const viewNames = { about: '关于我', works: '产品与实验', tools: '工具与 Skill', notes: '记录与分享', contact: '找到我' };
  const filenames = { about: 'about.md', works: 'products / index', tools: 'tools / index', notes: 'notes / index', contact: 'contact.md' };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const bootKey = 'yemin-visited-motion-2';
  let activeView = null;
  let viewAnimation = null;
  let bootController = null;
  let launchTimer = 0;
  let epoch = 0;
  let bootPhase = 'closed';

  function storageGet(key) { try { return sessionStorage.getItem(key); } catch (_) { return null; } }
  function storageSet(key, value) { try { sessionStorage.setItem(key, value); } catch (_) { /* Storage is optional. */ } }
  function announce(text) { document.getElementById('view-announcement').textContent = text; }
  function emitView(view) { document.dispatchEvent(new CustomEvent('yemin:viewchange', { detail: { view } })); }

  function switchView(nextView, moveFocus = false) {
    const next = Object.hasOwn(viewNames, nextView) ? nextView : 'about';
    if (next === activeView) return;
    const first = activeView === null;
    activeView = next;
    if (viewAnimation) viewAnimation.cancel();
    views.forEach(view => {
      const active = view.id === next;
      view.classList.toggle('active', active);
      view.setAttribute('aria-hidden', String(!active));
      view.inert = !active;
    });
    document.querySelectorAll('[data-view]').forEach(link => {
      if (link.dataset.view === next) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.getElementById('window-title').textContent = filenames[next];
    document.getElementById('status-view').textContent = `cat ${filenames[next]}`;
    document.title = `${viewNames[next]} · 张俊豪 — 个人工作台`;
    announce(`已打开${viewNames[next]}`);
    if (documentArea) documentArea.scrollTop = 0;
    if (!first && !reduced.matches && typeof Element.prototype.animate === 'function') {
      const view = document.getElementById(next);
      viewAnimation = view.animate([
        { opacity: 0, transform: 'translateY(14px)', filter: 'blur(2px)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }
      ], { duration: 430, easing: 'cubic-bezier(.2,.8,.25,1)' });
    }
    if (moveFocus) {
      mainWindow.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    emitView(next);
  }

  function navigate(view) {
    if (!Object.hasOwn(viewNames, view)) return;
    if (location.hash !== `#${view}`) history.pushState(null, '', `#${view}`);
    switchView(view, true);
  }

  function stopBootWork() {
    epoch += 1;
    bootController?.abort();
    bootController = null;
    clearTimeout(launchTimer);
    launchTimer = 0;
  }

  function wait(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      const onAbort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, ms);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  function completeTranscript() {
    rows.forEach(row => {
      row.classList.add('is-visible');
      const typed = row.querySelector('[data-type]');
      if (typed) { typed.textContent = typed.dataset.type; typed.classList.remove('is-typing'); }
    });
    rows.at(-1)?.querySelector('[data-type]')?.classList.add('is-typing');
    document.getElementById('boot-state').textContent = 'SYSTEM READY · 按 Enter 进入';
    bootScreen.dataset.phase = 'ready';
  }

  async function runTranscript(signal) {
    try {
      await wait(220, signal);
      for (const row of rows) {
        const typed = row.querySelector('[data-type]');
        row.classList.add('is-visible');
        if (typed) {
          rows.forEach(item => item.querySelector('.is-typing')?.classList.remove('is-typing'));
          typed.classList.add('is-typing');
          for (const character of Array.from(typed.dataset.type)) {
            await wait(25, signal);
            typed.textContent += character;
          }
          await wait(110, signal);
        } else await wait(row.classList.contains('boot-system') ? 105 : 155, signal);
        const transcript = document.getElementById('boot-transcript');
        if (transcript.scrollHeight > transcript.clientHeight) transcript.scrollTop = transcript.scrollHeight;
      }
      if (!signal.aborted) { completeTranscript(); bootPhase = 'ready'; }
    } catch (error) { if (error.name !== 'AbortError') throw error; }
  }

  function finishLaunch(run) {
    if (run !== epoch || bootPhase !== 'launching') return;
    bootScreen.hidden = true;
    bootScreen.classList.remove('is-leaving');
    root.classList.remove('launching');
    desktop.inert = false;
    desktop.removeAttribute('aria-hidden');
    bootPhase = 'closed';
    storageSet(bootKey, '1');
    mainWindow.focus({ preventScroll: true });
    announce('工作台已就绪');
    document.dispatchEvent(new CustomEvent('yemin:desktopready', { detail: { view: activeView } }));
    emitView(activeView);
  }

  function openDesktop() {
    if (bootPhase === 'closed' || bootPhase === 'launching') return;
    stopBootWork();
    const run = epoch;
    completeTranscript();
    bootPhase = 'launching';
    bootScreen.dataset.phase = 'launching';
    document.getElementById('boot-state').textContent = '> Launching personal workspace…';
    root.classList.add('launching');
    root.classList.remove('booting');
    bootScreen.classList.add('is-leaving');
    if (reduced.matches) finishLaunch(run);
    else launchTimer = setTimeout(() => finishLaunch(run), 780);
  }

  function showBoot() {
    stopBootWork();
    viewAnimation?.cancel();
    root.classList.remove('launching');
    root.classList.add('booting');
    bootScreen.hidden = false;
    bootScreen.classList.remove('is-leaving');
    bootScreen.dataset.phase = 'typing';
    desktop.inert = true;
    desktop.setAttribute('aria-hidden', 'true');
    bootPhase = 'typing';
    rows.forEach(row => {
      row.classList.remove('is-visible');
      const typed = row.querySelector('[data-type]');
      if (typed) { typed.textContent = ''; typed.classList.remove('is-typing'); }
    });
    document.getElementById('boot-transcript').scrollTop = 0;
    document.getElementById('boot-state').textContent = '正在载入，可随时进入';
    enterButton.focus({ preventScroll: true });
    if (reduced.matches) { completeTranscript(); bootPhase = 'ready'; }
    else {
      bootController = new AbortController();
      void runTranscript(bootController.signal);
    }
  }

  function updateThemeLabel() {
    const dark = root.dataset.theme === 'dark';
    themeButton.setAttribute('aria-pressed', String(dark));
    themeButton.setAttribute('aria-label', `切换为${dark ? '浅色' : '深色'}主题`);
    document.querySelector('meta[name="theme-color"]').content = dark ? '#192330' : '#edf1f5';
  }
  function toggleTheme() {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('yemin-theme', root.dataset.theme); } catch (_) { /* Theme remains usable without storage. */ }
    updateThemeLabel();
  }
  function updateClock() {
    const now = new Date();
    const clock = document.getElementById('system-clock');
    clock.textContent = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    clock.dateTime = now.toISOString();
  }

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    const target = link.getAttribute('href').slice(1);
    if (!Object.hasOwn(viewNames, target)) return;
    link.addEventListener('click', event => { event.preventDefault(); navigate(target); });
  });
  const followHistory = () => switchView(location.hash.slice(1));
  window.addEventListener('hashchange', followHistory);
  window.addEventListener('popstate', followHistory);
  enterButton.addEventListener('click', openDesktop);
  skipButton.addEventListener('click', openDesktop);
  restartButton.addEventListener('click', showBoot);
  themeButton.addEventListener('click', toggleTheme);
  document.addEventListener('keydown', event => {
    const editable = event.target instanceof HTMLElement && (event.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName));
    if (editable || event.metaKey || event.ctrlKey || event.altKey) return;
    if (bootPhase !== 'closed') {
      if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); openDesktop(); }
      if (event.key === 'Tab') {
        event.preventDefault();
        const current = document.activeElement;
        (current === enterButton ? skipButton : enterButton).focus();
      }
      return;
    }
    const next = ({ '1': 'about', '2': 'works', '3': 'tools', '4': 'notes', '5': 'contact' })[event.key];
    if (next) { event.preventDefault(); navigate(next); }
    else if (event.key.toLowerCase() === 'd') toggleTheme();
  });

  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  filterButtons.forEach(button => button.addEventListener('click', () => {
    const category = button.dataset.filter;
    filterButtons.forEach(item => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
    let count = 0;
    document.querySelectorAll('#works .project-card').forEach(card => {
      card.hidden = category !== 'all' && card.dataset.category !== category;
      if (!card.hidden) count += 1;
    });
    document.dispatchEvent(new CustomEvent('yemin:filterchange', { detail: { category, view: 'works' } }));
    announce(`显示 ${count} 个${button.textContent === '全部' ? '' : button.textContent}作品`);
  }));
  reduced.addEventListener('change', () => {
    viewAnimation?.cancel();
    if (bootPhase === 'typing' && reduced.matches) {
      bootController?.abort();
      completeTranscript();
      bootPhase = 'ready';
    } else if (bootPhase === 'launching' && reduced.matches) finishLaunch(epoch);
  });

  switchView(location.hash.slice(1));
  updateClock(); updateThemeLabel();
  setInterval(updateClock, 30_000);
  if (storageGet(bootKey) === '1' || Object.hasOwn(viewNames, location.hash.slice(1))) bootScreen.hidden = true;
  else showBoot();
})();
