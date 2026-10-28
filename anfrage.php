<?php
/*
 * maximalmobil – Anfrage-Formular
 *
 * Nimmt das Formular „Erstgespräch anfragen“ der Startseite an, prüft die Eingaben
 * und schickt sie als E-Mail an MAIL_TO. Es werden keine Anfragen auf dem Server gespeichert.
 *
 * Antwort:
 *   - mit Accept: application/json (Formular mit JavaScript): JSON und HTTP-Status
 *       200 {ok:true} · 422 {ok:false,errors:{feld:text}} · 429 {ok:false,error:"rate"}
 *       403/405 {ok:false,error:"..."} · 500 {ok:false,error:"mail"}
 *   - sonst (Formular ohne JavaScript): eine Seite im Website-Look
 *
 * Spam-Schutz: verstecktes Feld „website“, Mindest-Ausfüllzeit (fill_ms) und
 * höchstens RATE_MAX Anfragen pro Stunde je Absender (gespeichert nur als täglich
 * wechselnder Hash der IP-Adresse, maximal eine Stunde lang).
 */

declare(strict_types=1);

header_remove('X-Powered-By');
date_default_timezone_set('Europe/Berlin');

const MAIL_TO     = 'info@maximalmobil.de';
const MAIL_FROM   = 'info@maximalmobil.de';   // muss ein Postfach der eigenen Domain sein
const RATE_MAX    = 5;
const RATE_WINDOW = 3600;                     // Sekunden
const MIN_FILL_MS = 2500;                     // schneller ausgefüllt = sehr wahrscheinlich ein Bot
const LIMITS      = ['betrieb' => 120, 'name' => 100, 'email' => 160, 'telefon' => 40, 'nachricht' => 3000];
const BRANCHEN    = ['Automobil', 'Immobilien', 'Privat'];
const PAKETE      = ['Basis', 'Standard', 'Premium'];
const PHONE_SHOWN = '+49 173 6386145';
const PHONE_LINK  = '+491736386145';

header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

/* ---------- Hilfsfunktionen ---------- */

function wants_json(): bool
{
    return stripos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;
}

function h(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function str_len(string $s): int
{
    return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : (int) preg_match_all('/./us', $s);
}

/** Einzeiliger Wert: ohne Steuerzeichen und Zeilenumbrüche (schützt die Mail-Header). */
function one_line(string $s): string
{
    $s = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $s) ?? '';
    return trim(preg_replace('/\s{2,}/u', ' ', $s) ?? '');
}

/** Mehrzeiliger Text: Zeilenumbrüche vereinheitlichen, sonstige Steuerzeichen entfernen. */
function multi_line(string $s): string
{
    $s = str_replace(["\r\n", "\r"], "\n", $s);
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    return trim(preg_replace("/\n{3,}/", "\n\n", $s) ?? '');
}

function post(string $key): string
{
    $v = $_POST[$key] ?? '';
    if (!is_string($v)) return '';
    // ungültiges UTF-8 verwerfen statt weiterzureichen
    return preg_match('//u', $v) ? $v : '';
}

function encode_header(string $s): string
{
    if (function_exists('mb_encode_mimeheader')) {
        return mb_encode_mimeheader($s, 'UTF-8', 'B', "\r\n");
    }
    return '=?UTF-8?B?' . base64_encode($s) . '?=';
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex');
    if (wants_json()) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE);
        exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    render_page($status, $payload);
    exit;
}

