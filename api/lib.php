<?php
/**
 * Abhyas — shared backend helpers.
 * Everything risky lives here so it is written once and reviewed once.
 */
declare(strict_types=1);

function cfg(): array {
  static $c = null;
  if ($c !== null) return $c;
  foreach ([dirname(__DIR__, 2) . '/abhyas-private/config.php', __DIR__ . '/config.php'] as $p) {
    if (is_file($p)) { $c = require $p; return $c; }
  }
  fail(500, 'Not configured');
}

function fail(int $code, string $msg): void {
  http_response_code($code);
  header('Content-Type: application/json');
  // Deliberately vague: no paths, no PHP messages, nothing to probe with.
  echo json_encode(['ok' => false, 'error' => $msg]);
  exit;
}

function ok(array $data = []): void {
  header('Content-Type: application/json');
  echo json_encode(['ok' => true] + $data);
  exit;
}

/* ---------- sessions ---------- */
function start_session(): void {
  if (session_status() === PHP_SESSION_ACTIVE) return;
  session_set_cookie_params([
    'httponly' => true,
    'secure'   => !empty($_SERVER['HTTPS']),
    'samesite' => 'Lax',
    'path'     => '/',
  ]);
  session_start();
}

/** Every protected action calls this. The console hiding itself proves nothing. */
function require_admin(): string {
  start_session();
  if (empty($_SESSION['admin'])) fail(401, 'Not signed in');
  return (string) $_SESSION['admin'];
}

/* ---------- ids ---------- */
function new_id(): string { return bin2hex(random_bytes(8)); }

/** Path-traversal guard. Validate BEFORE the id touches the filesystem. */
function safe_id(string $id): string {
  if (!preg_match('/^[a-f0-9]{16}$/', $id)) fail(400, 'Bad id');
  return $id;
}

/* ---------- JSON, written so a half-write cannot happen ---------- */
function read_json(string $path, $fallback = []) {
  if (!is_file($path)) return $fallback;
  $raw = file_get_contents($path);
  $data = json_decode($raw, true);
  return is_array($data) ? $data : $fallback;
}

/**
 * Lock, write to a temp file, prove it parses, then rename over the original.
 * rename() is atomic on the same filesystem, so a reader never sees a
 * half-written index — which would blank Browse, Library and the Leaderboard
 * at the same time.
 */
function write_json_atomic(string $path, $data): void {
  $dir = dirname($path);
  $lock = fopen($path . '.lock', 'c');
  if (!$lock || !flock($lock, LOCK_EX)) fail(500, 'Busy, try again');

  $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  if ($json === false || json_decode($json) === null) {
    flock($lock, LOCK_UN); fclose($lock);
    fail(500, 'Refused to write invalid data');
  }

  if (is_file($path)) backup_file($path);

  $tmp = $dir . '/.tmp-' . new_id();
  if (file_put_contents($tmp, $json . "\n") === false) {
    flock($lock, LOCK_UN); fclose($lock);
    fail(500, 'Write failed');
  }
  rename($tmp, $path);
  flock($lock, LOCK_UN); fclose($lock);
}

function backup_file(string $path): void {
  $c = cfg();
  $dir = $c['private_dir'] . '/backups';
  if (!is_dir($dir)) @mkdir($dir, 0700, true);
  @copy($path, $dir . '/' . date('Ymd-His') . '-' . basename($path));

  // prune — every stale copy costs an inode, and shared hosting counts them
  $keep = $c['backup_keep'] ?? 20;
  $all = glob($dir . '/*-' . basename($path)) ?: [];
  if (count($all) > $keep) {
    sort($all);
    foreach (array_slice($all, 0, count($all) - $keep) as $old) @unlink($old);
  }
}

/* ---------- uploads ---------- */
/** A file is a PDF because it starts like one — not because of its name. */
function looks_like_pdf(string $tmpPath): bool {
  $fh = fopen($tmpPath, 'rb');
  if (!$fh) return false;
  $head = fread($fh, 5);
  fclose($fh);
  return $head === '%PDF-';
}

function slugify(string $s): string {
  $s = strtolower(trim($s));
  $s = preg_replace('/[^a-z0-9]+/', '-', $s) ?? '';
  return trim($s, '-');
}
