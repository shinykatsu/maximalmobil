/* maximalmobil – läuft im <head> vor dem ersten Zeichnen.
   Setzt die Klasse "js" und bereitet das Intro der Zeitleiste vor. Lädt main.js nicht,
   gibt das Intro nach 2,5 s trotzdem frei, damit nie etwas verborgen bleibt.
   Auf der Startseite am Telefon (schmal und hochkant) schaltet es vor dem ersten Bild die App-Ansicht ein,
   damit beim Laden nichts springt.
   Hell/Dunkel: Start ist immer dunkel; wer umschaltet, dessen Wahl wird gemerkt und vor dem ersten Bild gesetzt. */
(function (d) {
  d.classList.replace('no-js', 'js');
  var p = location.pathname;
  if ((p === '/' || /\/index(\.html)?$/.test(p)) && window.matchMedia('(max-width: 37.49em) and (min-height: 31.3em)').matches) {
    d.classList.add('app');
  }
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    d.classList.add('intro');
    setTimeout(function () { d.classList.remove('intro'); }, 2500);
  }

  /* ---------- Hell/Dunkel ---------- */
  var KEY = 'mm-theme';
  var saved = null;
  try { saved = window.localStorage.getItem(KEY); } catch (e) { /* kein Speicher: dunkel */ }
  if (saved === 'light') d.setAttribute('data-theme', 'light');

  var isLight = function () { return d.getAttribute('data-theme') === 'light'; };
  var paint = function () {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isLight() ? '#fdfdfb' : '#0a0a0a');
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute('aria-pressed', String(isLight()));
  };
  paint();
  document.addEventListener('DOMContentLoaded', paint);
  document.addEventListener('click', function (e) {
    var t = e.target;
    var button = t && t.closest ? t.closest('[data-theme-toggle]') : null;
    if (!button) return;
    if (isLight()) d.removeAttribute('data-theme');
    else d.setAttribute('data-theme', 'light');
    try { window.localStorage.setItem(KEY, isLight() ? 'light' : 'dark'); } catch (err) { /* nur für diesen Besuch */ }
    paint();
  });
})(document.documentElement);
