<?php
/**
 * Abhyas — review console API. Everything except `login` requires a session,
 * re-checked server-side on every single request.
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

$c      = cfg();
$action = (string) ($_GET['action'] ?? '');
$body   = json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];

/* ---------------- auth ---------------- */
if ($action === 'login') {
  start_session();
  // Throttle guessing. Cheap, and enough for a single-admin console.
  if (!empty($_SESSION['login_block']) && time() < $_SESSION['login_block']) {
    fail(429, 'Too many attempts. Wait a minute.');
  }
  $pw = (string) ($body['password'] ?? '');
  foreach ($c['admins'] as $name => $hash) {
    if (password_verify($pw, $hash)) {
      session_regenerate_id(true);          // stop session fixation
      $_SESSION['admin'] = $name;
      unset($_SESSION['login_fails'], $_SESSION['login_block']);
      ok(['user' => $name]);
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

$admin = require_admin();

/* ---------------- queue ---------------- */
if ($action === 'queue') {
  $items = [];
  foreach (glob($c['pending_dir'] . '/*.json') ?: [] as $p) {
    $r = read_json($p, []);
    if ($r) { $r['size'] = human_size((int) ($r['size'] ?? 0)); $items[] = $r; }
  }
  usort($items, fn($a, $b) => strcmp($b['submitted'] ?? '', $a['submitted'] ?? ''));

  $live = read_json($c['public_dir'] . '/resources.json', []);
  $log  = read_json($c['private_dir'] . '/decisions.json', []);
  foreach (array_slice(array_reverse($log), 0, 60) as $d) $items[] = $d;

  ok([
    'items'  => $items,
    'counts' => [
      'pending'      => count(glob($c['pending_dir'] . '/*.json') ?: []),
      'published'    => count($live),
      'rejected'     => count(array_filter($log, fn($d) => ($d['status'] ?? '') === 'rejected')),
      'contributors' => count(read_json($c['public_dir'] . '/contributors.json', [])),
    ],
  ]);
}

/* ---------------- stream a pending file ----------------
   These files are not on the public web. This is the only way to see one,
   and it checks the session first. `safe_id` runs BEFORE any filesystem
   access — that is the path-traversal guard. */
if ($action === 'file') {
  $id   = safe_id((string) ($_GET['id'] ?? ''));
  $path = $c['pending_dir'] . '/' . $id . '.pdf';
  if (!is_file($path)) fail(404, 'Not found');
  header('Content-Type: application/pdf');
  header('X-Content-Type-Options: nosniff');
  header('Content-Disposition: inline; filename="review.pdf"');
  header('Content-Length: ' . filesize($path));
  readfile($path);
  exit;
}

/* ---------------- approve ---------------- */
if ($action === 'approve') {
  $id  = safe_id((string) ($body['id'] ?? ''));
  $src = $c['pending_dir'] . '/' . $id . '.pdf';
  if (!is_file($src)) fail(404, 'That submission is gone');

  $sub  = read_json($c['pending_dir'] . '/' . $id . '.json', []);
  $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) ($body['code'] ?? '')));
  $dept = strtoupper(preg_replace('/[^A-Za-z]/', '', (string) ($body['department'] ?? '')));
  if ($code === '' || $dept === '') fail(400, 'Course code and branch are required');

  // The stored name is built from approved metadata, never from the uploader.
  $exam = slugify((string) ($body['examType'] ?? '')) ?: slugify((string) ($body['type'] ?? 'file'));
  $year = (int) ($body['year'] ?? 0) ?: date('Y');
  $rel  = "$dept/$code/" . strtolower($code) . "-$exam-$year.pdf";

  $dest = $c['files_dir'] . '/' . $rel;
  if (!is_dir(dirname($dest))) @mkdir(dirname($dest), 0755, true);
  $n = 2;
  while (is_file($dest)) {                       // never silently overwrite
    $rel  = "$dept/$code/" . strtolower($code) . "-$exam-$year-$n.pdf";
    $dest = $c['files_dir'] . '/' . $rel;
    $n++;
  }
  if (!rename($src, $dest)) fail(500, 'Could not move the file');
  @chmod($dest, 0644);

  $record = [
    'id'         => $code . '-' . $year . '-' . $exam,
    'title'      => (string) ($body['course'] ?? $code) . ' — ' . ucfirst($exam),
    'code'       => $code,
    'course'     => (string) ($body['course'] ?? ''),
    'department' => $dept,
    'semester'   => (int) ($body['semester'] ?? 0) ?: null,
    'type'       => in_array($body['type'] ?? '', ['papers','notes','assignment','reference'], true)
                      ? $body['type'] : 'papers',
    'examType'   => (string) ($body['examType'] ?? ''),
    'professor'  => (string) ($body['professor'] ?? '—'),
    'year'       => $year,
    'file'       => $rel,
    'sha256'     => $sub['sha256'] ?? hash_file('sha256', $dest),
    'contributor'=> null,
    'added'      => date('Y-m-d'),
    'approvedBy' => $admin,          // audit trail, for free
  ];

  // Reference books carry the payload library.html renders. Without it the
  // Library filters the record straight out and shows nothing.
  if ($record['type'] === 'reference') {
    $record['book'] = [
      'author'    => (string) ($body['bookAuthor'] ?? ''),
      'publisher' => (string) ($body['bookPublisher'] ?? ''),
      'cover'     => (string) ($body['bookCover'] ?? 'ink'),
      'gist'      => (string) ($body['bookGist'] ?? ''),
    ];
  }

  // Contributors are a registry: match an existing person before inventing a
  // new id, or one human becomes two and their points split.
  $name = trim((string) ($body['contributor'] ?? ''));
  if ($name !== '') {
    $cpath = $c['public_dir'] . '/contributors.json';
    $people = read_json($cpath, []);
    $match = null;
    foreach ($people as $cid => $p) {
      if (strcasecmp(trim($p['name'] ?? ''), $name) === 0) { $match = $cid; break; }
    }
    if ($match === null) {
      $match = 'c' . (count($people) + 1);
      while (isset($people[$match])) $match .= 'x';
      $people[$match] = ['name' => $name, 'roll' => (string) ($body['roll'] ?? '')];
      write_json_atomic($cpath, $people);
    }
    $record['contributor'] = $match;
  }

  $rpath = $c['public_dir'] . '/resources.json';
  $all = read_json($rpath, []);
  $all[] = $record;
  write_json_atomic($rpath, $all);

  @unlink($c['pending_dir'] . '/' . $id . '.json');
  log_decision($c, ['id' => $id, 'status' => 'published', 'title' => $record['title'],
                    'code' => $code, 'type' => $record['type'], 'by' => $admin,
                    'submitted' => date('c'), 'size' => '—']);
  ok(['file' => $rel]);
}

