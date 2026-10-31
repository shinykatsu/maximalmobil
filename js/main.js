// maximalmobil · Version 3 „Der Sucher“
// Ohne dieses Skript ist die Seite vollständig: alle Texte stehen da, die Videos zeigen ihr Standbild,
// die Pakete stehen untereinander und das Formular schickt direkt an /anfrage.php.
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const mq = (q) => window.matchMedia(q);
  const reduceMq = mq('(prefers-reduced-motion: reduce)');
  const finePointer = mq('(hover: hover) and (pointer: fine)').matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  let reduce = reduceMq.matches;

  /* ---------- Bewegung anhalten (WCAG 2.2.2) ----------
     Ein Zustand für die ganze Seite: Videos, Laufschriften, Timecode und der runde Knopf stehen still. */
  let still = false;
  try { still = localStorage.getItem('mm-still') === '1'; } catch (e) { /* privates Fenster */ }
  const stillBtns = $$('[data-still]');
  const canMove = () => !reduce && !still;
  const canPlayVideo = () => canMove() && !saveData;
  const videoHooks = [];
  const applyStill = () => {
    root.classList.toggle('is-still', still);
    stillBtns.forEach((b) => {
      b.setAttribute('aria-pressed', String(still));
      b.textContent = still ? 'Bewegung fortsetzen' : 'Bewegung anhalten';
    });
    videoHooks.forEach((fn) => fn());
  };
  stillBtns.forEach((b) => b.addEventListener('click', () => {
    still = !still;
    try { localStorage.setItem('mm-still', still ? '1' : '0'); } catch (e) { /* egal */ }
    applyStill();
  }));
  reduceMq.addEventListener?.('change', (e) => { reduce = e.matches; applyStill(); });

  const play = (v) => {
    if (!v || !canPlayVideo()) return;
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  };
  const pause = (v) => { if (v && !v.paused) v.pause(); };

  /* ---------- Kopfzeile: Menü und aktueller Abschnitt ---------- */
  const head = $('[data-head]');
  const menuBtn = $('[data-menu]');
  const setMenu = (open) => {
    head.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    root.style.overflow = open ? 'hidden' : '';
  };
  menuBtn?.addEventListener('click', () => setMenu(!head.classList.contains('is-open')));
  $$('[data-nav] a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && head.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
  });
  mq('(min-width: 1025px)').addEventListener?.('change', (e) => { if (e.matches) setMenu(false); });

  const navLinks = new Map($$('[data-nav] a[href^="#"]').map((a) => [a.getAttribute('href').slice(1), a]));
  const sectionFor = { reichweite: null, kontakt: null, idee: null, top: null };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const id = en.target.id in sectionFor ? sectionFor[en.target.id] : en.target.id;
        navLinks.forEach((a, key) => {
          const on = key === id;
          a.classList.toggle('is-here', on);
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main > section[id]').forEach((s) => io.observe(s));
  }

  /* ---------- Timecode im Sucher ---------- */
  const tc = $('[data-timecode]');
  const hero = $('[data-hero]');
  let heroVisible = true;
  if (tc) {
    const t0 = performance.now();
    const pad = (n) => String(n).padStart(2, '0');
    setInterval(() => {
      if (!heroVisible || !canMove() || document.hidden) return;
      const f = Math.floor((performance.now() - t0) / 40); // 25 Bilder pro Sekunde
      const s = Math.floor(f / 25);
      tc.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f % 25)}`;
    }, 40);
  }

  /* ---------- Videos ---------- */
  const heroVideo = $('[data-autoplay]');
  if (heroVideo && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => {
      heroVisible = en.isIntersecting;
      if (heroVisible) play(heroVideo); else pause(heroVideo);
    }, { threshold: 0.15 }).observe(hero);
    videoHooks.push(() => { if (canPlayVideo() && heroVisible) play(heroVideo); else pause(heroVideo); });
  }

  // Arbeiten: mit der Maus beim Überfahren, auf dem Telefon das Reel, das gerade im Bild ist
  const hoverFigs = $$('[data-hoverplay]');
  hoverFigs.forEach((fig) => {
    const v = $('video', fig);
    v.addEventListener('playing', () => fig.classList.add('is-playing'));
    v.addEventListener('pause', () => fig.classList.remove('is-playing'));
    if (finePointer) {
      fig.addEventListener('mouseenter', () => play(v));
      fig.addEventListener('mouseleave', () => pause(v));
    }
  });
  if (!finePointer && 'IntersectionObserver' in window) {
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const v = $('video', en.target);
        if (en.intersectionRatio > 0.7) { seen.add(v); play(v); } else { seen.delete(v); pause(v); }
      });
    }, { threshold: [0, 0.7, 1] });
    hoverFigs.forEach((f) => io.observe(f));
    videoHooks.push(() => seen.forEach((v) => (canPlayVideo() ? play(v) : pause(v))));
  }
  videoHooks.push(() => { if (!canPlayVideo()) hoverFigs.forEach((f) => pause($('video', f))); });

  /* ---------- Einblenden beim Scrollen ---------- */
  const reveals = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduce) {
    const groups = new Map();
    reveals.forEach((el) => {
      const key = el.parentElement;
      const i = groups.get(key) || 0;
      groups.set(key, i + 1);
      el.style.setProperty('--d', `${Math.min(i, 7) * 80}ms`);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Der Name: Vorsilben und Endungen fahren an „mobil“ heran ---------- */
  const stack = $('[data-stack]');
  const slides = stack ? $$('[data-slide]', stack) : [];

  /* ---------- Für wen: angepinnt auf großen Bildschirmen ---------- */
  const pin = $('[data-pin]');
  const pinPanels = pin ? $$('[data-pin-panel]', pin) : [];
  const pinMarks = pin ? $$('[data-pin-mark]', pin) : [];
  const pinBar = pin ? $('[data-pin-bar]', pin) : null;
  const pinMq = mq('(min-width: 1025px) and (min-height: 680px)');
  let pinOn = false;
  let pinIndex = -1;
  const panelVideo = pin ? $('[data-panel-video]', pin) : null;
  const setPanel = (i) => {
    if (i === pinIndex) return;
    pinIndex = i;
    pinPanels.forEach((p, k) => {
      p.classList.toggle('is-on', k === i);
      if (pinOn) p.setAttribute('aria-hidden', String(k !== i)); else p.removeAttribute('aria-hidden');
    });
    pinMarks.forEach((m, k) => m.classList.toggle('is-on', k === i));
    if (panelVideo) { if (i === 0) play(panelVideo); else pause(panelVideo); }
  };
  const syncPin = () => {
    pinOn = !!pin && pinMq.matches && !reduce;
    pin?.classList.toggle('is-pin', pinOn);
    pinIndex = -1;
    if (!pinOn) {
      pinPanels.forEach((p) => { p.classList.add('is-on'); p.removeAttribute('aria-hidden'); });
      pinMarks.forEach((m) => m.classList.remove('is-on'));
    }
  };
  if (pin) {
    syncPin();
    pinMq.addEventListener?.('change', () => { syncPin(); onScroll(); });
    // Mit der Tastatur in ein verstecktes Panel? Dann zu dessen Stelle scrollen.
    pinPanels.forEach((p, k) => p.addEventListener('focusin', () => {
      if (!pinOn || k === pinIndex) return;
      const total = pin.offsetHeight - window.innerHeight;
      window.scrollTo({ top: pin.offsetTop + total * ((k + 0.5) / pinPanels.length), behavior: 'auto' });
    }));
    // Links „Automobil / Immobilien / Privat“ im ersten Bildschirm: angepinnt zur Stelle des Panels scrollen
    $$('[data-jump]').forEach((a) => a.addEventListener('click', (e) => {
      if (!pinOn) return;
      e.preventDefault();
      const k = Number(a.dataset.jump);
      const total = pin.offsetHeight - window.innerHeight;
      window.scrollTo({ top: pin.offsetTop + total * ((k + 0.5) / pinPanels.length), behavior: reduce ? 'auto' : 'smooth' });
    }));
    if (panelVideo && 'IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => {
        if (pinOn) return;
        if (en.isIntersecting) play(panelVideo); else pause(panelVideo);
      }, { threshold: 0.5 }).observe(panelVideo);
      videoHooks.push(() => { if (!canPlayVideo()) pause(panelVideo); else if (pinOn && pinIndex === 0) play(panelVideo); });
    }
  }

  /* ---------- Ablauf: Abspielkopf über der Schnittspur ---------- */
  const flow = $('[data-flow]');
  const tl = flow ? $('.tl', flow) : null;
  const playhead = flow ? $('[data-playhead]', flow) : null;
  const phTc = flow ? $('[data-ph-tc]', flow) : null;
  const clips = flow ? $$('[data-clip]', flow) : [];
  const steps = flow ? $$('[data-step]', flow) : [];
  if (flow) flow.classList.add('is-live');

  /* ---------- Reichweite: leichtes Mitlaufen des Bildes ---------- */
  const proofImg = $('.proof-frame img');

  /* ---------- Eine Schleife für alles, was am Scrollen hängt ---------- */
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(frame);
  }
  function frame() {
    ticking = false;
    const vh = window.innerHeight;

    // Name
    if (stack) {
      const r = stack.getBoundingClientRect();
      const p = reduce ? 1 : easeOut(clamp((vh - r.top) / (vh * 0.75)));
      const off = (1 - p) * Math.min(window.innerWidth * 0.28, 420);
      slides.forEach((el) => { el.style.transform = p >= 1 ? '' : `translate3d(${Number(el.dataset.slide) * off}px,0,0)`; });
    }

    // Angepinnte Branchen
    if (pinOn) {
      const r = pin.getBoundingClientRect();
      const total = pin.offsetHeight - (vh - head.offsetHeight);
      const p = clamp(-r.top / total);
      if (pinBar) pinBar.style.transform = `scaleX(${p})`;
      setPanel(Math.min(pinPanels.length - 1, Math.floor(p * pinPanels.length * 0.999)));
    } else if (pin && pinIndex !== -2) {
      pinIndex = -2;
    }

    // Abspielkopf
    if (tl && playhead && tl.offsetParent !== null) {
      const r = tl.getBoundingClientRect();
      const p = reduce ? 1 : clamp((vh * 0.8 - r.top) / (vh * 0.55));
      const w = tl.clientWidth - parseFloat(getComputedStyle(tl).paddingLeft) * 2;
      playhead.style.transform = `translate3d(${p * Math.max(0, w - 2)}px,0,0)`;
      const idx = Math.min(clips.length - 1, Math.floor(p * clips.length * 0.999));
      clips.forEach((c, k) => c.classList.toggle('is-on', k === idx));
      steps.forEach((s, k) => { s.classList.toggle('is-on', k === idx); s.classList.toggle('is-past', k < idx); });
      if (phTc) phTc.textContent = `Tag ${String(1 + Math.round(p * 29)).padStart(2, '0')}`;
    }

    // Bild der Reichweite
    if (proofImg && !reduce) {
      const r = proofImg.parentElement.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        const p = clamp((vh - r.top) / (vh + r.height));
        proofImg.style.transform = `translate3d(0,${(-p * 13).toFixed(2)}%,0)`;
      }
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ---------- Arbeiten: Reihe zum Durchblättern ---------- */
  const track = $('[data-track]');
  if (track) {
    const items = $$('.work-item', track);
    const prev = $('[data-work-prev]');
    const next = $('[data-work-next]');
    const pos = $('[data-work-pos]');
    const step = () => (items[1] ? items[1].offsetLeft - items[0].offsetLeft : track.clientWidth * 0.8);
    const smooth = reduce ? 'auto' : 'smooth';
    prev?.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: smooth }));
    next?.addEventListener('click', () => track.scrollBy({ left: step(), behavior: smooth }));
    const update = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max;
      const i = clamp(Math.round(track.scrollLeft / step()), 0, items.length - 1);
      if (pos) pos.textContent = String(track.scrollLeft >= max ? items.length : i + 1).padStart(2, '0');
    };
    track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();

    // Mit der Maus ziehen
    let down = null;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = { x: e.clientX, left: track.scrollLeft, moved: false };
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (!down.moved && Math.abs(dx) > 6) { down.moved = true; track.classList.add('is-drag'); }
      if (down.moved) track.scrollLeft = down.left - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!down) return;
      const moved = down.moved;
      down = null;
      track.classList.remove('is-drag');
      if (moved) {
        const i = Math.round(track.scrollLeft / step());
        track.scrollTo({ left: i * step(), behavior: smooth });
      }
    });
  }

  /* ---------- Pakete: Reiter und Beispielmonat ---------- */
  const PLANS = {
    basis: {
      sum: [[1, 'Drehtag'], [5, 'Reels'], [3, 'Feed-Beiträge'], [4, 'Story-Formate']],
      tiktok: false,
      days: { 1: ['plan'], 2: ['dreh'], 5: ['story'], 6: ['reel'], 8: ['feed'], 10: ['reel'], 12: ['story'], 15: ['reel'], 17: ['feed'], 19: ['story'], 20: ['reel'], 25: ['reel'], 26: ['story'], 27: ['feed'], 28: ['report'] },
    },
    standard: {
      sum: [[1, 'Drehtag'], [8, 'Reels'], [3, 'Feed-Beiträge'], [4, 'Story-Formate'], ['+', 'TikTok']],
      tiktok: true,
      days: { 1: ['plan'], 2: ['dreh'], 4: ['reel'], 6: ['story'], 7: ['reel'], 9: ['feed'], 10: ['reel'], 13: ['reel', 'story'], 16: ['reel'], 18: ['feed'], 19: ['reel'], 20: ['story'], 22: ['reel'], 25: ['reel'], 26: ['feed'], 27: ['story'], 28: ['report'] },
    },
    premium: {
      sum: [[2, 'Drehtage'], ['12+', 'Reels'], [3, 'Feed-Beiträge'], [4, 'Story-Formate'], [1, 'Fotostrecke'], ['+', 'alle Kanäle']],
      tiktok: true,
      days: { 1: ['plan'], 2: ['dreh'], 4: ['reel'], 5: ['story'], 6: ['reel'], 8: ['reel'], 9: ['foto'], 10: ['reel'], 11: ['feed'], 12: ['reel', 'story'], 14: ['reel'], 16: ['dreh'], 17: ['feed'], 18: ['reel'], 19: ['story'], 20: ['reel'], 22: ['reel'], 24: ['reel'], 25: ['feed'], 26: ['reel', 'story'], 27: ['reel'], 28: ['report'] },
    },
  };
  const CHIP = { plan: ['chip-plan', 'Plan'], dreh: ['chip-dreh', 'Drehtag'], reel: ['chip-reel', 'Reel'], feed: ['chip-feed', 'Feed'], story: ['chip-story', 'Story'], foto: ['chip-foto', 'Fotostrecke'], report: ['chip-plan', 'Report'] };
  const NAMES = { basis: 'Basis', standard: 'Standard', premium: 'Premium' };
  const calGrid = $('[data-cal-grid]');
  const tabs = $$('[data-tab]');
  const calPanel = document.getElementById('cal-panel');
  const renderCal = (key) => {
    if (!calGrid) return;
    const plan = PLANS[key];
    $$('.day', calGrid).forEach((d) => d.remove());
    let k = 0;
    for (let d = 1; d <= 28; d += 1) {
      const cell = document.createElement('div');
      cell.className = 'day';
      const n = document.createElement('span');
      n.className = 'day-n';
      n.textContent = String(d);
      cell.appendChild(n);
      (plan.days[d] || []).forEach((type) => {
        const [cls, label] = CHIP[type];
        const c = document.createElement('span');
        c.className = `chip ${cls}`;
        c.style.setProperty('--k', String(k += 1));
        c.textContent = label;
        if (type === 'reel' && plan.tiktok) {
          const s = document.createElement('small');
          s.textContent = '+ TikTok';
          c.appendChild(s);
        }
        cell.appendChild(c);
      });
      calGrid.appendChild(cell);
    }
    calGrid.setAttribute('aria-label', `Beispiel eines Contentplans über vier Wochen für das Paket ${NAMES[key]}: ${plan.sum.map(([a, b]) => `${a} ${b}`).join(', ')}, dazu Contentplan am Monatsanfang und Report am Monatsende.`);
  };
  const selectTab = (key, focus) => {
    tabs.forEach((t) => {
      const on = t.dataset.tab === key;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    if (calPanel) calPanel.setAttribute('aria-labelledby', `tab-${key}`);
    renderCal(key);
  };
  if (tabs.length) {
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => selectTab(t.dataset.tab));
      t.addEventListener('keydown', (e) => {
        let j = null;
        if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
        if (e.key === 'Home') j = 0;
        if (e.key === 'End') j = tabs.length - 1;
        if (j !== null) { e.preventDefault(); selectTab(tabs[j].dataset.tab, true); }
      });
    });
    selectTab('standard');
  }

  /* ---------- Kontakt: wechselndes Wort ---------- */
  const rot = $('[data-rotate]');
  if (rot) {
    const words = $$('.rot-w', rot);
    let i = 0;
    setInterval(() => {
      if (!canMove() || document.hidden) return;
      const cur = words[i];
      i = (i + 1) % words.length;
      cur.classList.remove('is-on');
      cur.classList.add('is-out');
      words[i].classList.remove('is-out');
      words[i].classList.add('is-on');
      setTimeout(() => cur.classList.remove('is-out'), 650);
    }, 2400);
  }

  /* ---------- Leiste unten (Telefon) ----------
     Erscheint erst nach dem ersten Bildschirm und geht bei Kontakt und Fußzeile weg. */
  const mbar = $('[data-mbar]');
  const contact = $('#kontakt');
  const foot = $('.ft');
  if (hero && contact && 'IntersectionObserver' in window) {
    const seen = { hero: true, contact: false, foot: false };
    const upd = () => {
      if (mbar) mbar.classList.toggle('is-shown', !seen.hero && !seen.contact && !seen.foot);
    };
    new IntersectionObserver(([e]) => { seen.hero = e.isIntersecting; upd(); }).observe(hero);
    new IntersectionObserver(([e]) => { seen.contact = e.isIntersecting; upd(); }).observe(contact);
    if (foot) new IntersectionObserver(([e]) => { seen.foot = e.isIntersecting; upd(); }).observe(foot);
  }

  applyStill();

  /* ---------- Formular ----------
     Sendet an /anfrage.php (data-endpoint). Ohne JavaScript schickt der Browser das Formular direkt dorthin.
     Eingaben bleiben bei jedem Fehler stehen. */
  const form = document.getElementById('anfrage');
  if (!form) return;
  const statusBox = $('[data-form-status]', form);
  const submitBtn = $('[data-submit]', form);
  const DEFAULT_LABEL = submitBtn.textContent;
  const MAIL = 'info@maximalmobil.de';
  const PHONE = '+49 173 6386145';
  const TIMEOUT_MS = 15000;
  const loadedAt = performance.now();
  let sending = false;

  const ERROR_TARGETS = {
    betrieb: { id: 'e-betrieb', inputs: () => [form.betrieb] },
    name: { id: 'e-name', inputs: () => [form.name] },
    reach: { id: 'e-reach', inputs: () => [form.email, form.telefon] },
    email: { id: 'e-reach', inputs: () => [form.email] },
    telefon: { id: 'e-reach', inputs: () => [form.telefon] },
    nachricht: { id: 'e-msg', inputs: () => [form.nachricht] },
  };
  const setInvalid = (inputs, errorId, invalid, message) => {
    const err = document.getElementById(errorId);
    inputs.forEach((inp) => { if (invalid) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid'); });
    if (message) err.textContent = message;
    err.hidden = !invalid;
  };
  const clearAll = () => Object.values(ERROR_TARGETS).forEach((t) => setInvalid(t.inputs(), t.id, false));

  // Privatleute haben keinen Betrieb: das Feld tritt zurück, anfrage.php bekommt „Privatperson“
  const betriebField = $('[data-betrieb-field]', form);
  const isPrivat = () => ($('input[name="branche"]:checked', form) || {}).value === 'Privat';
  const syncPrivat = () => {
    betriebField.hidden = isPrivat();
    if (isPrivat()) {
      setInvalid([form.betrieb], 'e-betrieb', false);
      if (paketInput.value) setPaket('');
    }
  };
  $$('input[name="branche"]', form).forEach((r) => r.addEventListener('change', syncPrivat));

  const validate = () => {
    let first = null;
    [['betrieb', 'e-betrieb'], ['name', 'e-name']].filter(([name]) => !(name === 'betrieb' && isPrivat())).forEach(([name, id]) => {
      const bad = form[name].value.trim() === '';
      setInvalid([form[name]], id, bad);
      if (bad && !first) first = form[name];
    });
    const mail = form.email.value.trim();
    const tel = form.telefon.value.trim();
    const telDigits = tel.replace(/\D/g, '');
    if (!mail && !tel) {
      setInvalid([form.email, form.telefon], 'e-reach', true, 'Bitte geben Sie eine E-Mail-Adresse oder eine Telefonnummer an, damit wir uns melden können.');
      if (!first) first = form.email;
    } else if (mail && (!form.email.checkValidity() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail))) {
      setInvalid([form.email], 'e-reach', true, tel
        ? 'Bitte prüfen Sie die E-Mail-Adresse, zum Beispiel name@betrieb.de, oder lassen Sie das Feld leer.'
        : 'Bitte prüfen Sie die E-Mail-Adresse, zum Beispiel name@betrieb.de. Oder lassen Sie das Feld leer und geben Sie Ihre Telefonnummer an.');
      form.telefon.removeAttribute('aria-invalid');
      if (!first) first = form.email;
    } else if (tel && (!/^[0-9+()/.\-\s]+$/.test(tel) || telDigits.length < 5)) {
      setInvalid([form.telefon], 'e-reach', true, telDigits.length < 5 && /^[0-9+()/.\-\s]+$/.test(tel)
        ? 'Die Telefonnummer ist zu kurz. Bitte geben Sie sie mit Vorwahl an, zum Beispiel 0123 456789.'
        : 'Bitte geben Sie die Telefonnummer nur mit Ziffern und + ( ) / - an, zum Beispiel 0123 456789.');
      form.email.removeAttribute('aria-invalid');
      if (!first) first = form.telefon;
    } else {
      setInvalid([form.email, form.telefon], 'e-reach', false);
    }
    setInvalid([form.nachricht], 'e-msg', false);
    return first;
  };
  const showServerErrors = (errors) => {
    clearAll();
    let first = null;
    Object.entries(errors || {}).forEach(([key, msg]) => {
      const t = ERROR_TARGETS[key];
      if (!t) return;
      setInvalid(t.inputs(), t.id, true, msg);
      if (!first) first = t.inputs()[0];
    });
    return first;
  };
  form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid') === 'true') validate(); });
  const msgCount = $('[data-msg-count]', form);
  const syncCount = () => {
    if (!msgCount) return;
    const left = 3000 - form.nachricht.value.length;
    msgCount.hidden = left > 300;
    msgCount.textContent = left > 0 ? `Noch ${left.toLocaleString('de-DE')} Zeichen.` : 'Die Nachricht hat die Höchstlänge von 3.000 Zeichen erreicht.';
  };
  form.nachricht.addEventListener('input', syncCount);

  // Aus den Branchen oder Paketen kommend: Branche bzw. Paket ist schon gewählt.
  const picks = $('[data-picks]', form);
  const paketChip = $('[data-paket-chip]', form);
  const paketInput = $('[data-paket-input]', form);
  const paketName = $('[data-paket-name]', form);
  const syncPicks = () => { picks.hidden = paketChip.hidden; };
  const setPaket = (p) => {
    paketInput.value = p || '';
    paketName.textContent = p || '';
    paketChip.hidden = !p;
    syncPicks();
  };
  const firstField = () => (isPrivat() ? form.name : form.betrieb);
  $('[data-paket-remove]', form)?.addEventListener('click', () => { setPaket(''); firstField().focus(); });
  $$('[data-ask-paket]').forEach((a) => a.addEventListener('click', () => setPaket(a.dataset.askPaket)));
  const LABEL = { auto: 'Automobil', immo: 'Immobilien', privat: 'Privat' };
  $$('[data-ask-branche]').forEach((a) => a.addEventListener('click', () => {
    $$('input[name="branche"]', form).forEach((r) => { r.checked = r.value === LABEL[a.dataset.askBranche]; });
    if (a.dataset.askBranche === 'privat') setPaket('');
    syncPrivat();
  }));
  const nachrichtMit = () => form.nachricht.value.trim().slice(0, 3000);

  const showStatus = (kind, html) => {
    statusBox.className = `status${kind === 'ok' ? ' is-ok' : ''}`;
    statusBox.innerHTML = html;
    statusBox.hidden = false;
    statusBox.focus();
  };
  const busy = (on) => {
    sending = on;
    submitBtn.disabled = on;
    form.setAttribute('aria-busy', String(on));
    submitBtn.textContent = on ? 'Wird gesendet …' : DEFAULT_LABEL;
  };
  const mailtoHref = () => {
    const v = (k) => (form[k] ? form[k].value : '').toString().trim();
    const branche = ($('input[name="branche"]:checked', form) || {}).value || 'nicht angegeben';
    const betrieb = isPrivat() ? 'Privatperson' : v('betrieb');
    const body = [`Branche: ${branche}`, `Paket: ${v('paket') || 'nicht angegeben'}`, `Betrieb: ${betrieb}`, `Name: ${v('name')}`, `E-Mail: ${v('email') || '–'}`, `Telefon: ${v('telefon') || '–'}`, '', nachrichtMit()].join('\n');
    return `mailto:${MAIL}?subject=${encodeURIComponent(`Erstgespräch-Anfrage: ${betrieb}`)}&body=${encodeURIComponent(body)}`;
  };
  // Nach dem Senden weicht das Formular einer Bestätigung mit Name, Kontaktweg und nächstem Schritt
  const showSent = ({ name, email, tel }) => {
    const via = email && tel ? `per E-Mail an ${email} oder telefonisch unter ${tel}` : email ? `per E-Mail an ${email}` : `telefonisch unter ${tel}`;
    statusBox.className = 'status is-ok';
    statusBox.textContent = '';
    const head = document.createElement('strong');
    head.textContent = name ? `Danke, ${name}.` : 'Danke.';
    const p1 = document.createElement('p');
    p1.textContent = 'Ihre Anfrage ist angekommen.';
    const p2 = document.createElement('p');
    p2.textContent = `Wir melden uns innerhalb eines Werktags ${via}, um einen Termin für das kostenlose Erstgespräch zu finden.`;
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'btn btn-line';
    again.textContent = 'Weitere Anfrage senden';
    again.addEventListener('click', () => {
      form.classList.remove('is-sent');
      statusBox.hidden = true;
      firstField().focus();
    });
    statusBox.append(head, p1, p2, again);
    form.classList.add('is-sent');
    statusBox.hidden = false;
    statusBox.focus();
  };
  const rescue = () => `Sie können die Anfrage auch <a href="${mailtoHref().replace(/"/g, '&quot;')}">als E-Mail senden</a> oder anrufen: <a href="tel:+491736386145">${PHONE}</a>.`;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const firstInvalid = validate();
    if (firstInvalid) { firstInvalid.focus(); return; }
    if (navigator.onLine === false) {
      showStatus('error', '<strong>Sie sind gerade offline.</strong>Ihre Eingaben sind noch da. Sobald die Verbindung wieder steht, senden Sie die Anfrage einfach noch einmal.');
      return;
    }
    const data = new FormData(form);
    data.set('fill_ms', String(Math.round(performance.now() - loadedAt)));
    data.set('nachricht', nachrichtMit());
    if (isPrivat()) data.set('betrieb', 'Privatperson');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    busy(true);
    try {
      const res = await fetch(form.dataset.endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' }, signal: ctrl.signal });
      let json = {};
      try { json = await res.json(); } catch (err) { json = {}; }
      if (res.ok && json.ok) {
        const sent = { name: form.name.value.trim(), email: form.email.value.trim(), tel: form.telefon.value.trim() };
        form.reset();
        clearAll();
        setPaket('');
        syncPrivat();
        syncCount();
        showSent(sent);
      } else if (res.status === 422) {
        const first = showServerErrors(json.errors);
        statusBox.hidden = true;
        if (first) first.focus();
      } else if (res.status === 429) {
        showStatus('error', `<strong>Zu viele Anfragen in kurzer Zeit.</strong>Ihre Eingaben sind noch da. Bitte versuchen Sie es in einer Stunde noch einmal. ${rescue()}`);
      } else {
        showStatus('error', `<strong>Ihre Anfrage wurde nicht gesendet.</strong>Das lag an uns, nicht an Ihnen. Ihre Eingaben sind noch da. Versuchen Sie es in ein paar Minuten noch einmal. ${rescue()}`);
      }
    } catch (err) {
      const timedOut = err && err.name === 'AbortError';
      showStatus('error', timedOut
        ? `<strong>Noch keine Bestätigung.</strong>Unser Server hat nicht rechtzeitig geantwortet. Vielleicht ist Ihre Anfrage trotzdem angekommen. Ihre Eingaben sind noch da: Senden Sie ruhig noch einmal, schlimmstenfalls erreicht uns die Anfrage doppelt. ${rescue()}`
        : `<strong>Ihre Anfrage wurde nicht gesendet.</strong>Die Verbindung zu unserem Server kam nicht zustande. Ihre Eingaben sind noch da. Versuchen Sie es gleich noch einmal. ${rescue()}`);
    } finally {
      clearTimeout(timer);
      busy(false);
    }
  });
})();
