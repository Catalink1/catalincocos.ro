<?php
// articol.php — servește articol.html cu titlul, descrierea și imaginea articolului
// deja puse în <head>, pentru Facebook, LinkedIn și alte rețele care nu rulează
// JavaScript când generează previzualizarea unui link.
// .htaccess trimite aici cererile pentru /articol.html; pagina rămâne aceeași,
// iar JS-ul din articol.html continuă să încarce articolul ca înainte.

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-cache, must-revalidate');

$html = @file_get_contents(__DIR__ . '/articol.html');
if ($html === false) {
    http_response_code(500);
    exit;
}

$slug = isset($_GET['slug']) ? (string) $_GET['slug'] : '';
$articol = null;
if ($slug !== '') {
    $json = @file_get_contents(__DIR__ . '/data/blog.json');
    $lista = $json !== false ? json_decode($json, true) : null;
    if (is_array($lista)) {
        foreach ($lista as $a) {
            if (isset($a['slug']) && $a['slug'] === $slug) {
                $articol = $a;
                break;
            }
        }
    }
}

if ($articol === null) {
    echo $html;
    exit;
}

$e = function ($s) {
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
};

$titlu = !empty($articol['seo_title']) ? $articol['seo_title'] : ($articol['titlu'] ?? '');
$descriere = $articol['rezumat'] ?? '';
$url = 'https://catalincocos.ro/articol.html?slug=' . rawurlencode($slug);
$imagine = !empty($articol['imagine'])
    ? 'https://catalincocos.ro/img/' . rawurlencode($articol['imagine'])
    : 'https://catalincocos.ro/img/eu.jpg';
$imagineAlt = !empty($articol['imagine_alt']) ? $articol['imagine_alt'] : ($articol['titlu'] ?? '');

$inlocuiri = [
    '#<title id="pageTitle">.*?</title>#s' => '<title id="pageTitle">' . $e($titlu) . ' — Cătălin Cocoș</title>',
    '#<meta name="description" id="pageDesc" content="[^"]*"\s*/>#' => '<meta name="description" id="pageDesc" content="' . $e($descriere) . '" />',
    '#<meta name="keywords" id="pageKeywords" content="[^"]*"\s*/>#' => '<meta name="keywords" id="pageKeywords" content="' . $e($articol['keywords'] ?? '') . '" />',
    '#<meta property="og:title" id="ogTitle" content="[^"]*"\s*/>#' => '<meta property="og:title" id="ogTitle" content="' . $e($titlu) . '" />',
    '#<meta property="og:description" id="ogDesc" content="[^"]*"\s*/>#' => '<meta property="og:description" id="ogDesc" content="' . $e($descriere) . '" />',
    '#<meta property="og:image" content="[^"]*"\s*/>#' => '<meta property="og:image" content="' . $e($imagine) . '" />'
        . "\n    " . '<meta property="og:image:alt" content="' . $e($imagineAlt) . '" />'
        . "\n    " . '<meta property="og:url" content="' . $e($url) . '" />'
        . "\n    " . '<meta property="og:site_name" content="Cătălin Cocoș" />'
        . "\n    " . '<meta name="twitter:card" content="summary_large_image" />'
        . "\n    " . '<link rel="canonical" href="' . $e($url) . '" />',
];

foreach ($inlocuiri as $model => $nou) {
    $html = preg_replace_callback($model, function () use ($nou) { return $nou; }, $html, 1);
}

echo $html;
