/* maximalmobil – Startseite
   Branchenwahl, Zeitleiste (Timecode, Abspielkopf), Klappe, Freigabe-Beispiel, Monatsraster, Formular.
   Bewegung: Standardzustände sind immer sichtbar; versteckte Ausgangszustände setzt nur dieses Skript. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionOK = () => !reduceMotion.matches;
  const FPS = 25;            // PAL
  const TOTAL_SECONDS = 30;  // Der Ablauf als ein 30-Sekunden-Reel

  /* ---------- Timecode ---------- */
  const two = (n) => String(n).padStart(2, '0');
  const tcString = (frames) => {
    const s = Math.floor(frames / FPS);
    return `${two(Math.floor(s / 3600))}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}:${two(frames % FPS)}`;
  };
  const paintTC = (el, str) => {
    if (el._tc === str) return;
    if (!el._cells || el._cells.length !== str.length) {
      el.innerHTML = str.split('').map((ch) => (ch === ':' ? '<span class="c">:</span>' : '<span class="d"></span>')).join('');
      el._cells = [...el.children];
    }
    for (let i = 0; i < str.length; i++) {
      if (str[i] !== ':' && el._cells[i].textContent !== str[i]) el._cells[i].textContent = str[i];
    }
    el._tc = str;
  };
  document.querySelectorAll('.tc').forEach((el) => paintTC(el, el.textContent.trim()));

  let armLive = () => {};

  /* ---------- Klappe ---------- */
  const monitors = [...document.querySelectorAll('.monitor')];
  const clap = (m) => {
    if (!m || !motionOK()) return;
    m.classList.remove('is-clap');
    void m.offsetWidth; // Animation neu starten
    m.classList.add('is-clap');
  };
  monitors.forEach((m) => m.addEventListener('animationend', (e) => {
    if (e.animationName === 'clap') m.classList.remove('is-clap');
  }));

  // Text wechselt mit kurzer Unschärfe statt hart
  const swapText = (el, text) => {
    if (el.textContent === text && el._swapTo == null) return;
    el._swapTo = text;
    if (!motionOK() || !el.animate) { el.textContent = text; el._swapTo = null; return; }
    el.getAnimations().forEach((a) => a.cancel());
    const out = el.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(4px)' }], { duration: 120, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    out.onfinish = () => {
      el.textContent = el._swapTo;
      el._swapTo = null;
      out.cancel();
      el.animate([{ opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' });
    };
  };

  /* ---------- Branchenwahl: jede Wahl ist eine neue Szene ---------- */
  const LABEL = { auto: 'Automobil', immo: 'Immobilien' };
  const switchable = [...document.querySelectorAll('[data-auto]')];
  switchable.forEach((el) => { el.dataset.none = el.textContent; });
  const spurButtons = [...document.querySelectorAll('.spur')];
  const spurThumb = document.querySelector('.spur-thumb');
  const formBranche = [...document.querySelectorAll('input[name="branche"]')];
  const takes = [...document.querySelectorAll('[data-take]')];
  let current = '';
  let take = 1;

  const placeThumb = () => {
    if (!spurThumb || !spurButtons.length) return;
    const on = spurButtons.find((btn) => btn.getAttribute('aria-pressed') === 'true');
    if (!on) { spurThumb.classList.remove('is-on'); return; }
    const base = spurButtons[0].offsetWidth;
    const appearing = !spurThumb.classList.contains('is-on');
    if (appearing) spurThumb.style.transition = 'none';
    spurThumb.style.setProperty('--tw', `${base}px`);
    spurThumb.style.setProperty('--tx', `${on.offsetLeft}px`);
    spurThumb.style.setProperty('--ts', (on.offsetWidth / base).toFixed(4));
    if (appearing) { void spurThumb.offsetWidth; spurThumb.style.transition = ''; }
    spurThumb.classList.add('is-on');
  };

  const setBranche = (b, source) => {
    b = b || '';
    const changed = b !== current;
    current = b;
    if (b) root.dataset.branche = b; else delete root.dataset.branche;
    spurButtons.forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.branche === b)));
    placeThumb();
    switchable.forEach((el) => swapText(el, b ? el.dataset[b] : el.dataset.none));
    if (source !== 'form') formBranche.forEach((r) => { r.checked = Boolean(b) && r.value === LABEL[b]; });
    if (changed && source !== 'reset') {
      take += 1;
      takes.forEach((el) => swapText(el, String(take)));
      monitors.forEach(clap);
      setTimeout(() => armLive(), 175);
    }
  };
  spurButtons.forEach((btn) => btn.addEventListener('click', () => {
    setBranche(btn.getAttribute('aria-pressed') === 'true' ? '' : btn.dataset.branche, 'spur');
  }));
  formBranche.forEach((r) => r.addEventListener('change', () => {
    const b = Object.keys(LABEL).find((k) => LABEL[k] === r.value);
    setBranche(b, 'form');
  }));
  window.addEventListener('resize', placeThumb);
  document.fonts?.ready.then(placeThumb);

  /* ---------- Laufender Timecode der Klappe: läuft ab dem Schlag 4,8 s und hält dann an ----------
     WCAG 2.2.2: automatisch startende Bewegung endet nach weniger als 5 Sekunden. */
  const REC_MS = 4800;
  const liveTC = document.querySelector('[data-tc="live"]');
  if (liveTC) {
    const recMonitor = liveTC.closest('.monitor');
    let raf = 0;
    let recorded = 0;
    let segStart = 0;
    let until = 0;
    const stop = () => { cancelAnimationFrame(raf); raf = 0; recMonitor?.classList.remove('is-rec'); };
    const tick = (now) => {
      if (!segStart) segStart = now;
      const ms = recorded + (now - segStart);
      paintTC(liveTC, tcString(Math.floor((ms / 1000) * FPS) % (FPS * 3600)));
      if (now >= until) { recorded = ms; segStart = 0; stop(); return; }
      raf = requestAnimationFrame(tick);
    };
    armLive = () => {
      if (!motionOK()) return;
      until = performance.now() + REC_MS;
      recMonitor?.classList.add('is-rec');
      if (!raf) { segStart = 0; raf = requestAnimationFrame(tick); }
    };
  }

  /* ---------- Ablauf: Scroll treibt Abspielkopf, Timecode und Monitor ---------- */
  const steps = [...document.querySelectorAll('.step')];
  const stepsList = document.querySelector('.steps');
  const panels = steps.map((s) => s.querySelector('.step-panel'));
  const monitor = document.querySelector('[data-monitor]');
  const timeline = document.querySelector('[data-timeline]');
  const dock = document.querySelector('[data-dock]');
  const dockClips = dock ? dock.querySelector('.dock-clips') : null;
  const scrubTCs = [...document.querySelectorAll('[data-tc="scrub"]')];
  const clipLinks = [...document.querySelectorAll('[data-clip]')];
  const mobileQuery = window.matchMedia('(max-width: 860px)');
  let activeStep = -1;
  let dockShown = false;

  const setStep = (n) => {
    if (n === activeStep) return;
    activeStep = n;
    for (let k = 1; k <= 5; k++) monitor.classList.toggle(`s${k}`, k <= Math.max(n, 1));
    steps.forEach((s, i) => s.classList.toggle('is-active', i + 1 === n));
    clipLinks.forEach((a) => {
      const on = Number(a.dataset.clip) === n;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
  };

  const showDock = (on) => {
    if (!dock || on === dockShown) return;
    dockShown = on;
    dock.classList.toggle('is-visible', on);
    root.classList.toggle('dock-on', on);
    dock.inert = !on;
  };

  // Fokus nie unter der Leiste unten (WCAG 2.4.11)
  document.addEventListener('focusin', (e) => {
    if (!dockShown || !dock || dock.contains(e.target)) return;
    const r = e.target.getBoundingClientRect();
    const top = dock.getBoundingClientRect().top;
    if (r.bottom > top - 8) window.scrollBy({ top: r.bottom - top + 24, left: 0, behavior: 'auto' });
  });

  const update = () => {
    if (!steps.length || !monitor) return;
    const vh = window.innerHeight;
    const probe = vh * (mobileQuery.matches ? 0.7 : 0.5);
    const tops = panels.map((p) => p.getBoundingClientRect().top);
    const lastRect = steps[steps.length - 1].getBoundingClientRect();
    const listRect = stepsList ? stepsList.getBoundingClientRect() : null;

    let i = -1;
    tops.forEach((t, k) => { if (t <= probe) i = k; });

    let p = 0;
    if (i >= 0) {
      const next = i + 1 < tops.length ? tops[i + 1] : lastRect.bottom;
      const local = Math.min(1, Math.max(0, (probe - tops[i]) / Math.max(1, next - tops[i])));
      p = (i + local) / steps.length;
    }

    setStep(i + 1);
    timeline?.style.setProperty('--p', p.toFixed(4));
    dockClips?.style.setProperty('--p', p.toFixed(4));
    if (listRect) stepsList.style.setProperty('--sp', Math.min(1, Math.max(0, (probe - listRect.top) / Math.max(1, listRect.height))).toFixed(4));
    const tc = tcString(Math.round(p * TOTAL_SECONDS * FPS));
    scrubTCs.forEach((el) => paintTC(el, tc));

    showDock(tops[0] < vh * 0.9 && lastRect.bottom > vh * 0.55);
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  };
  if (monitor) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ---------- Intro: Clips legen sich auf die Zeitleiste, dann schlägt die Klappe ---------- */
  const heroMonitor = document.querySelector('.monitor-hero');
  if (root.classList.contains('intro')) {
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('intro')));
    // Der Timecode startet im Moment, in dem die Klappe zuschlägt (24 % von 720 ms)
    setTimeout(() => { clap(heroMonitor); setTimeout(armLive, 175); }, 820);
  } else {
    armLive();
  }

  /* ---------- Schleifen pausieren außerhalb des Bildschirms ---------- */
  if ('IntersectionObserver' in window) {
    const offscreen = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('is-off', !e.isIntersecting)));
    monitors.forEach((m) => offscreen.observe(m));
  }

  /* ---------- Freigabe-Beispiel ---------- */
  const approveBox = document.querySelector('[data-approve]');
  const approveBtn = document.querySelector('[data-approve-btn]');
  const approveLabel = document.querySelector('[data-approve-label]');
  approveBtn?.addEventListener('click', () => {
    const on = !approveBox.classList.contains('is-approved');
    approveBtn.textContent = on ? 'Freigabe zurücknehmen' : 'Freigeben';
    approveLabel.textContent = on ? 'Content freigegeben' : 'Änderungen offen';
    approveBox.classList.toggle('is-approved', on);
    monitor?.classList.toggle('is-approved', on);
  });

  /* ---------- Paketmonate: spielen sich beim Einblenden Tag für Tag ab ---------- */
  const DAY_MS = 16;
  const d = (day, extra = 0) => `--d:${(day - 1) * DAY_MS + extra}ms`;
  const months = [...document.querySelectorAll('[data-month]')];
  months.forEach((el) => {
    const m = JSON.parse(el.dataset.month);
    let h = '';
    for (let w = 1; w <= 4; w++) h += `<span class="mw" style="grid-column:${(w - 1) * 7 + 1} / span 7">Woche ${w}</span>`;
    (m.dreh || []).forEach((x) => {
      h += `<span class="mi mi-dreh" style="grid-column:${x};${d(x)}"></span><span class="mi-dreh-label" style="grid-column:${x + 1} / span 6;${d(x, 80)}">Drehtag</span>`;
    });
    (m.reel || []).forEach((x) => { h += `<span class="mi mi-reel" style="grid-column:${x};${d(x, 60)}"></span>`; });
    if (m.reelMore) h += `<span class="mi-more" style="grid-column:28;${d(28, 80)}">+</span>`;
    (m.feed || []).forEach((x) => { h += `<span class="mi mi-feed" style="grid-column:${x};${d(x, 60)}"></span>`; });
    if (m.foto) h += `<span class="mi mi-foto" style="grid-column:${m.foto[0]} / ${m.foto[1] + 1};${d(m.foto[0], 60)}"></span>`;
    if (m.storySpan) h += `<span class="mi-story-span" style="${d(1, 120)}"></span>`;
    (m.storyTicks || []).forEach((x) => { h += `<span class="mi mi-story" style="grid-column:${x};${d(x, 120)}"></span>`; });
    h += `<span class="mi-report" style="${d(28, 160)}"></span>`;
    el.innerHTML = h;
  });
  if (motionOK() && 'IntersectionObserver' in window) {
    const play = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.remove('will-play');
      play.unobserve(e.target);
    }), { threshold: 0.4 });
    months.forEach((el) => {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('will-play'); play.observe(el); }
    });
  }

  /* ---------- Abschnitts-Überschriften fahren beim Einblenden zeilenweise hoch ---------- */
  const heads = [...document.querySelectorAll('main .h2')];
  heads.forEach((h) => {
    [...h.children].forEach((span) => {
      const ln = document.createElement('span');
      ln.className = 'ln';
      while (span.firstChild) ln.appendChild(span.firstChild);
      span.appendChild(ln);
    });
  });
  if (motionOK() && 'IntersectionObserver' in window) {
    const rise = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.remove('will-rise');
      rise.unobserve(e.target);
    }), { rootMargin: '0px 0px -12% 0px' });
    heads.forEach((h) => {
      if (h.getBoundingClientRect().top > window.innerHeight) { h.classList.add('will-rise'); rise.observe(h); }
    });
  }

  /* ---------- Formular ---------- */
  const form = document.getElementById('anfrage');
  if (form) {
    const statusBox = form.querySelector('[data-form-status]');
    const submitBtn = form.querySelector('[data-submit]');
    const submitLabel = submitBtn.firstChild;
    const DEFAULT_LABEL = submitLabel.textContent;
    const MAIL = 'info@maximalmobil.de';
    const PHONE = '+49 173 6386145';
    const fallback = `Schreiben Sie uns an <a href="mailto:${MAIL}">${MAIL}</a> oder rufen Sie an: <a href="tel:+491736386145">${PHONE}</a>.`;

    const setInvalid = (inputs, errorId, invalid, message) => {
      const err = document.getElementById(errorId);
      inputs.forEach((inp) => { if (invalid) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid'); });
      if (message) err.textContent = message;
      err.hidden = !invalid;
    };

    const validate = () => {
      let first = null;
      [['betrieb', 'e-betrieb'], ['name', 'e-name']].forEach(([name, id]) => {
        const bad = form[name].value.trim() === '';
        setInvalid([form[name]], id, bad);
        if (bad && !first) first = form[name];
      });
      const mail = form.email.value.trim();
      const tel = form.telefon.value.trim();
      if (!mail && !tel) {
        setInvalid([form.email, form.telefon], 'e-reach', true, 'Bitte geben Sie eine E-Mail-Adresse oder eine Telefonnummer an, damit wir uns melden können.');
        if (!first) first = form.email;
      } else if (mail && !form.email.checkValidity()) {
        setInvalid([form.email], 'e-reach', true, 'Bitte prüfen Sie die E-Mail-Adresse, zum Beispiel name@betrieb.de. Oder lassen Sie das Feld leer und geben Sie Ihre Telefonnummer an.');
        form.telefon.removeAttribute('aria-invalid');
        if (!first) first = form.email;
      } else {
        setInvalid([form.email, form.telefon], 'e-reach', false);
      }
      return first;
    };

    form.addEventListener('input', (e) => {
      if (e.target.getAttribute('aria-invalid') === 'true') validate();
    });

    const showStatus = (kind, html) => {
      statusBox.className = `form-status${kind === 'ok' ? ' is-ok' : ''}`;
      statusBox.innerHTML = html;
      statusBox.hidden = false;
      statusBox.focus();
    };

    const busy = (on) => {
      submitBtn.disabled = on;
      submitLabel.textContent = on ? 'Wird gesendet … ' : DEFAULT_LABEL;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (form.website.value) return; // Spam-Falle
      const firstInvalid = validate();
      if (firstInvalid) { firstInvalid.focus(); return; }

      const data = new FormData(form);
      data.delete('website');
      const endpoint = form.dataset.endpoint;

      // Ohne Formular-Dienst: fertige E-Mail im eigenen Mailprogramm öffnen.
      if (!endpoint) {
        const v = (k) => (data.get(k) || '').toString().trim();
        const body = [
          `Branche: ${v('branche') || 'nicht angegeben'}`,
          `Betrieb: ${v('betrieb')}`,
          `Name: ${v('name')}`,
          `E-Mail: ${v('email') || '–'}`,
          `Telefon: ${v('telefon') || '–'}`,
          '',
          v('nachricht'),
        ].join('\n');
        window.location.href = `mailto:${MAIL}?subject=${encodeURIComponent(`Erstgespräch-Anfrage: ${v('betrieb')}`)}&body=${encodeURIComponent(body)}`;
        showStatus('info', `<strong>Fast geschafft.</strong>Ihr E-Mail-Programm öffnet sich mit der fertigen Anfrage. Bitte dort auf Senden klicken. Öffnet sich nichts, bleiben Ihre Eingaben hier stehen. ${fallback}`);
        return;
      }

      busy(true);
      try {
        const res = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        setBranche('', 'reset');
        showStatus('ok', '<strong>Danke, Ihre Anfrage ist angekommen.</strong>Wir melden uns bei Ihnen, um einen Termin für das Erstgespräch zu finden.');
      } catch (err) {
        showStatus('error', `<strong>Ihre Anfrage wurde nicht gesendet.</strong>Ihre Eingaben sind noch da. Versuchen Sie es gleich noch einmal. ${fallback}`);
      } finally {
        busy(false);
      }
    });
  }
})();
