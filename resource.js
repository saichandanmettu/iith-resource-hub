/* ============================================================
   Abhyas — single resource page (resource.html?id=N)

   The WooCommerce-style "product page" for one uploaded file: course
   identity, which branches take it, and the PDF itself, embedded live
   instead of forcing a download first. Download still exists — it just
   lives here, next to the file it downloads, not on the archive listing
   where clicking it used to just fire a toast and nothing else.

   Viewer: self-hosted PDF.js (Mozilla's official "generic" dist build,
   vendored at assets/pdfjs/, v6.2.108), not the Adobe PDF Embed API
   mentioned in HANDOVER.md — Adobe needs a credential nobody has set up,
   and is exactly the account dependency this project keeps avoiding.
   PDF.js needs no account and renders identically across every browser
   instead of leaning on whatever PDF plugin (or lack of one) the visitor's
   browser happens to ship — a plain <iframe src="files/...pdf"> is at the
   mercy of that, and looks different, or breaks, depending on the browser.
   The whole viewer decision is isolated to renderViewer() below — nothing
   else on this page needs to know which viewer is behind it.
   ============================================================ */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Real download/share counts, same pattern as releases.js's VOTE_API — one
   more Apps Script web app, source kept at _local/counters-apps-script.gs.
   Deploy it, paste the /exec URL below, and counts start appearing; until
   then this stays a placeholder and the buttons just don't show a number
   (same graceful no-op releases.js already uses for its own PASTE_ guard) —
   never a fabricated number in the meantime. */
const COUNTER_API = "PASTE_YOUR_APPS_SCRIPT_URL_HERE";
const counterConfigured = () => COUNTER_API.indexOf("PASTE_") !== 0;

async function loadCounts(id) {
  if (!counterConfigured()) return null;
  try {
    const res = await fetch(`${COUNTER_API}?action=read&id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function bumpCount(id, action) {
  if (!counterConfigured()) return;
  /* Fire-and-forget — a download or share should never wait on this, and
     a failed count update shouldn't block or error the actual action. */
  fetch(`${COUNTER_API}?action=${action}&id=${encodeURIComponent(id)}`).catch(() => {});
}

/* This page doesn't load app.js (no folder grid, no filters — nothing else
   there applies here), so it can't rely on window.showToast from app.js
   even though it shares the same .toast markup. Same behavior, defined
   locally instead of dragging in a script full of unrelated code. */
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.hidden = false;
  toast.offsetHeight;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => { toast.hidden = true; }, 300);
  }, 2600);
}

const KIND = {
  papers:     { label: "Past paper", noun: "quiz or exam paper" },
  notes:      { label: "Notes & slides", noun: "set of notes" },
  assignment: { label: "Assignment", noun: "assignment" },
  reference:  { label: "Reference book", noun: "reference title" },
};

/* courses.json isn't part of data.js's shared ABHYAS_READY load (that's
   resources.json + contributors.json only) — same reasoning as
   contribute.js, which fetches it the same standalone way: it's read-only
   registry data only a couple of pages need, not core archive state. */
async function fetchCourses() {
  try {
    const res = await fetch("courses.json", { cache: "no-cache" });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

function departmentName(code) {
  if (typeof DEPARTMENTS === "undefined") return code;
  return DEPARTMENTS.find((d) => d.code === code)?.short || code;
}
function departmentAccent(code) {
  if (typeof DEPARTMENTS === "undefined") return "var(--ink-soft)";
  return DEPARTMENTS.find((d) => d.code === code)?.accent || "var(--ink-soft)";
}

function renderNotFound(root, reason) {
  root.className = "rp-notfound";
  root.innerHTML = `
    <div class="rp-notfound-badge">404</div>
    <h1>Couldn't find that file</h1>
    <p>${esc(reason)}</p>
    <a class="cta-solid" href="index.html">Back to the archive</a>
  `;
  document.getElementById("rpPageTitle").textContent = "Not found · Abhyas";
}

function renderViewer(fileUrl, title) {
  /* HEAD instead of just dropping the URL straight into an <iframe>: a
     missing PDF still "loads" inside an iframe (as the browser's own
     built-in 404 page), which looks like a broken embed rather than an
     honest "not uploaded yet" message. Checking first lets us show the
     right one. Expected to 404 for now — see HANDOVER.md, real files
     haven't been uploaded yet. */
  const wrap = document.createElement("div");
  wrap.className = "rp-viewer";
  wrap.innerHTML = `<div class="rp-viewer-loading">Loading preview&hellip;</div>`;

  fetch(fileUrl, { method: "HEAD" })
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      /* PDF.js's own viewer page does the rendering; we just hand it the
         file. `file` must be resolved to an absolute URL and then encoded
         as one query value, or a relative path with its own `?`/`#`
         breaks the viewer's query parsing. */
      const absolute = new URL(fileUrl, window.location.href).href;
      const viewerUrl = `assets/pdfjs/web/viewer.html?file=${encodeURIComponent(absolute)}`;
      wrap.innerHTML = `<iframe class="rp-pdf-frame" src="${esc(viewerUrl)}" title="${esc(title)}" loading="lazy" allow="fullscreen"></iframe>`;
    })
    .catch(() => {
      wrap.innerHTML = `
        <div class="rp-viewer-empty">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          <b>Preview not available yet</b>
          <span>This file hasn't finished uploading to the archive. Check back soon, or reach out if this looks stuck.</span>
        </div>`;
    });

  return wrap;
}

