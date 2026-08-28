<?php
/**
 * Abhyas — public PDF delivery endpoint.
 *
 * Same reasoning as api/data.php, applied to the actual uploaded files:
 * `files/` used to sit inside public_html, deployed alongside the site's
 * source. Anything not tracked by git in there is at the mercy of
 * whatever Hostinger's deploy process does to public_html — confirmed,
 * twice, to be destructive. Per HANDOVER.md §4, the uploaded papers are
 * the one thing on this project with no other copy anywhere; that's
 * exactly the file this endpoint exists to stop being fragile.
 *
 * Files now live in abhyas-private/files/, outside public_html and
 * outside git. This is the only way to them — public and unauthenticated
 * (published papers are meant to be public), but never a direct static
 * file fetch.
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

$c    = cfg();
$path = (string) ($_GET['path'] ?? '');

// The only filenames this ever generates (BACKEND-PLAN-v3.md): DEPT/CODE/
// code-examtype-year[-n].pdf, all uppercase dept/code — plus, for a
// reference book, code-examtype-year-cover[-n].(jpg|png|webp). Validate
// BEFORE the path touches the filesystem — same rule as safe_id() in lib.php.
if (!preg_match('#^[A-Z0-9]+/[A-Z0-9]+/[a-z0-9-]+\.(pdf|jpg|jpeg|png|webp)$#', $path)) fail(404, 'Not found');

$full = $c['files_dir'] . '/' . $path;
if (!is_file($full)) fail(404, 'Not found');

$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
$mime = [
  'pdf'  => 'application/pdf',
  'jpg'  => 'image/jpeg',
  'jpeg' => 'image/jpeg',
  'png'  => 'image/png',
  'webp' => 'image/webp',
][$ext] ?? 'application/octet-stream';

header('Content-Type: ' . $mime);
header('X-Content-Type-Options: nosniff');
// Generated filenames never change once published (BACKEND-PLAN-v3.md
// §4 — never silently overwritten, a collision gets a new name instead),
// so this can cache hard instead of revalidating on every view.
header('Cache-Control: public, max-age=31536000, immutable');
header('Content-Length: ' . (string) filesize($full));
readfile($full);