/** Antwortseite für Besucher ohne JavaScript, im Look der Rechtsseiten (Fassung „Der Sucher“, 28.10.2026). */
function render_page(int $status, array $payload): void
{
    $mail = h(MAIL_TO);
    $fallback = 'Schreiben Sie uns an <a href="mailto:' . $mail . '">' . $mail . '</a> oder rufen Sie an: '
        . '<a href="tel:' . h(PHONE_LINK) . '">' . h(PHONE_SHOWN) . '</a>.';

    if ($status === 200) {
        $title = 'Danke, Ihre Anfrage ist angekommen.';
        $body = '<p>Wir melden uns bei Ihnen, um einen Termin für das kostenlose Erstgespräch zu finden.</p>';
    } elseif ($status === 422) {
        $title = 'Bitte prüfen Sie Ihre Angaben.';
        $items = '';
        foreach (($payload['errors'] ?? []) as $msg) $items .= '<li>' . h((string) $msg) . '</li>';
        $body = '<ul>' . $items . '</ul><p>Gehen Sie mit der Zurück-Taste Ihres Browsers zum Formular. Ihre Eingaben sind dort in der Regel noch vorhanden.</p>';
    } elseif ($status === 429) {
        $title = 'Zu viele Anfragen in kurzer Zeit.';
        $body = '<p>Bitte versuchen Sie es in einer Stunde noch einmal. ' . $fallback . '</p>';
    } else {
        $title = 'Ihre Anfrage wurde nicht gesendet.';
        $body = '<p>Das lag an uns, nicht an Ihnen. Versuchen Sie es in ein paar Minuten noch einmal. ' . $fallback . '</p>';
    }

    echo '<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0a0a0a">
<meta name="color-scheme" content="dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/syne-800.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/outfit-300.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/style.css?v=2026-10-28-v3c">
<title>' . h($title) . ' – maximalmobil</title>
</head>
<body class="page-legal">
<svg class="sprite" aria-hidden="true" focusable="false">
  <symbol id="i-arrow" viewBox="0 0 20 20"><path d="M4 10h11.5M11 5.5 15.5 10 11 14.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-left" viewBox="0 0 20 20"><path d="M16 10H4.5M9 5.5 4.5 10 9 14.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-out" viewBox="0 0 20 20"><path d="M6 14 14 6M7.5 6H14v6.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></symbol>
</svg>
<div class="grid-bg" aria-hidden="true"><div><span></span><span></span><span></span><span></span><span></span><span></span></div></div>
<header class="head">
  <div class="head-in">
    <a class="brand" href="/" aria-label="maximalmobil, zur Startseite"><img src="/assets/logo/wortmarke.svg" alt="" width="190" height="18"></a>
  </div>
</header>
<main id="inhalt" class="legal">
  <div class="wrap cols">
    <article class="legal-body c-2-5">
      <a class="back" href="/"><svg class="i" aria-hidden="true"><use href="#i-left"/></svg>Zur Startseite</a>
      <h1 class="h-msg">' . h($title) . '</h1>
      ' . $body . '
    </article>
  </div>
</main>
<footer class="ft ft-legal">
  <div class="wrap cols ft-cols">
    <div class="ft-col c-1-2">
      <p class="ft-claim">Social Media Agentur für Automobil und Immobilien. Fotos und Videos auch für Privatleute.</p>
    </div>
    <nav class="ft-col c-3" aria-label="Seiten">
      <p class="label">Seiten</p>
      <a href="/">Startseite</a>
      <a href="/#kontakt">Kontakt</a>
    </nav>
    <div class="ft-col c-4">
      <p class="label">Kontakt</p>
      <a href="tel:+491736386145">+49 173 6386145</a>
      <a href="mailto:info@maximalmobil.de">info@maximalmobil.de</a>
    </div>
    <div class="ft-col c-5">
      <p class="label">Kanäle</p>
      <a href="https://www.instagram.com/maximalmobil/" rel="noopener" target="_blank">Instagram<svg class="i" aria-hidden="true"><use href="#i-out"/></svg><span class="sr-only"> (öffnet in neuem Tab)</span></a>
      <a href="https://www.tiktok.com/@maximalmobil" rel="noopener" target="_blank">TikTok<svg class="i" aria-hidden="true"><use href="#i-out"/></svg><span class="sr-only"> (öffnet in neuem Tab)</span></a>
    </div>
    <nav class="ft-col c-6" aria-label="Rechtliches">
      <p class="label">Rechtliches</p>
      <a href="/impressum">Impressum</a>
      <a href="/datenschutz">Datenschutz</a>
    </nav>
  </div>
  <div class="wrap ft-bottom">
    <p>© ' . date('Y') . ' maximalmobil</p>
  </div>
</footer>
</body>
</html>';
}

/* ---------- Anfrage prüfen ---------- */

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    if (!wants_json()) {
        header('Location: /#kontakt', true, 303);
        exit;
    }
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'method']);
}

// Nur Anfragen von der eigenen Website annehmen
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    $originHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
    $ownHost = strtolower(preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '') ?? '');
    if ($originHost === '' || $originHost !== $ownHost) {
        respond(403, ['ok' => false, 'error' => 'origin']);
    }
}

// Spam-Falle 1: verstecktes Feld ist ausgefüllt -> scheinbar erfolgreich, aber nichts senden
if (trim(post('website')) !== '') {
    respond(200, ['ok' => true]);
}

// Spam-Falle 2: in unter MIN_FILL_MS ausgefüllt (nur mit JavaScript gemessen)
$fill = post('fill_ms');
if ($fill !== '' && ctype_digit($fill) && (int) $fill < MIN_FILL_MS) {
    respond(200, ['ok' => true]);
}

$branche   = one_line(post('branche'));
$paket     = one_line(post('paket'));
$betrieb   = one_line(post('betrieb'));
$name      = one_line(post('name'));
$email     = one_line(post('email'));
$telefon   = one_line(post('telefon'));
$nachricht = multi_line(post('nachricht'));

$errors = [];
if ($betrieb === '') $errors['betrieb'] = 'Bitte nennen Sie den Namen Ihres Betriebs.';
elseif (str_len($betrieb) > LIMITS['betrieb']) $errors['betrieb'] = 'Der Name des Betriebs ist zu lang (höchstens ' . LIMITS['betrieb'] . ' Zeichen).';

if ($name === '') $errors['name'] = 'Bitte nennen Sie Ihren Namen.';
elseif (str_len($name) > LIMITS['name']) $errors['name'] = 'Der Name ist zu lang (höchstens ' . LIMITS['name'] . ' Zeichen).';

