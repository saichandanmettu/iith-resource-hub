/* ============================================================
   Abhyas — Light revamp
   Smooth animations, 3D card physics, parallax, and interactive modals.
   ============================================================ */

const KIND = {
  papers:     { label: "Past papers", color: "var(--papers)" },
  notes:      { label: "Notes & slides", color: "var(--notes)" },
  assignment: { label: "Assignments", color: "var(--assignment)" },
  reference:  { label: "Reference", color: "var(--reference)" },
};

const state = { kind: "all", q: "" };
let ALL = [];

const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function groupByCourse(list) {
  const map = new Map();
  list.forEach((r) => {
    if (!map.has(r.course)) {
      map.set(r.course, { course: r.course, code: r.code, department: r.department, semester: r.semester, items: [] });
    }
    map.get(r.course).items.push(r);
  });
  return [...map.values()].sort((a, b) => b.items.length - a.items.length);
}

/* The most recent item of a given kind inside a folder — not the folder's
   own overall recency, which could be led by a different kind entirely
   (Calculus-II's newest file might be a paper even though the item we
   want to represent it by, here, is its one assignment). */
function newestOfKind(f, kind) {
  return f.items
    .filter((r) => r.type === kind)
    .reduce((best, r) => ((r.added || "") > (best?.added || "") ? r : best), null);
}

/* Lead the grid with one card per kind whenever the archive has ANY file
   of that kind — not just a folder whose MAJORITY is that kind. A course
   that's mostly past papers but has one assignment in it should still be
   able to fill the assignment slot: kind-by-kind selection runs
   independently, on purpose, and can and will surface the same course
   folder to fill two slots if it happens to be the only or best source of
   more than one kind. Once you have a real reference book (or a second
   course with an assignment), it slots in on its own, no lead-order
   accounting needed. Only for the unfiltered view: once someone picks a
   kind or searches, their order is the one that matters. */
const KIND_ORDER = ["papers", "notes", "assignment", "reference"];

function leadWithEachKind(folders) {
  const lead = [];
  const used = new Set(); // by folder+kind pair, not by course — see above

  KIND_ORDER.forEach((kind) => {
    let best = null;
    let bestItem = null;
    folders.forEach((f) => {
      const item = newestOfKind(f, kind);
      if (!item) return;
      if (!bestItem || (item.added || "") > (bestItem.added || "")) {
        best = f;
        bestItem = item;
      }
    });
    if (best) {
      lead.push({ ...best, _leadKind: kind, _leadItem: bestItem });
      used.add(best.course);
    }
  });

  return [...lead, ...folders.filter((f) => !used.has(f.course))];
}

function fileLabel(r) {
  const parts = r.title.split(/\s+[—–-]\s+/);
  return parts.length > 1 ? parts.slice(1).join(" — ") : r.title;
}

