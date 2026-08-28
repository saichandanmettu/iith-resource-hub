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

  $fields = parsed_fields($body);
  $hasFile = !empty($_FILES['file']['name']);

  /* A reference book is a pointer to something real, not a copy of it —
     there's nowhere legitimate to host the actual text of a commercial
     textbook. Its upload, when there is one, is the COVER IMAGE the
     Bookshelf renders (handled below); the book itself is reached by
     book.link. It can also be filed with no upload at all, on the link
     alone. Every other type still needs a real PDF, same as always. */
  if (!$hasFile && $fields['type'] !== 'reference') fail(400, 'No file received.');

  $rel = '';
  $sha256 = '';
  $existing = read_json($c['private_dir'] . '/resources.json', []);

  if ($hasFile) {
    if ($_FILES['file']['error'] !== UPLOAD_ERR_OK) fail(400, 'No file received.');
    $f = $_FILES['file'];
    if ($f['size'] <= 0 || $f['size'] > $c['max_upload_bytes']) fail(413, 'That file is too large.');
    if (!is_uploaded_file($f['tmp_name'])) fail(400, 'No file received.');

    if ($fields['type'] === 'reference') {
      // A reference book's upload is its COVER SCAN, not the text of the
      // book (there's nowhere legal to host a commercial textbook). It
      // lands beside where the PDF would have gone, with a -cover suffix,
      // and the record carries it as book.coverImage — the top-level
      // `file` stays empty so books.js links out rather than to the image.
      $ext = image_ext($f['tmp_name']);
      if ($ext === null) fail(415, 'The cover must be a JPG, PNG or WebP image.');
      $rel  = cover_dest_for($c, $fields, $ext);
      $dest = $c['files_dir'] . '/' . $rel;
      if (!is_dir(dirname($dest))) @mkdir(dirname($dest), 0755, true);
      if (!move_uploaded_file($f['tmp_name'], $dest)) fail(500, 'Could not store the file.');
      @chmod($dest, 0644);
      $body['coverImage'] = $rel;
      $rel = '';
    } else {
      if (!looks_like_pdf($f['tmp_name'])) fail(415, 'Only PDF files can be accepted.');

      $sha256 = hash_file('sha256', $f['tmp_name']);
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
    }
  }

  $record = build_record($fields, $admin, $rel, $sha256, $body);
  $record['contributor'] = match_or_create_contributor($c, (string) ($body['contributor'] ?? ''), (string) ($body['roll'] ?? ''));

  $rpath = $c['private_dir'] . '/resources.json';
  $existing[] = $record;
  write_json_atomic($rpath, $existing);

  ok(['id' => $record['id'], 'file' => $rel]);
}

/* ---------------- set_cover (add / replace a published reference book's cover image) ----------------
   The Edit panel can't swap a PDF (HANDOVER.md §4 — no web action ever
   overwrites an uploaded file), and a cover scan is held to the same
   rule: a new upload is written under a fresh -N name and the record is
   pointed at it, the old image is left on disk. Reference books only. */
