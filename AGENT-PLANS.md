# Abhyas — backend plans, by agent

**Internal only. Not linked from the site.** A running log of every AI's take
on "how should the Abhyas backend/admin-console work," collected so they can
be compared side by side afterward instead of relying on memory of which one
said what.

Context every agent was given: `roadmap.md`, `BACKEND-PLAN-v2.md`,
`HANDOVER.md` (see those files for the settled architecture and the two
decisions already made — PDF viewer = self-hosted PDF.js, public uploads
deferred, admin-only publishing first).

Each entry: who, when, their plan verbatim, then a short verdict once
compared.

---

## Claude (Sonnet 5, in this session) — 2026-08-26

**Take:** the originally-scoped plan (quarantine queue, `submit.php`,
duplicate detection, rate limiting) solves the "anonymous public upload"
problem, which isn't needed yet since publishing is admin-only for now.
Proposed cutting it down to a single authenticated "add resource" flow —
one PHP endpoint, no pending queue, no `abhyas-pending/` — with the queue
machinery added back later only when public submissions actually launch.

Full text: see this session's transcript (not yet reproduced verbatim here
— add if it needs to be judged against the others word-for-word).

**Verdict:** _pending — waiting on the other agents' plans to compare against._

---

## Google Antigravity — 2026-08-26

**Take:** restated the existing settled plan (quarantine queue, atomic
writes, admin console, PDF.js) with three deltas: (1) swap the hardcoded
student contact email for a domain address, (2) change the approved
resource ID format to a lowercase `dept-code-year-exam` slug, (3) a
verification flow that submits a test resource through the public
`contribute.html` form.

**Verdict:** Claude's read on it (this session) — the contact-email swap is
a genuine good catch, deferred pending the domain inbox actually being set
up; the ID-format change is unrequested scope creep with no stated reason;
the verification flow contradicts the "admin-only first, public later"
decision already made and would wire public submissions live during a test.

---

## ChatGPT (thinking mode) — 2026-08-26

**Take:** the proposed system solves a "content moderation" problem, but the
actual current problem is "private publishing interface" — a much smaller
thing. Recommends deleting the quarantine folder, the moderation queue,
approve/reject states, duplicate detection, rate limiting, and cooldowns
entirely for now; replacing them with one authenticated admin flow (login →
upload PDF → fill ~5 fields → Publish → file moved into public storage +
`resources.json` updated). Explicitly keeps atomic JSON writes, file
locking, and basic backups as worth having even at this scale. Adds edit/
delete capability for already-published resources (not previously scoped).
Surveyed and rejected Google Sheets, Airtable, Decap/Git CMS, and WordPress
as alternatives — each trades the "no inheritable account" property this
project already protects (see `HANDOVER.md` §3) for a nicer UI, and judged
that trade not worth it here. Frames the moderation-queue machinery as
"Phase 3 infrastructure," to be added back only once public submissions
actually launch, not thrown away.

**Verdict:** converges independently with Claude's plan from earlier in
this session (cut the queue, ship a direct-publish admin flow, add the
queue back only for Phase 4) — two different models reaching the same cut
on the same evidence is a good signal it's the right call, not just a
preference. Genuinely new and worth taking: the explicit point that
"the backend owns the schema, the frontend just consumes it" as a boundary
worth stating outright, and edit/delete on published resources, which
hadn't been scoped in the original plan or Claude's revision.

## Claude Opus 4.6 (thinking, via Antigravity) — 2026-08-26

**Take:** same core cut as Claude and ChatGPT above — quarantine, moderation
queue, atomic locking-as-architecture, rate limiting, and duplicate
detection all exist to solve untrusted public uploads, which aren't
happening yet. Recommends "Option A": one `admin.php` (~100-150 lines) —
auth (HTTP Basic or a simple session), one form (file + course code +
branch + year + type), on submit `move_uploaded_file()` + append to
`resources.json`. Explicitly downgrades file-locking from "architecture" to
"one `LOCK_EX` flag," and backup from "rolling versioned copies" to
"commit `resources.json` to a private git repo after each change." Also
surveyed and rejected Git-as-CMS, Google Sheets, and Decap CMS as
alternatives, each for introducing a third-party account or hosting
migration this project is trying to avoid — same reasoning ChatGPT gave
independently.

**Verdict:** third independent model, same conclusion. Genuinely new here:
using **git commits as the backup mechanism** instead of a rolling-copies
folder — free, gives real diff/history, and this project already has a
GitHub repo it's tracked in, so it's not a new dependency. Worth folding
in. The HTTP-Basic-Auth-instead-of-PHP-session suggestion is weaker for
this project specifically — `admin/.htaccess` Basic Auth is already planned
as a *second* layer per `HANDOVER.md` §5a rule 2, on top of a session, not
instead of one; collapsing to Basic-Auth-only would lose the "every action
re-checks server-side" property that rule exists for.

