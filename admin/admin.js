/* ------------------------------------------------------------
   Abhyas — review console

   Every server call goes through api() below. Right now it is
   answered by a MOCK so the console can be judged before any PHP
   exists. Flip USE_MOCK to false once api.php is deployed; no
   other line in this file changes.

   The console never decides who you are — it only hides itself
   until the server says the session is good. Anything that
   matters is checked again server-side on every request.
   ------------------------------------------------------------ */
(function () {
  "use strict";

  const USE_MOCK = true;
  const API = "../api/moderate.php";

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

  let state = { tab: "pending", items: [], current: null };

  /* ============================================================
     Server calls — one seam
     ============================================================ */
  async function api(action, payload) {
    if (USE_MOCK) return mockApi(action, payload);
    const res = await fetch(`${API}?action=${encodeURIComponent(action)}`, {
      method: payload ? "POST" : "GET",
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      credentials: "same-origin",
    });
    if (res.status === 401) { showLogin(); throw new Error("unauthorised"); }
    if (!res.ok) throw new Error(`${action} failed (${res.status})`);
    return res.json();
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
      showConsole();
      document.getElementById("who").textContent = r.user || "signed in";
      loadQueue();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });

  document.getElementById("logout").addEventListener("click", async () => {
    await api("logout").catch(() => {});
    showLogin();
  });

  /* ============================================================
     Queue
     ============================================================ */
  async function loadQueue() {
    const data = await api("queue");
    state.items = data.items || [];
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("cPending", data.counts.pending);
    set("cPublished", data.counts.published);
    set("cRejected", data.counts.rejected);
    set("sPending", data.counts.pending);
    set("sPublished", data.counts.published);
    set("sRejected", data.counts.rejected);
    set("sContrib", data.counts.contributors ?? 0);

    /* the headline says what is actually waiting, rather than a fixed slogan */
    const h = document.getElementById("adHeadline");
    const sub = document.getElementById("adSub");
    if (h) {
      h.innerHTML = data.counts.pending
        ? `<span class="muted">${data.counts.pending} ${data.counts.pending === 1 ? "file is" : "files are"}</span><br>waiting for you`
        : `<span class="muted">Nothing is waiting</span><br>the queue is clear`;
    }
    if (sub) {
      sub.textContent = data.counts.pending
        ? "Check the file, correct anything the contributor got wrong, then publish."
        : "Everything submitted so far has been reviewed.";
    }
    renderQueue();
  }

  function renderQueue() {
    const host = document.getElementById("queue");
    const rows = state.items.filter((i) => i.status === state.tab);
    if (!rows.length) {
      host.innerHTML = `<div class="ad-empty"><b>Nothing ${esc(state.tab)}</b><span>When something lands here, it will show up in this list.</span></div>`;
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
            <span>${esc(it.contributor || "no credit")}</span>
            <span>${esc(it.submitted)}</span>
            <span>${esc(it.size)}</span>
            ${it.duplicateOf ? `<span class="ad-dupe">possible duplicate</span>` : ""}
          </div>
        </div>
        ${state.tab === "pending"
          ? `<button class="ad-review-btn" type="button" data-id="${esc(it.id)}">Review</button>`
          : `<span class="ad-status">${esc(it.status)}</span>`}
      </div>`).join("");

    host.querySelectorAll(".ad-review-btn").forEach((b) => {
      b.addEventListener("click", () => openReview(b.dataset.id));
    });
  }

  function labelOf(t) {
    return { papers: "Past paper", notes: "Notes", assignment: "Assignment", reference: "Reference" }[t] || t;
  }

  document.querySelectorAll("#tabs .ad-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.tab = tab.dataset.tab;
      document.querySelectorAll("#tabs .ad-tab").forEach((t) => t.classList.toggle("on", t === tab));
      renderQueue();
    });
  });

  /* ============================================================
     Review
     ============================================================ */
  function openReview(id) {
    const it = state.items.find((x) => x.id === id);
    if (!it) return;
    state.current = it;

    document.getElementById("fCode").value = it.code || "";
    document.getElementById("fCourse").value = it.course || "";
    document.getElementById("fSem").value = it.semester || "";
    document.getElementById("fType").value = it.type || "papers";
    document.getElementById("fYear").value = it.year || "";
    document.getElementById("fExam").value = it.examType || "";
    document.getElementById("fProf").value = it.professor || "";
    document.getElementById("fContrib").value = it.contributor || "";
    document.getElementById("fRoll").value = it.roll || "";
    fillDepts(it.department);
    document.getElementById("fBookAuthor").value = it.book?.author || "";
    document.getElementById("fBookPublisher").value = it.book?.publisher || "";
    document.getElementById("fBookCover").value = it.book?.cover || "ink";
    document.getElementById("fBookGist").value = it.book?.gist || "";
    syncBookFields();

    const warn = document.getElementById("dupeWarn");
    warn.hidden = !it.duplicateOf;
    if (it.duplicateOf) {
      warn.textContent = `This file is byte-for-byte identical to one already in the archive (${it.duplicateOf}). Approving it would add a second copy — and it scores no points either way.`;
    }

    /* The file is not on the public web. It is streamed through the
       API, which checks the session before returning a single byte. */
    const pane = document.getElementById("pdfPane");
    pane.innerHTML = USE_MOCK
      ? `<div class="ad-pdf-stub">PDF preview<br>${esc(it.filename)}<br><br>Served by api.php?action=file&amp;id=${esc(it.id)}<br>only after the session check passes.</div>`
      : `<iframe src="${API}?action=file&id=${encodeURIComponent(it.id)}" title="Submission preview"></iframe>`;

    document.getElementById("review").classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeReview() {
    document.getElementById("review").classList.remove("open");
    document.getElementById("pdfPane").innerHTML = "";
    document.body.style.overflow = "";
    state.current = null;
  }
  document.getElementById("revClose").addEventListener("click", closeReview);
  document.getElementById("reviewBack").addEventListener("click", closeReview);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.current) closeReview();
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

  document.getElementById("btnApprove").addEventListener("click", async () => {
    if (!state.current) return;
    const record = {
      id: state.current.id,
      code: document.getElementById("fCode").value.trim().toUpperCase(),
      course: document.getElementById("fCourse").value.trim(),
      department: document.getElementById("fDept").value,
      semester: Number(document.getElementById("fSem").value) || null,
      type: document.getElementById("fType").value,
      year: Number(document.getElementById("fYear").value) || null,
      examType: document.getElementById("fExam").value || null,
      professor: document.getElementById("fProf").value.trim() || "—",
      contributor: document.getElementById("fContrib").value.trim() || null,
      roll: document.getElementById("fRoll").value.trim() || null,
    };
    if (record.type === "reference") {
      record.bookAuthor = document.getElementById("fBookAuthor").value.trim();
      record.bookPublisher = document.getElementById("fBookPublisher").value.trim();
      record.bookCover = document.getElementById("fBookCover").value;
      record.bookGist = document.getElementById("fBookGist").value.trim();
      if (!record.bookAuthor) {
        alert("A reference book needs an author, or the Library cannot render it.");
        return;
      }
    }
    if (!record.code || !record.course) {
      alert("A course code and name are required before this can go live.");
      return;
    }
    await api("approve", record);
    closeReview();
    loadQueue();
  });

  document.getElementById("btnReject").addEventListener("click", async () => {
    if (!state.current) return;
    const reason = prompt("Reason for rejecting? (optional, kept for your own records)") ?? "";
    await api("reject", { id: state.current.id, reason });
    closeReview();
    loadQueue();
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
     MOCK — delete once api.php is live
     ============================================================ */
  let mockItems = [
    { id: "a3f9c1", status: "pending", title: "Algorithms — Mid-Sem 2024", filename: "midsem_scan.pdf",
      code: "CS2110", course: "", department: "CS", semester: null, type: "papers", year: 2024,
      examType: "Mid-Sem", professor: "", contributor: "Aarav Menon", roll: "CS23",
      submitted: "2 hours ago", size: "3.4 MB", duplicateOf: null },
    { id: "b81e40", status: "pending", title: "flu mech notes", filename: "IMG_20260821.pdf",
      code: "ME2210", course: "", department: "ME", semester: null, type: "notes", year: 2026,
      examType: "", professor: "", contributor: "", roll: "",
      submitted: "5 hours ago", size: "11.2 MB", duplicateOf: null },
    { id: "c07a55", status: "pending", title: "Materials Chemistry — Quiz 2", filename: "quiz2.pdf",
      code: "CY1120", course: "Materials Chemistry", department: "MSME", semester: 2, type: "papers",
      year: 2024, examType: "Quiz", professor: "Atul Deshpande", contributor: "Rohan Iyer", roll: "MS24",
      submitted: "yesterday", size: "1.1 MB", duplicateOf: "CY1120-quiz2-2024.pdf" },
    { id: "d22b19", status: "published", title: "Calculus-II — Assignment", filename: "assign.pdf",
      code: "MA1210", course: "Calculus-II", department: "CS", semester: 2, type: "assignment",
      year: 2024, examType: "", professor: "Sukumar", contributor: "Aarav Menon", roll: "CS23",
      submitted: "3 days ago", size: "0.8 MB", duplicateOf: null },
    { id: "e51f77", status: "rejected", title: "wa0032.jpg", filename: "IMG-wa0032.pdf",
      code: "", course: "", department: "CS", semester: null, type: "papers", year: null,
      examType: "", professor: "", contributor: "", roll: "",
      submitted: "4 days ago", size: "0.2 MB", duplicateOf: null },
  ];

  async function mockApi(action, payload) {
    await new Promise((r) => setTimeout(r, 160));
    if (action === "login") {
      return payload.password === "demo"
        ? { ok: true, user: "admin" }
        : { ok: false, error: "Wrong password. (Mock password is: demo)" };
    }
    if (action === "logout") return { ok: true };
    if (action === "queue") {
      return {
        items: mockItems,
        counts: {
          pending: mockItems.filter((i) => i.status === "pending").length,
          published: mockItems.filter((i) => i.status === "published").length,
          rejected: mockItems.filter((i) => i.status === "rejected").length,
          contributors: new Set(mockItems.filter((i) => i.contributor).map((i) => i.contributor)).size,
        },
      };
    }
    if (action === "approve") {
      const it = mockItems.find((x) => x.id === payload.id);
      if (it) { Object.assign(it, payload, { status: "published" }); }
      return { ok: true };
    }
    if (action === "reject") {
      const it = mockItems.find((x) => x.id === payload.id);
      if (it) it.status = "rejected";
      return { ok: true };
    }
    return { ok: false };
  }

  showLogin();
})();
