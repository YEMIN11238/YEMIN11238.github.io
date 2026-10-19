(() => {
  'use strict';

  const root = document.documentElement;
  const bootScreen = document.getElementById('boot-screen');
  const desktop = document.getElementById('desktop');
  const enterButton = document.getElementById('enter-desktop');
  const restartButton = document.getElementById('restart-button');
  const themeButton = document.getElementById('theme-toggle');
  const mainWindow = document.getElementById('main-content');
  const views = [...document.querySelectorAll('.view')];
  const viewNames = { about: '关于我', works: '产品与实验', tools: '工具与 Skill', notes: '记录与分享', contact: '找到我' };
  const filenames = { about: 'about.md', works: 'products / index', tools: 'tools / index', notes: 'notes / index', contact: 'contact.md' };
  let isBooting = false;

  function storageGet(key) {
    try { return window.sessionStorage.getItem(key); } catch (_) { return null; }
  }
  function storageSet(key, value) {
    try { window.sessionStorage.setItem(key, value); } catch (_) { /* The site also works without storage. */ }
  }

  function switchView(nextView, moveFocus = false) {
    const next = Object.hasOwn(viewNames, nextView) ? nextView : 'about';
    views.forEach((view) => {
      const active = view.id === next;
      view.classList.toggle('active', active);
      view.setAttribute('aria-hidden', String(!active));
    });
    document.querySelectorAll('[data-view]').forEach((link) => {
      if (link.dataset.view === next) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.getElementById('window-title').textContent = filenames[next];
    document.getElementById('status-view').textContent = `cat ${filenames[next]}`;
    document.title = `${viewNames[next]} · YEMIN — 个人工作台`;
    document.getElementById('view-announcement').textContent = `已打开${viewNames[next]}`;
    if (moveFocus) {
      mainWindow.focus({ preventScroll: true });
      const documentArea = mainWindow.querySelector('.window-content');
      if (documentArea) documentArea.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  function openDesktop() {
    if (!isBooting) return;
    isBooting = false;
    bootScreen.hidden = true;
    root.classList.remove('booting');
    desktop.inert = false;
    desktop.removeAttribute('aria-hidden');
    storageSet('yemin-visited', '1');
    mainWindow.focus({ preventScroll: true });
  }

  function showBoot() {
    isBooting = true;
    root.classList.add('booting');
    bootScreen.hidden = false;
    desktop.inert = true;
    desktop.setAttribute('aria-hidden', 'true');
    enterButton.focus({ preventScroll: true });
  }

  function updateThemeLabel() {
    const dark = root.dataset.theme === 'dark';
    themeButton.setAttribute('aria-pressed', String(dark));
    themeButton.setAttribute('aria-label', `切换为${dark ? '浅色' : '深色'}主题`);
    document.querySelector('meta[name="theme-color"]').content = dark ? '#192330' : '#edf1f5';
  }

  function toggleTheme() {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { window.localStorage.setItem('yemin-theme', next); } catch (_) { /* Keep the in-memory setting. */ }
    updateThemeLabel();
  }

  function updateClock() {
    const now = new Date();
    document.getElementById('system-clock').textContent = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', weekday: 'short',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(now);
    document.getElementById('system-clock').dateTime = now.toISOString();
    
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const target = link.getAttribute('href').slice(1);
    if (!Object.hasOwn(viewNames, target)) return;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (window.location.hash !== `#${target}`) window.location.hash = target;
      switchView(target, true);
    });
  });

  window.addEventListener('hashchange', () => switchView(window.location.hash.slice(1)));
  enterButton.addEventListener('click', openDesktop);
  restartButton.addEventListener('click', showBoot);
  themeButton.addEventListener('click', toggleTheme);
  document.addEventListener('keydown', (event) => {
    const editable = event.target instanceof HTMLElement && (event.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName));
    if (editable || event.metaKey || event.ctrlKey || event.altKey) return;
    if (isBooting) {
      if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); openDesktop(); }
      else if (event.key === 'Tab') { event.preventDefault(); enterButton.focus(); }
      return;
    }
    const next = ({ '1': 'about', '2': 'works', '3': 'tools', '4': 'notes', '5': 'contact' })[event.key];
    if (next) {
      window.location.hash = next;
      switchView(next, true);
    } else if (event.key.toLowerCase() === 'd') toggleTheme();
  });

  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  filterButtons.forEach((button) => button.addEventListener('click', () => {
    const category = button.dataset.filter;
    filterButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    let count = 0;
    document.querySelectorAll('#works .project-card').forEach((card) => {
      card.hidden = category !== 'all' && card.dataset.category !== category;
      if (!card.hidden) count += 1;
    });
    document.getElementById('view-announcement').textContent = `显示 ${count} 个${button.textContent === '全部' ? '' : button.textContent}作品`;
  }));


  switchView(window.location.hash.slice(1));
  updateClock();
  updateThemeLabel();
  window.setInterval(updateClock, 30_000);
  if (storageGet('yemin-visited') === '1' || Object.hasOwn(viewNames, window.location.hash.slice(1))) {
    bootScreen.hidden = true;
  } else showBoot();
})();
