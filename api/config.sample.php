<?php
/**
 * Abhyas — configuration TEMPLATE.
 *
 * COPY THIS to  /home/<youruser>/abhyas-private/config.php
 * (one level ABOVE public_html) and edit it there.
 *
 * Do NOT put the real config inside public_html, and do not commit it.
 *
 * Path note: this file's own __DIR__ is wherever IT lives once copied —
 * abhyas-private/, not api/. Every path below is written relative to
 * THAT location on purpose. Don't reuse api/lib.php's dirname() pattern
 * here; it assumes a different starting point and silently points
 * public_dir at your home folder instead of public_html if copied in.
 */
return [
  // __DIR__ here is abhyas-private/ itself once this file is in place.
  'private_dir'  => __DIR__,
  'public_dir'   => dirname(__DIR__) . '/public_html',
  'files_dir'    => dirname(__DIR__) . '/public_html/files',

  // Admins. Generate a hash with api/hash.php, paste it here, delete that file.
  // At least two people should have an account (see HANDOVER.md).
  'admins' => [
    'chandan' => '$2y$10$REPLACE_WITH_A_REAL_HASH_FROM_hash_php',
  ],

  'max_upload_bytes' => 25 * 1024 * 1024,  // 25 MB per file
  'backup_keep'      => 20,
];
