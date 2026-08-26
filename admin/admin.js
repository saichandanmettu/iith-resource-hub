/* ------------------------------------------------------------
   Abhyas — admin console

   Direct publishing, not moderation: the person signed in here IS the
   person deciding what goes on the archive, so there's no queue, no
   approve/reject, no separate "pending" pile. Publish a resource, or
   edit/delete one already live. See BACKEND-PLAN-v3.md for why this is
   deliberately smaller than a public-submission review console would
   need to be.

   Every server call goes through api() below. Right now it is answered
   by a MOCK so the console can be judged before any PHP exists. Flip
   USE_MOCK to false once api/publish.php is deployed; no other line in
   this file changes.
   ------------------------------------------------------------ */
(function () {
  "use strict";

  const USE_MOCK = true;
  const API = "../api/publish.php";

  /* ============================================================
     Course registry — one place a code maps to a name.

     Note what it deliberately does NOT do: it never sets the
     branch. In this archive `department` means "which branch's
     students take this", and one course legitimately belongs to
     several — MA1010 sits under CS while MA1310 sits under MSME.
     A fixed code->branch map would quietly move papers out of the
     branch whose students need them.
     ============================================================ */
  const COURSE_CATALOG = {
    "MA1010": { name: "Elementary Linear Algebra", sem: 1, professors: ["Amit Tripathi"] },
    "MA1110": { name: "Calculus-I", sem: 1, professors: ["Jyotirmoy Rana", "Vikas Krishnamurthy"] },
    "MA1210": { name: "Calculus-II", sem: 2, professors: ["Rajesh Kannan", "Sukumar"] },
    "MA1310": { name: "Differential Equations", sem: 2, professors: ["Dhriti Sundar Patra"] },
    "MA2110": { name: "Vector Calculus", sem: 2, professors: ["Alok Pan"] },
    "MA2210": { name: "Complex Analysis", sem: 3, professors: ["Alok Pan"] },
    "PH1210": { name: "Maths for Physics", sem: 2, professors: ["Alok Pan"] },
    "PH2110": { name: "Modern Physics", sem: 3, professors: [] },
    "CY1120": { name: "Materials Chemistry", sem: 2, professors: ["Atul Deshpande"] },
    "CY2140": { name: "Environmental Chemistry", sem: 4, professors: ["Sudharshanam"] },
    "CS2110": { name: "Design and Analysis of Algorithms", sem: 4, professors: [] },
    "CS2130": { name: "Database Management Systems", sem: 5, professors: [] },
    "CS3110": { name: "Operating Systems", sem: 5, professors: [] },
    "EE2140": { name: "Digital Circuits", sem: 3, professors: [] },
    "ES1110": { name: "Introduction to Climate Change", sem: 1, professors: ["Pritha Chatterjee", "Deepu J Babu"] },
    "ME2110": { name: "Mechanics of Solids", sem: 3, professors: ["Prabhat Kumar"] },
    "ME2210": { name: "Fluid Mechanics", sem: 4, professors: [] },
    "MS1110": { name: "Introduction to Materials Science and Engineering", sem: 2, professors: ["Ranjith Ramadurai"] },
    "LA1010": { name: "Communication Skills", sem: 1, professors: ["Srirupa Chatterjee"] },
  };

  let state = { items: [], contributors: {}, current: null, csrf: null, filter: "" };

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
    if (res.status === 401) { showLogin(); throw new Error("unauthorised"); }
    const data = await res.json().catch(() => ({ ok: false, error: `${action} failed (${res.status})` }));
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
    const data = await api("list");
    state.items = data.items || [];
    state.contributors = data.contributors || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("sPublished", data.counts.published);
    set("sContrib", data.counts.contributors ?? 0);

    const h = document.getElementById("adHeadline");
    const sub = document.getElementById("adSub");
    if (h) {
      h.innerHTML = state.items.length
        ? `<span class="muted">${state.items.length} resource${state.items.length === 1 ? "" : "s"}</span><br>on the archive`
        : `<span class="muted">Nothing published yet</span><br>add the first one`;
    }
    if (sub) {
      sub.textContent = "Upload a PDF, fill in the course details, and it appears on the archive immediately.";
    }
    renderList();
  }

  function renderList() {
    const host = document.getElementById("queue");
    const q = state.filter.trim().toLowerCase();
    const rows = state.items.filter((i) => !q ||
      [i.title, i.course, i.code, contributorName(i.contributor)].some((f) => String(f || "").toLowerCase().includes(q)));

    if (!rows.length) {
      host.innerHTML = `<div class="ad-empty"><b>${state.items.length ? "No matches" : "Nothing here yet"}</b><span>${state.items.length ? "Try a different search." : "Click “Add resource” to publish the first file."}</span></div>`;
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
    ["fCode", "fCourse", "fSem", "fYear", "fExam", "fProf", "fContrib", "fRoll",
     "fBookAuthor", "fBookPublisher", "fBookGist"].forEach((id) => { document.getElementById(id).value = ""; });
    document.getElementById("fType").value = "papers";
    document.getElementById("fBookCover").value = "ink";
    document.getElementById("fFile").value = "";
    document.getElementById("codeHint").hidden = true;
    document.getElementById("dupeWarn").hidden = true;
    syncBookFields();
  }

  function openAdd() {
    state.current = null;
    resetForm();
    fillDepts(null);
    document.getElementById("revTitle").textContent = "Add resource";
    document.getElementById("fileField").hidden = false;
    document.getElementById("btnDelete").hidden = true;
    document.getElementById("btnSave").textContent = "Publish";
    document.getElementById("pdfPane").innerHTML = `<div class="ad-pdf-stub">Pick a PDF to preview it here &mdash; nothing uploads until you click Publish.</div>`;
    openPanel();
  }

  function openEdit(id) {
    const it = state.items.find((x) => x.id === id);
    if (!it) return;
    state.current = it;
    resetForm();

    document.getElementById("revTitle").textContent = "Edit resource";
    document.getElementById("fileField").hidden = true; // the file itself isn't replaceable from here
    document.getElementById("btnDelete").hidden = false;
    document.getElementById("btnSave").textContent = "Save changes";

    document.getElementById("fCode").value = it.code || "";
    document.getElementById("fCourse").value = it.course || "";
    document.getElementById("fSem").value = it.semester || "";
    document.getElementById("fType").value = it.type || "papers";
    document.getElementById("fYear").value = it.year || "";
    document.getElementById("fExam").value = it.examType || "";
    document.getElementById("fProf").value = it.professor || "";
    document.getElementById("fContrib").value = it.contributor ? contributorName(it.contributor) : "";
    document.getElementById("fRoll").value = it.roll || "";
    fillDepts(it.department);
    document.getElementById("fBookAuthor").value = it.book?.author || "";
    document.getElementById("fBookPublisher").value = it.book?.publisher || "";
    document.getElementById("fBookCover").value = it.book?.cover || "ink";
    document.getElementById("fBookGist").value = it.book?.gist || "";
    syncBookFields();

    /* Same viewer the public site uses — pointed at the file already live,
       not a blob: URL, since there's nothing local to preview here. */
    const pane = document.getElementById("pdfPane");
    const fileUrl = it.file ? new URL(`../files/${it.file}`, window.location.href).href : null;
    pane.innerHTML = fileUrl
      ? `<iframe src="../assets/pdfjs/web/viewer.html?file=${encodeURIComponent(fileUrl)}" title="Preview"></iframe>`
      : `<div class="ad-pdf-stub">No file on record for this entry.</div>`;

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
    pendingForcePublish = null;
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
    pendingForcePublish = null;
    document.getElementById("dupeWarn").hidden = true;
    if (!file) {
      pane.innerHTML = `<div class="ad-pdf-stub">Pick a PDF to preview it here &mdash; nothing uploads until you click Publish.</div>`;
      return;
    }
    previewUrl = URL.createObjectURL(file);
    pane.innerHTML = `<iframe src="../assets/pdfjs/web/viewer.html?file=${encodeURIComponent(previewUrl)}" title="Preview"></iframe>`;
  });

  /* Reference is the only type that needs the book payload — show those
     fields only when they apply, but never let a book be filed without them. */
  function syncBookFields() {
    const isBook = document.getElementById("fType").value === "reference";
    document.getElementById("bookFields").hidden = !isBook;
  }
  document.getElementById("fType").addEventListener("change", syncBookFields);

  function fillDepts(selected) {
    const sel = document.getElementById("fDept");
    sel.innerHTML = DEPARTMENTS.map((d) =>
      `<option value="${esc(d.code)}"${d.code === selected ? " selected" : ""}>${esc(d.code)} — ${esc(d.short)}</option>`
    ).join("");
  }

  /* Auto-fill from the registry: name, semester and professors, but
     never the branch — see the note on COURSE_CATALOG above. */
  const codeInput = document.getElementById("fCode");
  codeInput.addEventListener("input", () => {
    const code = codeInput.value.trim().toUpperCase();
    const hit = COURSE_CATALOG[code];
    const hint = document.getElementById("codeHint");
    if (!hit) { hint.hidden = true; return; }
    codeInput.value = code;
    const course = document.getElementById("fCourse");
    const sem = document.getElementById("fSem");
    const prof = document.getElementById("fProf");
    if (!course.value.trim()) course.value = hit.name;
    if (!sem.value) sem.value = hit.sem || "";
    if (!prof.value.trim() && hit.professors.length) prof.value = hit.professors.join(", ");
    hint.textContent = `Known course — ${hit.name}`;
    hint.hidden = false;
  });

  function readForm() {
    return {
      code: document.getElementById("fCode").value.trim().toUpperCase(),
      course: document.getElementById("fCourse").value.trim(),
      department: document.getElementById("fDept").value,
      semester: document.getElementById("fSem").value || "",
      type: document.getElementById("fType").value,
      year: document.getElementById("fYear").value || "",
      examType: document.getElementById("fExam").value || "",
      professor: document.getElementById("fProf").value.trim(),
      contributor: document.getElementById("fContrib").value.trim(),
      roll: document.getElementById("fRoll").value.trim(),
      bookAuthor: document.getElementById("fBookAuthor").value.trim(),
      bookPublisher: document.getElementById("fBookPublisher").value.trim(),
      bookCover: document.getElementById("fBookCover").value,
      bookGist: document.getElementById("fBookGist").value.trim(),
    };
  }

  /* Set once a publish attempt comes back "this looks like a duplicate" —
     clicking Publish again resubmits the SAME file with force:1 attached,
     rather than making the admin re-pick it. Cleared on any successful
     save, any panel close, and any fresh file pick. */
  let pendingForcePublish = null;

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

    try {
      if (state.current) {
        await api("edit", { id: state.current.id, ...f });
      } else if (pendingForcePublish) {
        const r2 = await api("publish", pendingForcePublish);
        pendingForcePublish = null;
        if (!r2.ok) throw new Error(r2.error || "Publish failed");
      } else {
        const file = document.getElementById("fFile").files[0];
        if (!file) { alert("Pick a PDF first."); return; }
        const fd = new FormData();
        fd.append("file", file);
        Object.entries(f).forEach(([k, v]) => fd.append(k, v));
        const r1 = await api("publish", fd);
        if (!r1.ok && r1.error && /identical/i.test(r1.error)) {
          const warn = document.getElementById("dupeWarn");
          warn.hidden = false;
          warn.textContent = r1.error + " Click Publish again to confirm.";
          fd.append("force", "1");
          pendingForcePublish = fd;
          return;
        }
        if (!r1.ok) throw new Error(r1.error || "Publish failed");
      }
      pendingForcePublish = null;
      closePanel();
      loadList();
    } catch (ex) {
      alert(ex.message);
    }
  });

  async function doDelete(id) {
    const it = state.items.find((x) => x.id === id);
    if (!it) return;
    if (!confirm(`Remove "${it.title}" from the archive listing?\n\nThe PDF file itself stays on disk — this only unlists it.`)) return;
    await api("delete", { id });
    loadList();
  }
  document.getElementById("btnDelete").addEventListener("click", () => {
    if (state.current) { doDelete(state.current.id); closePanel(); }
  });

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  /* populate the code autocomplete */
  document.getElementById("codeList").innerHTML =
    Object.keys(COURSE_CATALOG).sort().map((c) =>
      `<option value="${c}">${esc(COURSE_CATALOG[c].name)}</option>`).join("");

  /* ============================================================
     MOCK — delete once api/publish.php is live
     ============================================================ */
  const mockContributors = {
    c1: { name: "Aarav Menon", roll: "CS23" },
    c2: { name: "Rohan Iyer", roll: "MS24" },
  };
  let mockItems = [
    { id: "cs2110-2024-endsem", status: "published", title: "Algorithms — End-Sem", filename: "algo.pdf",
      code: "CS2110", course: "Design and Analysis of Algorithms", department: "CS", semester: 4, type: "papers",
      year: 2024, examType: "End-Sem", professor: "", contributor: "c1", roll: "CS23",
      added: "2026-08-20", file: null },
    { id: "cy1120-2024-quiz", status: "published", title: "Materials Chemistry — Quiz", filename: "quiz2.pdf",
      code: "CY1120", course: "Materials Chemistry", department: "MSME", semester: 2, type: "papers",
      year: 2024, examType: "Quiz", professor: "Atul Deshpande", contributor: "c2", roll: "MS24",
      added: "2026-08-18", file: null },
  ];

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
        contributors: mockContributors,
        counts: {
          published: mockItems.length,
          contributors: new Set(mockItems.filter((i) => i.contributor).map((i) => i.contributor)).size,
        },
      };
    }
    if (action === "publish") {
      const id = (payload.get("code") || "new").toLowerCase() + "-" + (payload.get("year") || "0000");
      mockItems.push({
        id, status: "published", title: `${payload.get("course")} — ${payload.get("examType") || payload.get("type")}`,
        code: payload.get("code"), course: payload.get("course"), department: payload.get("department"),
        semester: Number(payload.get("semester")) || null, type: payload.get("type"), year: Number(payload.get("year")) || null,
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
      mockItems = mockItems.filter((x) => x.id !== payload.id);
      return { ok: true };
    }
    return { ok: false };
  }

  showLogin();
})();
