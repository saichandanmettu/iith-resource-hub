<?php
/**
 * Abhyas — one-time password hash generator.
 *
 * Run this ONCE to produce a bcrypt hash for `abhyas-private/config.php`'s
 * `admins` array, then DELETE THIS FILE. It has no other purpose and no
 * safeguard against being run by someone else — the only safeguard is that
 * it does not exist after you are done with it.
 *
 * Usage: upload to /public_html/api/hash.php, visit it in a browser,
 * submit a password, copy the printed hash, paste it into config.php as:
 *   'admins' => [ 'yourname' => '<hash printed below>' ],
 * then delete this file (or it stays a way for anyone to see the hash
 * format — not a login bypass, but it has no reason to still be there).
 */
declare(strict_types=1);

$hash = null;
$pw = $_POST['password'] ?? '';
if ($pw !== '') {
  $hash = password_hash($pw, PASSWORD_DEFAULT);
}
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Abhyas — password hash generator</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; max-width: 640px; margin: 3rem auto; padding: 0 1.5rem; color: #222; }
  h1 { font-size: 1.1rem; }
  input[type=password] { font: inherit; padding: .5rem; width: 100%; box-sizing: border-box; }
  button { font: inherit; padding: .5rem 1rem; margin-top: .5rem; }
  pre { background: #f4f4f4; padding: 1rem; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
  .warn { color: #a33; font-weight: 600; }
</style>
</head>
<body>
<h1>Abhyas — one-time password hash generator</h1>
<p class="warn">Delete this file from the server as soon as you have your hash.</p>
<form method="post">
  <input type="password" name="password" placeholder="Choose the admin password" autofocus required>
  <button type="submit">Generate hash</button>
</form>
<?php if ($hash): ?>
<p>Paste this into <code>abhyas-private/config.php</code>:</p>
<pre><?= htmlspecialchars("'yourname' => '{$hash}',", ENT_QUOTES) ?></pre>
<?php endif; ?>
</body>
</html>
