<?php
/**
 * Abhyas — admin publishing + moderation API.
 *
 * Everything except `login` requires a signed-in session; every
 * state-changing action also needs a matching CSRF token. Two ways a
 * resource reaches `resources.json`:
 *   - `publish`: the admin uploads and files something directly (no
 *     review needed — they ARE the reviewer of their own upload).
 *   - `approve`: a public submission (api/submit.php) sat in
 *     abhyas-pending/ until an admin checked it and approved it.
 * Both end up sharing the same record-building logic (build_record()
 * below) and the same destination-naming logic (dest_for()) — the only
 * difference is where the PDF comes from before that point.
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

  /* Throttle guessing, keyed by IP rather than session — a lockout that
     only lives in $_SESSION resets the moment an attacker stops sending
     the session cookie back, which makes it no lockout at all. This one
     is a small file in abhyas-private/ (outside the web root, outside
     git) so it survives across "sessions" an attacker never keeps. */
  $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
  $throttlePath = $c['private_dir'] . '/login_throttle.json';
  $now = time();
  $fh = @fopen($throttlePath, 'c+');
  $locked = $fh && flock($fh, LOCK_EX);

  $throttle = [];
  if ($locked) {
    $raw = stream_get_contents($fh);
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) $throttle = $decoded;
  }

  $entry = $throttle[$ip] ?? ['fails' => 0, 'block_until' => 0, 'last' => 0];
  // Forget an IP's history after an hour of quiet — an old failed attempt
  // shouldn't count against someone months later, and it keeps this file
  // from growing forever with every crawler that ever hit the endpoint.
  if ($now - ($entry['last'] ?? 0) > 3600) $entry = ['fails' => 0, 'block_until' => 0, 'last' => 0];

  if ($locked && $entry['block_until'] > $now) {
    flock($fh, LOCK_UN); fclose($fh);
    fail(429, 'Too many attempts. Wait a minute.');
  }

  $pw = (string) ($body['password'] ?? '');
  $matched = null;
  foreach ($c['admins'] as $name => $hash) {
    if (password_verify($pw, $hash)) { $matched = $name; break; }
  }

  if ($matched !== null) {
    if ($locked) {
      unset($throttle[$ip]);
      foreach ($throttle as $k => $v) {
        if ($now - ($v['last'] ?? 0) > 3600) unset($throttle[$k]);
      }
      ftruncate($fh, 0); rewind($fh);
      fwrite($fh, json_encode($throttle));
      flock($fh, LOCK_UN); fclose($fh);
    }
    session_regenerate_id(true);          // stop session fixation
    $_SESSION['admin'] = $matched;
    ok(['user' => $matched, 'csrf' => csrf_token()]);
  }

  if ($locked) {
    $entry['fails'] = ($entry['fails'] ?? 0) + 1;
    $entry['last'] = $now;
    if ($entry['fails'] >= 5) $entry['block_until'] = $now + 60;
    $throttle[$ip] = $entry;
    ftruncate($fh, 0); rewind($fh);
    fwrite($fh, json_encode($throttle));
    flock($fh, LOCK_UN); fclose($fh);
  }
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

/* ---------------- list ---------------- */
/* Read-only — CSRF tokens protect state-changing requests, not "show me
   the data." (This exact mistake broke the dashboard once already:
   every list refresh silently 403'd because admin.js never sends a
   token on a GET, correctly, since it shouldn't need one.) */
if ($action === 'list') {
  $trash = purge_trash($c); // opportunistic — no cron needed, see the function below

  $all    = read_json($c['private_dir'] . '/resources.json', []);
  $people = read_json($c['private_dir'] . '/contributors.json', []);

  $pending = [];
  foreach (glob($c['pending_dir'] . '/*.json') ?: [] as $p) {
    $r = read_json($p, []);
    if ($r) { $r['sizeLabel'] = human_size((int) ($r['size'] ?? 0)); $pending[] = $r; }
  }
  usort($pending, fn($a, $b) => strcmp($b['submitted'] ?? '', $a['submitted'] ?? ''));
  usort($trash, fn($a, $b) => strcmp($b['deletedAt'] ?? '', $a['deletedAt'] ?? ''));

  ok([
    'items'        => $all,
    'pending'      => $pending,
    'trash'        => $trash,
    'contributors' => $people,   // {id: {name, roll}} — console resolves ids to names itself
    'counts' => [
      'published'    => count(array_filter($all, fn($r) => ($r['status'] ?? 'published') === 'published')),
      'contributors' => count($people),
      'pending'      => count($pending),
      'trash'        => count($trash),
    ],
  ]);
}

