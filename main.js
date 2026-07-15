/* Mark current-page nav link (desktop pill + mobile sheet) */
(() => {
  const page = document.body.dataset.page;
  if (!page) return;
  document.querySelectorAll(`nav a[data-page], .mobile-menu a[data-page]`).forEach(a => {
    if (a.dataset.page === page) a.setAttribute('aria-current', 'page');
  });
})();

/* Hamburger / mobile glass sheet */
(() => {
  const ham = document.querySelector('.nav-ham');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!ham || !mobileMenu) return;
  ham.addEventListener('click', () => {
    const open = ham.classList.toggle('open');
    ham.setAttribute('aria-expanded', open);
    mobileMenu.classList.toggle('open', open);
    mobileMenu.setAttribute('aria-hidden', !open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      ham.classList.remove('open');
      ham.setAttribute('aria-expanded', 'false');
      mobileMenu.classList.remove('open');
      mobileMenu.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    });
  });
})();

/* Scroll-scrub engine — panels rise into frame, hold, slide up + fade out.
   "soft" variant enters but never exits (for paragraph text). */
(() => {
  const els = Array.from(document.querySelectorAll('[data-scrub]'));
  if (!els.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach(el => { el.style.opacity = 1; });
    return;
  }

  const isMobile = matchMedia('(max-width: 768px)').matches;

  const ENTER_END  = 0.30;
  const EXIT_START = 0.72;
  const RISE       = isMobile ? 48 : 70;
  const DROP       = isMobile ? 36 : 56;
  const SCALE_IN   = 0.94;
  const SCALE_OUT  = 0.97;

  const ease = t => 1 - Math.pow(1 - t, 3);
  let ticking = false;

  function update() {
    ticking = false;
    const vh = window.innerHeight;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      const soft = el.dataset.scrub === 'soft';
      let y = 0, s = 1, o = 1;
      if (p <= ENTER_END) {
        const t = ease(p / ENTER_END);
        y = (1 - t) * RISE;
        s = SCALE_IN + (1 - SCALE_IN) * t;
        o = t;
      } else if (p >= EXIT_START && !soft) {
        const t = ease((p - EXIT_START) / (1 - EXIT_START));
        y = -t * DROP;
        s = 1 - (1 - SCALE_OUT) * t;
        o = 1 - t;
      }
      el.style.opacity   = o;
      el.style.transform = `translateY(${y}px) scale(${s})`;
    }
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  window.addEventListener('scroll', onScroll, {passive: true});
  window.addEventListener('resize', onScroll, {passive: true});
  update();
})();

/* Spiral section engine — a flat ring of cards driven by wheel/touch/keys,
   looping forever in both directions (projects.html). The ring has no
   vertical pitch, so every 360° looks identical and the wrap is invisible —
   that's what makes an infinite loop possible without a jump cut. Runs
   under reduced motion too (prev/next + arrow keys are the fallback
   input), just without the inertia fling or the on-load demo spin. */