/* ---------------- reject ---------------- */
if ($action === 'reject') {
  $id  = safe_id((string) ($body['id'] ?? ''));
  $sub = read_json($c['pending_dir'] . '/' . $id . '.json', []);
  $dir = $c['private_dir'] . '/rejected';
  if (!is_dir($dir)) @mkdir($dir, 0700, true);
  @rename($c['pending_dir'] . '/' . $id . '.pdf', $dir . '/' . $id . '.pdf');
  @unlink($c['pending_dir'] . '/' . $id . '.json');
  log_decision($c, ['id' => $id, 'status' => 'rejected',
                    'title' => $sub['filename'] ?? $id,
                    'code' => $sub['code'] ?? '', 'type' => $sub['type'] ?? 'papers',
                    'reason' => mb_substr((string) ($body['reason'] ?? ''), 0, 300),
                    'by' => $admin, 'submitted' => date('c'), 'size' => '—']);
  ok();
}

fail(400, 'Unknown action');

/* ---------------- helpers ---------------- */
function log_decision(array $c, array $entry): void {
  $p = $c['private_dir'] . '/decisions.json';
  $log = read_json($p, []);
  $log[] = $entry;
  write_json_atomic($p, $log);
}

function human_size(int $b): string {
  if ($b >= 1048576) return round($b / 1048576, 1) . ' MB';
  if ($b >= 1024) return round($b / 1024) . ' KB';
  return $b . ' B';
}
