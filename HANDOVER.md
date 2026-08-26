# Abhyas — handover

If you have just taken this over, read this file first. It covers what the
site is made of, which accounts it depends on, and what breaks if one of them
lapses.

`DESIGN.md` covers how it looks and why. This file covers how it stays alive.

---

## 1. The 60-second version

Abhyas is a **plain static website**. HTML, CSS and JavaScript, no build step,
no database, no server code. You can open `index.html` in a browser and it
works.

That is deliberate, and it is the main thing protecting the project: if the
hosting ever disappears, the whole site can be put back up anywhere — another
host, GitHub Pages, Netlify — by copying the files. There is nothing to
install and nothing to migrate.

| Page | File |
|---|---|
| Archive | `index.html` |
| Bookshelf | `library.html` |
| Honor Roll | `leaderboard.html` |
| Contribute | `contribute.html` |
| Releases | `releases.html` |
| Terms | `terms.html` |

All styling is in **one** file, `styles.css`. All resource data is in
`data.js`.

**Cache-busting is manual.** Every `<link>` and `<script>` tag carries a
`?v=N`. If you edit a file and the change does not appear in the browser,
you forgot to increase that number.

---

## 2. Accounts this depends on

Fill this in and keep it current. **At least two people should hold access to
every row.** The most common way a student project dies is a renewal notice
going to an inbox nobody reads any more.

| What | Provider | Registered to | Renews | Who has access |
|---|---|---|---|---|
| Domain (`iith.online`) | | | | |
| Web hosting | Hostinger | | | |
| Code repository | GitHub | `saichandanmettu` | n/a | |
| Vote counter API | Google Apps Script | | n/a | |
| PDF viewer credential | Adobe | *not yet set up* | | |

---

## 3. Known single points of failure

These are **known and were deliberately deferred**, not overlooked. Each one
is quick to fix; the entry tells you how.

### 3.1 The contact address is a student email

`ms24btech11021@iith.ac.in` is hardcoded in **11 places** across all six
pages. It is a roll-number address, so it will be deactivated after that
student graduates.

This matters more than it looks: **`terms.html` promises that takedown
requests go to this inbox.** A takedown promise pointing at a dead mailbox is
the kind of thing that becomes somebody's problem.

To change it everywhere, from the project folder:

```bash
grep -rl 'ms24btech11021@iith.ac.in' *.html | xargs sed -i '' 's/ms24btech11021@iith\.ac\.in/NEW@ADDRESS/g'
```

Then check nothing was missed:

```bash
grep -c 'ms24btech11021@iith.ac.in' *.html
```

**Best fix:** an address on the domain the project already owns
(`abhyas@iith.online`) forwarded to whoever currently maintains the site.
Then the address on the site never has to change again — only the forwarding
target does.

### 3.2 The vote counter runs on a personal Google account

`releases.js` calls a Google Apps Script web app for the release vote count.
Apps Script web apps deployed as *"Execute as: Me"* stop working when that
Google account is deactivated, and they fail **silently** — the number just
stops moving.

The script source is kept in `_local/votes-apps-script.gs`, so it can be
redeployed under a different account. Or delete the counter; it is a
nice-to-have, and it currently costs a whole account dependency.

### 3.3 The code is on a personal GitHub account

The repository sits under a personal account rather than an organisation.
Personal repos cannot have co-owners, so transferring it requires that
person to still have access when the time comes.

Moving it to a GitHub **organisation** takes a few minutes, keeps the full
history, and lets several people be owners at once.

---

## 4. Back up the PDFs. This is the most important item here.

Everything else in this project is replaceable. The code is in a repository,
the design is documented, the layout can be rebuilt.

**The collected past papers cannot be replaced.** If a hosting renewal lapses
and those files existed only in that account, years of contributions are gone
permanently — and that archive is the entire point of the project.

- Keep a periodic zip of the uploaded files somewhere that is **neither** the
  hosting account **nor** one student's laptop.
- A copy held by the department, or by two maintainers, is enough.
- Do this before worrying about anything else on this list.

---

## 5. How resources work today

Resource data lives in **JSON**, not JavaScript:

| File | Holds |
|---|---|
| `resources.json` | every resource in the archive |
| `contributors.json` | who shared what, keyed by id |
| `courses.json` | course-code registry (used by the review console) |
| `data.js` | **configuration only** — branches, point values, semester dates |

`fetchResources()` in `data.js` is the single seam between the site and its
data. Pages wait on `ABHYAS_READY` before their first paint.

**Serving locally:** `fetch()` does not work over `file://`, so opening
`index.html` by double-clicking will show a "could not load" notice. Serve the
folder instead:

```bash
python3 -m http.server 8000
```

Re-hosting anywhere (another host, Netlify, GitHub Pages) works normally —
any web server is fine, this only affects opening files directly.

**Still placeholder:** the 24 resources and 8 contributors are invented, and
there are no real PDFs yet. Delete both files' contents when real files start
arriving — the leaderboard currently ranks people who do not exist.

---

## 5a. The backend

Two small PHP endpoints. Everything else is static.

| Path | Job |
|---|---|
| `api/submit.php` | public: accepts an upload into quarantine |
| `api/moderate.php` | authenticated: queue, preview, approve, reject |
| `api/hash.php` | generates a password hash. **Delete after use.** |
| `api/config.sample.php` | template — copy it OUTSIDE `public_html` |
| `admin/` | the review console |

### Setup, once

1. Create `abhyas-pending/` and `abhyas-private/` **above** `public_html`.
2. Copy `api/config.sample.php` to `abhyas-private/config.php` and edit paths.
3. Open `api/hash.php`, generate a password hash, paste it into the config,
   then **delete `api/hash.php`**.
4. Uncomment the Basic Auth lines in `admin/.htaccess`.
5. In `admin/admin.js`, set `USE_MOCK = false`.

### Two rules that are not optional

1. **Unreviewed uploads live outside `public_html`.** Anything under the web
   root is public the moment it is written — before review. The console
   previews pending files by streaming them through a session check.
2. **`admin/` is protected at the server, not just in the page.** The
   JavaScript that hides the console is convenience, not a security boundary.

### Status

The console UI is built and works against a mock (password `demo`). **The PHP
has never been executed** — it was written without a PHP runtime available.
Test every endpoint on a staging copy before pointing the live site at it,
especially `submit.php`.

---

## 6. Editing rules worth keeping

- **Branch and resource type must stay dropdowns, never free text.** If one
  person types `CSE` and the next types `Computer Science`, the filters
  quietly stop working and nobody notices for months.
- `DEPARTMENTS` in `data.js` is the single source of truth for the fifteen
  branches. The Bookshelf's shelves, the filter pills and the Contribute page
  all read from it. Never hardcode a branch list anywhere else.
- Read `DESIGN.md` before changing any CSS. It is a contract, and the
  reasoning behind each rule is written down.

---

## 7. Putting the site back up from nothing

1. Get the files (repository, or a backup copy).
2. Upload them to any web host, or drop them on GitHub Pages / Netlify.
3. Point the domain at it.
4. Re-upload `/files/` from the backup in §4.

There is no database to restore and no server to configure. That is the whole
advantage of the way this is built — protect it by not adding one unless
something genuinely requires it.
