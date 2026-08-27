/* ------------------------------------------------------------
   Abhyas — admin console

   Two ways a resource goes live: the admin publishes something
   directly (Add resource — no review needed, they ARE the reviewer of
   their own upload), or a public submission from contribute.html sits
   in the Pending tab until an admin reviews and approves it. One
   dialog serves all three actions (Add / Edit / Review) — see
   setFooterButtons() below for how it tells them apart.

   Every server call goes through api(). USE_MOCK lets the console be
   judged with fake data before any PHP exists or is reachable; flip it
   to test against api/publish.php for real.
   ------------------------------------------------------------ */
(function () {
  "use strict";

  const USE_MOCK = false;
  const API = "../api/publish.php";

  /* ============================================================
     Course registry — one place a code maps to a name, read from the
     site's real courses.json instead of a small hardcoded sample list.
     Every known code autofills; only a genuinely new one needs typing
     once (add it to courses.json afterward and it autofills from then
     on for everyone).

     Note what it deliberately does NOT do: it never sets the branch.
     In this archive `department` means "which branch's students take
     this", and one course legitimately belongs to several — MA1010
     sits under CS while MA1310 sits under MSME. A fixed code->branch
     map would quietly move papers out of the branch whose students
     need them.
     ============================================================ */
  let COURSE_CATALOG = {};
  const courseRegistryReady = fetch("../courses.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : {}))
    .then((data) => {
      COURSE_CATALOG = data || {};
      document.getElementById("codeList").innerHTML =
        Object.keys(COURSE_CATALOG).sort().map((c) =>
          `<option value="${c}">${esc(COURSE_CATALOG[c].name)}</option>`).join("");
      // The Pending list's "New course" badge depends on this registry.
      // If the console already rendered once before this fetch resolved,
      // re-render now so nothing is stuck labelled "new" incorrectly.
      if (state.pending.length || state.items.length) renderList();
    })
    .catch(() => { COURSE_CATALOG = {}; });

  let state = {
    items: [], pending: [], trash: [], contributors: {}, current: null, mode: "add", tab: "pending",
    csrf: null, filter: "", filterKind: "all", filterDept: "all", filterYear: "all",
  };

  /* Same toast used site-wide (resource.js) — one visible confirmation
     per action instead of a wall of alert() boxes for things that
     aren't actually errors. */
  let toastTimer = null;
  function toast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    t.offsetHeight;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => { t.hidden = true; }, 300);
    }, 2600);
  }

  function contributorName(id) {
    if (!id) return "no credit";
    return state.contributors[id]?.name || id;
  }

  /* ============================================================
     Server calls — one seam. `publish` sends multipart/form-data
     (it carries a file); everything else sends JSON. Both carry the
     CSRF token issued at login — a session cookie alone doesn't stop
     a forged request from another tab from riding the same session.
     ============================================================ */
  async function api(action, payload) {
    if (USE_MOCK) return mockApi(action, payload);
    const isForm = payload instanceof FormData;
    if (isForm && state.csrf) payload.append("csrf", state.csrf);
    if (!isForm && payload && state.csrf) payload.csrf = state.csrf;

    const res = await fetch(`${API}?action=${encodeURIComponent(action)}`, {
      method: payload ? "POST" : "GET",
      headers: isForm || !payload ? undefined : { "Content-Type": "application/json" },
      body: isForm ? payload : payload ? JSON.stringify(payload) : undefined,
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({ ok: false, error: `${action} failed (${res.status})` }));
    /* A 401 means two different things depending on who asked: for
       `login` itself it's just "wrong password" — show that, don't treat
       it as a lost session (we're already on the login screen). For
       every other action it means the session expired mid-console. */
    if (res.status === 401 && action !== "login") { showLogin(); throw new Error(data.error || "Session expired — please sign in again"); }
    if (!res.ok && res.status !== 409) throw new Error(data.error || `${action} failed (${res.status})`);
    return data;
  }

  /* ============================================================
     Login
     ============================================================ */
  function showLogin() {
    document.getElementById("loginWrap").hidden = false;
    document.getElementById("console").hidden = true;
  }
  function showConsole() {
    document.getElementById("loginWrap").hidden = true;
    document.getElementById("console").hidden = false;
  }

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("loginErr");
    err.hidden = true;
    try {
      const r = await api("login", { password: document.getElementById("pw").value });
      if (!r.ok) throw new Error(r.error || "Wrong password");
      document.getElementById("pw").value = "";
      state.csrf = r.csrf || null;
      showConsole();
      document.getElementById("who").textContent = r.user || "signed in";
      loadList();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });

  document.getElementById("logout").addEventListener("click", async () => {
    await api("logout").catch(() => {});
    state.csrf = null;
    showLogin();
  });

  /* On a page reload, the session cookie may still be good even though
     `state.csrf` (in-memory only) is gone — ask the server instead of
     forcing a re-login. */
  (async function tryResume() {
    if (USE_MOCK) return;
    try {
      const r = await api("me");
      if (r.ok) {
        state.csrf = r.csrf;
        showConsole();
        document.getElementById("who").textContent = r.user || "signed in";
        loadList();
      }
    } catch { /* not signed in — leave the login form showing */ }
  })();

  /* ============================================================
     List
     ============================================================ */
  async function loadList() {
    /* This is called fire-and-forget from several places (after login,
       after publish/edit/delete) without the caller awaiting or catching
       it. A silent failure here previously meant the dashboard just sat
       at stale numbers with zero indication anything went wrong — this
       is what makes that impossible to miss again. */
    let data;
    try {
      data = await api("list");
    } catch (ex) {
      alert(`Couldn't refresh the list: ${ex.message}`);
      return;
    }
    state.items = data.items || [];
    state.pending = data.pending || [];
    state.trash = data.trash || [];
    state.contributors = data.contributors || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("sPublished", data.counts.published);
    set("sContrib", data.counts.contributors ?? 0);
    set("sPending", data.counts.pending ?? 0);
    set("cPending", data.counts.pending ?? 0);
    set("cPublished", data.counts.published);
    set("cTrash", data.counts.trash ?? 0);
    populateFilterOptions();
    renderList();
  }

  /* Branch options come from the site's own DEPARTMENTS list (data.js) —
     every branch, not just ones with a resource yet. Year options come
     from whatever years actually exist in the data, since there's no
     fixed registry for that the way there is for branches. */
  function populateFilterOptions() {
    const deptSel = document.getElementById("filterDept");
    if (deptSel.options.length <= 1 && typeof DEPARTMENTS !== "undefined") {
      deptSel.innerHTML = `<option value="all">Branch: All</option>` +
        DEPARTMENTS.map((d) => `<option value="${esc(d.code)}">${esc(d.code)}</option>`).join("");
    }
    const years = new Set([...state.items, ...state.pending].map((i) => i.year).filter(Boolean));
    const yearSel = document.getElementById("filterYear");
    const current = yearSel.value;
    yearSel.innerHTML = `<option value="all">Year: All</option>` +
      [...years].sort((a, b) => b - a).map((y) => `<option value="${y}">${esc(academicYear(y))}</option>`).join("");
    yearSel.value = [...years].map(String).includes(current) ? current : "all";
  }

  function renderList() {
    const host = document.getElementById("queue");
    const q = state.filter.trim().toLowerCase();
    const onPending = state.tab === "pending";
    const onTrash = state.tab === "trash";
    const source = onPending ? state.pending : onTrash ? state.trash : state.items;
    const rows = source
      .filter((i) => state.filterKind === "all" || i.type === state.filterKind)
      .filter((i) => state.filterDept === "all" || i.department === state.filterDept)
      .filter((i) => state.filterYear === "all" || String(i.year) === state.filterYear)
      .filter((i) => !q ||
        [i.title, i.course, i.code, i.filename, contributorName(i.contributor)].some((f) => String(f || "").toLowerCase().includes(q)));

    if (!rows.length) {
      const empty = onPending ? "Nothing waiting for review" : onTrash ? "Trash is empty" : "Nothing here yet";
      const sub = source.length ? "Try a different search." : (onPending
        ? "Submissions from the Contribute page will show up here."
        : onTrash ? "Deleted resources sit here for 14 days before they're gone for good."
        : "Click “Add resource” to publish the first file.");
      host.innerHTML = `<div class="ad-empty"><b>${source.length ? "No matches" : empty}</b><span>${sub}</span></div>`;
      return;
    }

    if (onPending) {
      host.innerHTML = rows.map((it) => {
        const isNewCourse = it.code && !COURSE_CATALOG[it.code.toUpperCase()];
        return `
        <div class="ad-card k-${esc(it.type)}">
          <div class="ad-fileicon">PDF</div>
          <div class="ad-cardmain">
            <p class="ad-cardtitle">${esc(it.course || it.filename || "Untitled")}</p>
            <div class="ad-cardmeta">
              <span class="ad-kind">${esc(labelOf(it.type))}</span>
              <span>${esc(it.code || "no code")}</span>
              <span>${esc(it.contributor || "no credit given")}</span>
              <span>${esc(it.sizeLabel || "")}</span>
              ${isNewCourse ? `<span class="ad-newtag">New course</span>` : ""}
              ${it.duplicateOf ? `<span class="ad-dupe">possible duplicate</span>` : ""}
            </div>
          </div>
          <div class="ad-card-actions">
            <button class="ad-review-btn" type="button" data-id="${esc(it.id)}">Review</button>
          </div>
        </div>`;
      }).join("");
      host.querySelectorAll(".ad-review-btn").forEach((b) => {
        b.addEventListener("click", () => openReview(b.dataset.id));
      });
      return;
    }

    if (onTrash) {
      host.innerHTML = rows.map((it) => `
        <div class="ad-card k-${esc(it.type)}">
          <div class="ad-fileicon">PDF</div>
          <div class="ad-cardmain">
            <p class="ad-cardtitle">${esc(it.title || it.course || "Untitled")}</p>
            <div class="ad-cardmeta">
              <span class="ad-kind">${esc(labelOf(it.type))}</span>
              <span>${esc(it.code || "no code")}</span>
              <span>${esc(contributorName(it.contributor))}</span>
              <span>${esc(daysLeft(it.deletedAt))} left</span>
            </div>
          </div>
          <div class="ad-card-actions">
            <button class="ad-review-btn" type="button" data-id="${esc(it.id)}">Restore</button>
          </div>
        </div>`).join("");
      host.querySelectorAll(".ad-review-btn").forEach((b) => {
        b.addEventListener("click", () => doRestore(b.dataset.id));
      });
      return;
    }

    host.innerHTML = rows.map((it) => `
      <div class="ad-card k-${esc(it.type)}">
        <div class="ad-fileicon">PDF</div>
        <div class="ad-cardmain">
          <p class="ad-cardtitle">${esc(it.title || it.course || "Untitled")}</p>
          <div class="ad-cardmeta">
            <span class="ad-kind">${esc(labelOf(it.type))}</span>
            <span>${esc(it.code || "no code")}</span>
            <span>${esc(contributorName(it.contributor))}</span>
            <span>${esc(it.added || "")}</span>
          </div>
        </div>
        <div class="ad-card-actions">
          <button class="ad-edit-btn" type="button" data-id="${esc(it.id)}">Edit</button>
          <button class="ad-delete-btn" type="button" data-id="${esc(it.id)}">Delete</button>
        </div>
      </div>`).join("");

    host.querySelectorAll(".ad-edit-btn").forEach((b) => {
      b.addEventListener("click", () => openEdit(b.dataset.id));
    });
    host.querySelectorAll(".ad-delete-btn").forEach((b) => {
      b.addEventListener("click", () => doDelete(b.dataset.id));
    });
  }

  document.querySelectorAll("#tabs .ad-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.tab = tab.dataset.tab;
      document.querySelectorAll("#tabs .ad-tab").forEach((t) => t.classList.toggle("on", t === tab));
      renderList();
    });
  });

  document.querySelectorAll("#filterBar [data-kind]").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#filterBar [data-kind]").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      state.filterKind = b.dataset.kind;
      renderList();
    });
  });
  document.getElementById("filterDept").addEventListener("change", (e) => {
    state.filterDept = e.target.value;
    renderList();
  });
  document.getElementById("filterYear").addEventListener("change", (e) => {
    state.filterYear = e.target.value;
    renderList();
  });

  function labelOf(t) {
    return { papers: "Past paper", notes: "Notes", assignment: "Assignment", reference: "Reference" }[t] || t;
  }

  document.getElementById("search").addEventListener("input", (e) => {
    state.filter = e.target.value;
    renderList();
  });

  /* ============================================================
     Add / edit panel
     ============================================================ */
  let previewUrl = null; // revoke the previous blob: URL before making a new one

  function resetForm() {
    ["fCode", "fCourse", "fExam", "fTitle", "fProf", "fContrib", "fRoll",
     "fBookTitle", "fBookAuthor", "fBookPublisher", "fBookGist", "fBookLink", "fBookPages"]
      .forEach((id) => { document.getElementById(id).value = ""; });
    document.getElementById("fType").value = "papers";
    fillYears(null);
    document.getElementById("fBookCover").value = "ink";
    document.getElementById("fFile").value = "";
    document.getElementById("codeHint").hidden = true;
    document.getElementById("dupeWarn").hidden = true;
    document.getElementById("submissionInfo").hidden = true;
    deptTouched = false; // let the next code typed autofill branch again
    syncBookFields();
  }

  /* The title shown on the card, the resource page and search is normally
     DERIVED from the course name and exam type, not typed. Keeping it
     derived is what makes "fix the course name" fix the title everywhere
     as well -- before this, editing the course left a stale title behind,
     which read exactly like Save doing nothing. Typing in the field
     overrides it (record.titleCustom); clearing the field hands it back.
     Must stay in step with build_record()/auto_title() in api/publish.php. */
  function autoTitle() {
    const course = document.getElementById("fCourse").value.trim();
    const type = document.getElementById("fType").value;
    if (type === "reference") {
      const bt = document.getElementById("fBookTitle").value.trim();
      return bt ? `${bt} — Reference Book` : "";
    }
    const exam = document.getElementById("fExam").value.trim();
    return course ? `${course} — ${exam || labelOf(type)}` : "";
  }
  function syncTitlePlaceholder() {
    const auto = autoTitle();
    document.getElementById("fTitle").placeholder = auto || "Built from the course name";
    const custom = document.getElementById("fTitle").value.trim();
    // The greyed-out placeholder already shows what the automatic title
    // would be -- the hint only has to say which of the two is in force.
    document.getElementById("titleHint").textContent = custom
      ? "Custom title — clear this field to go back to the automatic one."
      : "Building itself from the course name and exam type. Type here to override.";
  }
  ["fCourse", "fExam", "fType", "fTitle", "fBookTitle"].forEach((id) => {
    document.getElementById(id).addEventListener("input", syncTitlePlaceholder);
    document.getElementById(id).addEventListener("change", syncTitlePlaceholder);
  });

  /* Three modes share one dialog: add (blank), edit (an already-published
     resource), review (a pending submission awaiting approve/reject).
     Each just shows/hides the same fields and swaps the footer buttons —
     there's no reason to build three separate dialogs for what's really
     one form with different starting data and a different save action. */
  function setFooterButtons(mode) {
    document.getElementById("btnDelete").hidden = mode !== "edit";
    document.getElementById("btnReject").hidden = mode !== "review";
    document.getElementById("btnSave").textContent =
      mode === "edit" ? "Save changes" : mode === "review" ? "Approve & publish" : "Publish";
  }

  function openAdd() {
    state.current = null;
    state.mode = "add";
    resetForm();
    fillDepts(null);
    document.getElementById("revTitle").textContent = "Add resource";
    document.getElementById("fileField").hidden = false;
    setFooterButtons("add");
    document.getElementById("pdfPane").innerHTML = `<div class="ad-pdf-stub">Pick a PDF to preview it here &mdash; nothing uploads until you click Publish.</div>`;
    syncTitlePlaceholder();
    openPanel();
  }

  function openEdit(id) {
    const it = state.items.find((x) => x.id === id);
    if (!it) return;
    state.current = it;
    state.mode = "edit";
    resetForm();

    document.getElementById("revTitle").textContent = "Edit resource";
    document.getElementById("fileField").hidden = true; // the file itself isn't replaceable from here
    setFooterButtons("edit");

    document.getElementById("fCode").value = it.code || "";
    document.getElementById("fCourse").value = it.course || "";
    document.getElementById("fType").value = it.type || "papers";
    fillYears(it.year);
    document.getElementById("fExam").value = it.examType || "";
    document.getElementById("fProf").value = it.professor || "";
    document.getElementById("fContrib").value = it.contributor ? contributorName(it.contributor) : "";
    /* The batch lives on the contributor registry entry, not on the
       resource -- `it.roll` has never existed on a published record, so
       this field came up blank on every edit and saving it blanked
       nothing back. Read it from the same registry the name comes from. */
    document.getElementById("fRoll").value = state.contributors[it.contributor]?.roll || "";
    fillDepts(it.department);
    // Only a deliberately overridden title goes in the box; an automatic
    // one stays automatic so it keeps tracking the course name.
    document.getElementById("fTitle").value = it.titleCustom ? (it.title || "") : "";
    // The book's own title, not the record's generated one — strip the
    // " — Reference Book/Guide" suffix build_record() appends, same regex
    // books.js's title() uses to show it clean everywhere else.
    document.getElementById("fBookTitle").value = (it.title || "").replace(/\s+[—–-]\s+Reference (Book|Guide)$/i, "");
    document.getElementById("fBookAuthor").value = it.book?.author || "";
    document.getElementById("fBookPublisher").value = it.book?.publisher || "";
    document.getElementById("fBookCover").value = it.book?.cover || "ink";
    document.getElementById("fBookGist").value = it.book?.gist || "";
    document.getElementById("fBookLink").value = it.book?.link || "";
    document.getElementById("fBookPages").value = it.pages || "";
    syncBookFields();
    syncTitlePlaceholder();

    /* Same viewer the public site uses — pointed at the file already live,
       not a blob: URL, since there's nothing local to preview here. */
    const pane = document.getElementById("pdfPane");
    const fileUrl = it.file ? new URL(`../api/file.php?path=${encodeURIComponent(it.file)}`, window.location.href).href : null;
    pane.innerHTML = fileUrl
      ? `<iframe src="../assets/pdfjs/web/viewer.html?file=${encodeURIComponent(fileUrl)}" title="Preview"></iframe>`
      : `<div class="ad-pdf-stub">No file on record for this entry.</div>`;

    openPanel();
  }

  function openReview(id) {
    const it = state.pending.find((x) => x.id === id);
    if (!it) return;
    state.current = it;
    state.mode = "review";
    resetForm();

    document.getElementById("revTitle").textContent = "Review submission";
    document.getElementById("fileField").hidden = true; // the file is already uploaded — nothing to pick here
    setFooterButtons("review");

    // The student's fields are a SUGGESTION — every one of them is
    // editable before approving, same as any typo in a direct upload.
    document.getElementById("fCode").value = it.code || "";
    document.getElementById("fCourse").value = it.course || "";
    document.getElementById("fType").value = it.type || "papers";
    fillYears(it.year);
    document.getElementById("fExam").value = it.examType || "";
    document.getElementById("fProf").value = it.professor || "";
    document.getElementById("fContrib").value = it.contributor || "";
    document.getElementById("fRoll").value = it.roll || "";
    fillDepts(it.department || null);
    syncBookFields();
    syncTitlePlaceholder();

    const info = document.getElementById("submissionInfo");
    const bits = [`Uploaded as "${it.filename || "unnamed file"}"`, it.sizeLabel, it.submitted ? new Date(it.submitted).toLocaleString() : null];
    if (it.semesterHint) bits.push(`suggested: ${it.semesterHint}`);
    info.textContent = bits.filter(Boolean).join(" · ");
    info.hidden = false;

    const warn = document.getElementById("dupeWarn");
    warn.hidden = !it.duplicateOf;
    if (it.duplicateOf) {
      warn.textContent = `This looks byte-for-byte identical to ${it.duplicateOf}. Approving it publishes a second copy — check before you do.`;
    }

    // Pending files are never on the public web (api/submit.php) — this
    // authenticated stream is the only way to see one before deciding.
    // Must be an ABSOLUTE url: PDF.js resolves a relative `file` param
    // against the viewer's OWN location (assets/pdfjs/web/), not this
    // page's — same bug already caught once in openEdit above.
    const pane = document.getElementById("pdfPane");
    const previewSrc = new URL(`${API}?action=preview_pending&id=${encodeURIComponent(it.id)}`, window.location.href).href;
    pane.innerHTML = `<iframe src="../assets/pdfjs/web/viewer.html?file=${encodeURIComponent(previewSrc)}" title="Preview"></iframe>`;

    openPanel();
  }

  function openPanel() {
    document.getElementById("review").classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closePanel() {
    document.getElementById("review").classList.remove("open");
    document.getElementById("pdfPane").innerHTML = "";
    document.body.style.overflow = "";
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    pendingForceRetry = null;
    state.current = null;
  }
  document.getElementById("btnAdd").addEventListener("click", openAdd);
  document.getElementById("revClose").addEventListener("click", closePanel);
  document.getElementById("reviewBack").addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("review").classList.contains("open")) closePanel();
  });

  /* Picking a file previews it entirely client-side — nothing is sent to
     the server until Publish is clicked. A blob: URL is same-origin, so
     PDF.js's viewer (loaded from this same site) can render it directly. */
  document.getElementById("fFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    const pane = document.getElementById("pdfPane");
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    pendingForceRetry = null;
    document.getElementById("dupeWarn").hidden = true;
    if (!file) {
      pane.innerHTML = `<div class="ad-pdf-stub">Pick a PDF to preview it here &mdash; nothing uploads until you click Publish.</div>`;
      return;
    }
    previewUrl = URL.createObjectURL(file);
    pane.innerHTML = `<iframe src="../assets/pdfjs/web/viewer.html?file=${encodeURIComponent(previewUrl)}" title="Preview"></iframe>`;
  });

  /* Reference is the only type that needs the book payload — show those
     fields only when they apply, but never let a book be filed without them.
     It's also the only type where the PDF field becomes optional: a
     reference book is a pointer to something students can find themselves,
     not a copy of it, so it takes a link instead of a file when there
     isn't one. */
  function syncBookFields() {
    const isBook = document.getElementById("fType").value === "reference";
    document.getElementById("bookFields").hidden = !isBook;
    // A reference book's title is the book's own title (books.js depends on
    // the " — Reference Book" suffix), so there's nothing to override here.
    document.getElementById("titleField").hidden = isBook;
    document.getElementById("titleHint").hidden = isBook;
    document.getElementById("fileFieldLabel").textContent = isBook ? "PDF file (optional)" : "PDF file";
    document.getElementById("noFileHint").hidden = !isBook;
  }
  document.getElementById("fType").addEventListener("change", syncBookFields);

  /* GEN ("General / Open Elective") sits at the top, apart from the real
     branches: for a course several branches take, picking one of them is
     not a smaller mistake than picking none -- it is the CY1010-filed-
     under-IC bug waiting to happen again. Nothing on the public site
     filters the archive by this field (app.js groups by course), so GEN
     costs nothing beyond being honest. */
  /* Academic years, newest first, back far enough to cover anything worth
     archiving. The label is the span ("2025-26"); the value is the start
     year, which is what the record, the id and the filename all carry.
     Defaults to the session in progress -- terms start around July, so
     before then "this year" is still the one that began last calendar
     year. A record whose stored year predates the list keeps its own
     option rather than being silently snapped to another year. */
  function fillYears(selected) {
    const sel = document.getElementById("fYear");
    const now = new Date();
    const current = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const years = [];
    for (let y = current; y >= current - 14; y--) years.push(y);
    const chosen = Number(selected) || current;
    if (!years.includes(chosen)) years.push(chosen);
    years.sort((a, b) => b - a);
    sel.innerHTML = years.map((y) =>
      `<option value="${y}"${y === chosen ? " selected" : ""}>${esc(academicYear(y))}</option>`).join("");
  }

  function fillDepts(selected) {
    const sel = document.getElementById("fDept");
    const branches = DEPARTMENTS.filter((d) => !d.elective);
    const general = DEPARTMENTS.filter((d) => d.elective);
    const opt = (d) => `<option value="${esc(d.code)}"${d.code === selected ? " selected" : ""}>${esc(d.code)} — ${esc(d.short)}</option>`;
    sel.innerHTML = general.map(opt).join("") +
      `<option disabled>──────────</option>` +
      branches.map(opt).join("");
    /* Anything we can't place -- a blank Add form, or a stored branch that
       is no longer in the list -- keeps the first option, GEN. "Not
       attributed to a branch" is the honest answer there; whichever branch
       happens to sort first alphabetically is not. Typing a known course
       code corrects it a moment later anyway. */
    if (selected && [...sel.options].some((o) => o.value === selected)) sel.value = selected;
  }

  /* Auto-fill from the registry: name, professors, AND branch — keyed to
     the exact code, never guessed from its prefix. That distinction
     matters: MA1010 and MA1310 share a prefix but sit under different
     branches (CS and MSME respectively) in courses.json, which is
     exactly why a prefix-based guess would get one of them wrong. This
     is safe because it's a per-code lookup in the same registry the
     name autofill already trusts, not a pattern match on the code
     itself. */
  let deptTouched = false;
  document.getElementById("fDept").addEventListener("change", () => { deptTouched = true; });

  const codeInput = document.getElementById("fCode");
  codeInput.addEventListener("input", () => {
    const code = codeInput.value.trim().toUpperCase();
    const hit = COURSE_CATALOG[code];
    const hint = document.getElementById("codeHint");
    if (!hit) { hint.hidden = true; return; }
    codeInput.value = code;
    const course = document.getElementById("fCourse");
    const prof = document.getElementById("fProf");
    const dept = document.getElementById("fDept");
    if (!course.value.trim()) course.value = hit.name;
    if (!prof.value.trim() && hit.professors?.length) prof.value = hit.professors.join(", ");
    /* A course registered to more than one branch is an open elective:
       there IS no single owning branch, so offer GEN rather than the
       arbitrary first entry in its branches list. Still only a default --
       touching the dropdown yourself always wins. */
    const isElective = (hit.branches?.length || 0) > 1;
    if (!deptTouched) {
      if (isElective) dept.value = "GEN";
      else if (hit.branches?.length) dept.value = hit.branches[0];
    }
    hint.textContent = isElective
      ? `Known course — ${hit.name} · open elective (${hit.branches.length} branches), filed as General`
      : `Known course — ${hit.name}`;
    hint.hidden = false;
  });

  /* Batch is a property of the person, not of the upload, and it is
     already on record for anyone who has contributed before -- so once
     the name matches a known contributor, fill their batch in rather
     than making it be retyped (and risk a second spelling of the same
     person's roll). Only ever fills a blank box: a batch typed by hand
     is a correction, and match_or_create_contributor() writes it back to
     the registry. */
  const contribInput = document.getElementById("fContrib");
  contribInput.addEventListener("input", () => {
    const typed = contribInput.value.trim().toLowerCase();
    if (!typed) return;
    const hit = Object.values(state.contributors)
      .find((p) => String(p.name || "").trim().toLowerCase() === typed);
    const rollBox = document.getElementById("fRoll");
    if (hit?.roll && !rollBox.value.trim()) rollBox.value = hit.roll;
  });

  function readForm() {
    return {
      code: document.getElementById("fCode").value.trim().toUpperCase(),
      course: document.getElementById("fCourse").value.trim(),
      department: document.getElementById("fDept").value,
      type: document.getElementById("fType").value,
      year: document.getElementById("fYear").value || "",
      examType: document.getElementById("fExam").value.trim(),
      // Empty means "keep deriving it" -- the server regenerates on every
      // save, so a corrected course name corrects the title with it.
      title: document.getElementById("fTitle").value.trim(),
      professor: document.getElementById("fProf").value.trim(),
      contributor: document.getElementById("fContrib").value.trim(),
      roll: document.getElementById("fRoll").value.trim().toUpperCase(),
      bookTitle: document.getElementById("fBookTitle").value.trim(),
      bookAuthor: document.getElementById("fBookAuthor").value.trim(),
      bookPublisher: document.getElementById("fBookPublisher").value.trim(),
      bookCover: document.getElementById("fBookCover").value,
      bookGist: document.getElementById("fBookGist").value.trim(),
      bookLink: document.getElementById("fBookLink").value.trim(),
      pages: document.getElementById("fBookPages").value || "",
    };
  }

  /* Set once a publish attempt comes back "this looks like a duplicate" —
     clicking Publish again resubmits the SAME file with force:1 attached,
     rather than making the admin re-pick it. Cleared on any successful
     save, any panel close, and any fresh file pick. */
  /* Set once a publish/approve attempt comes back "this looks like a
     duplicate" — clicking the button again resubmits the SAME payload
     with force:1 attached, rather than making the admin redo the form.
     Cleared on success, panel close, or (for add mode) a fresh file pick. */
  let pendingForceRetry = null; // { action: "publish" | "approve", payload }

  function offerDupeRetry(action, payload, error, verb) {
    const warn = document.getElementById("dupeWarn");
    warn.hidden = false;
    warn.textContent = `${error} Click ${verb} again to confirm.`;
    pendingForceRetry = { action, payload };
  }

  document.getElementById("btnSave").addEventListener("click", async () => {
    const f = readForm();
    if (!f.code || !f.course || !f.department) {
      alert("Course code, name, and branch are required.");
      return;
    }
    if (f.type === "reference" && !f.bookAuthor) {
      alert("A reference book needs an author, or the Bookshelf cannot render it.");
      return;
    }
    if (f.type === "reference" && !f.bookTitle) {
      alert("A reference book needs its own title — the course name isn't the book's name.");
      return;
    }
    const fileForAdd = state.mode === "add" ? document.getElementById("fFile").files[0] : null;
    if (f.type === "reference" && !fileForAdd && !f.bookLink) {
      alert("A reference book needs either a file or a link to find it online.");
      return;
    }

    try {
      let successMsg = "Saved.";
      if (pendingForceRetry) {
        const { action, payload } = pendingForceRetry;
        pendingForceRetry = null;
        const r = await api(action, payload);
        if (!r.ok) throw new Error(r.error || "Failed");
        successMsg = action === "approve" ? "Approved and published." : "Published.";
      } else if (state.mode === "edit") {
        const r = await api("edit", { id: state.current.id, ...f });
        if (!r.ok) throw new Error(r.error || "Couldn't save those changes");
        successMsg = "Changes saved.";
      } else if (state.mode === "review") {
        const payload = { id: state.current.id, ...f };
        const r = await api("approve", payload);
        if (!r.ok && r.error && /identical/i.test(r.error)) {
          offerDupeRetry("approve", { ...payload, force: 1 }, r.error, "Approve");
          return;
        }
        if (!r.ok) throw new Error(r.error || "Approve failed");
        successMsg = "Approved and published.";
      } else { // add
        const file = document.getElementById("fFile").files[0];
        if (!file && f.type !== "reference") { alert("Pick a PDF first."); return; }
        const fd = new FormData();
        if (file) fd.append("file", file);
        Object.entries(f).forEach(([k, v]) => fd.append(k, v));
        const r = await api("publish", fd);
        if (!r.ok && r.error && /identical/i.test(r.error)) {
          fd.append("force", "1");
          offerDupeRetry("publish", fd, r.error, "Publish");
          return;
        }
        if (!r.ok) throw new Error(r.error || "Publish failed");
        successMsg = "Published.";
      }
      pendingForceRetry = null;
      closePanel();
      loadList();
      toast(successMsg);
    } catch (ex) {
      alert(ex.message);
    }
  });

  async function doDelete(id) {
    const it = state.items.find((x) => x.id === id);
    if (!it) return;
    if (!confirm(`Remove "${it.title}" from the archive listing?\n\nIt moves to Trash for 14 days (restorable there), then drops for good. The PDF file itself is never touched — it stays on disk regardless.`)) return;
    await api("delete", { id });
    loadList();
    toast(`Moved "${it.title}" to Trash.`);
  }
  document.getElementById("btnDelete").addEventListener("click", () => {
    if (state.current) { doDelete(state.current.id); closePanel(); }
  });

  async function doReject(id) {
    const it = state.pending.find((x) => x.id === id);
    if (!it) return;
    const reason = prompt("Reason for rejecting? (kept for your own records, not shown to the student)") ?? "";
    await api("reject", { id, reason });
    loadList();
    toast("Rejected.");
  }
  document.getElementById("btnReject").addEventListener("click", () => {
    if (state.current) { doReject(state.current.id); closePanel(); }
  });

  /* No cron on shared hosting — the server purges anything past 14 days
     the next time the console loads (see purge_trash() in publish.php),
     not on a schedule. This is just the countdown shown here. */
  function daysLeft(deletedAt) {
    if (!deletedAt) return "?";
    const elapsed = (Date.now() - new Date(deletedAt).getTime()) / 86400000;
    return Math.max(0, Math.ceil(14 - elapsed)) + "d";
  }

  async function doRestore(id) {
    await api("restore", { id });
    loadList();
    toast("Restored.");
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  /* codeList is populated once courseRegistryReady resolves, above */

  /* ============================================================
     MOCK — delete once api/publish.php is live
     ============================================================ */
  const mockContributors = {
    c1: { name: "Aarav Menon", roll: "CS23" },
    c2: { name: "Rohan Iyer", roll: "MS24" },
  };
  let mockItems = [
    { id: "cs2110-2024-endsem", status: "published", title: "Algorithms — End-Sem", filename: "algo.pdf",
      code: "CS2110", course: "Design and Analysis of Algorithms", department: "CS", type: "papers",
      year: 2024, examType: "End-Sem", professor: "", contributor: "c1", roll: "CS23",
      added: "2026-08-20", file: null },
    { id: "cy1120-2024-quiz", status: "published", title: "Materials Chemistry — Quiz", filename: "quiz2.pdf",
      code: "CY1120", course: "Materials Chemistry", department: "MSME", type: "papers",
      year: 2024, examType: "Quiz", professor: "Atul Deshpande", contributor: "c2", roll: "MS24",
      added: "2026-08-18", file: null },
  ];
  let mockPending = [
    { id: "a3f9c1b8e2d4f7a1", status: "pending", filename: "midsem_scan.pdf", sizeLabel: "3.4 MB",
      submitted: "2026-08-26T10:00:00", code: "CS2110", course: "", department: "", type: "papers",
      year: 2024, examType: "Mid-Sem", professor: "", contributor: "Aarav Menon", roll: "CS23",
      semesterHint: "Sem 4 2024", duplicateOf: null },
    { id: "b81e40c3d5f6a9b2", status: "pending", filename: "IMG_20260821.pdf", sizeLabel: "11.2 MB",
      submitted: "2026-08-26T05:00:00", code: "ME2210", course: "Fluid Mechanics", department: "ME", type: "notes",
      year: 2026, examType: "", professor: "", contributor: "", roll: "",
      semesterHint: "Sem 4 2026", duplicateOf: null },
  ];
  let mockTrash = [];

  async function mockApi(action, payload) {
    await new Promise((r) => setTimeout(r, 160));
    if (action === "login") {
      return payload.password === "demo"
        ? { ok: true, user: "admin", csrf: "mock-csrf" }
        : { ok: false, error: "Wrong password. (Mock password is: demo)" };
    }
    if (action === "logout") return { ok: true };
    if (action === "list") {
      return {
        ok: true,
        items: mockItems,
        pending: mockPending,
        trash: mockTrash,
        contributors: mockContributors,
        counts: {
          published: mockItems.length,
          contributors: new Set(mockItems.filter((i) => i.contributor).map((i) => i.contributor)).size,
          pending: mockPending.length,
          trash: mockTrash.length,
        },
      };
    }
    if (action === "publish") {
      const id = (payload.get("code") || "new").toLowerCase() + "-" + (payload.get("year") || "0000");
      mockItems.push({
        id, status: "published", title: `${payload.get("course")} — ${payload.get("examType") || payload.get("type")}`,
        code: payload.get("code"), course: payload.get("course"), department: payload.get("department"),
        type: payload.get("type"), year: Number(payload.get("year")) || null,
        examType: payload.get("examType"), professor: payload.get("professor") || "—",
        contributor: payload.get("contributor") || null, roll: payload.get("roll"), added: new Date().toISOString().slice(0, 10),
        file: null,
      });
      return { ok: true, id };
    }
    if (action === "edit") {
      const it = mockItems.find((x) => x.id === payload.id);
      if (it) Object.assign(it, payload);
      return { ok: true };
    }
    if (action === "delete") {
      const it = mockItems.find((x) => x.id === payload.id);
      mockItems = mockItems.filter((x) => x.id !== payload.id);
      if (it) mockTrash.push({ ...it, deletedAt: new Date().toISOString() });
      return { ok: true };
    }
    if (action === "restore") {
      const it = mockTrash.find((x) => x.id === payload.id);
      mockTrash = mockTrash.filter((x) => x.id !== payload.id);
      if (it) { delete it.deletedAt; mockItems.push(it); }
      return { ok: true };
    }
    if (action === "approve") {
      const sub = mockPending.find((x) => x.id === payload.id);
      if (!sub) return { ok: false, error: "That submission is gone" };
      const id = (payload.code || "new").toLowerCase() + "-" + (payload.year || "0000");
      mockItems.push({
        id, status: "published", title: `${payload.course} — ${payload.examType || payload.type}`,
        code: payload.code, course: payload.course, department: payload.department, type: payload.type,
        year: Number(payload.year) || null, examType: payload.examType, professor: payload.professor || "—",
        contributor: payload.contributor || null, roll: payload.roll, added: new Date().toISOString().slice(0, 10),
        file: null,
      });
      mockPending = mockPending.filter((x) => x.id !== payload.id);
      return { ok: true, id };
    }
    if (action === "reject") {
      mockPending = mockPending.filter((x) => x.id !== payload.id);
      return { ok: true };
    }
    return { ok: false };
  }

  showLogin();
})();
