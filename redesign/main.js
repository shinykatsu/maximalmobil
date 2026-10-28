/* maximalmobil, Redesign-Entwurf
   Kontaktabzug im ersten Bild, Reel, Leistungen mit mitlaufendem Bild, Bildraster, Formular.
   Ohne JavaScript bleibt alles sichtbar und das Formular schickt direkt an anfrage.php. */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionOK = () => !reduce.matches;
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  const wide = window.matchMedia('(min-width: 62.01em)');

  /* ---------- Kontaktabzug: Reihen bündig setzen, Beschreibung des Drehs beim Zeigen ---------- */
  const sheet = document.querySelector('[data-sheet]');
  if (sheet) {
    sheet.querySelectorAll('.frame').forEach((f) => {
      const img = f.querySelector('img');
      // Seitenverhältnis für die bündigen Reihen
      const ar = (Number(img.getAttribute('width')) / Number(img.getAttribute('height')) || 1).toFixed(3);
      (f.parentElement.classList.contains('run-first') ? f.parentElement : f).style.setProperty('--ar', ar);
    });

    // Zeigt man auf einen Dreh, steht seine Beschreibung an fester Stelle über dem Abzug
    const note = sheet.querySelector('[data-sheet-note]');
    const fallback = note.textContent;
    let shown = fallback;
    let timer = 0;
    const show = (text) => {
      if (text === shown) return;
      shown = text;
      clearTimeout(timer);
      if (!motionOK()) { note.textContent = text; return; }
      note.classList.add('is-swap');
      timer = setTimeout(() => { note.textContent = shown; note.classList.remove('is-swap'); }, 120);
    };
    const runOf = (el) => (el && el.closest ? el.closest('.run') : null);
    sheet.addEventListener('pointerover', (e) => { const r = runOf(e.target); show(r ? r.dataset.run : fallback); });
    sheet.addEventListener('pointerleave', () => show(fallback));
  }

  /* ---------- Reel im ersten Bild: drei eigene Clips nacheinander, nur sichtbar, mit Pause (WCAG 2.2.2) ---------- */
  const reel = document.querySelector('[data-reel]');
  if (reel) {
    const v = reel.querySelector('video');
    const btn = reel.querySelector('[data-reel-pause]');
    const clips = ['auto-zusammenschnitt', 'auto-lotus', 'auto-rx7-japan'];
    const webm = v.canPlayType('video/webm; codecs="vp9"') === 'probably';
    let idx = 0;
    let paused = false;
    let visible = false;
    let started = false;
    let triedMp4 = false;
    v.loop = false;
    v.muted = true;
    v.setAttribute('muted', '');
    const load = () => {
      triedMp4 = !webm;
      v.poster = `../assets/videos/${clips[idx]}.jpg`;
      v.src = `../assets/videos/${clips[idx]}-s.${webm ? 'webm' : 'mp4'}`;
      v.load();
    };
    const canPlay = () => motionOK() && !saveData;
    const sync = () => {
      btn.hidden = !canPlay();
      btn.firstChild.textContent = paused ? 'Abspielen' : 'Pause';
      if (canPlay() && visible && !paused && !document.hidden) {
        if (!started) { started = true; load(); }
        v.play().catch(() => {});
      } else if (!v.paused) {
        v.pause();
      }
    };
    v.addEventListener('ended', () => { idx = (idx + 1) % clips.length; load(); sync(); });
    v.addEventListener('error', () => {
      if (!triedMp4) { triedMp4 = true; v.src = `../assets/videos/${clips[idx]}-s.mp4`; v.load(); sync(); }
    });
    btn.addEventListener('click', () => { paused = !paused; sync(); });
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => entries.forEach((e) => { visible = e.isIntersecting; sync(); }), { threshold: 0.25 }).observe(reel);
    }
    reduce.addEventListener?.('change', sync);
    sync();
  }

  /* ---------- Leistungen: auf breiten Rechnern zeigt das mitlaufende Feld das Bild der aktiven Leistung.
     Aktiv wird, worauf man zeigt, was den Fokus hat oder was beim Scrollen die Mitte des Fensters kreuzt. ---------- */
  const svcList = document.querySelector('[data-svc-list]');
  const clips = [];
  if (svcList) {
    const items = [...svcList.querySelectorAll('[data-svc]')];
    let active = null;
    const activate = (it) => {
      if (!it || it === active) return;
      if (active) active.classList.remove('is-active');
      active = it;
      it.classList.add('is-active');
      clips.forEach((c) => c.sync());
    };
    activate(items[0]);
    const itemOf = (el) => (el && el.closest ? el.closest('[data-svc]') : null);
    svcList.addEventListener('pointerover', (e) => { if (wide.matches) activate(itemOf(e.target)); });
    svcList.addEventListener('focusin', (e) => activate(itemOf(e.target)));
    let raf = 0;
    const pick = () => {
      raf = 0;
      if (!wide.matches) return;
      const mid = window.innerHeight * 0.45;
      let best = null;
      let bestD = Infinity;
      items.forEach((it) => {
        const r = it.querySelector('.svc-body').getBoundingClientRect();
        const d = r.top > mid ? r.top - mid : r.bottom < mid ? mid - r.bottom : 0;
        if (d < bestD) { bestD = d; best = it; }
      });
      // erst wenn die Liste die Mitte erreicht hat, sonst bleibt die erste Leistung aktiv
      if (best && bestD < window.innerHeight * 0.3) activate(best);
    };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(pick); }, { passive: true });
    wide.addEventListener?.('change', () => clips.forEach((c) => c.sync()));
  }

  /* ---------- Clips in den Leistungen: nur sichtbar, nur die aktive Leistung, mit Pause (WCAG 2.2.2) ---------- */
  document.querySelectorAll('[data-clip]').forEach((fig) => {
    const v = fig.querySelector('video');
    const btn = fig.querySelector('[data-clip-pause]');
    const item = fig.closest('[data-svc]');
    let paused = false;
    let visible = false;
    v.muted = true;
    const canPlay = () => motionOK() && !saveData;
    const sync = () => {
      btn.hidden = !canPlay();
      btn.firstChild.textContent = paused ? 'Abspielen' : 'Pause';
      const shown = !wide.matches || !item || item.classList.contains('is-active');
      if (canPlay() && visible && shown && !paused && !document.hidden) v.play().catch(() => {});
      else if (!v.paused) v.pause();
    };
    btn.addEventListener('click', () => { paused = !paused; sync(); });
    document.addEventListener('visibilitychange', sync);
    reduce.addEventListener?.('change', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => entries.forEach((e) => { visible = e.isIntersecting; sync(); }), { threshold: 0.25 }).observe(fig);
    }
    clips.push({ sync });
    sync();
  });

  /* ---------- Bildraster Automobil: Foto erst laden, wenn das Raster in die Nähe kommt ---------- */
  const board = document.querySelector('[data-board]');
  if (board) {
    if ('IntersectionObserver' in window) {
      const near = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        board.classList.add('is-near');
        near.disconnect();
      }), { rootMargin: '600px 0px' });
      near.observe(board);
    } else {
      board.classList.add('is-near');
    }
  }

  /* ---------- Einblenden der Abschnitte, einmal, in Leserichtung (ab Tablet; auf dem Telefon steht alles sofort da) ---------- */
  if (motionOK() && 'IntersectionObserver' in window && window.matchMedia('(min-width: 48em)').matches) {
    const mark = (el, kind, i) => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return; // was schon zu sehen ist, wartet nicht
      el.setAttribute('data-reveal', kind || '');
      if (i) el.style.setProperty('--i', String(i));
    };
    document.querySelectorAll('.svc-head, .steps-head, .shots, .extras, .contact-say, .contact-direct, .form').forEach((el) => mark(el));
    document.querySelectorAll('.moment').forEach((el, k) => mark(el, '', Math.min(k, 3)));
    document.querySelectorAll('.board .t').forEach((el) => {
      const r = Number(getComputedStyle(el).getPropertyValue('--r')) || 0;
      mark(el, 'tile', Math.min(r, 3));
    });
    document.querySelectorAll('.plan-table, .plan-block').forEach((el, k) => mark(el, '', Math.min(k, 2)));
    document.querySelectorAll('.contact-pic').forEach((el) => mark(el, 'shutter'));
    document.querySelectorAll('.foot .tile').forEach((el, k) => mark(el, '', Math.min(Math.floor(k / 2), 2)));
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }), { rootMargin: '0px 0px 8% 0px', threshold: 0 });
    document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    // Was beim schnellen Scrollen oder per Sprungmarke übersprungen wurde, ist trotzdem sofort da
    let sweepTimer = 0;
    const sweep = () => {
      sweepTimer = 0;
      const limit = window.innerHeight * 1.08;
      document.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => {
        if (el.getBoundingClientRect().top < limit) { el.classList.add('is-in'); io.unobserve(el); }
      });
    };
    window.addEventListener('scroll', () => { if (!sweepTimer) sweepTimer = setTimeout(sweep, 90); }, { passive: true });
  }

  /* ---------- Telefon: „Anfragen“ unten rechts, sobald der erste Bildschirm vorbei ist ---------- */
  const fab = document.querySelector('[data-fab]');
  const hero = document.querySelector('.hero');
  const contact = document.getElementById('kontakt');
  if (fab && hero && contact && 'IntersectionObserver' in window) {
    let heroIn = true;
    let contactIn = false;
    const upd = () => fab.classList.toggle('is-shown', !heroIn && !contactIn);
    new IntersectionObserver(([e]) => { heroIn = e.isIntersecting; upd(); }).observe(hero);
    new IntersectionObserver(([e]) => { contactIn = e.isIntersecting; upd(); }).observe(contact);
  }

  /* ---------- Formular ----------
     Sendet an ../anfrage.php (data-endpoint). Ohne JavaScript schickt der Browser das Formular direkt dorthin.
     Eingaben bleiben bei jedem Fehler stehen. */
  const form = document.getElementById('anfrage');
  if (!form) return;
  const statusBox = form.querySelector('[data-form-status]');
  const submitBtn = form.querySelector('[data-submit]');
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
  const betriebField = form.querySelector('[data-betrieb-field]');
  const isPrivat = () => (form.querySelector('input[name="branche"]:checked') || {}).value === 'Privat';
  const syncPrivat = () => {
    betriebField.hidden = isPrivat();
    if (isPrivat()) setInvalid([form.betrieb], 'e-betrieb', false);
  };
  form.querySelectorAll('input[name="branche"]').forEach((r) => r.addEventListener('change', syncPrivat));

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
    } else if (mail && !form.email.checkValidity()) {
      setInvalid([form.email], 'e-reach', true, tel
        ? 'Bitte prüfen Sie die E-Mail-Adresse, zum Beispiel name@betrieb.de, oder lassen Sie das Feld leer.'
        : 'Bitte prüfen Sie die E-Mail-Adresse, zum Beispiel name@betrieb.de. Oder lassen Sie das Feld leer und geben Sie Ihre Telefonnummer an.');
      form.telefon.removeAttribute('aria-invalid');
      if (!first) first = form.email;
    } else if (tel && (!/^[0-9+()/.\-\s]+$/.test(tel) || telDigits.length < 5)) {
      setInvalid([form.telefon], 'e-reach', true, 'Bitte geben Sie die Telefonnummer nur mit Ziffern und + ( ) / - an, zum Beispiel 0123 456789.');
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

  // Aus den Leistungen, dem Automobil-Raster oder den Paketen kommend: Branche, Leistung bzw. Paket ist schon gewählt.
  // anfrage.php kennt kein Feld für die Leistung; sie steht deshalb in der ersten Zeile der Nachricht.
  const picks = form.querySelector('[data-picks]');
  const paketChip = form.querySelector('[data-paket-chip]');
  const paketInput = form.querySelector('[data-paket-input]');
  const paketName = form.querySelector('[data-paket-name]');
  const leistungChip = form.querySelector('[data-leistung-chip]');
  const leistungName = form.querySelector('[data-leistung-name]');
  let leistung = '';
  const syncPicks = () => { picks.hidden = paketChip.hidden && leistungChip.hidden; };
  const setPaket = (p) => {
    paketInput.value = p || '';
    paketName.textContent = p || '';
    paketChip.hidden = !p;
    syncPicks();
  };
  const setLeistung = (l) => {
    leistung = l || '';
    leistungName.textContent = leistung;
    leistungChip.hidden = !leistung;
    syncPicks();
  };
  const firstField = () => (isPrivat() ? form.name : form.betrieb);
  form.querySelector('[data-paket-remove]')?.addEventListener('click', () => { setPaket(''); firstField().focus(); });
  form.querySelector('[data-leistung-remove]')?.addEventListener('click', () => { setLeistung(''); firstField().focus(); });
  document.querySelectorAll('[data-ask-paket]').forEach((a) => a.addEventListener('click', () => setPaket(a.dataset.askPaket)));
  const LABEL = { auto: 'Automobil', immo: 'Immobilien', privat: 'Privat' };
  document.querySelectorAll('[data-ask-branche]').forEach((a) => a.addEventListener('click', () => {
    form.querySelectorAll('input[name="branche"]').forEach((r) => { r.checked = r.value === LABEL[a.dataset.askBranche]; });
    if (a.dataset.askBranche === 'privat') setPaket('');
    setLeistung(a.dataset.askLeistung || '');
    syncPrivat();
  }));
  const nachrichtMit = () => {
    const msg = form.nachricht.value.trim();
    return (leistung ? `Leistung: ${leistung}${msg ? `\n\n${msg}` : ''}` : msg).slice(0, 3000);
  };

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
    const branche = (form.querySelector('input[name="branche"]:checked') || {}).value || 'nicht angegeben';
    const betrieb = isPrivat() ? 'Privatperson' : v('betrieb');
    const body = [`Branche: ${branche}`, `Paket: ${v('paket') || 'nicht angegeben'}`, `Betrieb: ${betrieb}`, `Name: ${v('name')}`, `E-Mail: ${v('email') || '–'}`, `Telefon: ${v('telefon') || '–'}`, '', nachrichtMit()].join('\n');
    return `mailto:${MAIL}?subject=${encodeURIComponent(`Erstgespräch-Anfrage: ${betrieb}`)}&body=${encodeURIComponent(body)}`;
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
      try { json = await res.json(); } catch { json = {}; }
      if (res.ok && json.ok) {
        form.reset();
        clearAll();
        setPaket('');
        setLeistung('');
        syncPrivat();
        showStatus('ok', '<strong>Danke, Ihre Anfrage ist angekommen.</strong>Wir melden uns bei Ihnen, um einen Termin für das Erstgespräch zu finden.');
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
