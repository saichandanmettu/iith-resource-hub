/* The full library page — every shelf on the platform, grouped by
   department, filterable. Covers and the detail panel come from books.js. */

const DEPT_NAMES = {};
const DEPT_ACCENT = {};
const DEPT_SHORT = {};
DEPARTMENTS.forEach((d) => { DEPT_NAMES[d.code] = d.name; DEPT_ACCENT[d.code] = d.accent; DEPT_SHORT[d.code] = d.short || d.name; });

const lib = { q: "", dept: "all" };
let LIB_ALL = [];

function shelvesByDept(books) {
  const map = new Map();
  books.forEach((r) => {
    if (!map.has(r.department)) map.set(r.department, []);
    map.get(r.department).push(r);
  });
  return [...map.entries()]
    .map(([code, items]) => ({ code, name: DEPT_NAMES[code] || code, short: DEPT_SHORT[code] || code, accent: DEPT_ACCENT[code] || "var(--muted)", items }))
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
}

function renderDeptFilter(books) {
  /* Every branch gets a pill, not just the ones that happen to hold books
     today — a student should see their own branch listed even when its
     shelf is still empty. Branches with nothing yet render dimmed and
     inert rather than leading to a dead end. */
  const counts = new Map();
  books.forEach((r) => counts.set(r.department, (counts.get(r.department) || 0) + 1));

  document.getElementById("libPills").innerHTML =
    DEPARTMENTS.map((d) => {
      const n = counts.get(d.code) || 0;
      const on = lib.dept === d.code ? " on" : "";
      return `<button class="pill${on}${n ? "" : " is-empty"}" data-dept="${d.code}" type="button"` +
             `${n ? "" : " disabled aria-disabled=\"true\""}` +
             ` title="${BookShelf.esc(d.name)}${n ? "" : " — no books yet"}">` +
             `<i style="background:${d.accent}"></i> ${BookShelf.esc(d.code)}</button>`;
    }).join("");
}

function renderLibrary() {
  let books = LIB_ALL;
  if (lib.dept !== "all") books = books.filter((r) => r.department === lib.dept);
  if (lib.q) {
    const q = lib.q.toLowerCase();
    books = books.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.course.toLowerCase().includes(q) ||
      (r.code && r.code.toLowerCase().includes(q)) ||
      (r.book.author && r.book.author.toLowerCase().includes(q)) ||
      (r.book.publisher && r.book.publisher.toLowerCase().includes(q)));
  }

  const host = document.getElementById("shelves");
  const shelves = shelvesByDept(books);

  if (!shelves.length) {
    // One message, not two \u2014 this used to also render a second, differently
    // worded "no book matches" paragraph inside #shelves at the same time
    // #libCount showed its own. Same single-message pattern the Archive
    // page already uses (app.js's #count), same wording too.
    host.innerHTML = "";
    document.getElementById("libCount").textContent = "Nothing found \u2014 try searching another course or clearing filters.";
    return;
  }

  host.innerHTML = shelves.map((s, i) => `
    <section class="shelf-block" style="--d:${i * 60}ms">
      <div class="shelf-label">
        <h2 title="${BookShelf.esc(s.name)}"><i class="shelf-dot" style="background:${s.accent}"></i>${BookShelf.esc(s.short)}</h2>
        <span>${s.items.length} book${s.items.length === 1 ? "" : "s"}</span>
      </div>
      <div class="shelf">
        <div class="shelf-row" data-shelf="${s.code}"></div>
      </div>
    </section>`).join("");

  shelves.forEach((s) => {
    BookShelf.render(host.querySelector(`[data-shelf="${s.code}"]`), s.items);
  });

  /* No running total: each shelf already prints its own count beside the
     label, and the browse page leaves this line blank unless nothing
     matched. Same behaviour here. */
  document.getElementById("libCount").textContent = "";

  host.querySelectorAll(".shelf-block").forEach((el) => el.classList.add("reveal"));
  setupReveals();
}



function initSpotlightShortcut() {
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const q = document.getElementById("libSearch");
      if (q) {
        q.focus();
        q.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault();
      const q = document.getElementById("libSearch");
      if (q) {
        q.focus();
        q.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else if (e.key === "Escape") {
      const q = document.getElementById("libSearch");
      if (document.activeElement === q) q.blur();
      closeShareModal();
      BookShelf.close?.();
    }
  });
}

function openShareModal() {
  const shareModal = document.getElementById("shareModal");
  if (!shareModal) return;
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

fetchResources().then((all) => {
  LIB_ALL = all.filter((r) => r.book);
  BookShelf.init(all);

  renderDeptFilter(LIB_ALL);
  renderLibrary();

  document.getElementById("libPills").addEventListener("click", (e) => {
    const p = e.target.closest(".pill");
    if (!p) return;
    /* No "All" pill: nothing selected already means everything. Clicking the
       active branch again clears the filter. */
    const already = p.classList.contains("on");
    document.querySelectorAll("#libPills .pill").forEach((x) => x.classList.remove("on"));
    if (already) {
      lib.dept = "all";
    } else {
      p.classList.add("on");
      lib.dept = p.dataset.dept;
    }
    renderLibrary();
  });

  document.getElementById("libSearch").addEventListener("input", (e) => {
    lib.q = e.target.value.trim();
    renderLibrary();
  });

  /* The header CTA is a plain link to contribute.html now — leave it alone
     so it actually navigates. */
  document.querySelectorAll("nav a[href*='archive']:not(.on)").forEach((btn) => {
    if (btn.textContent.trim() === "Contribute") {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openShareModal();
      });
    }
  });

  document.getElementById("shareModalClose")?.addEventListener("click", closeShareModal);
  document.querySelector("#shareModal .modal-back")?.addEventListener("click", closeShareModal);
  document.getElementById("smForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    closeShareModal();
    showToast("Thank you! Resource submitted for review.");
  });

  initSpotlightShortcut();
});

/* scroll polish */
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

/* Branch dropdown on the Contribute form, filled from DEPARTMENTS so the
   list only ever lives in one place. */
(function fillDeptSelect() {
  var sel = document.getElementById("smDeptSelect") || document.getElementById("smTypeSelect");
  if (!sel || typeof DEPARTMENTS === "undefined") return;
  sel.innerHTML = '<option value="">Select a branch</option>' +
    DEPARTMENTS.map(function (d) {
      return '<option value="' + d.code + '">' + d.name + '</option>';
    }).join("");
})();
