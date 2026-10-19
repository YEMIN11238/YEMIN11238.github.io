/* An accessible, dependency-free coverflow enhancement for the existing project cards. */
(() => {
  'use strict';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const instances = [];
  let nextId = 0;

  class ProjectCarousel {
    constructor(grid) {
      this.grid = grid;
      this.cards = [...grid.querySelectorAll(':scope > .project-card')];
      this.visible = [];
      this.index = 0;
      this.drag = null;
      this.suppressClickUntil = 0;
      this.refreshQueued = false;
      const isWork = Boolean(grid.closest('#works'));
      this.wrapper = document.createElement('div');
      this.wrapper.className = 'project-carousel';
      this.wrapper.tabIndex = 0;
      this.wrapper.setAttribute('role', 'region');
      this.wrapper.setAttribute('aria-roledescription', '轮播');
      this.wrapper.setAttribute('aria-label', isWork ? '精选作品' : '工具与 Skill');
      grid.before(this.wrapper);
      this.wrapper.append(grid);
      grid.closest('.view')?.classList.add('has-coverflow');
      grid.classList.add('coverflow-stage');
      grid.setAttribute('aria-live', 'off');
      this.id = `project-carousel-${++nextId}`;
      grid.id ||= this.id;
      const hint = document.createElement('p');
      hint.id = `${this.id}-hint`;
      hint.className = 'coverflow-hint';
      hint.innerHTML = '<span class="coverflow-gesture" aria-hidden="true">↔</span> 拖动切换 <span aria-hidden="true">·</span> 聚焦后可用 ← → 键';
      this.wrapper.setAttribute('aria-describedby', hint.id);
      this.controls = document.createElement('div');
      this.controls.className = 'coverflow-controls';
      this.previous = this.makeButton('上一项', '‹', 'coverflow-arrow');
      this.next = this.makeButton('下一项', '›', 'coverflow-arrow');
      this.previous.setAttribute('aria-controls', grid.id);
      this.next.setAttribute('aria-controls', grid.id);
      this.dots = document.createElement('div');
      this.dots.className = 'coverflow-dots';
      this.dots.setAttribute('role', 'group');
      this.dots.setAttribute('aria-label', '选择展示项目');
      this.counter = document.createElement('span');
      this.counter.className = 'coverflow-counter';
      this.counter.setAttribute('aria-hidden', 'true');
      this.announcement = document.createElement('span');
      this.announcement.className = 'sr-only';
      this.announcement.setAttribute('role', 'status');
      this.announcement.setAttribute('aria-live', 'polite');
      this.controls.append(this.previous, this.dots, this.next, this.counter);
      this.wrapper.append(this.controls, hint, this.announcement);
      this.hitTargets = this.cards.map((card, cardIndex) => {
        const target = this.makeButton('', '', 'coverflow-side-hit');
        target.tabIndex = -1;
        target.setAttribute('aria-hidden', 'true');
        target.addEventListener('click', () => {
          const index = this.visible.indexOf(card);
          if (index >= 0) {
            this.wrapper.focus({ preventScroll: true });
            this.go(index);
          }
        });
        target.dataset.cardIndex = String(cardIndex);
        grid.append(target);
        card.querySelectorAll('img, a').forEach((item) => item.draggable = false);
        return target;
      });
      this.previous.addEventListener('click', () => this.go(this.index - 1));
      this.next.addEventListener('click', () => this.go(this.index + 1));
      this.wrapper.addEventListener('keydown', (event) => this.onKey(event));
      grid.addEventListener('pointerdown', (event) => this.onPointerDown(event));
      grid.addEventListener('pointermove', (event) => this.onPointerMove(event));
      grid.addEventListener('pointerup', (event) => this.onPointerUp(event));
      grid.addEventListener('pointercancel', (event) => {
        if (this.drag?.id === event.pointerId) this.cancelDrag();
      });
      grid.addEventListener('lostpointercapture', (event) => {
        if (event.target === grid && this.drag?.id === event.pointerId) this.cancelDrag();
      });
      grid.addEventListener('dragstart', (event) => event.preventDefault());
      grid.addEventListener('click', (event) => {
        if (performance.now() < this.suppressClickUntil) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, true);
      this.observer = new MutationObserver(() => this.queueRefresh());
      this.cards.forEach((card) => this.observer.observe(card, { attributes: true, attributeFilter: ['hidden'] }));
      this.resizeObserver = new ResizeObserver(() => this.render());
      this.resizeObserver.observe(grid);
      this.refresh(true);
    }

    makeButton(label, content, className) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = className;
      if (label) button.setAttribute('aria-label', label);
      button.textContent = content;
      return button;
    }

    queueRefresh() {
      if (this.refreshQueued) return;
      this.refreshQueued = true;
      queueMicrotask(() => {
        this.refreshQueued = false;
        this.refresh(true);
      });
    }

    refresh(reset = false) {
      this.cancelDrag();
      const active = document.activeElement;
      const previouslyVisible = this.visible;
      this.visible = this.cards.filter((card) => !card.hidden);
      if (reset || this.index >= this.visible.length) this.index = 0;
      if (previouslyVisible.some((card) => card.contains(active)) && !this.visible[this.index]?.contains(active)) {
        const filter = this.grid.closest('#works')?.querySelector('[data-filter][aria-pressed="true"]');
        (filter || this.wrapper).focus({ preventScroll: true });
      }
      const focusedDot = this.dots.contains(active) ? [...this.dots.children].indexOf(active) : -1;
      this.dots.replaceChildren();
      this.visible.forEach((card, index) => {
        const title = card.querySelector('h2')?.textContent.replace('↗', '').trim() || `项目 ${index + 1}`;
        const dot = this.makeButton(`查看 ${title}`, '', 'coverflow-dot');
        dot.addEventListener('click', () => this.go(index));
        this.dots.append(dot);
      });
      this.wrapper.classList.toggle('coverflow-single', this.visible.length < 2);
      this.wrapper.classList.toggle('coverflow-empty', !this.visible.length);
      this.render();
      if (focusedDot >= 0) (this.dots.children[Math.min(focusedDot, this.visible.length - 1)] || this.wrapper).focus({ preventScroll: true });
    }

    relative(index) {
      let distance = index - this.index;
      const length = this.visible.length;
      if (length > 2) {
        if (distance > length / 2) distance -= length;
        if (distance < -length / 2) distance += length;
      }
      return distance;
    }

    render(dragPixels = 0) {
      const width = this.grid.clientWidth || 700;
      const small = width < 500;
      const step = Math.min(small ? width * 0.43 : width * 0.265, small ? 170 : 215);
      const dragFraction = motion.matches ? 0 : dragPixels / Math.max(step, 1) * 0.72;
      const height = this.visible.reduce((maximum, card) => Math.max(maximum, card.offsetHeight), 0);
      if (height) this.grid.style.setProperty('--coverflow-stage-height', `${height + (small ? 22 : 26)}px`);
      this.cards.forEach((card, originalIndex) => {
        const index = this.visible.indexOf(card);
        const target = this.hitTargets[originalIndex];
        const current = index === this.index && index >= 0;
        const distance = index >= 0 ? this.relative(index) : 99;
        const position = distance + dragFraction;
        const magnitude = Math.abs(position);
        const beyond = index < 0 || Math.abs(distance) > 1;
        const x = position * step;
        const rotate = motion.matches ? 0 : Math.max(-64, Math.min(64, position * -34));
        const depth = motion.matches ? 0 : -Math.min(magnitude, 2) * (small ? 105 : 140);
        const scale = motion.matches ? 1 : Math.max(0.74, 1 - magnitude * 0.12);
        const transform = `translateX(calc(-50% + ${x.toFixed(2)}px)) translateZ(${depth.toFixed(2)}px) rotateY(${rotate.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
        const depthOrder = current ? 4 : Math.max(1, 3 - Math.abs(distance));
        card.style.transform = transform;
        target.style.transform = transform;
        card.style.zIndex = String(depthOrder);
        target.style.zIndex = String(depthOrder);
        card.style.opacity = beyond ? '0' : (current ? '1' : (motion.matches ? '0.28' : '0.52'));
        card.style.visibility = beyond ? 'hidden' : 'visible';
        card.classList.toggle('is-current', current);
        card.inert = !current;
        card.setAttribute('aria-hidden', String(!current));
        target.hidden = beyond || current;
        target.style.height = `${card.offsetHeight}px`;
        this.dots.children[index]?.setAttribute('aria-pressed', String(current));
      });
      this.previous.disabled = this.visible.length < 2;
      this.next.disabled = this.visible.length < 2;
      this.counter.textContent = this.visible.length ? `${String(this.index + 1).padStart(2, '0')} / ${String(this.visible.length).padStart(2, '0')}` : '00 / 00';
    }

    go(index) {
      if (this.visible.length < 2) return;
      this.cancelDrag();
      const nextIndex = (index + this.visible.length) % this.visible.length;
      if (nextIndex === this.index) return;
      if (this.visible[this.index]?.contains(document.activeElement)) this.wrapper.focus({ preventScroll: true });
      this.index = nextIndex;
      this.render();
      const title = this.visible[this.index].querySelector('h2')?.textContent.replace('↗', '').trim();
      this.announcement.textContent = `${this.index + 1} / ${this.visible.length}，${title || '项目'}`;
    }

    onKey(event) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        event.stopPropagation();
        this.go(this.index + (event.key === 'ArrowRight' ? 1 : -1));
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        this.go(event.key === 'Home' ? 0 : this.visible.length - 1);
      }
    }

    onPointerDown(event) {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0) || this.visible.length < 2) return;
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, started: false, delta: 0, at: performance.now() };
    }

    onPointerMove(event) {
      const drag = this.drag;
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.started) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { this.drag = null; return; }
        if (Math.abs(dx) < 9 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        drag.started = true;
        if (event.target.closest('.coverflow-side-hit')) this.wrapper.focus({ preventScroll: true });
        this.grid.setPointerCapture(event.pointerId);
        this.wrapper.classList.add('is-dragging');
      }
      if (event.cancelable) event.preventDefault();
      drag.delta = dx;
      this.render(Math.max(-240, Math.min(240, dx)));
    }

    onPointerUp(event) {
      const drag = this.drag;
      if (!drag || drag.id !== event.pointerId) return;
      const elapsed = performance.now() - drag.at;
      const threshold = Math.min(75, this.grid.clientWidth * 0.16);
      const shouldMove = Math.abs(drag.delta) > threshold || (Math.abs(drag.delta) > 25 && Math.abs(drag.delta) / Math.max(elapsed, 1) > 0.45);
      const direction = drag.delta < 0 ? 1 : -1;
      if (drag.started) this.suppressClickUntil = performance.now() + 400;
      this.cancelDrag();
      if (drag.started && shouldMove) this.go(this.index + direction);
    }

    cancelDrag() {
      const previous = this.drag;
      this.drag = null;
      this.wrapper.classList.remove('is-dragging');
      if (previous && this.grid.hasPointerCapture(previous.id)) this.grid.releasePointerCapture(previous.id);
      if (previous?.started) this.render();
    }
  }

  function start() {
    document.querySelectorAll('#works .project-grid, #tools .project-grid').forEach((grid) => {
      if (!grid.classList.contains('coverflow-stage')) instances.push(new ProjectCarousel(grid));
    });
    document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
      instances.filter((item) => item.grid.closest('#works')).forEach((item) => item.queueRefresh());
    }));
  }
  document.addEventListener('yemin:viewchange', () => instances.forEach((item) => { item.cancelDrag(); item.render(); }));
  document.addEventListener('yemin:filterchange', () => instances.filter((item) => item.grid.closest('#works')).forEach((item) => item.queueRefresh()));
  motion.addEventListener('change', () => instances.forEach((item) => { item.cancelDrag(); item.render(); }));
  window.YeminCarousel = { refresh: () => instances.forEach((item) => item.refresh(false)) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
