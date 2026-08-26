/* ------------------------------------------------------------
   Releases — what shipped, what is being built, what is next.
   Add an entry at the TOP of RELEASES and it appears first.

   status:  "shipped" | "building" | "next"
   date:    free text, shown as-is (omit for "next" items)
   tag:     short label, e.g. "v1.2" or "Bookshelf"
   ------------------------------------------------------------ */
const RELEASES = [
  {
    status: "building",
    tag: "Honor Roll",
    title: "Contributor points",
    date: "August 2026",
    body: "Every file is worth points to whoever shared it, so the people keeping the archive alive are visible instead of anonymous. Seeded by hand while uploads are still manual.",
    items: ["Points per resource kind", "This semester and all time", "Credit stays optional"]
  },
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
    tag: "Bookshelf",
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

const STATUS_META = {
  shipped:  { label: "Shipped", badge: "Live", kind: "f-shipped", frontTag: "Completed / Live", frontTitle: "Shipped Updates" },
  building: { label: "In Progress", badge: "Active", kind: "f-building", frontTag: "Current Sprint", frontTitle: "In Progress" },
  next:     { label: "Next Up", badge: "Planned", kind: "f-next", frontTag: "Up Next", frontTitle: "Roadmap" }
};

/* Three 3D Fan-Out & Expandable Folders */
(function () {
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const root = document.getElementById("releaseList");
  if (!root) return;

  const order = ["shipped", "building", "next"];

  const sheetCard = (r, ci, i) => `
    <article class="ab-sheet-card" style="--i:${i}">
      <div class="ab-sheet-meta">
        <span class="ab-sheet-tag">${esc(r.tag)}</span>
        ${r.date ? `<span class="ab-sheet-date">${esc(r.date)}</span>` : ""}
      </div>
      <h4 class="ab-sheet-title">${esc(r.title)}</h4>
      <p class="ab-sheet-desc">${esc(r.body)}</p>
      ${r.items && r.items.length
        ? `<ul class="ab-sheet-items">${r.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
        : ""}
    </article>`;

  const miniCard = (r, idx, total) => {
    let posClass = "cm-single";
    if (total === 2) {
      posClass = idx === 0 ? "cm-left" : "cm-right";
    } else if (total >= 3) {
      if (idx === 0) posClass = "cm-left";
      else if (idx === 1) posClass = "cm-center";
      else posClass = "cm-right";
    }
    return `
      <div class="ab-card-mini ${posClass}">
        <div class="ab-card-mini-head">
          <span class="ab-card-mini-tag">${esc(r.tag)}</span>
          ${r.date ? `<span class="ab-card-mini-date">${esc(r.date)}</span>` : ""}
        </div>
        <h4 class="ab-card-mini-title">${esc(r.title)}</h4>
        <div class="ab-card-mini-lines">
          <div class="ab-mini-line w-full"></div>
          <div class="ab-mini-line w-3-4"></div>
        </div>
      </div>`;
  };

  root.innerHTML = order.map((status, ci) => {
    const meta = STATUS_META[status];
    const rows = RELEASES.filter((r) => r.status === status);

    return `
      <div class="ab-folder-col ${meta.kind}" id="col-${status}">
        <div class="ab-stage-head">
          <div class="ab-stage-title-wrap">
            <span class="ab-stage-dot"></span>
            <span class="ab-stage-title">${esc(meta.label)}</span>
          </div>
          <span class="ab-stage-pill">${rows.length} ${esc(meta.badge)}</span>
        </div>

        <div class="ab-folder">
          <!-- Closed Folder (Interactive Hover Fan) -->
          <div class="ab-folder-closed" role="button" aria-expanded="false" tabindex="0">
            ${rows.slice(0, 3).map((r, idx) => miniCard(r, idx, Math.min(rows.length, 3))).join("")}

            <!-- Front Pocket Cover -->
            <div class="ab-folder-front">
              <div>
                <span class="ab-front-tag">${esc(meta.frontTag)}</span>
                <h3 class="ab-front-title">${esc(meta.frontTitle)}</h3>
              </div>
              <div class="ab-front-bottom">
                <div class="ab-front-count-wrap">
                  <span class="ab-front-count">${rows.length}</span>
                  <span class="ab-front-label">${rows.length === 1 ? 'Feature' : 'Features'}</span>
                </div>
                <div class="ab-front-btn" title="Open folder">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Open Folder (Full Readable Cards) -->
          <div class="ab-folder-spread">
            <div class="ab-spread-inner">
              <div class="ab-sheets-list">
                ${rows.map((r, i) => sheetCard(r, ci, i)).join("")}
                <button class="ab-restack-btn" type="button">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m18 15-6-6-6 6"/></svg>
                  <span>Restack folder</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>`;
  }).join("");

  root.querySelectorAll(".ab-folder-closed, .ab-restack-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const col = btn.closest(".ab-folder-col");
      if (!col) return;
      const isOpen = col.classList.toggle("is-open");
      const closedTrigger = col.querySelector(".ab-folder-closed");
      if (closedTrigger) closedTrigger.setAttribute("aria-expanded", String(isOpen));
    });
  });

  // Native scroll-driven animation handles arrival where supported.
  if (window.CSS && CSS.supports("(animation-timeline: view()) and (animation-range: entry)") &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  root.querySelectorAll(".ab-folder-col").forEach((el) => io.observe(el));
})();


/* ============================================================
   VERSIONS — the big releases, shown as a timeline below the board.

   The three folders above are for small, in-flight updates. A numbered
   release goes here instead — a pill node on a rail, a card with a
   date badge, an announcement callout for the headline releases, and a
   checklist of what shipped. Functions here are declared at top level
   (not inside an IIFE) because the generated markup wires them up via
   inline onclick handlers, which only resolve against the global scope.
   ============================================================ */
const VERSIONS = [
  {
    id: "v3-0",
    version: "3.0",
    theme: "notes", // Green (#698B39)
    title: "Version 3.0",
    date: "22 Aug 2025",
    daysSince: "310 days later",
    votes: 0,
    announcement: [
      "Resource Hub has officially evolved into <strong>Abhyas</strong>. We've completely rebuilt the platform from scratch with a new brand identity, a redesigned file architecture, faster access, and updated course materials across all engineering departments."
    ],
    groups: [
      {
        label: "REVAMP & REBRANDING",
        items: [
          "Platform Evolution: Resource Hub is now Abhyas with our official brand logo & identity",
          "Built From Scratch: Re-architected website, new deployment pipeline, file system, and design system",
          "Usability & Performance: Faster navigation and a more user-friendly interface across devices"
        ]
      },
      {
        label: "CONTENT UPDATES",
        items: [
          "50+ Course Materials Added: Fresh resources uploaded across multiple engineering departments",
          "More Releases Soon: Stay tuned for ongoing course material expansions"
        ]
      }
    ]
  },
  {
    id: "v2-0",
    version: "2.0",
    theme: "papers", // Warm Amber (#F28700)
    title: "Version 2.0",
    date: "16 Oct 2024",
    groups: [
      {
        label: "NEW FEATURES",
        items: [
          "Contribution System: Actively contribute to the platform by uploading notes, quizzes, past papers, and assignments directly",
          "Content Management Interface: Brand-new interface to easily upload, organize, and manage your contributions in one place"
        ]
      },
      {
        label: "IMPROVEMENTS",
        items: [
          "Performance Optimizations: Faster platform load times and smoother navigation",
          "UI Enhancements: Cleaner, intuitive interface with improved buttons, layout, and responsiveness across devices"
        ]
      }
    ]
  },
  {
    id: "v1-5",
    version: "1.5",
    theme: "reference", // Clay Mauve (#8C6597)
    title: "Release 1.5",
    date: "13 Oct 2024",
    groups: [
      {
        label: "WHAT'S NEW",
        items: [
          "Added new pages showcasing detailed content and improved resource categorization for better user accessibility",
          "Enhanced platform interface to ensure faster navigation between different website sections",
          "Uploaded sample content to give users a sneak peek of the platform's full capabilities"
        ]
      }
    ]
  },
  {
    id: "v1-0",
    version: "1.0",
    theme: "assignment", // Terracotta Coral (#D04724)
    title: "Version 1.0",
    date: "10 Oct 2024",
    groups: [
      {
        label: "FEATURES",
        items: [
          "Official platform launch with foundational features to browse and access resources",
          "Homepage setup and access to initial sample content",
          "Primary pages developed and deployed for core site navigation",
          "Initial enhancements to optimize page load times and refine the user interface layout"
        ]
      }
    ]
  }
];

const esc = (v) => String(v).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ------------------------------------------------------------
   RENDER FUNCTION
   ------------------------------------------------------------ */
function renderTimeline() {
  const root = document.getElementById("versionTimeline");
  if (!root) return;

  root.innerHTML =
    '<div class="vt-rail-line" aria-hidden="true"><div class="vt-rail-fill" id="railFill"></div></div>' +
    VERSIONS.map((v, i) => `
      <article class="vt-item s-${v.theme}" id="version-${v.version.replace('.', '-')}" style="--d:${i * 80}ms">
        <!-- Left Oval Pill Node -->
        <div class="vt-node-pill" title="Jump to v${esc(v.version)}" onclick="scrollToVersion('${v.version.replace('.', '-')}');">
          ${esc(v.version)}
        </div>

        <!-- Right Winner Card -->
        <div class="vt-card-winner">
          <div class="vt-winner-head">
            <div class="vt-winner-title-group">
              <span class="vt-winner-dot"></span>
              <h3 class="vt-winner-title">${esc(v.title)}</h3>
            </div>

            <div class="vt-head-actions">
              <!-- Upvote Reaction Button (Only for Version 3.0) -->
              ${v.version === "3.0" ? `
                <button class="vt-react-btn" id="react-${v.id}" onclick="toggleVote('${v.id}')" title="Mark as helpful">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                  <span id="vote-count-${v.id}">${v.votes}</span>
                </button>
              ` : ''}

              <!-- Tactile Date Badge -->
              <span class="vt-date-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                ${esc(v.date)}
              </span>

              <!-- Separate Red Sticky Note Patch Badge for Time Gap -->
              ${v.daysSince ? `
                <span class="vt-patch-badge" title="Time elapsed since Version 2.0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  ${esc(v.daysSince)}
                </span>
              ` : ''}
            </div>
          </div>

          <!-- Condensed Announcement Paragraph -->
          ${v.announcement ? `
            <div class="vt-announcement">
              ${v.announcement.map(p => `<p>${p}</p>`).join('')}
            </div>
          ` : ''}

          <!-- Feature Group Intro Boxes -->
          <div class="vt-winner-groups">
            ${v.groups.map(g => `
              <div class="vt-winner-group">
                <div class="vt-winner-group-header">
                  ${g.label ? `<span class="vt-winner-group-label">${esc(g.label)}</span>` : ''}
                </div>
                ${g.items.map(item => `
                  <div class="vt-capsule-row" onclick="toggleCapsuleCheck(this)">
                    <span class="vt-check-badge">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6 9 17l-5-5"/></svg>
                    </span>
                    <span class="vt-capsule-text">${esc(item)}</span>
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
        </div>
      </article>
    `).join('');

  // Trigger scroll entrance animations
  const items = [...root.querySelectorAll(".vt-item")];
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    items.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    items.forEach((el) => io.observe(el));
    /* safety net: if the observer never fires for any reason, don't leave
       the whole section stuck invisible */
    setTimeout(() => items.forEach((el) => el.classList.add("in")), 2500);
  }

  updateRailFill();
}

/* ------------------------------------------------------------
   INTERACTIVE MICRO-DELIGHT FUNCTIONS
   ------------------------------------------------------------ */

/* 1. Upvotes — a real, shared count.
   Backed by a tiny Google Apps Script web app sitting in front of a
   Sheet (same pattern as the Aarambh Tools setup): a GET request reads
   or increments/decrements one cell. localStorage only remembers
   *this browser's* own vote, so a second click here un-votes instead
   of double-counting — the shared number itself always lives on the
   sheet, not in the page. */
const VOTE_API = "https://script.google.com/macros/s/AKfycbwaLinr_EnJPy8926LJ2l2l5D9MduWWrmZGwHH6QBNrcmJzEb2cm3XXtpsiyhvAhj4C/exec";

function votedKey(id) { return `abhyas_voted_${id}`; }

async function loadVoteCount(id) {
  const countEl = document.getElementById(`vote-count-${id}`);
  const btn = document.getElementById(`react-${id}`);
  if (!countEl || VOTE_API.indexOf("PASTE_") === 0) return;
  try {
    const res = await fetch(`${VOTE_API}?action=read`);
    const data = await res.json();
    countEl.textContent = data.votes;
  } catch (e) { /* offline or not configured yet — keep the static count */ }
  if (btn && localStorage.getItem(votedKey(id)) === "1") btn.classList.add("voted");
}

async function toggleVote(id) {
  const btn = document.getElementById(`react-${id}`);
  const countEl = document.getElementById(`vote-count-${id}`);
  if (!btn || !countEl) return;
  if (VOTE_API.indexOf("PASTE_") === 0) {
    showToast("Voting isn't connected yet");
    return;
  }

  const alreadyVoted = localStorage.getItem(votedKey(id)) === "1";
  const delta = alreadyVoted ? "down" : "up";

  btn.disabled = true;
  try {
    const res = await fetch(`${VOTE_API}?action=vote&delta=${delta}`);
    const data = await res.json();
    countEl.textContent = data.votes;
    btn.classList.toggle("voted", !alreadyVoted);
    localStorage.setItem(votedKey(id), alreadyVoted ? "0" : "1");
    showToast(alreadyVoted ? "Vote removed" : "Appreciated this release!");
  } catch (e) {
    showToast("Couldn't reach the vote counter");
  } finally {
    btn.disabled = false;
  }
}

/* 2. Interactive Capsule Checklist Toggle */
function toggleCapsuleCheck(row) {
  const isChecked = row.classList.toggle("checked");
  if (isChecked) {
    showToast("Marked feature as reviewed");
  }
}

/* 3. Toast Notification System */
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById("vtToast");
  if (!toast) return;

  toast.textContent = msg;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

/* 4. Scroll To Version Helper */
function scrollToVersion(id) {
  const target = document.getElementById(`version-${id}`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/* 5. Scroll Rail Fill & Node Scrollspy */
function updateRailFill() {
  const fill = document.getElementById("railFill");
  const root = document.getElementById("versionTimeline");
  if (!fill || !root) return;

  const r = root.getBoundingClientRect();
  const vh = window.innerHeight;
  const start = vh * 0.85;
  const end = vh * 0.25;
  const p = (start - r.top) / (start - end + r.height);
  fill.style.backgroundSize = "100% " + Math.max(0, Math.min(1, p)) * 100 + "%";

  // ScrollSpy Node Highlighting
  const items = root.querySelectorAll(".vt-item");
  items.forEach(item => {
    const box = item.getBoundingClientRect();
    if (box.top <= vh * 0.55 && box.bottom >= vh * 0.25) {
      item.classList.add("active-node");
    } else {
      item.classList.remove("active-node");
    }
  });
}

/* Init */
window.addEventListener("DOMContentLoaded", () => {
  renderTimeline();
  loadVoteCount("v3-0");
  window.addEventListener("scroll", updateRailFill, { passive: true });
  window.addEventListener("resize", updateRailFill, { passive: true });
});
