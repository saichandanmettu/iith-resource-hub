<?php
/**
 * Abhyas — public submission endpoint.
 *
 * The only unauthenticated thing that writes to disk, so every guard
 * here exists for a reason:
 *
 *  - files land in abhyas-pending/, OUTSIDE public_html — an unreviewed
 *    upload is never on the web, not even briefly
 *  - the stored filename is generated, never the uploader's
 *  - a file is a PDF because it STARTS like one, not because of its
 *    extension or the browser's claimed MIME type
 *  - the queue is capped, which is what actually bounds disk/inode abuse
 *  - the cooldown is per-browser, NOT per-IP: campus wifi puts thousands
 *    of students behind one address, so a per-IP limit would either
 *    block everyone on campus or stop nobody
 *
 * No CSRF check here — there's no session worth protecting yet, and the
 * worst a forged request can do is add one more item to a queue a human
 * reviews before anything goes live. That review step is the real
 * mitigation, not a token.
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST only');
$c = cfg();

start_session();
$now = time();
if (!empty($_SESSION['last_submit']) && $now - $_SESSION['last_submit'] < $c['submit_cooldown']) {
  fail(429, 'Please wait a moment before sending another file.');
}

$pending = $c['pending_dir'];
if (!is_dir($pending)) @mkdir($pending, 0700, true);

$queued = glob($pending . '/*.json') ?: [];
if (count($queued) >= $c['max_pending']) {
  fail(503, 'The review queue is full right now. Please try again later.');
}

if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) fail(400, 'No file received.');
$f = $_FILES['file'];
if ($f['size'] <= 0 || $f['size'] > $c['max_upload_bytes']) fail(413, 'That file is too large.');
if (!is_uploaded_file($f['tmp_name']) || !looks_like_pdf($f['tmp_name'])) fail(415, 'Only PDF files can be accepted.');

$id = new_id();
if (!move_uploaded_file($f['tmp_name'], $pending . '/' . $id . '.pdf')) {
  fail(500, 'Could not store the file.');
}
@chmod($pending . '/' . $id . '.pdf', 0600);

/* What the student typed is kept as a SUGGESTION. The admin corrects it
   in the console before anything is published, so none of it is
   trusted here beyond being stored as text. */
$field = fn(string $k, int $max = 200) => mb_substr(trim((string) ($_POST[$k] ?? '')), 0, $max);

$record = [
  'id'          => $id,
  'status'      => 'pending',
  'submitted'   => date('c'),
  'size'        => $f['size'],
  'filename'    => mb_substr(basename((string) $f['name']), 0, 120),
  'sha256'      => hash_file('sha256', $pending . '/' . $id . '.pdf'),
  'code'        => strtoupper($field('code', 12)),
  'course'      => $field('course'),
  'department'  => strtoupper(preg_replace('/[^A-Za-z]/', '', $field('department', 20)) ?? ''),
  'type'        => in_array($_POST['type'] ?? '', ['papers', 'notes', 'assignment', 'reference'], true)
                     ? $_POST['type'] : 'papers',
  // "semester" is collected on the form as a free-text hint (e.g. "Sem 3
  // 2024") for the admin's eyes only — never becomes part of a published
  // record. See BACKEND-PLAN-v3.md: the same course can sit in a
  // different semester for different branches, so it was never a fact
  // about the course to store.
  'semesterHint'=> $field('semester', 50),
  'year'        => (int) ($_POST['year'] ?? 0) ?: null,
  'examType'    => $field('examType', 100),
  'professor'   => $field('professor'),
  'contributor' => $field('contributor', 80),
  'roll'        => $field('roll', 20),
];

/* Duplicate check spans BOTH the live index and the pending queue — two
   students can submit the same paper before either is reviewed. Never
   rejected outright: the uploader isn't told what's already in the
   queue, only the admin sees the flag during review. */
$record['duplicateOf'] = null;
foreach (read_json($c['private_dir'] . '/resources.json', []) as $r) {
  if (!empty($r['sha256']) && $r['sha256'] === $record['sha256']) {
    $record['duplicateOf'] = $r['file'] ?? ($r['id'] ?? 'an existing file');
    break;
  }
}
if ($record['duplicateOf'] === null) {
  foreach ($queued as $q) {
    $prev = read_json($q, []);
    if (!empty($prev['sha256']) && $prev['sha256'] === $record['sha256']) {
      $record['duplicateOf'] = 'another file already waiting in the queue';
      break;
    }
  }
}

file_put_contents($pending . '/' . $id . '.json', json_encode($record, JSON_PRETTY_PRINT));
@chmod($pending . '/' . $id . '.json', 0600);

$_SESSION['last_submit'] = $now;

/* The reference is deliberately short and not the internal id. */
ok(['reference' => strtoupper(substr($id, 0, 6))]);