(() => {
  const sections = document.querySelectorAll('.spiral-section');
  if (!sections.length) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  sections.forEach(initSpiral);

  function initSpiral(section) {
    const helix = section.querySelector('.helix');
    const cards = Array.from(section.querySelectorAll('.card3d'));
    const summaries = Array.from(section.querySelectorAll('.summary'));
    const counter = section.querySelector('.spiral-counter');
    const prevBtn = section.querySelector('.spiral-nav-btn.prev');
    const nextBtn = section.querySelector('.spiral-nav-btn.next');
    const N = cards.length;
    if (!helix || !N) return;

    let activeIdx = -1;
    const tVals = new Array(N).fill(0);

    const STEP = 360 / N;
    const TOTAL = STEP * N; /* 360, kept named for the wrap-around math */
    const SETBACK = parseFloat(getComputedStyle(section).getPropertyValue('--setback')) || 120;
    const DEPTH = parseFloat(getComputedStyle(section).getPropertyValue('--depth')) || 400;

    cards.forEach(card => {
      card.style.cursor = 'pointer';
      const open = () => {
        if (!card.dataset.href) return;
        window.open(card.dataset.href, '_blank', 'noopener');
      };
      card.addEventListener('click', (e) => {
        if (e.target.closest('a')) return; /* inner links win */
        open();
      });
      card.addEventListener('keydown', (e) => {
        if (e.target !== card) return; /* let inner links handle their own Enter */
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });

    const nearestCardAngle = a => Math.round(a / STEP) * STEP;

    let target = 0, current = 0, velocity = 0;
    const WHEEL_FACTOR = 0.12;
    const DRAG_FACTOR  = 0.25;

    let snapTimer;
    function snap() {
      clearTimeout(snapTimer);
      snapTimer = setTimeout(() => { target = nearestCardAngle(target); }, 140);
    }

    section.addEventListener('wheel', (e) => {
      e.preventDefault();
      target += e.deltaY * WHEEL_FACTOR;
      snap();
    }, { passive: false });

    /* touch drag with flick inertia — single-finger only, so pinch-zoom
       still reaches the browser untouched */
    let lastY = 0, lastT = 0;
    section.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      lastY = e.touches[0].clientY; lastT = performance.now();
      velocity = 0;
    }, { passive: true });
    section.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      const y = e.touches[0].clientY, now = performance.now();
      const dy = lastY - y;
      target += dy * DRAG_FACTOR;
      velocity = reduceMotion ? 0 : dy / Math.max(1, now - lastT) * 16;
      lastY = y; lastT = now;
    }, { passive: false });
    section.addEventListener('touchend', () => {
      if (!reduceMotion) target += velocity * DRAG_FACTOR * 14;
      snap();
    });

    function step(dir) { target = nearestCardAngle(target) + dir * STEP; }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1);
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   step(-1);
    });
    if (nextBtn) nextBtn.addEventListener('click', () => step(1));
    if (prevBtn) prevBtn.addEventListener('click', () => step(-1));

    if (!reduceMotion) {
      target = 8; /* nudge the ring on load so the wheel affordance reads immediately */
      setTimeout(() => { target = 0; }, 1200);
    }

    function frame() {
      current += (target - current) * (reduceMotion ? 1 : 0.075);

      /* keep the numbers small without any visual change (360° modular) */
      if (Math.abs(current) > TOTAL * 100) {
        const k = Math.trunc(current / TOTAL) * TOTAL;
        current -= k; target -= k;
      }

      helix.style.transform = `translateZ(${-(DEPTH + SETBACK)}px) rotateY(${-current}deg)`;

      cards.forEach((c, i) => {
        const A = i * STEP;
        /* billboard: orbit position, then counter-rotate to always face viewer */
        c.style.transform =
          `rotateY(${A}deg) translateZ(${DEPTH}px) rotateY(${current - A}deg)`;

        let d = Math.abs(((A - current) % 360 + 360) % 360);
        if (d > 180) d = 360 - d;
        const t = 1 - Math.min(d, 180) / 180;
        tVals[i] = t;
        c.style.opacity = 0.45 + 0.55 * t;
        c.style.zIndex = Math.round(10 + 10 * t);
        c.style.pointerEvents = t > 0.7 ? 'auto' : 'none';
        c.style.boxShadow = t > 0.9
          ? 'inset 0 1px 0 var(--glass-brd), inset 0 -1px 0 var(--glass-brd-btm), inset 1px 0 0 rgba(255,255,255,0.35), inset -1px 0 0 rgba(255,255,255,0.35), 0 32px 80px rgba(30,30,40,0.30)'
          : '';
      });

      if (summaries.length) {
        let best = 0, bestT = -1;
        cards.forEach((c, i) => {
          if (tVals[i] > bestT) { bestT = tVals[i]; best = i; }
        });
        if (best !== activeIdx && bestT > 0.55) {
          activeIdx = best;
          summaries.forEach((s, i) => s.classList.toggle('active', i === activeIdx));
        }
      }

      if (counter) counter.textContent = `${(activeIdx < 0 ? 0 : activeIdx) + 1} / ${N}`;

      requestAnimationFrame(frame);
    }

    frame();
  }
})();
