<?php
/**
 * Abhyas — public data endpoint.
 *
 * resources.json and contributors.json used to be plain static files
 * inside public_html, deployed via git alongside the site's source code.
 * That broke: Hostinger's deploy process resets/cleans public_html on
 * every deploy — confirmed live, twice, on 2026-08-26 — which silently
 * discarded every real publish back to whatever was last committed (or
 * removed the file outright once it was gitignored instead of tracked).
 *
 * The actual data now lives in abhyas-private/, outside public_html and
 * outside git entirely — the one location proven to survive every deploy
 * tonight, because nothing about deploying the SITE ever touches it. This
 * endpoint is the read side of that: public, unauthenticated (the data
 * itself is public — every visitor's archive page needs it), but the
 * only way to it is through PHP, never a direct static file fetch.
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

$c    = cfg();
$file = (string) ($_GET['file'] ?? '');
if (!in_array($file, ['resources', 'contributors'], true)) fail(400, 'Unknown file');

$path = $c['private_dir'] . '/' . $file . '.json';
if (!is_file($path)) fail(404, 'Not found');

// Same caching intent as BACKEND-PLAN-v2.md §5 always specified for this
// file: never served stale, but cheap (304) when nothing changed.
header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');
header('ETag: "' . md5_file($path) . '"');
readfile($path);
