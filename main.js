/**
 * IIT-H Resource Hub — front-end logic.
 * All data currently comes from `fetchResources()` in data.js (dummy array).
 * Swap that function's body for a real fetch() once the WordPress
 * taxonomy/REST endpoint is available — nothing below needs to change.
 */

const state = {
  all: [],
  filters: { department: null, semester: null, course: null, types: new Set() },
  search: "",
  sort: "recent",
};

const ICONS = {
  papers: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></svg>`,
  notes: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`,
  assignment: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v3h6V3M9 12l2 2 4-4"/></svg>`,
  reference: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 004 21z"/><path d="M4 5.5v16"/></svg>`,
};

const TYPE_ACCENT = {
  papers: "var(--type-papers)",
  notes: "var(--type-notes)",
  assignment: "var(--type-assignment)",
  reference: "var(--type-reference)",
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  state.all = await fetchResources();
  renderTypeChips();
  populateDropdown("department", buildDepartmentOptions());
  populateDropdown("semester", buildSemesterOptions());
  populateDropdown("course", buildCourseOptions());
  bindGlobalUI();
  bindDropdowns();
  applyFiltersAndRender();
  animateStats();
  setupRevealObserver();
}

/* ---------------- Options builders ---------------- */

function buildDepartmentOptions() {
  const counts = countBy(state.all, "department");
  return DEPARTMENTS
    .filter((d) => counts[d.code])
    .map((d) => ({ value: d.code, label: `${d.name} (${d.code})`, count: counts[d.code] || 0 }));
}

function buildSemesterOptions() {
  const counts = countBy(state.all, "semester");
  return Object.keys(counts)
    .map(Number)
    .sort((a, b) => a - b)
    .map((s) => ({ value: String(s), label: ordinal(s) + " Semester", count: counts[s] }));
}

function buildCourseOptions() {
  const counts = countBy(state.all, "course");
  return Object.keys(counts)
    .sort()
    .map((c) => ({ value: c, label: c, count: counts[c] }));
}

function countBy(arr, key) {
  return arr.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ---------------- Rendering ---------------- */

function renderTypeChips() {
  const row = document.getElementById("typeRow");
  row.innerHTML = RESOURCE_TYPES.map(
    (t) => `
    <button class="type-chip" data-type="${t.id}" style="--dot:${t.color}" type="button">
      <span class="dot"></span>${t.label}
    </button>`
  ).join("");

  row.querySelectorAll(".type-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const id = chip.dataset.type;
      if (state.filters.types.has(id)) state.filters.types.delete(id);
      else state.filters.types.add(id);
      chip.classList.toggle("active");
      applyFiltersAndRender();
    });
  });
}

function populateDropdown(name, options) {
  const dd = document.querySelector(`.dropdown[data-dropdown="${name}"]`);
  const panel = dd.querySelector(".dropdown-panel");
  const allOption = `<div class="dropdown-option selected" data-value="">All ${name}s</div>`;
  panel.innerHTML =
    allOption +
    options
      .map(
        (o) =>
          `<div class="dropdown-option" data-value="${escapeAttr(o.value)}">${escapeHtml(o.label)}<span class="count">${o.count}</span></div>`
      )
      .join("");

  panel.querySelectorAll(".dropdown-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      panel.querySelectorAll(".dropdown-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      const value = opt.dataset.value || null;
      state.filters[name] = value;
      const label = dd.querySelector(".dropdown-label");
      label.textContent = value ? opt.textContent.replace(/\d+$/, "").trim() : capitalize(name);
      dd.classList.toggle("has-value", !!value);
      closeAllDropdowns();
      applyFiltersAndRender();
    });
  });
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(str) { return escapeHtml(str); }

function renderResourceCards(list) {
  const grid = document.getElementById("resourceGrid");
  const empty = document.getElementById("emptyState");

  if (list.length === 0) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = list
    .map((r, i) => {
      const typeInfo = RESOURCE_TYPES.find((t) => t.id === r.type);
      const accent = TYPE_ACCENT[r.type];
      return `
      <article class="resource-card" style="--accent-color:${accent}; --stagger:${Math.min(i, 12) * 45}ms">
        <div class="card-top">
          <div class="card-icon">${ICONS[r.type] || ICONS.notes}</div>
          <span class="card-tag" style="background:none;">${typeInfo ? typeInfo.label : ""}</span>
        </div>
        <div>
          <h3 class="card-title">${escapeHtml(r.title)}</h3>
          <p class="card-course">${escapeHtml(r.course)}</p>
        </div>
        <div class="card-meta">
          <span>${iconCalendar()} ${r.year}</span>
          <span>${iconUser()} ${escapeHtml(r.professor)}</span>
          ${r.pages ? `<span>${iconPages()} ${r.pages} pages</span>` : ""}
          <span>${iconDownload()} ${r.downloads}</span>
        </div>
        <div class="card-footer">
          <span class="card-dept">${r.department} · Sem ${r.semester}</span>
          <span class="card-cta">View
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </span>
        </div>
      </article>`;
    })
    .join("");
}

