<?php
/**
 * Password hash generator — a calculator, not a login.
 *
 * A successor who needs to change the admin password runs this, pastes the
 * result into config.php via File Manager, then DELETES this file.
 *
 * It deliberately cannot change anything by itself: it only prints a hash.
 * (An endpoint that could *reset* a password would be a permanent way in.)
 */
$pw = $_POST['pw'] ?? '';
header('Content-Type: text/html; charset=utf-8');
echo '<meta name="robots" content="noindex">';
echo '<style>body{font:16px/1.6 system-ui;max-width:640px;margin:60px auto;padding:0 20px}
code{display:block;background:#f4f4f4;padding:14px;border-radius:8px;word-break:break-all;margin:14px 0}</style>';
echo '<h1>Password hash</h1>';
echo '<p>Type a password, copy the hash into <code style="display:inline;padding:2px 6px">config.php</code>, then delete this file.</p>';
echo '<form method="post"><input name="pw" type="text" style="padding:10px;width:70%" placeholder="new password" autofocus>
      <button style="padding:10px 18px">Generate</button></form>';
if ($pw !== '') {
  echo '<code>' . htmlspecialchars(password_hash($pw, PASSWORD_DEFAULT), ENT_QUOTES) . '</code>';
}