## Gemini 3.7 Flash — 2026-08-26

**Take:** identical cut to the three above — quarantine/queue/rate-limiting/
duplicate-hashing all cut as premature for an authenticated-admin-only tool.
Same shape: one `admin/index.php`, session auth via `password_verify()`,
upload into `uploads/pdfs/` with a sanitized filename, atomic
`file_put_contents(..., LOCK_EX)` on the JSON. Notes Hostinger's own
automated site backups make a custom rolling-backup system redundant.
New idea not raised by the other three: **SQLite as the upgrade path**
if flat-JSON writes ever become a real concern — a single `.sqlite` file,
native PHP PDO support on Hostinger, removes JSON-locking concerns
entirely, still no server/account to run. Explicitly rejects Google
Sheets/Forms for the same reason every other agent did — personal-account
dependency.

**Verdict:** fourth independent model, fourth identical conclusion on the
core cut — this is no longer "one model's opinion," it's consensus.
The SQLite suggestion is worth noting but not adopting now: `BACKEND-PLAN-v2.md`
already deliberately rejected a database (see `roadmap.md` §0 — that
question was closed after two review rounds, and reopening it needs an
explicit decision, not a quiet drift). It's also solving a concurrency
problem — two admins writing at once — that doesn't exist yet with one
admin and possibly a second. Worth revisiting only if that actually
becomes a real, observed problem later, not pre-built for it now.

## Gemini 3.1 Pro — 2026-08-26

**Take:** identical cut to all four above, same "high-trust vs zero-trust"
framing Claude used ("a metal detector on your own bedroom door"). Same
shape: single admin form + one PHP script, moves PDF straight to the public
folder, appends to `resources.json`. For auth, suggests **HTTP Basic Auth
alone** (`.htaccess`/`.htpasswd`) rather than a PHP session. For backup,
suggests copying `resources.json` to `resources_backup.json` right before
each write. Also surveyed Google Forms+Sheets (same account-dependency
rejection every other agent gave) and flat-file CMSs like Kirby/Grav/
CouchCMS (rejected for violating the project's own "no framework"
preference, and for handing off a CMS-specific tagging system to whoever
inherits the project instead of plain HTML/PHP/JSON).

**Verdict:** fifth independent model, fifth identical core conclusion — at
this point that's not a signal, it's confirmation. Nothing new to adopt:
the Basic-Auth-only suggestion has the same problem Opus's did (loses the
two-layer "every action re-checks server-side" property `HANDOVER.md` §5a
rule 2 exists for — keeping both a session and `.htaccess` costs nothing
extra); the single-backup-copy idea is strictly weaker than Opus's
git-commit approach already adopted (one copy vs. full history) so it adds
nothing. Flat-file CMS option correctly ruled out by the model itself.

## Claude Opus 5 (high) — 2026-08-26

**Take:** identical cut to all five above, with the sharpest framing yet of
*why*: every cut component exists to solve "the uploader isn't the person
you trust," which doesn't apply when uploader and approver are the same
two people — "a moderation queue is a form that makes you click twice."
Adds a sequencing argument the others didn't: code written against a
threat model with no real traffic sits untested for a year and gets
rewritten anyway once the threat becomes real, so building it now doesn't
even save future work. Same shape as the rest (one form, one PHP script,
session auth, atomic rename, PDF-only allowlist, generated filenames).
Reconfirms `files/.htaccess`'s `php_flag engine off` as the actual security
boundary the quarantine folder was standing in for (already in
`BACKEND-PLAN-v2.md` §2). Notes generated filenames give duplicate
collision-detection "for free" without building a dedupe system. Points
out Hostinger's hPanel has a GUI "Password Protect Directories" feature
that produces the same `.htaccess`/`.htpasswd` Basic Auth without needing
CLI `htpasswd` access. Re-confirms git-as-CMS and SQLite rejections with
sharper detail (Decap/Sveltia need an OAuth proxy since Netlify Identity is
no longer a safe bet; SQLite breaks static-JSON cacheability, so if a
database is ever needed later it should generate the JSON, not replace it).

**New and worth adopting immediately, cheaply:** put a `"status": "published"`
field on every resource record now, even though there's only one status
today. When public submissions eventually arrive, the moderation queue
becomes "filter resources.json by status" instead of a schema migration
touching every existing record.

**Verdict:** sixth independent model, sixth identical core conclusion.
Comparison is done — six different models given the same source docs found
the same answer six times. Folding the `status` field into the schema now.

## GPT 5.6 Terra (high) — 2026-08-26