function dominantKind(f) {
  const counts = {};
  f.items.forEach((r) => (counts[r.type] = (counts[r.type] || 0) + 1));
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function meta(r) {
  return r.year || "";
}

function sheet(r, n) {
  if (!r) return "";
  return `<div class="fc-sheet s${n}">
    <div class="sh-top"><i></i><small>${meta(r)}</small></div>
    <b>${esc(fileLabel(r))}</b>
    <div class="fc-rule"><span></span><span></span><span></span><span></span><span></span></div>
  </div>`;
}

function tier(r, n) {
  if (!r) return `<div class="fc-tier t${n}"></div>`;
  return `<div class="fc-tier t${n}">${esc(fileLabel(r))}<small>${meta(r)}</small></div>`;
}

function card(f, i) {
  // Lead-row cards (see leadWithEachKind) carry an explicit kind + the
  // specific item that earned this folder its slot — e.g. Calculus-II's
  // lone assignment, even though the folder's own overall majority is
  // past papers. Render by that kind/item instead of recomputing the
  // folder's dominant type, which would just put it back under "papers"
  // and silently drop the assignment slot it was chosen to fill.
  const kind = f._leadKind || dominantKind(f);
  const items = f._leadItem ? [f._leadItem, ...f.items.filter((r) => r !== f._leadItem)] : f.items;
  const n = f.items.length;

  const foot = kind === "reference"
    ? '<div class="fc-open" data-book-action="true">Open the book <span>&rarr;</span></div>'
    : '<div class="fc-open">View all files <span>&rarr;</span></div>';

  /* Was `${code} \u00b7 Sem N` \u2014 semester is a per-branch fact (the same course
     can sit in a CE student's 2nd sem and an ME student's 5th), so stamping
     one number on a folder that mixes every branch's copies of the course
     was just wrong for whichever branches didn't match it. Code alone. */
  const line = f.code || "";

  const head = `
    <div class="fc-front">
      <div class="fc-id">
        <div class="fc-meta">${esc(line)}</div>
        <div class="fc-title">${esc(f.course)}</div>
        ${foot}
      </div>
      <div class="fc-stat">${n}<span>${n === 1 ? "file" : "files"}</span></div>
    </div>`;

  const inside =
    kind === "reference"
      ? `${tier(items[2], 3)}${tier(items[1], 2)}${tier(items[0], 1)}`
      : `<div class="fc-back"></div>
         ${kind === "notes" ? '<div class="fc-mid"></div>' : ""}
         ${sheet(items[2], 3)}${sheet(items[1], 2)}${sheet(items[0], 1)}`;

  const one = n === 1 ? " one" : "";
  const book = kind === "reference" ? items.find((r) => r.book) : null;
  const bookAttr = book ? ` data-book-id="${book.id}"` : "";

  const stagger = (i % 4) * 45;
  return `<article class="fcard t-${kind}${one} reveal-card" data-course="${esc(f.course)}" data-kind="${kind}"${bookAttr} tabindex="0" role="button" aria-label="${esc(f.course)} folder, ${n} files" style="--d:${stagger}ms">${inside}${head}</article>`;
}

function render() {
  let list = ALL;
  if (state.kind !== "all") list = list.filter((r) => r.type === state.kind);
  if (state.q) {
    const q = state.q.toLowerCase();
    list = list.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.course.toLowerCase().includes(q) ||
      (r.code && r.code.toLowerCase().includes(q)) ||
      (r.professor && r.professor.toLowerCase().includes(q)));
  }
  let folders = groupByCourse(list);
  if (state.kind === "all" && !state.q) folders = leadWithEachKind(folders);
  const grid = document.getElementById("grid");
  grid.innerHTML = folders.map(card).join("");
  document.getElementById("count").textContent =
    folders.length === 0 ? "Nothing found — try searching another course or clearing filters." : "";

  setupCardReveals();
}

function setupCardReveals() {
  /* Native scroll-driven animation handles arrival where supported
     (see MOTION in styles.css); the observer is the Firefox fallback. */
  if (window.CSS && CSS.supports("(animation-timeline: view()) and (animation-range: entry)") &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  const cards = document.querySelectorAll(".reveal-card:not(.in)");
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    cards.forEach((c) => c.classList.add("in"));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -20px 0px", threshold: 0.05 });

  cards.forEach((card) => io.observe(card));
}

function bind() {
  document.querySelectorAll(".pills .pill").forEach((p) => {
    p.addEventListener("click", () => {
      document.querySelectorAll(".pills .pill").forEach((x) => x.classList.remove("on"));
      p.classList.add("on");
      state.kind = p.dataset.kind;
      render();
    });
  });

  const q = document.getElementById("q");
  if (q) {
    q.addEventListener("input", (e) => {
      state.q = e.target.value.trim();
      render();
    });
  }

  // Header "Share a file" buttons
  /* The header CTA is a plain link to contribute.html now — leave it alone
     so it actually navigates. */
  document.querySelectorAll("nav a[href='#archive']:not(.on)").forEach((btn) => {
    if (btn.textContent.trim() === "Contribute") {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openShareModal();
      });
    }
  });
}

/* ============================================================
   Course Folder Modal Pop-up
   ============================================================ */
let activeCourseResources = [];
let activeFolderTab = "all";

function openFolderModal(courseName, presetTab) {
  const folderModal = document.getElementById("folderModal");
  if (!folderModal) return;

  activeCourseResources = ALL.filter((r) => r.course === courseName);
  if (!activeCourseResources.length) return;

  const first = activeCourseResources[0];
  document.getElementById("fmTitle").textContent = first.course;
  /* Was `${department} \u00b7 Sem N` \u2014 same reasoning as card()'s .fc-meta
     line above: this folder mixes every branch's copies of the course, and
     "first" is arbitrary, so its semester isn't a fact about the course. */
  document.getElementById("fmDept").textContent = first.department || "";
  document.getElementById("fmCode").textContent = first.code || "IITH";
  document.getElementById("fmSub").textContent = `${activeCourseResources.length} ${activeCourseResources.length === 1 ? "file" : "files"} available across past papers, notes & assignments`;
  document.getElementById("fmTabAllCount").textContent = activeCourseResources.length;

  /* Land on the tab the folder's own colour promised. Someone who clicks an
     amber past-papers folder wants past papers, not an "all files" list they
     have to filter down again. Fall back to "all" if that tab would be empty. */
  const wanted = presetTab && activeCourseResources.some((r) => r.type === presetTab)
    ? presetTab
    : "all";
  activeFolderTab = wanted;
  document.querySelectorAll("#fmTabs .fm-tab").forEach((tab) => {
    tab.classList.toggle("on", tab.dataset.fmtab === wanted);
  });
  const onTab = document.querySelector("#fmTabs .fm-tab.on");
  if (onTab) onTab.scrollIntoView({ block: "nearest", inline: "nearest" });

  renderFolderModalFiles();

  folderModal.hidden = false;
  folderModal.offsetHeight; // trigger reflow
  folderModal.classList.add("open");
  document.body.style.overflow = "hidden";
  window.__pauseLenis?.();
}

