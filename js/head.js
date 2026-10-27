/* maximalmobil – läuft im <head> vor dem ersten Zeichnen.
   Setzt die Klasse "js" und bereitet das Intro der Zeitleiste vor. Lädt main.js nicht,
   gibt das Intro nach 2,5 s trotzdem frei, damit nie etwas verborgen bleibt.
   Auf der Startseite am Telefon (schmal und hochkant) schaltet es vor dem ersten Bild die App-Ansicht ein,
   damit beim Laden nichts springt. */
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
})(document.documentElement);