/* ---------------- preview a pending submission ----------------
   Also read-only, also no CSRF needed. Pending files are not on the
   public web at all (see api/submit.php) — this authenticated stream
   is the only way to see one before deciding on it. safe_id() runs
   BEFORE the id touches the filesystem; that's the path-traversal
   guard, same as everywhere else this pattern is used. */
if ($action === 'preview_pending') {
  $id   = safe_id((string) ($_GET['id'] ?? ''));
  $path = $c['pending_dir'] . '/' . $id . '.pdf';
  if (!is_file($path)) fail(404, 'Not found');
  header('Content-Type: application/pdf');
  header('X-Content-Type-Options: nosniff');
  header('Content-Length: ' . (string) filesize($path));
  readfile($path);
  exit;
}

/* Every action below this line changes something and needs a valid
   CSRF token — a session cookie alone doesn't stop a forged request
   from another tab riding the same session. `publish` carries its
   token in the multipart body instead of JSON, so it checks its own. */
if (!$isMultipart) require_csrf($body['csrf'] ?? null);

/* ---------------- publish (admin's own upload, no review needed) ---------------- */
if ($action === 'publish') {
  require_csrf($_POST['csrf'] ?? null);

  if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) fail(400, 'No file received.');
  $f = $_FILES['file'];
  if ($f['size'] <= 0 || $f['size'] > $c['max_upload_bytes']) fail(413, 'That file is too large.');
  if (!is_uploaded_file($f['tmp_name']) || !looks_like_pdf($f['tmp_name'])) fail(415, 'Only PDF files can be accepted.');

  $fields = parsed_fields($body);
  $sha256 = hash_file('sha256', $f['tmp_name']);

  $existing = read_json($c['private_dir'] . '/resources.json', []);
  $duplicateOf = find_duplicate($existing, $sha256);
  // Non-blocking: tell the admin, let them decide. They are the moderator
  // AND the uploader here, so a hard block would just be in their own way.
  if ($duplicateOf !== null && empty($body['force'])) {
    fail(409, "This looks byte-for-byte identical to an existing file ($duplicateOf). Resubmit with confirmation to publish anyway.");
  }

  $rel  = dest_for($c, $fields);
  $dest = $c['files_dir'] . '/' . $rel;
  if (!is_dir(dirname($dest))) @mkdir(dirname($dest), 0755, true);
  if (!move_uploaded_file($f['tmp_name'], $dest)) fail(500, 'Could not store the file.');
  @chmod($dest, 0644);

  $record = build_record($fields, $admin, $rel, $sha256, $body);
  $record['contributor'] = match_or_create_contributor($c, (string) ($body['contributor'] ?? ''), (string) ($body['roll'] ?? ''));

  $rpath = $c['private_dir'] . '/resources.json';
  $existing[] = $record;
  write_json_atomic($rpath, $existing);

  ok(['id' => $record['id'], 'file' => $rel]);
}

