/* ============================================================
   Abhyas — single resource page (resource.html?id=N)

   The WooCommerce-style "product page" for one uploaded file: course
   identity, which branches take it, and the PDF itself, embedded live
   instead of forcing a download first. Download still exists — it just
   lives here, next to the file it downloads, not on the archive listing
   where clicking it used to just fire a toast and nothing else.

   Deliberately a plain <iframe src="files/...">, not the Adobe PDF Embed
   API mentioned in HANDOVER.md — that needs a credential that was never
   set up, and native iframe PDF rendering (every evergreen browser does
   this without a plugin) works today with zero new account dependency.
   Swapping the iframe for Adobe later, once/if that credential exists, is
   a one-function change (renderViewer below) — nothing else on this page
   needs to know which viewer is behind it.
   ============================================================ */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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
      wrap.innerHTML = `<iframe class="rp-pdf-frame" src="${esc(fileUrl)}" title="${esc(title)}" loading="lazy"></iframe>`;
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

function render(root, resource, course, contributor) {
  const kind = KIND[resource.type] || KIND.papers;
  const fileUrl = "files/" + resource.file;
  const branches = (course && Array.isArray(course.branches) && course.branches.length)
    ? course.branches
    : [resource.department];

  document.getElementById("rpPageTitle").textContent = `${resource.title} · Abhyas`;

  root.className = `rp-layout k-${resource.type}`;
  root.innerHTML = `
    <div class="rp-masthead">
      <div class="rp-head-top">
        <span class="rp-kind-chip"><span class="rp-kind-dot"></span>${esc(kind.label)}</span>
      </div>
      <h1 class="rp-title">${esc(resource.title)}</h1>
      <p class="rp-sub">${esc(resource.course)} &middot; Semester ${esc(String(resource.semester || "—"))}</p>
    </div>

    <div class="rp-body">
      <div class="rp-main">
        <div id="rpViewerSlot"></div>
      </div>

      <aside class="rp-side">
        <div class="rp-side-card">
          <div class="rp-actions">
            <a class="btn-open rp-download" href="${esc(fileUrl)}" download>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </a>
            <button class="btn-share" type="button" id="rpShareBtn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Share
            </button>
          </div>

          <dl class="rp-facts">
            <div><dt>Course</dt><dd>${esc(resource.course)}</dd></div>
            <div><dt>Code</dt><dd>${esc(resource.code)}</dd></div>
            <div><dt>Semester</dt><dd>${esc(String(resource.semester || "—"))}</dd></div>
            ${resource.year ? `<div><dt>Year</dt><dd>${esc(String(resource.year))}</dd></div>` : ""}
            ${resource.professor && resource.professor !== "—" ? `<div><dt>Professor</dt><dd>${esc(resource.professor)}</dd></div>` : ""}
            ${resource.pages ? `<div><dt>Pages</dt><dd>${esc(String(resource.pages))}</dd></div>` : ""}
            ${contributor ? `<div><dt>Shared by</dt><dd>${esc(contributor.name || "an IITH student")}</dd></div>` : ""}
          </dl>

          <div class="rp-branches">
            <span class="rp-branches-label">Taken by</span>
            <div class="rp-branch-chips">
              ${branches.map((b) => `<span class="rp-branch-chip" style="--bc: ${departmentAccent(b)}">${esc(departmentName(b))}</span>`).join("")}
            </div>
          </div>
        </div>
      </aside>
    </div>
  `;

  document.getElementById("rpViewerSlot").appendChild(renderViewer(fileUrl, resource.title));

  document.getElementById("rpShareBtn").addEventListener("click", () => {
    const url = new URL(`resource.html?id=${resource.id}`, window.location.href).href;
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    showToast(`Link copied for "${resource.title}"`);
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

  render(root, resource, course, contributor);
})();