**Take:** same core cut as all six above — no public endpoint, no
moderation queue, no persistent quarantine, no rate limiting, no database.
Same shape: session-authenticated PHP admin panel, generated filenames,
files kept non-executable, atomic write-and-rename with `flock`, rolling
metadata backups, `resources.json` served with weak caching while PDF URLs
(content-addressed by generated name) can cache hard. Frames "brief
temporary upload location" as fine in place of a persistent quarantine
folder — if a publish fails partway, an orphaned PDF is harmless clutter,
not a security problem, because no JSON entry ever points at it.

**Two things this one raises that the other six didn't:**
1. **CSRF protection** on the publish form. Every other agent assumed
   session-auth alone was enough; this one points out a same-origin
   authenticated POST form is still forgeable from another tab/site unless
   the form carries a session-bound token the server checks. Cheap to add,
   genuinely missed by everyone else — adopting it.
2. **A short `ADMIN.md`** — how to add an admin, reset a password, restore
   a JSON backup, publish a resource. Matches this project's own
   `HANDOVER.md` convention of writing down what a successor needs instead
   of assuming they'll read the code. Adopting it.

**Where it actually disagrees with the group:** keeps a SHA-256
duplicate-warning check at publish time; Opus 5 and Gemini 3.7 Flash both
said cut hash-based dedupe entirely in favor of a plain `file_exists()` /
generated-filename collision. This is the first real split across seven
opinions, not just a restatement. Siding with GPT 5.6 Terra here, narrowly:
generated filenames only catch the case where the *same course+year+type*
gets uploaded twice — they say nothing about the same PDF being
re-submitted under different metadata, which a filename collision can't
see and a human publishing dozens of files over time plausibly will hit.
A single `hash_file('sha256', ...)` compare against existing
`resources.json` entries at publish time, surfaced as a non-blocking
"this may already exist" notice rather than a rejection, costs one
function call — not the queue-spanning detection engine the original plan
built. Keeping it at that scope.

**Verdict:** seventh independent model, seventh confirmation of the core
cut, plus two genuine, cheap additions (CSRF, `ADMIN.md`) and one real,
narrow disagreement resolved above.

---

## Where seven-for-seven lands this

Claude, ChatGPT, Opus 4.6, Gemini 3.7 Flash, Gemini 3.1 Pro, Opus 5, and
GPT 5.6 Terra — seven different models, given the same `roadmap.md` /
`BACKEND-PLAN-v2.md` / `HANDOVER.md` context — independently converged on
the identical cut: **delete the quarantine folder, the moderation queue,
rate limiting, and cooldowns for now; ship one authenticated "upload →
fill fields → Publish" flow; keep atomic JSON writes and a real backup
story; re-add the queue machinery only once public submissions actually
launch.** Seven-for-seven ends the comparison — this is the plan, built now.

Net additions above the original scope, pulled from these seven:
- Edit/delete on already-published resources (ChatGPT)
- Backend owns the schema, frontend only consumes it — stated as an
  explicit rule (ChatGPT)
- Backup via git commit of `resources.json`, not a rolling-copies folder
  (Opus)
- SQLite noted as a future upgrade path if concurrent-write conflicts ever
  become real — not adopted now, since it would silently reopen the
  no-database decision `roadmap.md` §0 already closed (Gemini 3.7 Flash)
- `"status": "published"` on every resource record from day one, so a
  future moderation queue is a filter on existing data, not a migration
  (Opus 5)
- CSRF token on the publish form — missed by every other agent (GPT 5.6)
- A short `ADMIN.md` runbook (add/reset admin, restore a backup, publish a
  file), matching this project's own `HANDOVER.md` convention (GPT 5.6)
