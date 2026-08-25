# Abhyas — backend plan v2 (consolidated)

Supersedes the proposal in `backend.md`. That file stays as the record of how
these decisions were reached — two review rounds between Claude and
Antigravity — and should not be edited.

**Status:** everything below is settled except §8, which lists two decisions
that are the owner's and four facts that need checking rather than arguing.

---

## 1. What changed from v1

Accepted from Antigravity's review:

| Change | Why |
|---|---|
| `book` payload kept in the schema | `books.js:150` builds the Library with `filter(r => r.book)`; dropping it empties the Library silently |
| Cache headers on `resources.json` | Without them, returning students never see newly approved files |
| Viewer reuses existing modal + Lenis lifecycle | A second modal pattern would fight the first |
| Rolling backup pruning | Inode pressure is real on shared hosting |
| Per-IP rate limiting **removed** | Campus NAT puts thousands of students behind one address |
| Password recovery added | A non-technical successor cannot generate a bcrypt hash |

Changed from Antigravity's proposal:

| Their fix | What v2 does instead |
|---|---|
| `reset.php` + `reset.flag` | `hash.php` — prints a hash to paste in. A calculator cannot become a backdoor; a reset endpoint can |
| Turnstile / reCAPTCHA | Cookie token + global queue cap. A captcha is an external vendor account bound to a domain — the same structure that ruled out Adobe |
| `pending/` inside `public_html/.storage/` | Stays outside the web root — see §8.1 |

---

## 2. Directory layout

```
/home/uXXXXX/
├── abhyas-pending/              ← NOT web-reachable
│   ├── 9f2a1c4e8b3d7a05.pdf
│   └── 9f2a1c4e8b3d7a05.json
├── abhyas-private/              ← NOT web-reachable
│   ├── config.php                   (admin hashes, paths, limits)
│   ├── backups/                     (last 20 copies of resources.json)
│   └── rejected/
└── public_html/
    ├── files/                   ← approved PDFs only
    │   ├── .htaccess                (no PHP execution — defence in depth)
    │   └── CS/CS2110/CS2110-endsem-2024.pdf
    ├── api/
    │   ├── submit.php               (public intake)
    │   └── moderate.php             (authenticated)
    ├── assets/pdfjs/                (if PDF.js — see §8.2)
    ├── admin/
    ├── resources.json
    ├── courses.json
    ├── contributors.json
    └── (site files)
```

File naming stays `files/{DEPT}/{CODE}/{CODE}-{examType}-{year}.pdf`, generated
server-side from approved metadata, never from the uploader. Records store the
path **relative to `files/`**.

---

## 3. Data model

### `resources.json`

```json
{
  "id": "cs2110-2024-endsem",
  "title": "Algorithms — End-Sem Paper",
  "code": "CS2110",
  "course": "Design and Analysis of Algorithms",
  "department": "CS",
  "semester": 4,
  "type": "papers",
  "examType": "End-Sem",
  "professor": "—",
  "year": 2024,
  "file": "CS/CS2110/CS2110-endsem-2024.pdf",
  "pages": 6,
  "sha256": "…",
  "contributor": "c1",
  "added": "2026-08-23",
  "approvedBy": "chandan"
}
```

**Required when `type === "reference"`:**

```json
"book": { "author": "…", "publisher": "…", "cover": "crimson", "gist": "…" }
```

`cover` must be one of the values `books.js` maps in `COVER_CLASS`.

**`downloads` is removed.** It exists in `data.js` today, is rendered nowhere
in any page, and its current values are invented. A counter can be added later
behind an endpoint if it is ever actually wanted.

### `courses.json`

```json
"CS2110": { "name": "…", "sem": 4, "professors": [], "branches": ["CS"] }
```

`branches` **pre-selects** the dropdown; it never sets `department`
automatically. In this archive `department` means "which branch's students
take this" — `MA1010` is CS while `MA1310` is MSME (`data.js:241`, `:120`).

### `contributors.json`

```json
"c1": { "name": "Aarav Menon", "roll": "CS23" }
```

Resources reference the id. Names are never copied inline, or the leaderboard
splits one person's points across spellings. `roll` is the branch+year token
only, never a full roll number.

---

## 4. Pipeline

```
Student uploads → submit.php → abhyas-pending/  (quarantined, not public)
                                     │
Admin reviews ── previews via session-checked stream
              ── corrects metadata (registry auto-fills)
              ├─ Approve → move into files/{DEPT}/{CODE}/
              │            append to resources.json (atomic)
              │            stamp approvedBy + added
              └─ Reject  → abhyas-private/rejected/, log reason
```

Leaderboard points need no mechanism: they are computed from
`resources.json`, so approving grants them and a takedown removes them.

---

## 5. Security

**Upload (`submit.php`)** — public and unauthenticated, the highest-risk part:

- Server-side max size (recommend 25 MB/file).
- Verify magic bytes (`%PDF-`); never trust extension or browser MIME.
- Generate the stored filename: `bin2hex(random_bytes(8))`.
- Write only into `abhyas-pending/`.
- **Global cap on the pending queue** (e.g. 50) plus a cookie-scoped
  cooldown. No per-IP limiting.
- Generic error messages — no paths, no PHP notices.

**Admin auth:**

- `password_hash()` / `password_verify()`; hashes in `abhyas-private/config.php`.
- Supports **multiple admins** — an array of `{ name, hash }`. `HANDOVER.md`
  requires at least two people with access.
- `session_regenerate_id(true)` on login; cookie `HttpOnly`, `Secure`,
  `SameSite=Lax`.
- Every API action re-checks the session server-side. The JS that hides the
  console is convenience, not a boundary.
- Throttle failed logins. `.htaccess` Basic Auth over `/admin/` as a second layer.

**Serving pending files:**

- Validate `id` against `^[a-f0-9]{16}$` **before** touching the filesystem.
  This is the path-traversal guard.
- Then session-check, then `readfile()` with `application/pdf`,
  `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`.

**Writing `resources.json`:**

- `flock()` exclusive → write temp → `json_decode()` to prove it parses →
  `rename()` (atomic on the same filesystem).
- Keep the last 20 copies in `backups/`, prune beyond that.

**Serving `resources.json`:**

- `Cache-Control: no-cache, must-revalidate` plus ETag, so unchanged fetches
  cost a 304 rather than a full download.

**Not claimed:** this does not make uploads safe in the absolute. Magic bytes
prove a file *starts* like a PDF — not that it is harmless. Disk and inode
exhaustion remain live risks. The queue cap is what bounds them.

---

## 6. Resolved gaps

1. **Duplicate detection covers `pending/` too**, not just published records —
   otherwise two students uploading the same paper before either is approved
   both pass. Flag for the admin; do not reject at upload (the uploader should
   not learn what is in the queue).
2. **Submitter feedback:** a "held for review" confirmation with a reference
   id. Email address is an optional field. **No automatic rejection emails** —
   shared-hosting mail lands in spam and promising notification we cannot
   reliably deliver is worse than staying silent. `contribute.html` copy must
   change; it currently says uploads are still being built.
3. **Placeholder data is deleted at Phase 1** — all 24 records and all 8
   contributors. The leaderboard currently shows a plausible ranking of people
   who do not exist; publishing that is worse than an empty board. Keep the
   file as `data.sample.js` for design work.
4. **`downloads` removed** — see §3.
5. **Storage ceiling:** at ~4 MB average, 1,000 resources ≈ 4 GB. Disk is not
   the binding constraint for years; **inodes** are, since every file and
   thumbnail costs one. Check the limit, alert at 70%.
6. **Audit log for free:** `approvedBy` + `added` on each record already
   answers "who published this and when" with no extra infrastructure.

---

## 7. Build order

Each phase leaves the site working.

1. **`resources.json` + fetch swap**, including `book` and minus `downloads`;
   delete placeholder data. No server code, no security surface.
2. **Real files + public viewer.** Upload a few PDFs by hand, add `file`,
   wire the viewer into the existing modal.
3. **Review console against real data**, admin-only, no public uploads. The
   admin files resources through it.
4. **Public submissions** — `submit.php` and all of §5. This is the phase that
   introduces real risk.
5. **Housekeeping** — backups, pruning, retention policy, storage alerts.

Phases 1–3 are useful even if 4 is never built, and none of them depends on
the decisions in §8.

---

## 8. Still open

### 8.1 Where `pending/` lives — unresolved between reviewers

v2 keeps it **outside the web root**. The argument that decides it:
`.htaccess` protection is **fail-open** — if it is lost or ignored, every
unreviewed upload becomes publicly listable with no error. Outside the web
root, a misconfiguration breaks loudly instead. And nginx ignores `.htaccess`
entirely, so a future host migration — the exact succession scenario — would
silently expose the folder.

**Decision rule, once §8.4 is checked:** if backups cover the home directory,
this is settled with no downside. If they genuinely do not, the fix is an
explicit backup routine covering both trees — not moving unreviewed public
uploads inside the web root.

### 8.2 Adobe vs PDF.js — owner's decision

Both reviewers independently favour **PDF.js** on succession grounds: no
account, no domain-bound key, nothing to inherit or renew. The owner has
chosen Adobe twice and it remains his call. Either way the viewer sits behind
one function so the swap stays cheap.

### 8.3 Public uploads at all — owner's decision

Phases 1–3 deliver a working archive with admin-only filing. Phase 4 adds
public intake and, with it, every risk in §5. Worth deciding before Phase 4,
not before Phase 1.

### 8.4 Four facts to check in hPanel

Neither reviewer can resolve these by argument:

1. Does the backup cover the **home directory**, or only `public_html`?
2. Does this plan's LiteSpeed honour `php_flag engine off`, or is
   `RemoveHandler` needed?
3. What is the inode limit, and current usage?
4. Is Git deployment in use, and what directory does it write to?