function iconCalendar() {
  return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`;
}
function iconUser() {
  return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>`;
}
function iconPages() {
  return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/></svg>`;
}
function iconDownload() {
  return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 19h16"/></svg>`;
}

/* ---------------- Filtering / sorting ---------------- */

function applyFiltersAndRender() {
  let list = state.all.slice();
  const f = state.filters;

  if (f.department) list = list.filter((r) => r.department === f.department);
  if (f.semester) list = list.filter((r) => String(r.semester) === f.semester);
  if (f.course) list = list.filter((r) => r.course === f.course);
  if (f.types.size) list = list.filter((r) => f.types.has(r.type));

  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    list = list.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.course.toLowerCase().includes(q) ||
        r.professor.toLowerCase().includes(q)
    );
  }

  if (state.sort === "popular") list.sort((a, b) => b.downloads - a.downloads);
  else if (state.sort === "az") list.sort((a, b) => a.title.localeCompare(b.title));
  else list.sort((a, b) => b.year - a.year || b.id - a.id);

  document.getElementById("resultsCount").textContent =
    list.length === state.all.length
      ? `All ${list.length} resources`
      : `${list.length} resource${list.length === 1 ? "" : "s"} found`;

  renderResourceCards(list);
}

/* ---------------- Global UI bindings ---------------- */

function bindGlobalUI() {
  const header = document.getElementById("site-header");
  window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 8);
  });

  const navToggle = document.getElementById("navToggle");
  const mobileNav = document.getElementById("mobileNav");
  navToggle.addEventListener("click", () => {
    const open = navToggle.classList.toggle("open");
    mobileNav.classList.toggle("open", open);
    navToggle.setAttribute("aria-expanded", String(open));
  });
  mobileNav.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      navToggle.classList.remove("open");
      mobileNav.classList.remove("open");
    })
  );

  const searchInput = document.getElementById("searchInput");
  let debounceTimer;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.search = e.target.value;
      applyFiltersAndRender();
    }, 150);
  });

  document.getElementById("sortSelect").addEventListener("change", (e) => {
    state.sort = e.target.value;
    applyFiltersAndRender();
  });

  document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    state.filters = { department: null, semester: null, course: null, types: new Set() };
    state.search = "";
    document.getElementById("searchInput").value = "";
    document.querySelectorAll(".type-chip.active").forEach((c) => c.classList.remove("active"));
    document.querySelectorAll(".dropdown").forEach((dd) => {
      dd.classList.remove("has-value");
      dd.querySelector(".dropdown-label").textContent = capitalize(dd.dataset.dropdown);
      dd.querySelectorAll(".dropdown-option").forEach((o, i) => o.classList.toggle("selected", i === 0));
    });
    applyFiltersAndRender();
  });
}

function bindDropdowns() {
  const dropdowns = document.querySelectorAll(".dropdown");
  dropdowns.forEach((dd) => {
    const trigger = dd.querySelector(".dropdown-trigger");
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dd.classList.contains("open");
      closeAllDropdowns();
      if (!isOpen) dd.classList.add("open");
    });
  });
  document.addEventListener("click", closeAllDropdowns);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAllDropdowns(); });
}

function closeAllDropdowns() {
  document.querySelectorAll(".dropdown.open").forEach((dd) => dd.classList.remove("open"));
}

/* ---------------- Stat count-up ---------------- */

function realStatValue(key) {
  if (key === "resources") return state.all.length;
  if (key === "departments") return new Set(state.all.map((r) => r.department)).size;
  if (key === "courses") return new Set(state.all.map((r) => r.course)).size;
  return 0;
}

function animateStats() {
  const nums = document.querySelectorAll(".stat-num");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = realStatValue(el.dataset.countFrom);
        const duration = 900;
        const start = performance.now();
        function tick(now) {
          const p = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(eased * target).toLocaleString();
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        io.unobserve(el);
      });
    },
    { threshold: 0.5 }
  );
  nums.forEach((n) => io.observe(n));
}

/* ---------------- Scroll reveal ---------------- */

function setupRevealObserver() {
  const els = document.querySelectorAll(".reveal");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));
}
