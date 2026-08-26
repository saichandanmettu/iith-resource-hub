<?php
/**
 * Abhyas — configuration TEMPLATE.
 *
 * COPY THIS to  /home/<youruser>/abhyas-private/config.php
 * (one level ABOVE public_html) and edit it there.
 *
 * Do NOT put the real config inside public_html, and do not commit it.
 */
return [
  // Where things live. Adjust to match your hosting account.
  'private_dir'  => dirname(__DIR__, 2) . '/abhyas-private',
  'public_dir'   => dirname(__DIR__),          // public_html
  'files_dir'    => dirname(__DIR__) . '/files',

  // Admins. Generate a hash with api/hash.php, paste it here, delete that file.
  // At least two people should have an account (see HANDOVER.md).
  'admins' => [
    'chandan' => '$2y$10$REPLACE_WITH_A_REAL_HASH_FROM_hash_php',
  ],

  'max_upload_bytes' => 25 * 1024 * 1024,  // 25 MB per file
  'backup_keep'      => 20,                // how many resources.json snapshots to keep
];
