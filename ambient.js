(() => {
  'use strict';

  const about = document.getElementById('about');
  const system = about?.querySelector('.creation-system');
  const canvas = system?.querySelector('.system-canvas');
  const core = system?.querySelector('.system-core');
  const inputs = [...(system?.querySelectorAll('.system-small-node') || [])];
  const outputs = [...(system?.querySelectorAll('.output-node') || [])];
  const avatar = about?.querySelector('.intro-avatar');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dragViewport = window.matchMedia('(min-width: 791px)');
  const animations = new Set();
  let selected = -1;
  let lastEvent;
  let entryAt = 0;
  let pointer = null;
  let avatarAnimation;
  let resizeFrame = 0;

  function runAnimation(element, frames, options) {
    if (!element?.animate || reduceMotion.matches) return null;
    const animation = element.animate(frames, options);
    animations.add(animation);
    animation.finished.catch(() => {}).finally(() => animations.delete(animation));
    return animation;
  }

  if (canvas && core && outputs.length) {
    system.classList.add('ambient-system');
    const ns = 'http://www.w3.org/2000/svg';
    const overlay = document.createElementNS(ns, 'svg');
    overlay.classList.add('ambient-wires');
    overlay.setAttribute('aria-hidden', 'true');
    const wires = [...inputs.map((node) => ({ from: node, to: core, lane: -1 })),
      ...outputs.map((node, lane) => ({ from: core, to: node, lane }))];
    wires.forEach((wire) => {
      wire.path = document.createElementNS(ns, 'path');
      wire.path.classList.add('ambient-wire');
      wire.path.dataset.lane = wire.lane;
      overlay.append(wire.path);
      wire.signal = document.createElementNS(ns, 'path');
      wire.signal.classList.add('ambient-wire-signal');
      wire.signal.dataset.lane = wire.lane;
      overlay.append(wire.signal);
    });
    canvas.prepend(overlay);

    function point(rect, parent) {
      return { x: rect.left - parent.left + rect.width / 2, y: rect.top - parent.top + rect.height / 2 };
    }
    function drawWires() {
      resizeFrame = 0;
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      overlay.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
      wires.forEach((wire) => {
        const from = wire.from.getBoundingClientRect();
        const to = wire.to.getBoundingClientRect();
        let a = point(from, bounds);
        let b = point(to, bounds);
        const horizontal = Math.abs(b.x - a.x) > Math.abs(b.y - a.y) * 0.8;
        let d;
        if (horizontal) {
          const direction = Math.sign(b.x - a.x) || 1;
          a.x += from.width / 2 * direction;
          b.x -= to.width / 2 * direction;
          const bend = Math.max(16, Math.abs(b.x - a.x) * 0.5);
          d = `M${a.x},${a.y} C${a.x + bend * direction},${a.y} ${b.x - bend * direction},${b.y} ${b.x},${b.y}`;
        } else {
          const direction = Math.sign(b.y - a.y) || 1;
          a.y += from.height / 2 * direction;
          b.y -= to.height / 2 * direction;
          const bend = Math.max(12, Math.abs(b.y - a.y) * 0.5);
          d = `M${a.x},${a.y} C${a.x},${a.y + bend * direction} ${b.x},${b.y - bend * direction} ${b.x},${b.y}`;
        }
        wire.path.setAttribute('d', d);
        wire.signal.setAttribute('d', d);
        wire.signal.setAttribute('pathLength', '100');
      });
    }
    function requestDraw() {
      if (!resizeFrame) resizeFrame = requestAnimationFrame(drawWires);
    }
    const footnote = system.querySelector('.system-footnote > span:last-child');
    const originalFootnote = footnote?.textContent;
    const descriptions = ['Pop 划词与 OCR · Wild Talker 双语阅读', '音乐概念站 · 四关横版游戏原型', 'Glass UI Skill · TO-DO 玻璃面板'];
    function selectLane(index) {
      if (index === selected) return;
      selected = index;
      system.dataset.activeLane = index < 0 ? '' : String(index);
      outputs.forEach((node, i) => node.classList.toggle('ambient-selected', i === index));
      wires.forEach((wire) => {
        const active = index >= 0 && (wire.lane < 0 || wire.lane === index);
        wire.path.classList.toggle('ambient-active', active);
        wire.signal.classList.toggle('ambient-active', active);
      });
      if (footnote) {
        footnote.textContent = index < 0 ? originalFootnote : descriptions[index];
        runAnimation(footnote, [{ opacity: 0.2, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
      }
    }
    outputs.forEach((node, index) => {
      node.addEventListener('pointerenter', () => selectLane(index));
      node.addEventListener('focus', () => selectLane(index));
    });
    system.addEventListener('pointerleave', () => {
      const focused = outputs.indexOf(document.activeElement);
      selectLane(focused);
    });
    system.addEventListener('focusout', () => {
      queueMicrotask(() => {
        if (!system.contains(document.activeElement) && !system.matches(':hover')) selectLane(-1);
      });
    });
    if (window.ResizeObserver) new ResizeObserver(requestDraw).observe(canvas);
    window.addEventListener('resize', requestDraw, { passive: true });
    system.addEventListener('ambient:layout', requestDraw);
    requestDraw();
  }

  function resetAvatar(animate = true) {
    if (!avatar) return;
    const current = avatar.style.transform || 'translate(0, 0) rotate(0deg)';
    pointer = null;
    avatar.classList.remove('avatar-dragging');
    avatar.style.removeProperty('transform');
    avatarAnimation?.cancel();
    if (animate && !reduceMotion.matches) {
      avatarAnimation = runAnimation(avatar, [
        { transform: current },
        { transform: 'translate(-3px, 0) rotate(-2deg)', offset: 0.45 },
        { transform: 'translate(2px, 0) rotate(1deg)', offset: 0.7 },
        { transform: 'translate(0, 0) rotate(0deg)' }
      ], { duration: 680, easing: 'cubic-bezier(.2,.65,.25,1)' });
    }
  }

  function enterAbout() {
    if (!about?.classList.contains('active') || document.documentElement.classList.contains('booting') || document.documentElement.classList.contains('launching')) return;
    const now = performance.now();
    if (now - entryAt < 450) return;
    entryAt = now;
    system?.dispatchEvent(new Event('ambient:layout'));
    if (reduceMotion.matches) return;
    if (avatar) {
      avatarAnimation?.cancel();
      avatarAnimation = runAnimation(avatar, [
        { opacity: 0, transform: `translateY(${dragViewport.matches ? -180 : -30}px) rotate(-7deg)` },
        { opacity: 1, transform: 'translateY(4px) rotate(4deg)', offset: 0.57 },
        { transform: 'translateY(-2px) rotate(-2deg)', offset: 0.77 },
        { opacity: 1, transform: 'translateY(0) rotate(0deg)' }
      ], { duration: 1000, delay: 120, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'backwards' });
    }
    if (system) runAnimation(system, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 580, delay: 160, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'backwards' });
  }

  if (avatar) {
    avatar.classList.add('avatar-motion');
    avatar.draggable = false;
    avatar.addEventListener('pointerdown', (event) => {
      if (reduceMotion.matches || !dragViewport.matches || event.button !== 0) return;
      avatarAnimation?.cancel();
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      avatar.classList.add('avatar-dragging');
      avatar.setPointerCapture(event.pointerId);
    });
    avatar.addEventListener('pointermove', (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const x = Math.max(-30, Math.min(30, event.clientX - pointer.x));
      const y = Math.max(-12, Math.min(22, event.clientY - pointer.y));
      avatar.style.transform = `translate(${x}px, ${y}px) rotate(${x * 0.27}deg)`;
    });
    const release = (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      if (avatar.hasPointerCapture(event.pointerId)) avatar.releasePointerCapture(event.pointerId);
      resetAvatar();
    };
    avatar.addEventListener('pointerup', release);
    avatar.addEventListener('pointercancel', release);
    avatar.addEventListener('lostpointercapture', () => { if (pointer) resetAvatar(); });
  }

  function viewChange(event) {
    if (lastEvent === event) return;
    lastEvent = event;
    if (event.detail?.view === 'about') enterAbout();
    else resetAvatar(false);
  }
  document.addEventListener('yemin:viewchange', viewChange);
  window.addEventListener('yemin:viewchange', viewChange);
  new MutationObserver(() => {
    if (!document.documentElement.classList.contains('booting')) enterAbout();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      animations.forEach((animation) => animation.cancel());
      resetAvatar(false);
    }
  });
  reduceMotion.addEventListener('change', () => {
    animations.forEach((animation) => animation.cancel());
    resetAvatar(false);
  });
  dragViewport.addEventListener('change', () => resetAvatar(false));
  requestAnimationFrame(enterAbout);
})();
