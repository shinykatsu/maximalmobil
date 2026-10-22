/* maximalmobil – läuft im <head> vor dem ersten Zeichnen.
   Setzt die Klasse "js" und bereitet das Intro der Zeitleiste vor. Lädt main.js nicht,
   gibt das Intro nach 2,5 s trotzdem frei, damit nie etwas verborgen bleibt. */
(function (d) {
  d.classList.replace('no-js', 'js');
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    d.classList.add('intro');
    setTimeout(function () { d.classList.remove('intro'); }, 2500);
  }
})(document.documentElement);