- A lightweight, non-blocking SHA-256 "this may already exist" notice at
  publish time — one hash compare, not a detection engine (GPT 5.6,
  against Opus 5/Gemini's "skip it entirely"; kept at minimal scope)

---

## Benchmark — rating the seven, 2026-08-26

All seven independently reached the same core cut, so these scores are
about the *margin*: what each one added beyond the consensus, what it
missed, and where it gave weaker mechanisms than one already on the table.
Rated 1–10 on four axes; "Net contribution" is what actually survived into
the final spec below versus a restatement of what the others already said.

| Rank | Model | Idea/Insight | Implementation rigor | Simplicity judgment | Depth of reasoning | Overall | Net contribution |
|---|---|---|---|---|---|---|---|
| 1 | **Claude Opus 5 (high)** | 9 | 9 | 10 | 10 | **9.5** | The sequencing argument ("code built for a threat model with no real traffic gets stale and is rewritten anyway, so building it early saves nothing") — the single sharpest piece of reasoning across all seven. Plus the `"status": "published"` field: near-zero cost today, turns a future moderation queue into a filter instead of a migration. Also the only one to name the *actual* mechanism the quarantine folder was standing in for (`php_flag engine off` on the files directory) rather than just asserting quarantine is unnecessary. |
| 2 | **GPT 5.6 Terra (high)** | 8 | 10 | 9 | 8 | **8.8** | Caught CSRF — a real gap in a stateful authenticated form that all six other models, including the ones focused on security (Claude, Opus 4.6, Opus 5), missed entirely. Also the only one to propose a written `ADMIN.md` handoff doc, and the only one to give a *reasoned*, scoped keep on hash-based duplicate detection rather than a blanket cut. |
| 3 | **ChatGPT (thinking)** | 8 | 8 | 8 | 8 | **8.0** | Best survey breadth (Sheets/Airtable/Decap/WordPress with an explicit ranking table) and the cleanest statement of a project-wide principle: "the backend owns the schema, the frontend only consumes it." First to scope in edit/delete on published resources, which the original plan never covered at all. |
| 4 | **Claude Sonnet 5 (this session)** | 8 | 6 | 9 | 7 | **7.5** | First to make the cut, with no prior art to react to — correctly reframed the whole problem as "you don't have a moderation problem, you have a publishing-interface problem" before any other model weighed in. Lighter on concrete implementation detail than the four above once those had the benefit of reacting to what came before. |
| 5 | **Claude Opus 4.6 (via Antigravity)** | 7 | 7 | 8 | 7 | **7.3** | Contributed git-commit-as-backup, genuinely adopted. Cost itself points by recommending HTTP-Basic-Auth *instead of* a session — which drops the two-layer "every action re-checks server-side" property this project's own `HANDOVER.md` already calls non-optional. A miss from not weighing the provided project docs as heavily as the others did. |
| 6 | **Gemini 3.7 Flash** | 7 | 7 | 7 | 6 | **6.8** | Solid and correct on the core cut. Its one new idea (SQLite as an upgrade path) is reasonable in isolation but doesn't register that `roadmap.md` §0 already closed the no-database question after two review rounds — presented a live reopening as a footnote rather than flagging the tension itself. |
| 7 | **Gemini 3.1 Pro** | 6 | 6 | 7 | 6 | **6.3** | Correct on the core cut, and the "metal detector on your own bedroom door" framing is a good line, but its concrete additions are the weakest across the set: Basic-Auth-alone (same miss as Opus 4.6), a single `_backup.json` copy (strictly weaker than the git-commit approach already on the table by the time this arrived), and a flat-file-CMS tangent it self-rejects. Least net-new value of the seven, though nothing here is *wrong*.  |

**Reading this as a benchmark, not a verdict on the models generally:** every
one of these seven got the headline call right — the real differentiation
was in the second-order details (auth layering, CSRF, forward-compatible
schema, honest acknowledgment of a closed decision). Opus 5 and GPT 5.6
Terra earned their ranking by catching things specific to *this* project's
already-written docs, not by having a better general instinct. Don't read
"Gemini ranked lower" as "Gemini is a weaker model" — read it as "these two
particular responses paid closer attention to this project's own
`HANDOVER.md`/`roadmap.md` constraints than those two particular responses
did."

## Final combined spec — best of all seven

- `admin/publish.php`: session login (inner layer) + `.htaccess`/hPanel
  Basic Auth (outer layer, per `HANDOVER.md` §5a rule 2) + **CSRF token**
  checked on every state-changing request (GPT 5.6)
- One `publish` action, plus `edit`/`delete` on already-published resources
  (ChatGPT)
- Generated filenames (`CODE_YEAR_examtype.pdf`), magic-byte PDF check,
  `php_flag engine off` on `files/` (Opus 5's naming of the actual boundary)
- Atomic write: temp file → `LOCK_EX` → `rename()` — two lines, not a
  subsystem (all seven agreed)
- Backup: `git commit` on `resources.json` after every write, not a
  rolling-copies folder (Opus 4.6, reinforced by Gemini 3.7 Flash noting
  Hostinger's own host-level backups make more redundant)
- Every resource record carries `"status": "published"` from day one
  (Opus 5)
- A lightweight, non-blocking SHA-256 duplicate notice at publish time —
  one `hash_file()` compare, not a detection engine (GPT 5.6)
- The backend owns the JSON schema; nothing hand-edits it directly
  (ChatGPT)
- A short `ADMIN.md`: add/reset an admin, restore a backup, publish a file
  (GPT 5.6)
- No quarantine folder, no `abhyas-pending/`, no moderation queue, no
  `submit.php`, no rate limiting, no per-browser cooldowns, no database —
  all of it deferred to whenever public submissions actually launch, at
  which point `"status"` already exists to carry the new `"pending"` value

<!-- Next entries: paste each new agent's plan below, in its own dated
     section, in the same format. -->
