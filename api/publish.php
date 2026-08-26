<?php
/**
 * Abhyas — admin publishing API.
 *
 * Everything except `login` requires a signed-in session AND a matching
 * CSRF token, re-checked on every single request. There is no anonymous
 * intake here and no moderation queue — the person calling this endpoint
 * IS the person who gets to decide what's on the archive, so "submit" and
 * "publish" are the same action. See BACKEND-PLAN-v3.md for why this is
 * deliberately smaller than a public-facing intake pipeline would need to
 * be, and what gets added back if/when one is ever built.
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

$c      = cfg();
$action = (string) ($_GET['action'] ?? '');

/* `publish` arrives as multipart/form-data (it carries a file); everything
   else is JSON. Read whichever applies before touching $action's branches. */
$isMultipart = str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data');
$body = $isMultipart ? $_POST : (json_decode(file_get_contents('php://input') ?: '[]', true) ?: []);

/* ---------------- auth ---------------- */
if ($action === 'login') {
  start_session();
  // Throttle guessing. Cheap, and enough for a console with 1-2 admins.
  if (!empty($_SESSION['login_block']) && time() < $_SESSION['login_block']) {
    fail(429, 'Too many attempts. Wait a minute.');
  }
  $pw = (string) ($body['password'] ?? '');
  foreach ($c['admins'] as $name => $hash) {
    if (password_verify($pw, $hash)) {
      session_regenerate_id(true);          // stop session fixation
      $_SESSION['admin'] = $name;
      unset($_SESSION['login_fails'], $_SESSION['login_block']);
      ok(['user' => $name, 'csrf' => csrf_token()]);
    }
  }
  $_SESSION['login_fails'] = ($_SESSION['login_fails'] ?? 0) + 1;
  if ($_SESSION['login_fails'] >= 5) $_SESSION['login_block'] = time() + 60;
  fail(401, 'Wrong password');
}

if ($action === 'logout') {
  start_session();
  $_SESSION = [];
  session_destroy();
  ok();
}

/* Console reload: confirm the session is still good and hand back a CSRF
   token without asking for the password again. */
if ($action === 'me') {
  $admin = require_admin();
  ok(['user' => $admin, 'csrf' => csrf_token()]);
}

$admin = require_admin();
if (!$isMultipart) require_csrf($body['csrf'] ?? null);

/* ---------------- list ---------------- */
if ($action === 'list') {
  $all = read_json($c['public_dir'] . '/resources.json', []);
  $people = read_json($c['public_dir'] . '/contributors.json', []);
  ok([
    'items'        => $all,
    'contributors' => $people,   // {id: {name, roll}} — console resolves ids to names itself
    'counts' => [
      'published'    => count(array_filter($all, fn($r) => ($r['status'] ?? 'published') === 'published')),
      'contributors' => count($people),
      // Always 0 until Phase 4 (public submissions) exists — see
      // BACKEND-PLAN-v3.md §6. Counted for real the moment any record
      // ever carries "status": "pending", no code change needed here.
      'pending'      => count(array_filter($all, fn($r) => ($r['status'] ?? '') === 'pending')),
    ],
  ]);
}

/* ---------------- publish (new file) ---------------- */
if ($action === 'publish') {
  require_csrf($_POST['csrf'] ?? null);

  if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) fail(400, 'No file received.');
  $f = $_FILES['file'];
  if ($f['size'] <= 0 || $f['size'] > $c['max_upload_bytes']) fail(413, 'That file is too large.');
  if (!is_uploaded_file($f['tmp_name']) || !looks_like_pdf($f['tmp_name'])) fail(415, 'Only PDF files can be accepted.');

  $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) ($body['code'] ?? '')));
  $dept = strtoupper(preg_replace('/[^A-Za-z]/', '', (string) ($body['department'] ?? '')));
  $course = trim((string) ($body['course'] ?? ''));
  if ($code === '' || $dept === '' || $course === '') fail(400, 'Course code, branch and course name are required.');

  $type = in_array($body['type'] ?? '', ['papers', 'notes', 'assignment', 'reference'], true) ? $body['type'] : 'papers';
  $exam = slugify((string) ($body['examType'] ?? '')) ?: slugify($type);
  $year = (int) ($body['year'] ?? 0) ?: (int) date('Y');

  $sha256 = hash_file('sha256', $f['tmp_name']);
  $existing = read_json($c['public_dir'] . '/resources.json', []);
  $duplicateOf = null;
  foreach ($existing as $r) {
    if (!empty($r['sha256']) && $r['sha256'] === $sha256) { $duplicateOf = $r['file'] ?? ($r['id'] ?? null); break; }
  }
  // Non-blocking: tell the admin, let them decide. They are the moderator
  // AND the uploader here, so a hard block would just be in their own way.
  if ($duplicateOf !== null && empty($body['force'])) {
    fail(409, "This looks byte-for-byte identical to an existing file ($duplicateOf). Resubmit with confirmation to publish anyway.");
  }

  // Stored name is generated from approved metadata, never the uploader's
  // filename — this is also the entire duplicate/collision defence for the
  // common case (same course+year+type uploaded twice by mistake).
  $rel  = "$dept/$code/" . strtolower($code) . "-$exam-$year.pdf";
  $dest = $c['files_dir'] . '/' . $rel;
  if (!is_dir(dirname($dest))) @mkdir(dirname($dest), 0755, true);
  $n = 2;
  while (is_file($dest)) {                       // never silently overwrite
    $rel  = "$dept/$code/" . strtolower($code) . "-$exam-$year-$n.pdf";
    $dest = $c['files_dir'] . '/' . $rel;
    $n++;
  }
  if (!move_uploaded_file($f['tmp_name'], $dest)) fail(500, 'Could not store the file.');
  @chmod($dest, 0644);

  $record = [
    'id'          => strtolower($code) . '-' . $year . '-' . $exam,
    'title'       => $course . ' — ' . ucfirst($exam),
    'code'        => $code,
    'course'      => $course,
    'department'  => $dept,
    'semester'    => (int) ($body['semester'] ?? 0) ?: null,
    'type'        => $type,
    'examType'    => (string) ($body['examType'] ?? ''),
    'professor'   => (string) ($body['professor'] ?? '') ?: '—',
    'year'        => $year,
    'file'        => $rel,
    'sha256'      => $sha256,
    'contributor' => null,
    'added'       => date('Y-m-d'),
    'approvedBy'  => $admin,          // audit trail, for free
    // A field that costs nothing today and saves a schema migration the
    // day a moderation queue is ever reintroduced (BACKEND-PLAN-v3.md §6):
    // that queue becomes "filter resources.json by status", not a rewrite.
    'status'      => 'published',
  ];

  if ($record['type'] === 'reference') {
    $record['book'] = [
      'author'    => (string) ($body['bookAuthor'] ?? ''),
      'publisher' => (string) ($body['bookPublisher'] ?? ''),
      'cover'     => (string) ($body['bookCover'] ?? 'ink'),
      'gist'      => (string) ($body['bookGist'] ?? ''),
    ];
    if ($record['book']['author'] === '') fail(400, 'A reference book needs an author.');
  }

  $record['contributor'] = match_or_create_contributor($c, (string) ($body['contributor'] ?? ''), (string) ($body['roll'] ?? ''));

  $rpath = $c['public_dir'] . '/resources.json';
  $existing[] = $record;
  write_json_atomic($rpath, $existing);

  ok(['id' => $record['id'], 'file' => $rel]);
}

