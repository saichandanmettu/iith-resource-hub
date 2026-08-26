# Abhyas — roadmap

**Internal only. Not linked from the site, not meant for visitors.** This is
the working checklist for what's left before the archive is a real, running
service instead of a well-built shell around placeholder data.

Order matters — each phase mostly unblocks the next one. Don't skip ahead
just because a later box looks easier; §6.1 explains why.

---

## 0. One correction before this list makes sense

**The backend is not WordPress**, and that was already decided, not still
open. `backend.md` §"where we push back" rejected WordPress specifically
(its media library ties file hosting to a WordPress install — that's ceremony
and a security-patching burden this project doesn't need) and rejected
Cloudflare R2 too (better egress cost, but adds an account to inherit — see
`HANDOVER.md` §3.3 on why every extra account is a liability, not a
convenience).

**What's actually settled** (`BACKEND-PLAN-v2.md`, which supersedes and
freezes `backend.md`'s two review rounds): two small PHP endpoints
(`api/submit.php`, `api/moderate.php`) plus flat JSON files
(`resources.json`, `contributors.json`), all sitting on the **same Hostinger
hosting** the static site already lives on. No database, no CMS, no second
account to manage. If you want to reopen that decision, say so explicitly —
but going in assuming "WordPress or wherever" restarts a question that two
review rounds already closed.

---

## 1. Stand the backend up for real

- [ ] Read `BACKEND-PLAN-v2.md` in full — it's the settled plan, `backend.md`
      is just the historical record of how it got argued out.
- [ ] Resolve `BACKEND-PLAN-v2.md` §8 — the two decisions listed there are
      explicitly yours to make, not something to infer.
- [ ] Follow `HANDOVER.md` §5a "Setup, once": create `abhyas-pending/` and
      `abhyas-private/` **above** `public_html`, copy `api/config.sample.php`
      into `abhyas-private/config.php`, generate the admin password hash via
      `api/hash.php` **then delete that file**, uncomment Basic Auth in
      `admin/.htaccess`.
- [ ] **The PHP has never been executed.** It was written without a PHP
      runtime available to test against. Run every endpoint on a staging
      copy before pointing the live site at it — `submit.php` especially,
      since it's the one that accepts public input.
- [ ] Decide the two owner-facing single-points-of-failure in `HANDOVER.md`
      §3 while you're in there: the takedown-contact address hardcoded to a
      roll-number email (§3.1), and the release-vote counter's Apps Script
      running on a personal Google account (§3.2).

## 2. The PDF viewer

- [ ] Real files need somewhere real to live: `files/{DEPT}/{CODE}/` per
      `backend.md` §"file naming," matching the relative path already
      stored in each resource's `file` field.
- [ ] **Decide the viewer**, don't default into one. `resource.html` ships
      today with a plain `<iframe src="files/...">` — chosen because it
      needs zero new credentials and every evergreen browser renders PDFs
      in it natively. The Adobe PDF Embed API was the original plan in
      `backend.md` but needs a credential nobody has set up, and adds
      exactly the kind of inheritable-account dependency §3 warns about.
      Self-hosted PDF.js is the third option, listed as an open question in
      `backend.md` §14.3. Pick one on purpose; don't let "iframe" become the
      permanent answer just because it shipped first.
- [ ] Once real files exist at those paths, `resource.html` needs **no other
      changes** — it already HEAD-checks the file and swaps from "preview
      not available yet" to the real embed automatically.

## 3. Upload the real files, then wire up real numbers

- [ ] Replace the placeholder `resources.json` / `contributors.json` —
      `HANDOVER.md` §5 is explicit that today's 91 resources and every
      contributor in it are invented. The Honor Roll is currently ranking
      people who don't exist.
- [ ] Back up the uploaded files as they come in — `HANDOVER.md` §4 calls
      this the single most important item in that whole document: the
      papers themselves are the one thing on this project with no other
      copy anywhere.
- [x] **Download counts and share counts — frontend done, deployment is the
      one step left.** `resource.js` calls `COUNTER_API` on every Download/
      Share click and shows the real count next to each button once it
      answers — same pattern `releases.js` already uses for the vote
      counter, one more Apps Script instance, not a new architecture.
      Source is at `_local/counters-apps-script.gs`.
  - [ ] **Deploy it**: paste `_local/counters-apps-script.gs` into a Google
        Sheet's Extensions > Apps Script, deploy as a web app (Execute as
        Me, Anyone can access), copy the `/exec` URL into `COUNTER_API` at
        the top of `resource.js`. Until that URL is pasted in, both counts
        stay hidden on every button — never a fabricated number standing
        in for a real one.
- [ ] The one count that's already real and live, for comparison: each
      resource page's contributor avatar shows that person's actual file
      count today, computed straight from `resources.json` — no backend
      needed for that one because it was never fake to begin with.

## 4. Verify the Honor Roll

- [ ] Once real resources + real contributors replace the placeholders,
      recompute and sanity-check every leaderboard position by hand against
      what was actually contributed — placeholder scores currently on the
      board (Aarav Menon at 50, etc.) mean nothing once real data lands and
      shouldn't be trusted to "just still be right."
- [ ] Re-check `data.js`'s `SEMESTER_START` is still the right date for
      whichever term is live when this happens — it's meant to be rolled
      forward each semester, per its own comment.

## 5. The admin console — go look at it

**You can log into it right now**, but it's mock, not real:
`admin/index.html`, password `demo` (per `HANDOVER.md` §5a). It's built
against fake data and has never talked to the real PHP endpoints, because
those endpoints have never run (see §1 above). Once §1's staging test
passes, flip `USE_MOCK = false` in `admin/admin.js` and log in against the
real thing — that's the point where you should actually sit with it and
judge whether it's usable, not before.

## 6. Still open from the last two sessions

- [ ] **File naming.** `leaderboard.html` etc. currently keep their
      filenames while the nav/footer/`<title>` show the renamed Archive /
      Bookshelf / Honor Roll copy — a deliberate, dated decision in
      `DESIGN.md` §1, made explicitly to avoid breaking bookmarks and links
      to the live site at abhyas.iith.online. Still your call to keep or
      override; nothing's been renamed pending your answer.

### 6.1 Why this order

Each phase above assumes the one before it landed. Real files (§3) need
somewhere to live and a viewer that renders them (§2), which needs a real
backend to serve them from safely (§1). Skipping to counters or leaderboard
polish before the backend exists means rebuilding that work once real data
changes the shape of things underneath it.