function renderFolderModalFiles() {
  const body = document.getElementById("fmBody");
  let items = activeCourseResources;
  if (activeFolderTab !== "all") {
    items = items.filter((r) => r.type === activeFolderTab);
  }

  if (!items.length) {
    body.innerHTML = `<div class="fm-empty">No files in this category yet.</div>`;
    return;
  }

  body.innerHTML = items.map((r) => {
    const kColor = KIND[r.type]?.color || "var(--brand)";
    const kLabel = KIND[r.type]?.label || r.type;
    const prof = r.professor && r.professor !== "—" ? `Prof. ${esc(r.professor)}` : "";
    // The kind label ("Past papers") is only useful when the row could be
    // any kind, i.e. the "All Files" tab. Once a specific kind tab is
    // selected, every row IS that kind — repeating the label on each row
    // just says the same thing five times.
    const showKind = activeFolderTab === "all";

    return `
      <div class="fm-row k-${r.type}">
        <div class="fm-row-left">
          <span class="fm-type-dot" style="background: ${kColor};"></span>
          <div class="fm-info">
            <b>${esc(r.title)}</b>
            ${showKind ? `<span class="fm-kind">${esc(kLabel)}</span>` : ""}
            ${prof ? `<span class="fm-prof">${prof}</span>` : ""}
          </div>
        </div>
        <div class="fm-actions">
          ${r.year ? `<span class="fm-year-chip">${esc(String(r.year))}</span>` : ""}
          <div class="fm-btn-group">
            <button class="btn-share" type="button" data-share-title="${esc(r.title)}" data-share-id="${r.id}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Share
            </button>
            <a class="btn-open" href="resource.html?id=${r.id}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Open
            </a>
          </div>
        </div>
      </div>`;
  }).join("");
}

function closeFolderModal() {
  const folderModal = document.getElementById("folderModal");
  if (!folderModal || folderModal.hidden) return;
  folderModal.classList.remove("open");
  setTimeout(() => {
    folderModal.hidden = true;
    document.body.style.overflow = "";
    window.__resumeLenis?.();
  }, 260);
}

/* ============================================================
   Share / Contribute Modal
   ============================================================ */
function openShareModal(prefillCourse = "") {
  closeFolderModal();
  const shareModal = document.getElementById("shareModal");
  if (!shareModal) return;

  const courseInput = document.getElementById("smCourseInput");
  if (courseInput && prefillCourse) {
    courseInput.value = prefillCourse;
  }

  shareModal.hidden = false;
  shareModal.offsetHeight;
  shareModal.classList.add("open");
  document.body.style.overflow = "hidden";
  window.__pauseLenis?.();
}

function closeShareModal() {
  const shareModal = document.getElementById("shareModal");
  if (!shareModal || shareModal.hidden) return;
  shareModal.classList.remove("open");
  setTimeout(() => {
    shareModal.hidden = true;
    document.body.style.overflow = "";
    window.__resumeLenis?.();
  }, 260);
}

/* ============================================================
   Interactive Bindings: Clicks, Dropzone, Keyboard
   ============================================================ */