/* ---------------- edit (metadata on an already-published resource) ---------------- */
if ($action === 'edit') {
  $id = (string) ($body['id'] ?? '');
  if ($id === '') fail(400, 'Missing id');

  $rpath = $c['public_dir'] . '/resources.json';
  $all = read_json($rpath, []);
  $idx = null;
  foreach ($all as $i => $r) { if (($r['id'] ?? '') === $id) { $idx = $i; break; } }
  if ($idx === null) fail(404, 'Resource not found');

  foreach (['course', 'department', 'semester', 'type', 'examType', 'professor', 'year', 'roll'] as $k) {
    if (array_key_exists($k, $body)) $all[$idx][$k] = $body[$k];
  }
  $all[$idx]['department'] = strtoupper(preg_replace('/[^A-Za-z]/', '', (string) ($all[$idx]['department'] ?? '')));
  if (isset($body['year'])) $all[$idx]['year'] = (int) $body['year'] ?: null;
  if (isset($body['semester'])) $all[$idx]['semester'] = (int) $body['semester'] ?: null;

  if (($all[$idx]['type'] ?? '') === 'reference') {
    $all[$idx]['book'] = [
      'author'    => (string) ($body['bookAuthor'] ?? $all[$idx]['book']['author'] ?? ''),
      'publisher' => (string) ($body['bookPublisher'] ?? $all[$idx]['book']['publisher'] ?? ''),
      'cover'     => (string) ($body['bookCover'] ?? $all[$idx]['book']['cover'] ?? 'ink'),
      'gist'      => (string) ($body['bookGist'] ?? $all[$idx]['book']['gist'] ?? ''),
    ];
  }

  if (array_key_exists('contributor', $body)) {
    $all[$idx]['contributor'] = match_or_create_contributor($c, (string) $body['contributor'], (string) ($body['roll'] ?? ''));
  }

  write_json_atomic($rpath, $all);
  ok(['id' => $id]);
}

/* ---------------- delete ---------------- */
if ($action === 'delete') {
  // Soft-remove from the index only. The PDF stays on disk — HANDOVER.md
  // §4 is explicit that the uploaded files are the one thing on this
  // project with no other copy anywhere, so a web action never deletes
  // one. Remove the file by hand later if you're sure.
  $id = (string) ($body['id'] ?? '');
  if ($id === '') fail(400, 'Missing id');

  $rpath = $c['public_dir'] . '/resources.json';
  $all = read_json($rpath, []);
  $found = false;
  $all = array_values(array_filter($all, function ($r) use ($id, &$found) {
    if (($r['id'] ?? '') === $id) { $found = true; return false; }
    return true;
  }));
  if (!$found) fail(404, 'Resource not found');

  write_json_atomic($rpath, $all);
  ok(['id' => $id]);
}

fail(400, 'Unknown action');

/* ---------------- helpers ---------------- */

/**
 * Contributors are a registry: match an existing person before inventing a
 * new id, or one human becomes two and their points split on the Honor
 * Roll. Returns null for "no credit" (blank name).
 */
function match_or_create_contributor(array $c, string $name, string $roll): ?string {
  $name = trim($name);
  if ($name === '') return null;

  $cpath = $c['public_dir'] . '/contributors.json';
  $people = read_json($cpath, []);
  foreach ($people as $cid => $p) {
    if (strcasecmp(trim($p['name'] ?? ''), $name) === 0) return (string) $cid;
  }
  $match = 'c' . (count($people) + 1);
  while (isset($people[$match])) $match .= 'x';
  $people[$match] = ['name' => $name, 'roll' => $roll];
  write_json_atomic($cpath, $people);
  return $match;
}
