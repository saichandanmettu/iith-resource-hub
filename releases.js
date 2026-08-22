/* ------------------------------------------------------------
   Releases — what shipped, what is being built, what is next.
   Add an entry at the TOP of RELEASES and it appears first.

   status:  "shipped" | "building" | "next"
   date:    free text, shown as-is (omit for "next" items)
   tag:     short label, e.g. "v1.2" or "Library"
   ------------------------------------------------------------ */
const RELEASES = [
  {
    status: "building",
    tag: "Releases",
    title: "This page",
    date: "August 2026",
    body: "A running log of what is shipping, so contributors can see the archive is alive and know what is coming.",
    items: ["Changelog entries", "Status per item", "What is next"]
  },
  {
    status: "shipped",
    tag: "Library",
    title: "The reference shelf",
    date: "August 2026",
    body: "Every textbook a course leans on, on one shelf. Pull a book out to see what it is good for.",
    items: ["Shelves grouped by department", "Book detail panel", "Search by title, author or publisher"]
  },
  {
    status: "shipped",
    tag: "Archive",
    title: "Course folders",
    date: "August 2026",
    body: "Resources grouped by course rather than dumped in one list, with a colour per resource kind so you can spot a type before you read it.",
    items: ["Folder per course", "Filter by kind", "Full-text search across courses and professors"]
  },
  {
    status: "next",
    tag: "Contribute",
    title: "Open uploads",
    body: "Let students submit files directly, with a review step before anything goes live.",
    items: ["Upload form", "Moderation queue", "Contributor credits"]
  },
  {
    status: "next",
    tag: "Archive",
    title: "Past paper coverage",
    body: "Fill the gaps, semester by semester, until every course has its last few years of papers.",
    items: ["Coverage map per department", "Request a missing paper"]
  }
];

const STATUS = {
  building: { label: "In progress", kind: "building" },
  shipped:  { label: "Shipped",     kind: "shipped" },
  next:     { label: "Next up",     kind: "next" }
};

/* Three folders, one per status. Same construction as the archive cards:
   a coloured folder body with the site's asymmetric corner, and white
   sheets sitting inside it. */
(function () {
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const root = document.getElementById("releaseList");
  if (!root) return;

  const order = ["building", "shipped", "next"];

  root.innerHTML = order.map((status, ci) => {
    const meta = STATUS[status];
    const rows = RELEASES.filter((r) => r.status === status);

    const sheets = rows.length
      ? rows.map((r, i) => `
          <article class="rel-sheet" style="--d:${ci * 60 + i * 70}ms">
            <div class="rel-sheet-top">
              <span class="rel-tag">${esc(r.tag)}</span>
              ${r.date ? `<span class="rel-date">${esc(r.date)}</span>` : ""}
            </div>
            <h3 class="rel-title">${esc(r.title)}</h3>
            <p class="rel-text">${esc(r.body)}</p>
            ${r.items && r.items.length
              ? `<ul class="rel-items">${r.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
              : ""}
          </article>`).join("")
      : `<div class="rel-empty">Nothing here yet.</div>`;

    /* The status label sits outside the folder, on the paper, so the rail
       can run unbroken across all three instead of hiding behind them. */
    return `
      <div class="rel-track s-${meta.kind}" style="--d:${ci * 90}ms">
        <header class="rel-head">
          <span class="rel-node" aria-hidden="true"></span>
          <span class="rel-label">${esc(meta.label)}</span>
          <span class="rel-n">${rows.length}</span>
        </header>
        <section class="rel-col">
          <div class="rel-sheets">${sheets}</div>
        </section>
      </div>`;
  }).join("");

  // Native scroll-driven animation handles arrival where supported.
  if (window.CSS && CSS.supports("(animation-timeline: view()) and (animation-range: entry)") &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  root.querySelectorAll(".rel-track").forEach((el) => io.observe(el));
})();


/* ============================================================
   VERSIONS — the big releases, shown as a timeline below the board.

   The three folders above are for small, in-flight updates. A numbered
   release goes here instead. Keep every line a short bullet: this is a
   changelog, not an announcement post.

   status: "upcoming" | "shipped"
   ============================================================ */
const VERSIONS = [
  {
    version: "2.1",
    status: "upcoming",
    date: "Next up",
    groups: [
      { label: "New", items: [
        "Semester 1 materials across more departments",
        "Multi-file upload in one submission",
        "Android app in development"
      ]},
      { label: "Improved", items: [
        "Expanded coverage for Mechanical and other streams"
      ]}
    ]
  },
  {
    version: "2.0",
    status: "shipped",
    date: "16 Oct 2024",
    groups: [
      { label: "New", items: [
        "Contribution system — upload notes, quizzes, papers and assignments",
        "Content management interface for organising submissions"
      ]},
      { label: "Improved", items: [
        "Faster navigation across the platform",
        "Cleaner buttons, layout and responsiveness"
      ]}
    ]
  }
];

(function renderVersions() {
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const root = document.getElementById("versionTrack");
  if (!root) return;

  const ICON = {
    upcoming: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    shipped:  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
  };

  root.innerHTML =
    '<span class="vt-line" aria-hidden="true"></span>' +
    VERSIONS.map((v, i) => `
      <article class="vt-item s-${v.status === "shipped" ? "shipped" : "next"}" style="--d:${i * 80}ms">
        <span class="vt-node" aria-hidden="true">${ICON[v.status] || ICON.shipped}</span>
        <div class="vt-card">
          <div class="vt-head">
            <h3 class="vt-version">Version ${esc(v.version)}</h3>
            <span class="vt-date">${esc(v.date)}</span>
          </div>
          ${v.groups.map((g) => `
            <div class="vt-group">
              <h4 class="vt-group-label">${esc(g.label)}</h4>
              <ul class="vt-list">${g.items.map((it) => `<li>${esc(it)}</li>`).join("")}</ul>
            </div>`).join("")}
        </div>
      </article>`).join("");

  /* Always observer-driven here — see the note in styles.css. Anything that
     cannot be observed is shown immediately rather than left hidden. */
  const items = [...root.querySelectorAll(".vt-item")];
  if (!("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    items.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  items.forEach((el) => io.observe(el));
  /* safety net: never leave a card stuck invisible */
  setTimeout(() => items.forEach((el) => el.classList.add("in")), 2500);
})();

/* ------------------------------------------------------------
   Rail progress.

   Driven here rather than with a view() timeline: .vt-line is
   position:absolute, and an absolutely-positioned subject leaves the
   ViewTimeline inactive (currentTime null) even when fully on screen.
   Measured, not assumed — see DESIGN.md §6.
   ------------------------------------------------------------ */
(function railProgress() {
  const line = document.querySelector(".vt-line");
  const track = document.getElementById("versionTrack");
  if (!line || !track) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    line.style.backgroundSize = "100% 100%";
    return;
  }

  function update() {
    const r = track.getBoundingClientRect();
    const vh = window.innerHeight;
    /* 0 when the track's top reaches 85% down the viewport,
       1 by the time it has travelled to 25% — fills as you read. */
    const start = vh * 0.85;
    const end = vh * 0.25;
    const p = (start - r.top) / (start - end + r.height);
    line.style.backgroundSize = "100% " + Math.max(0, Math.min(1, p)) * 100 + "%";
  }
  /* Run inline rather than behind a rAF flag: a queued-flag pattern
     deadlocks if a frame never fires (throttled or backgrounded tab) and
     every later scroll is silently dropped. One rect read and one style
     write on a single 2px element is cheaper than that risk. */
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  update();
})();