if ($action === 'set_cover') {
  require_csrf($_POST['csrf'] ?? null);

  $id = (string) ($body['id'] ?? '');
  if ($id === '') fail(400, 'Missing id');

  if (empty($_FILES['file']['name']) || ($_FILES['file']['error'] ?? 1) !== UPLOAD_ERR_OK) fail(400, 'No image received.');
  $f = $_FILES['file'];
  if ($f['size'] <= 0 || $f['size'] > $c['max_upload_bytes']) fail(413, 'That image is too large.');
  if (!is_uploaded_file($f['tmp_name'])) fail(400, 'No image received.');
  $ext = image_ext($f['tmp_name']);
  if ($ext === null) fail(415, 'The cover must be a JPG, PNG or WebP image.');

  $rpath = $c['private_dir'] . '/resources.json';
  $all = read_json($rpath, []);
  $idx = null;
  foreach ($all as $i => $r) { if (($r['id'] ?? '') === $id) { $idx = $i; break; } }
  if ($idx === null) fail(404, 'Resource not found');
  if (($all[$idx]['type'] ?? '') !== 'reference') fail(400, 'Only reference books have a cover image.');

  // The naming scheme keys off the record's own fields — the book-title
  // slug matches what parsed_fields() derived at publish time (same
  // suffix-strip regex books.js uses).
  $bookSlug = slugify(preg_replace('/\s+[—–-]\s+Reference (Book|Guide)$/i', '', (string) ($all[$idx]['title'] ?? '')));
  $fields = [
    'code' => strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) ($all[$idx]['code'] ?? ''))),
    'dept' => strtoupper(preg_replace('/[^A-Za-z]/', '', (string) ($all[$idx]['department'] ?? ''))),
    'exam' => $bookSlug ?: 'reference',
    'year' => (int) ($all[$idx]['year'] ?? 0) ?: (int) date('Y'),
  ];
  $rel  = cover_dest_for($c, $fields, $ext);
  $dest = $c['files_dir'] . '/' . $rel;
  if (!is_dir(dirname($dest))) @mkdir(dirname($dest), 0755, true);
  if (!move_uploaded_file($f['tmp_name'], $dest)) fail(500, 'Could not store the image.');
  @chmod($dest, 0644);

  if (!isset($all[$idx]['book']) || !is_array($all[$idx]['book'])) $all[$idx]['book'] = [];
  $all[$idx]['book']['coverImage'] = $rel;
  write_json_atomic($rpath, $all);

  ok(['id' => $id, 'coverImage' => $rel]);
}