function bindModals() {
  // Folder modal clicks & tabs
  document.getElementById("folderModalClose")?.addEventListener("click", closeFolderModal);
  document.querySelector("#folderModal .modal-back")?.addEventListener("click", closeFolderModal);

  // Delegated instead of an inline onclick on each row's Share button — an
  // inline onclick="copyLink('${title}', ...)" breaks (and can be broken
  // out of) the moment a title contains a quote or backslash, since it's
  // interpolated into a JS-string context that HTML-escaping alone doesn't
  // protect against.
  document.getElementById("fmBody")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-share");
    if (!btn) return;
    const id = btn.dataset.shareId ? Number(btn.dataset.shareId) : null;
    copyLink(btn.dataset.shareTitle || "", id);
  });

  document.querySelectorAll("#fmTabs .fm-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#fmTabs .fm-tab").forEach((t) => t.classList.remove("on"));
      tab.classList.add("on");
      activeFolderTab = tab.dataset.fmtab;
      renderFolderModalFiles();
    });
  });

  document.getElementById("fmShareBtn")?.addEventListener("click", () => {
    const courseTitle = document.getElementById("fmTitle")?.textContent || "";
    openShareModal(courseTitle);
  });

  // Share modal clicks & dropzone
  document.getElementById("shareModalClose")?.addEventListener("click", closeShareModal);
  document.querySelector("#shareModal .modal-back")?.addEventListener("click", closeShareModal);

  const dropzone = document.getElementById("smDropzone");
  const fileInput = document.getElementById("smFileInput");
  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files.length) {
        showToast(`Selected ${e.dataTransfer.files[0].name}`);
      }
    });
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length) {
        showToast(`Selected ${fileInput.files[0].name}`);
      }
    });
  }

  document.getElementById("smForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    closeShareModal();
    showToast("Thank you! Resource submitted for review.");
  });

  // Course card click delegation
  const grid = document.getElementById("grid");
  if (grid) {
    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".fcard");
      if (!card) return;
      activateCard(card);
    });

    grid.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".fcard");
      if (card) {
        e.preventDefault();
        activateCard(card);
      }
    });
  }
}

/* Opening a folder honours the kind its colour advertises:
   a reference folder is a shelf, so it opens the book directly rather than
   a file list; every other kind opens the modal already on its own tab. */
function activateCard(card) {
  if (card.dataset.kind === "reference" && card.dataset.bookId) {
    BookShelf.open(card.dataset.bookId, card);
    return;
  }
  openFolderModal(card.dataset.course, card.dataset.kind);
}

/* ============================================================
   Keyboard Shortcuts & Toast
   ============================================================ */
function initSpotlightShortcut() {
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const q = document.getElementById("q");
      if (q) {
        q.focus();
        q.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault();
      const q = document.getElementById("q");
      if (q) {
        q.focus();
        q.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else if (e.key === "Escape") {
      const q = document.getElementById("q");
      if (document.activeElement === q) q.blur();
      closeFolderModal();
      closeShareModal();
      BookShelf.close?.();
    }
  });
}

let toastTimer = null;
window.showToast = function(msg) {
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
};

/* id is optional so this still works anywhere copyLink is only passed a
   title — but the folder modal rows now pass the resource's own id, so
   Share copies a real deep link to that file's page instead of just
   whatever page happened to be open when you clicked it. */
window.copyLink = function(title, id) {
  const url = id != null
    ? new URL(`resource.html?id=${id}`, window.location.href).href
    : window.location.href;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).catch(() => {});
  }
  showToast(`Link copied for "${title}"`);
};

/* ============================================================
   Scroll Reveals (Apple-style Lazy Section Appearance)
   ============================================================ */
function setupReveals() {
  const els = [...document.querySelectorAll(".reveal, .reveal-group")];
  const revealAll = () => els.forEach((el) => el.classList.add("in"));

  if (!("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.visibilityState !== "visible") {
    revealAll();
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });

  els.forEach((el) => io.observe(el));
  setTimeout(revealAll, 3500);
}

function markReveals() {
  const targets = [
    [".library .lib-head", 0],
    [".library .shelf", 90],
    [".shelf-block", 0],
  ];
  targets.forEach(([sel, delay]) => {
    document.querySelectorAll(sel).forEach((el) => {
      el.classList.add("reveal");
      if (delay) el.style.setProperty("--rd", delay + "ms");
    });
  });
}

/* ============================================================
   Initialization
   ============================================================ */
fetchResources().then((all) => {
  ALL = all;
  BookShelf.init(all);
  const refs = all.filter((r) => r.type === "reference" && r.book);
  BookShelf.render(document.getElementById("shelfRow"), refs);
  bind();
  bindModals();
  initSpotlightShortcut();
  render();
  markReveals();
  setupReveals();
});

/* Branch dropdown on the Contribute form, filled from DEPARTMENTS so the
   list only ever lives in one place. */
(function fillDeptSelect() {
  var sel = document.getElementById("smDeptSelect");
  if (!sel || typeof DEPARTMENTS === "undefined") return;
  sel.innerHTML = '<option value="">Select a branch</option>' +
    DEPARTMENTS.map(function (d) {
      return '<option value="' + d.code + '">' + d.name + '</option>';
    }).join("");
})();
