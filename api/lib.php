<?php
/**
 * Abhyas — shared backend helpers.
 * Everything risky lives here so it is written once and reviewed once.
 *
 * Shared by three entry points: api/publish.php (admin, session-checked),
 * api/submit.php (public, unauthenticated — the only thing that writes
 * to the pending queue), and api/data.php/api/file.php (public,
 * read-only). See BACKEND-PLAN-v3.md §6 for how the pending-review flow
 * layers onto the admin-only shape it started as.
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

/**
 * CSRF guard for every state-changing action. Session cookies alone don't
 * stop a form on another tab/site from POSTing to this endpoint using the
 * admin's own logged-in session — the browser attaches the cookie either
 * way. The token below only exists inside this session's own memory and
 * is never guessable from outside it, so a forged request can't include
 * it. `require_admin()` proves who you are; this proves the request
 * actually came from this console.
 */
function csrf_token(): string {
  start_session();
  if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
  return $_SESSION['csrf'];
}

function require_csrf(?string $sent): void {
  start_session();
  if (empty($_SESSION['csrf']) || !is_string($sent) || !hash_equals($_SESSION['csrf'], $sent)) {
    fail(403, 'Session expired, please refresh and try again');
  }
}

/* ---------- ids ---------- */
function new_id(): string { return bin2hex(random_bytes(8)); }

/** Path-traversal guard. Validate BEFORE an id touches the filesystem. */
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
 * half-written index — which would blank Archive, Bookshelf and the Honor
 * Roll at the same time. Not a subsystem: this is the whole atomicity story.
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

/**
 * A timestamped copy before every write, pruned to the last N. This is
 * plain PHP `copy()` — no shell, no git. A live PHP process running `git
 * commit` needs shell_exec() enabled and a working tree with push access
 * sitting on the same shared host, which is its own fragile dependency
 * (and shells-out-from-PHP is exactly the kind of surface this project
 * avoids elsewhere). This gets the same "never lose the last N versions"
 * guarantee with none of that.
 */
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

/**
 * An image by its magic bytes, not its name — used for reference-book
 * cover uploads (api/publish.php). Returns the canonical extension
 * (jpg|png|webp), or null if it is none of those.
 */
function image_ext(string $tmpPath): ?string {
  $fh = fopen($tmpPath, 'rb');
  if (!$fh) return null;
  $head = fread($fh, 12);
  fclose($fh);
  if ($head === false || strlen($head) < 12) return null;
  if (strncmp($head, "\xFF\xD8\xFF", 3) === 0) return 'jpg';
  if (strncmp($head, "\x89PNG\x0D\x0A\x1A\x0A", 8) === 0) return 'png';
  if (strncmp($head, 'RIFF', 4) === 0 && substr($head, 8, 4) === 'WEBP') return 'webp';
  return null;
}

function slugify(string $s): string {
  $s = strtolower(trim($s));
  $s = preg_replace('/[^a-z0-9]+/', '-', $s) ?? '';
  return trim($s, '-');
}

function human_size(int $b): string {
  if ($b >= 1048576) return round($b / 1048576, 1) . ' MB';
  if ($b >= 1024) return round($b / 1024) . ' KB';
  return $b . ' B';
}