$emailValid = false;
if ($email !== '') {
    $emailValid = str_len($email) <= LIMITS['email']
        && (filter_var($email, FILTER_VALIDATE_EMAIL, FILTER_FLAG_EMAIL_UNICODE) !== false
            || preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u', $email) === 1);
    if (!$emailValid) $errors['email'] = $telefon !== ''
        ? 'Bitte prüfen Sie die E-Mail-Adresse, zum Beispiel name@betrieb.de, oder lassen Sie das Feld leer.'
        : 'Bitte prüfen Sie die E-Mail-Adresse, zum Beispiel name@betrieb.de. Oder lassen Sie das Feld leer und geben Sie Ihre Telefonnummer an.';
}

if ($telefon !== '') {
    $digits = preg_replace('/\D/', '', $telefon) ?? '';
    if (str_len($telefon) > LIMITS['telefon'] || !preg_match('/^[0-9+()\/.\-\s]+$/', $telefon) || strlen($digits) < 5) {
        $errors['telefon'] = 'Bitte geben Sie die Telefonnummer nur mit Ziffern und + ( ) / - an, zum Beispiel 0123 456789.';
    }
}

if ($email === '' && $telefon === '') {
    $errors['reach'] = 'Bitte geben Sie eine E-Mail-Adresse oder eine Telefonnummer an, damit wir uns melden können.';
}

if (str_len($nachricht) > LIMITS['nachricht']) {
    $errors['nachricht'] = 'Die Nachricht ist zu lang (höchstens ' . number_format(LIMITS['nachricht'], 0, ',', '.') . ' Zeichen).';
}

if ($branche !== '' && !in_array($branche, BRANCHEN, true)) $branche = '';
if ($paket !== '' && !in_array($paket, PAKETE, true)) $paket = '';

if ($errors) {
    respond(422, ['ok' => false, 'errors' => $errors]);
}

/* ---------- Begrenzung pro Absender ---------- */

$ip = $_SERVER['REMOTE_ADDR'] ?? '';
$key = hash('sha256', $ip . '|' . gmdate('Y-m-d') . '|maximalmobil-anfrage');
$rateFile = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'mm-anfrage-rate.json';
$fh = @fopen($rateFile, 'c+');
if ($fh !== false && flock($fh, LOCK_EX)) {
    $now = time();
    $data = json_decode((string) stream_get_contents($fh), true);
    if (!is_array($data)) $data = [];
    foreach ($data as $k => $stamps) {
        $data[$k] = array_values(array_filter((array) $stamps, function ($t) use ($now) { return is_int($t) && $t > $now - RATE_WINDOW; }));
        if (!$data[$k]) unset($data[$k]);
    }
    $count = count($data[$key] ?? []);
    if ($count >= RATE_MAX) {
        flock($fh, LOCK_UN);
        fclose($fh);
        respond(429, ['ok' => false, 'error' => 'rate']);
    }
    $data[$key][] = $now;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($data));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
}
// Ist die Datei nicht schreibbar, wird ohne Begrenzung weitergemacht, statt echte Anfragen abzuweisen.

/* ---------- E-Mail senden ---------- */

$subject = encode_header('Erstgespräch-Anfrage: ' . $betrieb);
$lines = [
    'Neue Anfrage über maximalmobil.de',
    '',
    'Branche:   ' . ($branche !== '' ? $branche : 'nicht angegeben'),
    'Paket:     ' . ($paket !== '' ? $paket : 'nicht angegeben'),
    'Betrieb:   ' . $betrieb,
    'Name:      ' . $name,
    'E-Mail:    ' . ($email !== '' ? $email : '–'),
    'Telefon:   ' . ($telefon !== '' ? $telefon : '–'),
    '',
    'Nachricht:',
    $nachricht !== '' ? $nachricht : '–',
    '',
    '—',
    'Gesendet am ' . date('d.m.Y, H:i') . ' Uhr',
];
$body = implode("\r\n", str_replace("\n", "\r\n", $lines));
// base64: keine Probleme mit Umlauten, Emoji oder sehr langen Zeilen
$encodedBody = chunk_split(base64_encode($body), 76, "\r\n");

$headers = [
    'From: ' . encode_header('maximalmobil Website') . ' <' . MAIL_FROM . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
];
if ($emailValid && filter_var($email, FILTER_VALIDATE_EMAIL) !== false) {
    $headers[] = 'Reply-To: ' . $email;
}

if (getenv('MM_MAIL_DRYRUN') === '1') {
    // nur für lokale Tests: statt zu senden in eine Datei schreiben
    file_put_contents(rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'mm-anfrage-dryrun.txt',
        "To: " . MAIL_TO . "\r\nSubject: $subject\r\n" . implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n\r\n=====\r\n", FILE_APPEND);
    $sent = true;
} else {
    $sent = @mail(MAIL_TO, $subject, $encodedBody, implode("\r\n", $headers), '-f' . MAIL_FROM)
        || @mail(MAIL_TO, $subject, $encodedBody, implode("\r\n", $headers));
}

if (!$sent) {
    respond(500, ['ok' => false, 'error' => 'mail']);
}

respond(200, ['ok' => true]);