/* ---------------- approve (a public submission, reviewed and confirmed) ---------------- */
if ($action === 'approve') {
  $id  = safe_id((string) ($body['id'] ?? ''));
  $src = $c['pending_dir'] . '/' . $id . '.pdf';
  if (!is_file($src)) fail(404, 'That submission is gone');
  $sub = read_json($c['pending_dir'] . '/' . $id . '.json', []);

  $fields = parsed_fields($body);
  $sha256 = (string) ($sub['sha256'] ?? hash_file('sha256', $src));

  $existing = read_json($c['private_dir'] . '/resources.json', []);
  $duplicateOf = find_duplicate($existing, $sha256);
  if ($duplicateOf !== null && empty($body['force'])) {
    fail(409, "This looks byte-for-byte identical to an existing file ($duplicateOf). Approve again to confirm anyway.");
  }

  $rel  = dest_for($c, $fields);
  $dest = $c['files_dir'] . '/' . $rel;
  if (!is_dir(dirname($dest))) @mkdir(dirname($dest), 0755, true);
  if (!rename($src, $dest)) fail(500, 'Could not move the file');
  @chmod($dest, 0644);

  $record = build_record($fields, $admin, $rel, $sha256, $body);
  $record['contributor'] = match_or_create_contributor($c, (string) ($body['contributor'] ?? ''), (string) ($body['roll'] ?? ''));

  $rpath = $c['private_dir'] . '/resources.json';
  $existing[] = $record;
  write_json_atomic($rpath, $existing);

  @unlink($c['pending_dir'] . '/' . $id . '.json');
  ok(['id' => $record['id'], 'file' => $rel]);
}

/* ---------------- reject a public submission ---------------- */
if ($action === 'reject') {
  $id  = safe_id((string) ($body['id'] ?? ''));
  $dir = $c['private_dir'] . '/rejected';
  if (!is_dir($dir)) @mkdir($dir, 0700, true);

  // Keep the file and its metadata + reason together — this is the whole
  // audit trail for "why did this not go up", and it costs nothing extra
  // to write, same principle as approvedBy/added on a published record.
  $sub = read_json($c['pending_dir'] . '/' . $id . '.json', []);
  $sub['rejectedBy']     = $admin;
  $sub['rejectedAt']     = date('c');
  $sub['rejectionReason'] = mb_substr((string) ($body['reason'] ?? ''), 0, 300);
  file_put_contents($dir . '/' . $id . '.json', json_encode($sub, JSON_PRETTY_PRINT));

  @rename($c['pending_dir'] . '/' . $id . '.pdf', $dir . '/' . $id . '.pdf');
  @unlink($c['pending_dir'] . '/' . $id . '.json');
  ok(['id' => $id]);
}

/* ---------------- one-time: rename a contributor in place ----------------
 * TEMPORARY — remove once run. Renames by id, not by matching name, so
 * this contributor's existing point total / resource history stays
 * attached to the same id rather than orphaning it under the old name
 * and crediting a freshly-created one instead.
 */
if ($action === 'rename_contributor') {
  $id = (string) ($body['id'] ?? '');
  $newName = trim((string) ($body['name'] ?? ''));
  if ($id === '' || $newName === '') fail(400, 'Missing id or name');

  $cpath = $c['private_dir'] . '/contributors.json';
  $people = read_json($cpath, []);
  if (!isset($people[$id])) fail(404, 'No such contributor id');
  $people[$id]['name'] = $newName;
  write_json_atomic($cpath, $people);
  ok(['id' => $id, 'name' => $newName]);
}

/* ---------------- one-time: backdate migrated resources' `added` ----------------
 * TEMPORARY — remove once run. Migration ran through `publish`, which
 * always stamps `added` as today — correct for a resource actually
 * published today, wrong for one migrated from an archive that already
 * existed for years. The Honor Roll's "this semester" scope filters on
 * `added >= SEMESTER_START` (data.js) — leaving today's date on migrated
 * resources would count them as this semester's contributions, which
 * they aren't. `all` scope has no date filter, so overall totals were
 * already correct either way. Body is {"dates": {id: "YYYY-MM-DD", ...}},
 * built from each resource's real original publish date.
 */
if ($action === 'fix_added_dates') {
  $dates = $body['dates'] ?? null;
  if (!is_array($dates) || !$dates) fail(400, 'Missing dates map');

  $rpath = $c['private_dir'] . '/resources.json';
  $all = read_json($rpath, []);
  $fixed = 0;
  $missing = [];
  foreach ($all as $i => $r) {
    if (array_key_exists($r['id'], $dates)) {
      $all[$i]['added'] = (string) $dates[$r['id']];
      $fixed++;
    }
  }
  $known = array_column($all, 'id');
  foreach (array_keys($dates) as $wantId) {
    if (!in_array($wantId, $known, true)) $missing[] = $wantId;
  }
  if ($fixed > 0) write_json_atomic($rpath, $all);
  ok(['fixed' => $fixed, 'missing' => $missing]);
}

