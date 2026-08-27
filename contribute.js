/* ------------------------------------------------------------
   Abhyas — Contribute page

   Drives the intake studio and the gap radar. Both read the same
   arrays Archive renders, so neither can claim a branch is stocked
   when the shelf is empty.

   The upload posts to api/submit.php. Nothing it sends is trusted:
   the server re-checks the file type, renames it, and drops it in a
   quarantine folder that is not on the public web. The admin fixes
   the metadata before anything is published.
   ------------------------------------------------------------ */
(function () {
  "use strict";

  const SUBMIT_ENDPOINT = "api/submit.php";
  const MAX_BYTES = 25 * 1024 * 1024;
  const OK_TYPES = ["pdf", "jpg", "jpeg", "png"];

  const KIND_META = [
    { id: "papers",     title: "Quizzes &amp; Past Papers", tint: "--papers-tint",     ink: "--papers-ink",     k: "--papers",     glow: "rgba(242,135,0,.25)" },
    { id: "notes",      title: "Notes &amp; Slides",        tint: "--notes-tint",      ink: "--notes-ink",      k: "--notes",      glow: "rgba(105,139,57,.25)" },
    { id: "assignment", title: "Assignments &amp; Labs",    tint: "--assignment-tint", ink: "--assignment-ink", k: "--assignment", glow: "rgba(208,71,36,.25)" },
    { id: "reference",  title: "Reference Books",           tint: "--reference-tint",  ink: "--reference-ink",  k: "--reference",  glow: "rgba(140,101,151,.25)" },
  ];

  let stagedFiles = [];
  let currentKind = "papers";
  let creditOn = true;

  /* ============================================================
     Kind selector — points come from POINTS so the form can never
     advertise a score the leaderboard does not actually award
     ============================================================ */
  function renderKinds() {
    const host = document.getElementById("cgKindSelector");
    if (!host) return;
    host.innerHTML = KIND_META.map((m) => `
      <div class="cg-kind-opt${m.id === currentKind ? " on" : ""}" data-kind="${m.id}"
           style="--opt-k:var(${m.k});--opt-tint:var(${m.tint});--opt-ink:var(${m.ink});--opt-k-glow:${m.glow}">
        <div class="cg-kind-opt-head">
          <span class="cg-kind-opt-dot"></span>
          <span class="cg-kind-opt-pts">+${(typeof POINTS !== "undefined" && POINTS[m.id]) || 0} pts</span>
        </div>
        <span class="cg-kind-opt-title">${m.title}</span>
      </div>`).join("");

    host.querySelectorAll(".cg-kind-opt").forEach((opt) => {
      opt.addEventListener("click", () => {
        host.querySelectorAll(".cg-kind-opt").forEach((o) => o.classList.remove("on"));
        opt.classList.add("on");
        currentKind = opt.dataset.kind;
        paintDropzone();
      });
    });
    paintDropzone();
  }

  /* The drop area answers the kind you picked. Same four families as the
     folders on Archive, so the colour is learned by using it. */
  function paintDropzone() {
    const split = document.querySelector(".cg-intake-split");
    const m = KIND_META.find((x) => x.id === currentKind);
    if (!split || !m) return;
    split.style.setProperty("--dz", `var(${m.k})`);
    split.style.setProperty("--dz-tint", `var(${m.tint})`);
  }

  /* ============================================================
     Branch dropdowns + course registry autofill
     ============================================================ */
  function fillDepartments() {
    if (typeof DEPARTMENTS === "undefined") return;
    const opts = '<option value="">Select your department / branch…</option>' +
      DEPARTMENTS.map((d) => `<option value="${d.code}">${esc(d.name)}</option>`).join("");
    ["cgDept", "cgLinkDept"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = opts;
    });
  }

  /* Typing a known code fills the course name, so the same course does not
     enter the archive under three spellings. It never sets the branch — one
     course is taken by several branches (MA1010 is CS, MA1310 is MSME). */
  let COURSES = {};
  async function loadCourses() {
    try {
      const res = await fetch("courses.json", { cache: "no-cache" });
      if (res.ok) COURSES = await res.json();
    } catch { /* autofill is a convenience, not a requirement */ }

    const list = document.getElementById("cgCodeList");
    if (list) {
      list.innerHTML = Object.keys(COURSES).sort()
        .map((c) => `<option value="${c}">${esc(COURSES[c].name || "")}</option>`).join("");
    }

    const code = document.getElementById("cgCourseCode");
    const name = document.getElementById("cgCourseName");
    const prof = document.getElementById("cgProfessor");
    const semYear = document.getElementById("cgSemesterYear");
    const hint = document.getElementById("cgCodeHint");
    if (!code) return;
    code.addEventListener("input", () => {
      const key = code.value.trim().toUpperCase();
      const hit = COURSES[key];
      if (!hit) { if (hint) hint.hidden = true; return; }
      code.value = key;
      if (name && !name.value.trim()) name.value = hit.name || "";
      if (prof && !prof.value.trim() && Array.isArray(hit.professors) && hit.professors.length > 0) {
        prof.value = hit.professors.join(", ");
      }
      if (semYear && !semYear.value.trim() && hit.sem) {
        semYear.value = `Sem ${hit.sem} ${new Date().getFullYear()}`;
      }
      if (hint) {
        const semStr = hit.sem ? ` &middot; Sem ${hit.sem}` : "";
        const profStr = Array.isArray(hit.professors) && hit.professors.length > 0 ? ` &middot; Prof: ${hit.professors.join(", ")}` : "";
        hint.innerHTML = `Known course &mdash; <b>${esc(hit.name)}</b>${semStr}${profStr}`;
        hint.hidden = false;
      }
    });
  }

  /* ============================================================
     Dropzone
     ============================================================ */
  function initDropzone() {
    const dz = document.getElementById("cgDropzone");
    const input = document.getElementById("cgFileInput");
    const list = document.getElementById("cgFileList");
    if (!dz || !input) return;

    dz.addEventListener("click", () => input.click());
    ["dragenter", "dragover"].forEach((e) =>
      dz.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.add("drag-over"); }));
    ["dragleave", "drop"].forEach((e) =>
      dz.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.remove("drag-over"); }));

    dz.addEventListener("drop", (ev) => add([...ev.dataTransfer.files]));
    input.addEventListener("change", (ev) => { add([...ev.target.files]); input.value = ""; });

    /* Rejected here AND on the server. This check is for the person's
       benefit — a clear message now beats a confusing failure later. */
    function add(files) {
      files.forEach((f) => {
        const ext = (f.name.split(".").pop() || "").toLowerCase();
        if (!OK_TYPES.includes(ext)) return toast(`${f.name} is not a PDF or an image, so it can’t be accepted.`);
        if (f.size > MAX_BYTES) return toast(`${f.name} is over 25 MB.`);
        if (stagedFiles.some((s) => s.name === f.name && s.size === f.size)) return;
        stagedFiles.push(f);
      });
      render();
    }

    function render() {
      if (!list) return;
      list.innerHTML = stagedFiles.map((f, i) => `
        <div class="cg-file-item">
          <div class="cg-file-info">
            <div class="cg-file-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div style="min-width:0">
              <div class="cg-file-name">${esc(f.name)}</div>
              <div class="cg-file-meta">${size(f.size)} &middot; ready to send</div>
            </div>
          </div>
          <button type="button" class="cg-file-remove" data-i="${i}" title="Remove">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`).join("");
      list.querySelectorAll(".cg-file-remove").forEach((b) =>
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          stagedFiles.splice(+b.dataset.i, 1);
          render();
        }));
    }
    initDropzone.render = render;
  }

  function size(b) {
    return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
  }

  /* ============================================================
     Credit toggle + live preview
     ============================================================ */
  function initCredit() {
    const sw = document.getElementById("cgAttrSwitch");
    const fields = document.getElementById("cgAttrFields");
    const name = document.getElementById("cgContribName");
    const roll = document.getElementById("cgContribRoll");
    if (!sw || !fields) return;

    const flip = () => {
      creditOn = !creditOn;
      sw.classList.toggle("on", creditOn);
      sw.setAttribute("aria-checked", String(creditOn));
      fields.style.display = creditOn ? "grid" : "none";
    };
    sw.addEventListener("click", flip);
    sw.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
    });

    const update = () => {
      const n = (name.value || "").trim();
      const r = (roll.value || "").trim().toUpperCase();
      const pn = document.getElementById("cgPrevName");
      const pr = document.getElementById("cgPrevRoll");
      const pa = document.getElementById("cgPrevAvatar");
      if (pn) pn.textContent = n || "Your Name";
      // The board shows the batch, not the whole roll (see batchOf in
      // data.js) -- this chip is a preview of the board, so it matches.
      if (pr) pr.textContent = batchOf(r) || "BATCH";
      if (pa) pa.textContent = n
        ? n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
        : "YOU";
    };
    [name, roll].forEach((el) => el && el.addEventListener("input", update));
  }

  /* Scroll to intake form and focus course code */
  function prefillIntake() {
    document.querySelector('.cg-mode-btn[data-mode="files"]')?.click();
    const target = document.getElementById("intakeStudio");
    if (!target) return;
    if (window.__lenis) {
      window.__lenis.scrollTo(target, { offset: -84, duration: 1.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setTimeout(() => document.getElementById("cgCourseCode")?.focus(), 700);
  }

  /* ============================================================
     Mode tabs
     ============================================================ */
  function initModes() {
    const btns = document.querySelectorAll(".cg-mode-btn");
    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        btns.forEach((b) => { b.classList.remove("on"); b.setAttribute("aria-selected", "false"); });
        document.querySelectorAll(".cg-panel").forEach((p) => p.classList.remove("on"));
        btn.classList.add("on");
        btn.setAttribute("aria-selected", "true");
        document.getElementById(`cgPanel-${btn.dataset.mode}`)?.classList.add("on");
      });
    });
  }

  /* ============================================================
     Submit
     ============================================================ */
  function initSubmit() {
    const btn = document.getElementById("cgSubmitBtn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      const code = (document.getElementById("cgCourseCode").value || "").trim().toUpperCase();

      if (!stagedFiles.length) return toast("Add at least one file first.");
      if (!code) return toast("A course code is needed — it is how everything here is filed.");

      btn.disabled = true;
      const label = btn.innerHTML;
      btn.textContent = "Sending…";

      const semYearVal = (document.getElementById("cgSemesterYear")?.value || "").trim();
      const parsedYear = parseInt(semYearVal.replace(/\D/g, ""), 10) || new Date().getFullYear();
      const hit = COURSES[code];
      const dept = (hit && hit.branches && hit.branches[0]) || "";

      let sent = 0, failed = 0, reference = "";
      for (const file of stagedFiles) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("code", code);
        fd.append("department", dept);
        fd.append("course", (document.getElementById("cgCourseName")?.value || "").trim());
        fd.append("professor", (document.getElementById("cgProfessor")?.value || "").trim());
        fd.append("semester", semYearVal);
        fd.append("type", currentKind);
        fd.append("examType", (document.getElementById("cgExamType")?.value || "").trim());
        fd.append("year", parsedYear);
        if (creditOn) {
          fd.append("contributor", (document.getElementById("cgContribName")?.value || "").trim());
          fd.append("roll", (document.getElementById("cgContribRoll")?.value || "").trim().toUpperCase());
        }
        try {
          const res = await fetch(SUBMIT_ENDPOINT, { method: "POST", body: fd });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.ok) { sent++; reference = data.reference || reference; }
          else { failed++; toast(data.error || "That file could not be accepted."); }
        } catch {
          failed++;
        }
      }

      btn.disabled = false;
      btn.innerHTML = label;

      if (sent) {
        stagedFiles = [];
        initDropzone.render?.();
        toast(`Held for review${reference ? ` · ref ${reference}` : ""}. Nothing goes live until it is checked.`);
      } else if (failed) {
        toast("Could not reach the archive. The upload service may not be running yet.");
      }
    });

    document.getElementById("cgLinkSubmitBtn")?.addEventListener("click", () => {
      const url = (document.getElementById("cgLinkUrl").value || "").trim();
      if (!url) return toast("Paste the folder link first.");
      toast("Thanks — we’ll fetch the folder by hand and file what’s in it.");
    });
  }

  /* The closing sheet shows the real top three, scored the same way the
     leaderboard scores them, so the two pages can never disagree. */
  function renderTop3() {
    const host = document.getElementById("ctrTop3");
    if (!host) return;

    const contributors = globalThis.CONTRIBUTORS || [];
    const resources = globalThis.RESOURCES || [];

    const pts = typeof POINTS !== "undefined" ? POINTS : { papers: 10, assignment: 8, notes: 5, reference: 2 };
    const semStart = typeof SEMESTER_START !== "undefined" ? SEMESTER_START : "";
    const semLabel = typeof SEMESTER_LABEL !== "undefined" ? SEMESTER_LABEL : "This semester";

    let pool = resources.filter((r) => (r.added || "") >= semStart);
    let label = semLabel;
    if (!pool.length) { pool = resources; label = "All time"; }

    const tally = {};
    resources.forEach((r) => {
      if (!r.contributor) return;
      tally[r.contributor] = (tally[r.contributor] || 0) + (pts[r.type] || 0);
    });

    const rows = contributors
      .map((c) => ({ ...c, pts: tally[c.id] || 0 }))
      .filter((c) => c.pts > 0)
      .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name))
      .slice(0, 3);

    const lab = document.getElementById("ctrBoardLabel");
    if (lab) lab.textContent = label;

    if (!rows.length) {
      host.innerHTML = `<li class="ctr-lb-empty">No points awarded yet</li>`;
      return;
    }

    const medals = ["🥇", "🥈", "🥉"];
    host.innerHTML = rows.map((r, i) => `
      <li class="ctr-lb-row">
        <span class="ctr-lb-rank">${medals[i] || (i + 1)}</span>
        <div class="ctr-lb-user">
          <span class="ctr-lb-name">${esc(r.name)}</span>
          ${r.roll ? `<span class="ctr-lb-roll">${esc(r.roll)}</span>` : ""}
        </div>
        <span class="ctr-lb-pts">${r.pts} pts</span>
      </li>
    `).join("");

    const foot = document.getElementById("ctrBoardFoot");
    if (foot) {
      const total = Object.values(tally).reduce((a, b) => a + b, 0);
      foot.innerHTML = `<span>Campus tally</span><span><b>${total.toLocaleString()} pts</b> awarded</span>`;
    }
  }

  /* ============================================================
     Copy address
     ============================================================ */
  function initCopy() {
    const btn = document.getElementById("ctrCopy");
    const addr = document.getElementById("ctrAddr");
    if (!btn || !addr) return;
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(addr.textContent.trim());
        btn.textContent = "Copied";
        btn.classList.add("is-done");
        toast("Address copied.");
        setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("is-done"); }, 2200);
      } catch {
        toast("Press ⌘C to copy the address.");
      }
    });
  }

  /* ============================================================
     Shared bits
     ============================================================ */
  let toastTimer;
  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.offsetHeight;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => { el.hidden = true; }, 300);
    }, 3200);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function setupReveals() {
    const els = [...document.querySelectorAll(".reveal, .reveal-group")];
    const all = () => els.forEach((e) => e.classList.add("in"));
    if (!("IntersectionObserver" in window) ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return all();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    setTimeout(all, 3500);
  }

  /* the header CTA points at the form on this page */
  function initHeaderCta() {
    document.querySelectorAll(".btn-add").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.preventDefault();
        prefillIntake();
      }));
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await globalThis.ABHYAS_READY;
    renderKinds();
    fillDepartments();
    loadCourses();
    initDropzone();
    initCredit();
    initModes();
    initSubmit();
    renderTop3();
    initCopy();
    initHeaderCta();
    setupReveals();
  });
})();
