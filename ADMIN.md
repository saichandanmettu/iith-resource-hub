# Abhyas — admin runbook

Short, task-oriented. For *why* things are built this way, see
`BACKEND-PLAN-v3.md`; for the wider handoff picture, see `HANDOVER.md`.

---

## Publish a resource yourself

1. Go to `/admin/`, sign in.
2. Click **Add resource**, pick the PDF — a preview appears before you
   submit anything, entirely in your browser (nothing is uploaded until
   you click Publish).
3. Fill in course code, branch, year, type. The code field autocompletes
   from the course registry if it's a known code.
4. Click **Publish**. If the file looks identical to one already in the
   archive, you'll be told which one and asked to confirm before it goes
   through anyway — it's a heads-up, not a block.

### Reference books

Pick **Type → Reference book**. The form changes: the file field now
takes the **book's cover image** (JPG/PNG/WebP), not a PDF, and the book
detail fields appear (title, author, publisher, pages, cover colour,
summary, link). No PDF is ever hosted for a reference book — it's a
pointer to a real textbook, so add a **link** where students can find it.
A reference book needs a cover image *or* a link (ideally both). The
cover you upload is what the Bookshelf renders; with no image it falls
back to the generated colour cover, which is why the cover colour and
author are still required.

To **add or replace a cover on a book that's already published**, open it
from **Manage**, pick an image in the cover field, and Save. A
replacement is written under a new filename and the record re-pointed at
it — the old image stays on disk (nothing here ever overwrites an
uploaded file). Editing a non-reference resource still has no file
field: PDFs are not replaceable this way.

## Review a public submission

Students submit through the Contribute page; nothing they send goes live
until you approve it.

1. The **Pending** tab shows a count and a card per waiting submission —
   original filename, size, whatever they typed for course/contributor.
2. Click **Review** — the PDF streams in from quarantine (never public
   until approved), with their typed fields pre-filled and editable.
   Correct anything they got wrong before approving; nothing is trusted
   from the form beyond being a suggestion.
3. A "possible duplicate" flag means this looks byte-for-byte identical
   to something already in the archive or already waiting — check before
   you approve anyway.
4. **Approve & publish** files it exactly like a direct upload.
   **Reject** asks for an optional reason (kept for your own records,
   never shown to the student) and moves the file to a private rejected
   folder — nothing is deleted outright.

## Edit or remove something already published

- Open the resource from the **Manage** list, change the fields, save.
- **Delete** removes it from the archive listing only. The PDF stays on
  disk — per `HANDOVER.md` §4, uploaded files are the one thing here with
  no other copy anywhere, so nothing web-facing deletes one automatically.
  Remove the actual file by hand (FTP/File Manager) once you're sure.

## Add a second admin

1. Ask them to open `api/hash.php` in a browser, type a password, get a
   bcrypt hash back.
2. Add a line to `abhyas-private/config.php`'s `admins` array:
   ```php
   'their-name' => '<hash they gave you>',
   ```
3. Delete `api/hash.php` from the server again — it has no reason to sit
   there once you're done with it.
4. If Basic Auth is enabled on `/admin/` (`HANDOVER.md` §5a), also add
   them to the `.htpasswd` file: `htpasswd abhyas-private/.htpasswd theirname`.

## Reset a forgotten admin password

1. Open `api/hash.php` again (re-upload it temporarily if you deleted it —
   it's in `_local/_archive/` or the repository history if it's gone from
   the server).
2. Generate a new hash for the new password, replace that admin's line in
   `abhyas-private/config.php`.
3. Delete `hash.php` again.

## Restore `resources.json` from a backup

Every write keeps the last 20 snapshots in `abhyas-private/backups/`,
named `YYYYMMDD-HHMMSS-resources.json`. To roll back:

```bash
cp abhyas-private/backups/<the one you want> public_html/resources.json
```

`contributors.json` is backed up the same way, same folder.

## Something looks wrong after a publish

Check `abhyas-private/backups/` for the snapshot from just before —
comparing it to the current `resources.json` shows exactly what changed
(`diff old new`). Nothing here ever loses more than one write's worth of
history, by construction.