/* ---------------- edit (metadata on an already-published resource) ---------------- */
if ($action === 'edit') {
  $id = (string) ($body['id'] ?? '');
  if ($id === '') fail(400, 'Missing id');

  $rpath = $c['private_dir'] . '/resources.json';
  $all = read_json($rpath, []);
  $idx = null;
  foreach ($all as $i => $r) { if (($r['id'] ?? '') === $id) { $idx = $i; break; } }
  if ($idx === null) fail(404, 'Resource not found');

  foreach (['course', 'department', 'type', 'examType', 'professor', 'year', 'roll'] as $k) {
    if (array_key_exists($k, $body)) $all[$idx][$k] = $body[$k];
  }
  $all[$idx]['department'] = strtoupper(preg_replace('/[^A-Za-z]/', '', (string) ($all[$idx]['department'] ?? '')));
  if (isset($body['year'])) $all[$idx]['year'] = (int) $body['year'] ?: null;

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

/* ---------------- delete (moves to trash, not gone) ---------------- */
if ($action === 'delete') {
  // The PDF itself never gets touched here — HANDOVER.md §4 is explicit
  // that uploaded files are the one thing on this project with no other
  // copy anywhere, so no web action deletes one, ever. This only moves
  // the JSON record to trash.json, restorable for 14 days (purge_trash()
  // below), then dropped from the index for good — the file stays on
  // disk regardless, forever, unless someone removes it by hand.
  $id = (string) ($body['id'] ?? '');
  if ($id === '') fail(400, 'Missing id');

  $rpath = $c['private_dir'] . '/resources.json';
  $all = read_json($rpath, []);
  $record = null;
  $all = array_values(array_filter($all, function ($r) use ($id, &$record) {
    if (($r['id'] ?? '') === $id) { $record = $r; return false; }
    return true;
  }));
  if ($record === null) fail(404, 'Resource not found');

  $record['deletedAt'] = date('c');
  $record['deletedBy'] = $admin;
  $tpath = $c['private_dir'] . '/trash.json';
  $trash = read_json($tpath, []);
  $trash[] = $record;
  write_json_atomic($tpath, $trash);

  write_json_atomic($rpath, $all);
  ok(['id' => $id]);
}

/* ---------------- restore from trash ---------------- */
if ($action === 'restore') {
  $id = (string) ($body['id'] ?? '');
  if ($id === '') fail(400, 'Missing id');

  $tpath = $c['private_dir'] . '/trash.json';
  $trash = read_json($tpath, []);
  $record = null;
  $trash = array_values(array_filter($trash, function ($r) use ($id, &$record) {
    if (($r['id'] ?? '') === $id) { $record = $r; return false; }
    return true;
  }));
  if ($record === null) fail(404, 'Not in trash');

  unset($record['deletedAt'], $record['deletedBy']);
  $rpath = $c['private_dir'] . '/resources.json';
  $all = read_json($rpath, []);
  $all[] = $record;
  write_json_atomic($rpath, $all);
  write_json_atomic($tpath, $trash);
  ok(['id' => $id]);
}

fail(400, 'Unknown action');

/* ================= helpers ================= */

/**
 * The metadata every published record needs, validated once, shared by
 * both `publish` and `approve` — this is the exact set of fields the
 * admin form always sends, whether the file came from a fresh upload
 * or a reviewed submission.
 */
function parsed_fields(array $body): array {
  $code   = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) ($body['code'] ?? '')));
  $dept   = strtoupper(preg_replace('/[^A-Za-z]/', '', (string) ($body['department'] ?? '')));
  $course = trim((string) ($body['course'] ?? ''));
  if ($code === '' || $dept === '' || $course === '') fail(400, 'Course code, branch and course name are required.');

  $type = in_array($body['type'] ?? '', ['papers', 'notes', 'assignment', 'reference'], true) ? $body['type'] : 'papers';
  $exam = slugify((string) ($body['examType'] ?? '')) ?: slugify($type);
  $year = (int) ($body['year'] ?? 0) ?: (int) date('Y');

  return compact('code', 'dept', 'course', 'type', 'exam', 'year');
}

