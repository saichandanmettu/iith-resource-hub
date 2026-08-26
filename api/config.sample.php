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
  // Outside public_html on purpose (see api/file.php) — uploaded PDFs
  // are the one thing on this project with no other copy anywhere
  // (HANDOVER.md §4), and public_html gets reset on every deploy.
  'files_dir'    => __DIR__ . '/files',
  // Public, unauthenticated submissions (api/submit.php) land here —
  // a sibling of abhyas-private, NOT nested inside it, matching
  // BACKEND-PLAN-v2.md's original layout. Never web-reachable; the
  // admin console previews a pending file through an authenticated
  // PHP stream (api/publish.php?action=preview_pending), never a
  // direct link.
  'pending_dir'  => dirname(__DIR__) . '/abhyas-pending',

  // Admins. Generate a hash with api/hash.php, paste it here, delete that file.
  // At least two people should have an account (see HANDOVER.md).
  'admins' => [
    'chandan' => '$2y$10$REPLACE_WITH_A_REAL_HASH_FROM_hash_php',
  ],

  'max_upload_bytes' => 25 * 1024 * 1024,  // 25 MB per file
  'backup_keep'      => 20,
  'max_pending'      => 50,  // queue cap — flood guard
  'submit_cooldown'  => 60,  // seconds between submissions, per browser
];
