# Abhyas — backend plan v3 (admin-only publishing)

Supersedes `BACKEND-PLAN-v2.md` **for Phases 1–3 only**. v2 stays as the
record of how the public-submission design (quarantine, moderation queue,
rate limiting, duplicate detection across a pending pile) was argued out —
it is not wrong, it was answering a question this project isn't asking yet.
Do not edit v2; it becomes the reference again the day Phase 4 starts.

**How this got decided:** seven different AI models were independently
given `roadmap.md`, `BACKEND-PLAN-v2.md` and `HANDOVER.md` and asked the
same question — is admin-only publishing this complex? — without seeing
each other's answers. All seven cut the same things. The full comparison,
what each one added, and where they disagreed, is in `AGENT-PLANS.md`.

---

## 1. The one-sentence version

**The uploader and the approver are the same person right now.** Every
piece of machinery in v2 exists to answer "what happens when a stranger
uploads a file with no login?" — quarantine outside the web root, a
moderation queue, approve/reject states, per-browser cooldowns, duplicate
detection across an unreviewed pile. None of that question exists yet.
What's needed instead is a private publishing form: log in, pick a PDF,
fill in course/branch/year/type, click Publish, it's live.

## 2. What's cut, and why it's safe to cut it now

| Cut | Why it existed in v2 | Why it's fine to cut now |
|---|---|---|
| `abhyas-pending/` quarantine | Unreviewed public uploads must never be web-reachable | There are no unreviewed uploads — every file already comes from an authenticated admin |
| Moderation queue / approve / reject | Someone else's submission needs a decision before it's trusted | The person uploading already made that decision by choosing to publish it |
| Duplicate detection across the queue | Two strangers could submit the same paper before either is reviewed | No queue exists to collide in; a single non-blocking SHA-256 check against the live index (§4) covers the case that still matters |
| Per-browser cooldown, queue cap | Bound abuse from anonymous traffic | There is no anonymous traffic hitting this endpoint |
| `submit.php` | The only way for the public to get a file into review | Not needed until the public can submit anything — archived, not deleted, at `_local/_archive/phase4-deferred-api/` |

## 3. What's kept, unchanged from v2's reasoning

- **Atomic JSON writes.** `flock()` → write temp → parse-check → `rename()`.
  Two functions, not a subsystem — this protects against a half-written
  index blanking the Archive, Bookshelf, and Honor Roll at once, and that
  risk doesn't go away just because uploads are trusted.
- **PDF-only by magic bytes**, never by filename or extension.
- **Generated filenames** (`code-examtype-year.pdf`), never the uploader's
  own filename — collision-safe by construction, and incidentally the
  entire duplicate defence for "same course+year+type filed twice."
- **`files/` cannot execute PHP** (`.htaccess`, `php_flag engine off`) —
  this was always the actual security boundary; the quarantine folder was
  standing in front of it, not instead of it.
- **Two-layer admin auth**, per `HANDOVER.md` §5a rule 2: `.htaccess`/
  `.htpasswd` Basic Auth in front of `admin/`, PHP session behind it,
  every action re-checked server-side. Neither layer is a substitute for
  the other.
- **`approvedBy` + `added` on every record** — an audit trail that costs
  nothing extra, same as v2.

## 4. What's new in v3, not in v2

- **One endpoint, `api/publish.php`**, replacing `submit.php` +
  `moderate.php`. Actions: `login`, `logout`, `me`, `list`, `publish`,
  `edit`, `delete`.
- **CSRF token**, issued at login, required on every state-changing
  action. A session cookie alone doesn't stop a forged POST from another
  tab — this is the one thing none of the seven agents caught except
  GPT 5.6 Terra.
- **`edit` and `delete` on already-published resources.** v2 only ever
  covered adding things; a typo'd course code or a takedown request
  shouldn't mean hand-editing `resources.json`. `delete` removes the JSON
  record only — per `HANDOVER.md` §4, no web action deletes the PDF
  itself; do that by hand once you're sure.
- **`"status": "published"` on every resource record**, starting now, even
  though only one status exists today. The day a moderation queue is
  reintroduced, it's a filter on a field that's already there, not a
  migration touching every existing record.
- **Backup via timestamped `copy()` of `resources.json`**, pruned to the
  last N (`backup_file()` in `lib.php`, unchanged from v2) — not a `git
  commit` run from PHP. Shelling out from a live PHP process needs
  `shell_exec()` enabled and a working tree with push access on the same
  shared host; that's a fragile dependency and its own attack surface,
  exactly the kind of thing this project avoids elsewhere. A local
  timestamped copy gets the same "never lose the last N versions"
  guarantee with none of that.
- **Non-blocking duplicate notice.** One `hash_file()` compare against the
  live `resources.json` at publish time. If it matches, the admin sees
  which existing file it matches and can resubmit with confirmation —
  never a hard block, since the admin is also the moderator here.

## 5. Directory layout

```
/home/uXXXXX/
├── abhyas-private/              ← NOT web-reachable
│   ├── config.php                   (admin hashes, paths, limits)
│   └── backups/                     (last 20 copies of resources.json + contributors.json)
└── public_html/
    ├── files/                   ← published PDFs only
    │   └── .htaccess                (no PHP execution — defence in depth)
    ├── api/
    │   ├── publish.php              (the whole backend)
    │   ├── lib.php
    │   ├── hash.php                 (delete after generating your admin hash)
    │   └── config.sample.php
    ├── admin/
    ├── resources.json
    ├── courses.json
    ├── contributors.json
    └── (site files)
```

No `abhyas-pending/`. It didn't exist in this phase and doesn't need to.

## 6. When Phase 4 (public submissions) actually happens

Bring back `_local/_archive/phase4-deferred-api/submit.php` and the
queue half of the old `moderate.php`, updated against `"status"` instead
of a separate pending directory: a public submission gets written with
`"status": "pending"` (into a real quarantine location, per v2 §8.1's
already-settled reasoning) instead of `"published"`, and the console's
`list` action becomes a filter over that field. Everything built in v3 —
`publish`/`edit`/`delete`, CSRF, atomic writes, the schema — stays exactly
as it is; Phase 4 is additive, not a rewrite. That's the entire point of
adding `status` now instead of later.

## 7. Still open — same two owner calls as before

Unchanged from `BACKEND-PLAN-v2.md` §8: the PDF viewer (settled separately,
see `roadmap.md` §2 — self-hosted PDF.js) and whether/when Phase 4 launches
at all (deferred, per this document). The four hPanel facts in v2 §8.4
(backup coverage, `php_flag engine off` vs `RemoveHandler`, inode limit,
git deployment) still need checking once staging is up — nothing about v3
changes what those answers need to be.