function render(root, resource, course, contributor, allResources) {
  const kind = KIND[resource.type] || KIND.papers;
  /* Served through PHP, not a static path — files/ moved to
     abhyas-private/, outside anything a deploy can touch. See
     api/file.php for why. */
  const fileUrl = "api/file.php?path=" + encodeURIComponent(resource.file);
  const branches = (course && Array.isArray(course.branches) && course.branches.length)
    ? course.branches
    : [resource.department];

  /* Real count, not a placeholder: how many resources in the archive carry
     this same contributor id. Same computation the Honor Roll already does
     per contributor — reused here as the avatar's content instead of
     initials, since "how much has this person actually shared" is a more
     useful first impression than their initials, and unlike a download/
     share count, this number needs no backend to be real right now. */
  const contribCount = contributor
    ? allResources.filter((r) => r.contributor === contributor.id).length
    : 0;

  document.getElementById("rpPageTitle").textContent = `${resource.title} · Abhyas`;

  root.className = `rp-layout k-${resource.type}`;
  root.innerHTML = `
    <div class="rp-masthead">
      <div class="rp-head-top">
        <span class="rp-kind-chip"><span class="rp-kind-dot"></span>${esc(kind.label)}</span>
        <span class="rp-plain-chip">${esc(resource.code)}</span>
        ${resource.year ? `<span class="rp-plain-chip">${esc(String(resource.year))}</span>` : ""}
      </div>
      <h1 class="rp-title">${esc(resource.title)}</h1>
    </div>

    <div class="rp-body">
      <div class="rp-main">
        <div id="rpViewerSlot"></div>
      </div>

      <aside class="rp-side">
        <div class="rp-side-card">
          <div class="rp-actions">
            <a class="btn-open rp-download" href="${esc(fileUrl)}" id="rpDownloadBtn" download="${esc(resource.file.split("/").pop())}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download<span class="rp-btn-count" id="rpDlCount" hidden></span>
            </a>
            <button class="btn-share" type="button" id="rpShareBtn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Share<span class="rp-btn-count" id="rpShareCount" hidden></span>
            </button>
          </div>

          ${contributor ? `
          <div class="rp-contrib">
            <div class="rp-avatar" title="${contribCount} file${contribCount === 1 ? "" : "s"} shared to Abhyas">${contribCount}</div>
            <div class="rp-contrib-info">
              <b>${esc(contributor.name || "An IITH student")}</b>
              <span>${contribCount} file${contribCount === 1 ? "" : "s"} shared</span>
            </div>
          </div>` : ""}

          <dl class="rp-facts">
            <div><dt>Course</dt><dd>${esc(resource.course)}</dd></div>
            <div><dt>Code</dt><dd>${esc(resource.code)}</dd></div>
            ${resource.year ? `<div><dt>Year</dt><dd>${esc(String(resource.year))}</dd></div>` : ""}
            ${resource.professor && resource.professor !== "—" ? `<div><dt>Professor</dt><dd>${esc(resource.professor)}</dd></div>` : ""}
            ${resource.pages ? `<div><dt>Pages</dt><dd>${esc(String(resource.pages))}</dd></div>` : ""}
          </dl>

          <div class="rp-branches">
            <span class="rp-branches-label">Taken by</span>
            <div class="rp-branch-chips">
              ${branches.map((b) => `<span class="rp-branch-chip" style="--bc: ${departmentAccent(b)}" title="${esc(departmentName(b))}">${esc(b)}</span>`).join("")}
            </div>
          </div>
        </div>
      </aside>
    </div>
  `;

  document.getElementById("rpViewerSlot").appendChild(renderViewer(fileUrl, resource.title));

  const dlCountEl = document.getElementById("rpDlCount");
  const shareCountEl = document.getElementById("rpShareCount");
  const showCount = (el, n) => { el.textContent = ` ${n}`; el.hidden = false; };

  loadCounts(resource.id).then((counts) => {
    if (!counts) return;
    showCount(dlCountEl, counts.downloads);
    showCount(shareCountEl, counts.shares);
  });

  document.getElementById("rpDownloadBtn").addEventListener("click", () => {
    bumpCount(resource.id, "download");
    if (!dlCountEl.hidden) showCount(dlCountEl, Number(dlCountEl.textContent) + 1);
  });

  document.getElementById("rpShareBtn").addEventListener("click", () => {
    const url = new URL(`resource.html?id=${resource.id}`, window.location.href).href;
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    showToast(`Link copied for "${resource.title}"`);
    bumpCount(resource.id, "share");
    if (!shareCountEl.hidden) showCount(shareCountEl, Number(shareCountEl.textContent) + 1);
  });
}

(async function init() {
  const root = document.getElementById("rpRoot");
  const id = new URLSearchParams(window.location.search).get("id");

  if (!id) {
    renderNotFound(root, "No file id was given in the link.");
    return;
  }

  const [resources, courses] = await Promise.all([
    (typeof ABHYAS_READY !== "undefined" ? ABHYAS_READY : Promise.resolve([])),
    fetchCourses(),
  ]);

  const resource = resources.find((r) => String(r.id) === String(id));
  if (!resource) {
    renderNotFound(root, "This file may have been removed, or the link is out of date.");
    return;
  }

  const course = courses[resource.code];
  const contributor = (globalThis.CONTRIBUTORS || []).find((c) => c.id === resource.contributor);

  render(root, resource, course, contributor, resources);
})();