/* ---------------- approve (a public submission, reviewed and confirmed) ---------------- */
if ($action === 'approve') {
  $id  = safe_id((string) ($body['id'] ?? ''));
  $src = $c['pending_dir'] . '/' . $id . '.pdf';
  if (!is_file($src)) fail(404, 'That submission is gone');
  $sub = read_json($c['pending_dir'] . '/' . $id . '.json', []);

  $fields = parsed_fields($body);
  // The review queue only ever holds PDFs (api/submit.php). A reference
  // book is a cover scan plus a link, published straight from Add resource
  // — there's no reviewed-PDF path that makes sense for it.
  if ($fields['type'] === 'reference') fail(400, 'Reference books are published from Add resource, not the review queue.');
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

/* ---------------- one-time: merge a duplicate contributor ----------------
 * TEMPORARY — remove once run. match_or_create_contributor() only
 * de-dupes by exact case-insensitive name match at the moment a resource
 * is published — a direct rename (like the migration's rename_contributor
 * action, already removed) bypasses that check entirely, so if the new
 * name happens to already exist under a different id, the person now has
 * two rows splitting their points. Confirmed live 2026-08-27: "Chandan
 * Mettu" existed as both c1 (real roll, one resource) and c3 (blank
 * roll, the migration's 20 resources) after that rename. Reassigns every
 * resource crediting $drop to $keep, then removes $drop from the
 * registry -- $keep's own fields (including its roll) are untouched.
 */
if ($action === 'merge_contributors') {
  $keep = (string) ($body['keep'] ?? '');
  $drop = (string) ($body['drop'] ?? '');
  if ($keep === '' || $drop === '' || $keep === $drop) fail(400, 'Need two different contributor ids');

  $cpath = $c['private_dir'] . '/contributors.json';
  $people = read_json($cpath, []);
  if (!isset($people[$keep]) || !isset($people[$drop])) fail(404, 'Unknown contributor id');

  $rpath = $c['private_dir'] . '/resources.json';
  $all = read_json($rpath, []);
  $reassigned = 0;
  foreach ($all as $i => $r) {
    if (($r['contributor'] ?? null) === $drop) {
      $all[$i]['contributor'] = $keep;
      $reassigned++;
    }
  }
  write_json_atomic($rpath, $all);

  unset($people[$drop]);
  write_json_atomic($cpath, $people);

  ok(['reassigned' => $reassigned, 'kept' => $keep, 'dropped' => $drop]);
}

/* ---------------- update a contributor's own record ----------------
 * Roll numbers are identity data, not a property of any one upload, so
 * they need somewhere to be corrected that isn't "find a resource this
 * person happens to have contributed and edit that". Name changes go
 * through here too, and are refused if they would collide with someone
 * already in the registry -- match_or_create_contributor() de-dupes by
 * exact name, so two rows sharing one would split that person's points
 * on the Honor Roll (exactly the c1/c3 split merge_contributors exists
 * to clean up after).
 */
if ($action === 'update_contributor') {
  $id = (string) ($body['id'] ?? '');
  if ($id === '') fail(400, 'Missing contributor id');

  $cpath  = $c['private_dir'] . '/contributors.json';
  $people = read_json($cpath, []);
  if (!isset($people[$id])) fail(404, 'Unknown contributor');

  if (array_key_exists('name', $body)) {
    $name = trim((string) $body['name']);
    if ($name === '') fail(400, 'A contributor needs a name.');
    foreach ($people as $other => $p) {
      if ($other !== $id && strcasecmp(trim($p['name'] ?? ''), $name) === 0) {
        fail(409, "\"$name\" is already in the registry — merge them instead of creating a second row.");
      }
    }
    $people[$id]['name'] = $name;
  }

  // Uppercased and stripped of spaces, so "ms24 btech 11021" and
  // "MS24BTECH11021" cannot become two spellings of one person's roll.
  if (array_key_exists('roll', $body)) {
    $people[$id]['roll'] = strtoupper(preg_replace('/\s+/', '', (string) $body['roll']));
  }

  write_json_atomic($cpath, $people);
  ok(['id' => $id, 'contributor' => $people[$id]]);
}

/* ---------------- delete a contributor nobody credits ---------------- */
if ($action === 'delete_contributor') {
  $id = (string) ($body['id'] ?? '');
  $cpath  = $c['private_dir'] . '/contributors.json';
  $people = read_json($cpath, []);
  if (!isset($people[$id])) fail(404, 'Unknown contributor');

  // Never orphan a credit: a resource pointing at a missing id renders as
  // the raw id on the Honor Roll. Reassign or merge first.
  $all = read_json($c['private_dir'] . '/resources.json', []);
  $used = 0;
  foreach ($all as $r) if (($r['contributor'] ?? null) === $id) $used++;
  if ($used > 0) fail(409, "That contributor is credited on $used resource(s) — reassign or merge them first.");

  unset($people[$id]);
  write_json_atomic($cpath, $people);
  ok(['id' => $id]);
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
  unset($all[$idx]['roll']); // the batch belongs to the contributor registry, not the resource
  $all[$idx]['department'] = strtoupper(preg_replace('/[^A-Za-z]/', '', (string) ($all[$idx]['department'] ?? '')));
  if (isset($body['year'])) $all[$idx]['year'] = (int) $body['year'] ?: null;
  // Lets a wrong `added` be corrected after the fact -- e.g. a resource
  // that's genuinely from years ago (an old migration, a late-filed
  // paper) but got published today, which would otherwise count it
  // toward the Honor Roll's "this semester" scope (added >= SEMESTER_START
  // in leaderboard.js) when it isn't a new contribution at all.
  if (isset($body['added']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $body['added'])) {
    $all[$idx]['added'] = (string) $body['added'];
  }

  /* The title is derived, and derived means re-derived on every save --
     otherwise correcting a course name leaves the old title on the card,
     the resource page and search, which reads exactly like Save having
     done nothing at all. An explicitly typed title pins itself instead
     (titleCustom); clearing that field hands the title back to the
     generator. Reference books are excluded: their title is the book's
     own, set from bookTitle just below. */
  if (($all[$idx]['type'] ?? '') !== 'reference') {
    $explicit = trim((string) ($body['title'] ?? ''));
    if ($explicit !== '') {
      $all[$idx]['title'] = $explicit;
      $all[$idx]['titleCustom'] = true;
    } else {
      $all[$idx]['title'] = auto_title(
        (string) ($all[$idx]['course'] ?? ''),
        (string) ($all[$idx]['examType'] ?? ''),
        (string) ($all[$idx]['type'] ?? 'papers')
      );
      unset($all[$idx]['titleCustom']);
    }
  }

  if (($all[$idx]['type'] ?? '') === 'reference') {
    $all[$idx]['book'] = [
      'author'     => (string) ($body['bookAuthor'] ?? $all[$idx]['book']['author'] ?? ''),
      'publisher'  => (string) ($body['bookPublisher'] ?? $all[$idx]['book']['publisher'] ?? ''),
      'cover'      => (string) ($body['bookCover'] ?? $all[$idx]['book']['cover'] ?? 'ink'),
      'gist'       => (string) ($body['bookGist'] ?? $all[$idx]['book']['gist'] ?? ''),
      'link'       => trim((string) ($body['bookLink'] ?? $all[$idx]['book']['link'] ?? '')),
      // The cover scan isn't replaceable from the edit panel (same as the
      // PDF on any other type) — carry the existing one straight through.
      'coverImage' => (string) ($all[$idx]['book']['coverImage'] ?? ''),
    ];
    if (array_key_exists('bookTitle', $body) && trim((string) $body['bookTitle']) !== '') {
      $all[$idx]['title'] = trim((string) $body['bookTitle']) . ' — Reference Book';
    }
    if (array_key_exists('pages', $body)) {
      $pages = (int) $body['pages'];
      if ($pages > 0) $all[$idx]['pages'] = $pages; else unset($all[$idx]['pages']);
    }
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
  // A reference book has no "exam type" — fall back to the book's own
  // title instead of the generic type slug, or two different books for
  // the same course/year would both id as e.g. "mnc-ma1110-2024-reference"
  // and collide (see build_record()'s id, which doesn't otherwise know
  // one book from another).
  $examFallback = $type === 'reference' ? slugify((string) ($body['bookTitle'] ?? '')) : '';
  $exam = slugify((string) ($body['examType'] ?? '')) ?: ($examFallback ?: slugify($type));
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
 * Same scheme as dest_for(), for a reference book's cover scan: beside
 * where its PDF would have gone, a -cover suffix, and the image's real
 * extension. api/file.php's path whitelist accepts these too.
 */
function cover_dest_for(array $c, array $fields, string $ext): string {
  ['code' => $code, 'dept' => $dept, 'exam' => $exam, 'year' => $year] = $fields;
  $base = "$dept/$code/" . strtolower($code) . "-$exam-$year-cover";
  $rel = "$base.$ext";
  $n = 2;
  while (is_file($c['files_dir'] . '/' . $rel)) { $rel = "$base-$n.$ext"; $n++; }
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

/**
 * The one place the generated title is spelled out. Both writers go
 * through it -- build_record() at publish time, `edit` again on every
 * save -- which is what keeps a corrected course name correcting the
 * title with it. admin.js's autoTitle() mirrors this for the live
 * placeholder; change one, change both.
 */
function auto_title(string $course, string $examType, string $type): string {
  /* The exam type goes in AS TYPED. The slugified form belongs to the id
     and the filename, where it has to be url-safe -- putting it in the
     title too is what turned "Elementary Linear Algebra" into the
     "Elementary-linear-algebra" half of a title that read as the course
     name twice over. */
  $labels = ['papers' => 'Past paper', 'notes' => 'Notes', 'assignment' => 'Assignment'];
  $tail = trim($examType) !== '' ? trim($examType) : ($labels[$type] ?? ucfirst($type));
  return trim($course) . ' — ' . $tail;
}

function build_record(array $fields, string $admin, string $rel, string $sha256, array $body): array {
  ['code' => $code, 'dept' => $dept, 'course' => $course, 'type' => $type, 'exam' => $exam, 'year' => $year] = $fields;

  // A reference book's title is the BOOK's title, not the course's — the
  // generic "{course} — {exam}" scheme (built for exam papers/notes/
  // assignments) would show "Calculus-I — Thomas Calculus" instead of
  // "Thomas' Calculus". books.js's title() also expects exactly this
  // " — Reference Book" suffix to strip back off for display.
  $explicitTitle = trim((string) ($body['title'] ?? ''));
  $title = $type === 'reference'
    ? trim((string) ($body['bookTitle'] ?? '')) . ' — Reference Book'
    : ($explicitTitle !== '' ? $explicitTitle
       : auto_title($course, (string) ($body['examType'] ?? ''), $type));

  $record = [
    // Department is part of the id, not just code-year-exam: a course
    // genuinely shared across every branch (an open elective) is published
    // once per department (library.js/app.js filter on exact department
    // match, there's no "universal" resource concept), and without dept
    // here those copies would all collide on the same id — resource.html
    // ?id=..., edit and delete would then hit whichever one matched first.
    'id'          => strtolower($dept) . '-' . strtolower($code) . '-' . $year . '-' . $exam,
    'title'       => $title,
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

  // Marks a title that was typed rather than generated, so a later edit
  // knows not to regenerate over the top of it (see the `edit` action).
  if ($type !== 'reference' && $explicitTitle !== '') $record['titleCustom'] = true;

  if ($type === 'reference') {
    if (trim((string) ($body['bookTitle'] ?? '')) === '') fail(400, 'A reference book needs its own title.');

    $record['book'] = [
      'author'     => (string) ($body['bookAuthor'] ?? ''),
      'publisher'  => (string) ($body['bookPublisher'] ?? ''),
      'cover'      => (string) ($body['bookCover'] ?? 'ink'),
      'gist'       => (string) ($body['bookGist'] ?? ''),
      'link'       => trim((string) ($body['bookLink'] ?? '')),
      // Path under /files/ to the uploaded cover scan, same convention as
      // the top-level `file`. Set by the publish action; '' when none.
      'coverImage' => trim((string) ($body['coverImage'] ?? '')),
    ];
    if ($record['book']['author'] === '') fail(400, 'A reference book needs an author.');
    // Needs SOMETHING a reader can actually act on — the cover we shelve,
    // or a link out to where the book itself can be found.
    if ($record['book']['coverImage'] === '' && $record['book']['link'] === '') {
      fail(400, 'A reference book needs a cover image or a link to find it online.');
    }
    // A reference book never carries a hosted file of its own text.
    $record['file'] = '';

    $pages = (int) ($body['pages'] ?? 0);
    if ($pages > 0) $record['pages'] = $pages;
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
  $roll = trim($roll);
  foreach ($people as $cid => $p) {
    if (strcasecmp(trim($p['name'] ?? ''), $name) !== 0) continue;
    /* An existing person's batch used to be read-only through this path:
       whatever they were first filed with stuck, and the admin console's
       Batch field silently did nothing on every later save. A supplied
       batch now corrects the registry entry (a blank one still means
       "leave it alone" -- never let an empty field wipe a known roll). */
    if ($roll !== '' && $roll !== trim((string) ($p['roll'] ?? ''))) {
      $people[$cid]['roll'] = $roll;
      write_json_atomic($cpath, $people);
    }
    return (string) $cid;
  }
  $match = 'c' . (count($people) + 1);
  while (isset($people[$match])) $match .= 'x';
  $people[$match] = ['name' => $name, 'roll' => $roll];
  write_json_atomic($cpath, $people);
  return $match;
}