/**
 * Generated filename, never the uploader's own — collision-safe by
 * construction (never silently overwrites; adds -2, -3, ... instead),
 * which is also the entire duplicate defence for "same course+year+
 * type filed twice."
 */
function dest_for(array $c, array $fields): string {
  ['code' => $code, 'dept' => $dept, 'exam' => $exam, 'year' => $year] = $fields;
  $rel = "$dept/$code/" . strtolower($code) . "-$exam-$year.pdf";
  $n = 2;
  while (is_file($c['files_dir'] . '/' . $rel)) {
    $rel = "$dept/$code/" . strtolower($code) . "-$exam-$year-$n.pdf";
    $n++;
  }
  return $rel;
}

/**
 * No cron on shared hosting, so instead of a scheduled job, every `list`
 * call (i.e. every time the admin console loads) sweeps trash.json for
 * anything older than 14 days and drops it from the index for good. The
 * underlying PDF is never touched here or anywhere else — this only
 * decides how long an accidental delete stays recoverable through the
 * UI before the record itself is gone.
 */
function purge_trash(array $c): array {
  $tpath = $c['private_dir'] . '/trash.json';
  $trash = read_json($tpath, []);
  $cutoff = time() - 14 * 86400;
  $kept = array_values(array_filter($trash, function ($r) use ($cutoff) {
    $t = strtotime((string) ($r['deletedAt'] ?? ''));
    return $t === false || $t >= $cutoff; // keep anything with an unreadable date, rather than lose it
  }));
  if (count($kept) !== count($trash)) write_json_atomic($tpath, $kept);
  return $kept;
}

function find_duplicate(array $existing, string $sha256): ?string {
  foreach ($existing as $r) {
    if (!empty($r['sha256']) && $r['sha256'] === $sha256) return $r['file'] ?? ($r['id'] ?? 'an existing file');
  }
  return null;
}

function build_record(array $fields, string $admin, string $rel, string $sha256, array $body): array {
  ['code' => $code, 'dept' => $dept, 'course' => $course, 'type' => $type, 'exam' => $exam, 'year' => $year] = $fields;

  $record = [
    // Department is part of the id, not just code-year-exam: a course
    // genuinely shared across every branch (an open elective) is published
    // once per department (library.js/app.js filter on exact department
    // match, there's no "universal" resource concept), and without dept
    // here those copies would all collide on the same id — resource.html
    // ?id=..., edit and delete would then hit whichever one matched first.
    'id'          => strtolower($dept) . '-' . strtolower($code) . '-' . $year . '-' . $exam,
    'title'       => $course . ' — ' . ucfirst($exam),
    'code'        => $code,
    'course'      => $course,
    'department'  => $dept,
    'type'        => $type,
    'examType'    => (string) ($body['examType'] ?? ''),
    'professor'   => (string) ($body['professor'] ?? '') ?: '—',
    'year'        => $year,
    'file'        => $rel,
    'sha256'      => $sha256,
    'contributor' => null,          // set by the caller after this returns
    'added'       => date('Y-m-d'),
    'approvedBy'  => $admin,        // audit trail, for free
    'status'      => 'published',
  ];

  if ($type === 'reference') {
    $record['book'] = [
      'author'    => (string) ($body['bookAuthor'] ?? ''),
      'publisher' => (string) ($body['bookPublisher'] ?? ''),
      'cover'     => (string) ($body['bookCover'] ?? 'ink'),
      'gist'      => (string) ($body['bookGist'] ?? ''),
    ];
    if ($record['book']['author'] === '') fail(400, 'A reference book needs an author.');
  }

  return $record;
}

/**
 * Contributors are a registry: match an existing person before inventing a
 * new id, or one human becomes two and their points split on the Honor
 * Roll. Returns null for "no credit" (blank name).
 */
function match_or_create_contributor(array $c, string $name, string $roll): ?string {
  $name = trim($name);
  if ($name === '') return null;

  $cpath = $c['private_dir'] . '/contributors.json';
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
