/**
 * Abhyas — configuration and the data loader.
 *
 * CONTENT lives in JSON, not here:
 *   resources.json     every resource in the archive
 *   contributors.json  who shared what
 *   courses.json       course-code registry (admin console only)
 *
 * That split is deliberate. A missing comma in a .js file blanks Archive,
 * Bookshelf and the Honor Roll at once; a malformed .json file fails to parse
 * and can be reported instead. JSON is also what the review console writes,
 * and it can be validated before it replaces the live copy.
 *
 * What stays here is CONFIGURATION — things a human edits by hand and that
 * change perhaps once a year.
 *
 * NOTE: fetch() does not work over file://. Serve the folder to view it
 * locally:  python3 -m http.server 8000
 */


/* The BTech programmes IITH offers, alphabetical, as published by the
   institute. This is the single source of truth: the Bookshelf's shelves, the
   department filter and the Contribute form all read from it.

   `accent` is decorative, not semantic: unlike the resource-kind colours
   (amber = past papers, olive = notes...) a branch colour carries no meaning,
   it just makes 15 pills tellable apart.

   `short` is what the pills and shelf headings use. Every programme here is
   an engineering programme, so repeating "Engineering" in each label costs
   width and says nothing; `name` keeps the full official title for the
   Contribute form, where precision matters. So every accent is derived from the
   four families the brand already owns, at four lightness steps, rather than
   introducing 15 new hues. */
const DEPARTMENTS = [
  { code: "AI",   name: "Artificial Intelligence", accent: "#F28700", short: "Artificial Intelligence" },
  { code: "BM",   name: "Biomedical Engineering", accent: "#698B39", short: "Biomedical" },
  { code: "BT",   name: "Biotechnology and Bioinformatics", accent: "#D04724", short: "Biotech & Bioinformatics" },
  { code: "CM",   name: "Chemical Engineering", accent: "#8C6597", short: "Chemical" },
  { code: "CE",   name: "Civil Engineering", accent: "#C26C00", short: "Civil" },
  { code: "CS",   name: "Computer Science and Engineering", accent: "#546F2E", short: "Computer Science" },
  { code: "CO",   name: "Computational Engineering", accent: "#A6391D", short: "Computational" },
  { code: "EE",   name: "Electrical Engineering", accent: "#705179", short: "Electrical" },
  { code: "EP",   name: "Engineering Physics", accent: "#FFAE47", short: "Engineering Physics" },
  { code: "ES",   name: "Engineering Science", accent: "#809C5A", short: "Engineering Science" },
  { code: "ICT",  name: "IC Design & Technology", accent: "#E97A5E", short: "IC Design" },
  { code: "IC",   name: "Industrial Chemistry", accent: "#A081A9", short: "Industrial Chemistry" },
  { code: "MSME", name: "Materials Science and Metallurgical Engineering", accent: "#9B5A08", short: "Materials Science" },
  { code: "MNC",  name: "Mathematics and Computing", accent: "#445927", short: "Maths & Computing" },
  { code: "ME",   name: "Mechanical and Aerospace Engineering", accent: "#85321D", short: "Mechanical & Aerospace" },
  /* Not a programme, and flagged so the one place that means "a person's
     own branch" (the Honor Roll's branch pills, keyed off roll numbers,
     which never start GEN) can leave it out. It belongs in this list
     because everything else here answers "which code goes with which
     label" -- and an open elective genuinely has no owning branch.
     Filing CC1010 under whichever branch happened to be picked was the
     CY1010-under-IC bug over again; GEN says the true thing instead. */
  { code: "GEN",  name: "General / Open Elective", accent: "#8C6597", short: "General / Elective", elective: true },
];


/* A resource's `year` is stored as ONE integer -- the year the academic
   session STARTS -- because it has to stay an integer: it is part of every
   resource id and every filename on disk, and the Honor Roll sorts on it.
   But a bare "2025" is genuinely ambiguous to a reader (the 2024-25
   session that ended that year, or the 2025-26 one that began in it?),
   which is how the same course ends up filed under two different years by
   two different people. Store the start, always show the span.
   The admin console's Year dropdown writes the same start year, so the
   choice is unambiguous at the point it is made too. */
function academicYear(startYear) {
  const y = parseInt(startYear, 10);
  if (!y) return "";
  return `${y}\u2013${String(y + 1).slice(-2)}`; // 2024 -> "2024–25"
}


/* A contributor's `roll` is now the FULL institute roll (MS24BTECH11021),
   not the batch token it used to be (MS24) — a name alone doesn't identify
   anyone once two students share one, and the roll is the id the institute
   already uses. Public surfaces still show only the batch: the full roll
   is an institute identifier tied to logins and email addresses, and
   nothing on the Honor Roll needs more than "MS24" to place someone.
   Storage keeps the whole thing; this trims it for display.
   Tolerant by design — anything that doesn't parse is shown as-is rather
   than blanked, so an MTech/PhD roll in another format still reads. */
function batchOf(roll) {
  const r = String(roll || "").trim().toUpperCase();
  const m = r.match(/^([A-Z]+\d{2})/);
  return m ? m[1] : r;
}


/* What a contribution is worth, keyed by the SAME four ids that carry the
   colour (papers / notes / assignment / reference). One taxonomy for score
   and colour: if you add a kind, it needs an entry here, a `--kind` colour
   in :root, and a row in DESIGN.md — all three, or they drift.

   The weighting tracks effort and scarcity. A reference book is a title we
   shelve, not a file we host, so it sits lowest. */
const POINTS = {
  papers: 10,
  assignment: 8,
  notes: 5,
  reference: 2,
};

/* Where the current semester begins. The board offers "this semester" as
   well as all-time so an early contributor cannot freeze the top of the
   list — a board nobody new can climb stops recruiting the people it is
   meant to recruit. Roll this forward each semester. */
const SEMESTER_START = "2026-07-01";
const SEMESTER_LABEL = "This Semester";

const RESOURCE_TYPES = [
  { id: "papers", label: "Quizzes / Past Papers", color: "var(--type-papers)" },
  { id: "notes", label: "Notes / Slides", color: "var(--type-notes)" },
  { id: "assignment", label: "Assignments", color: "var(--type-assignment)" },
  { id: "reference", label: "Reference Books", color: "var(--type-reference)" },
];

/* ============================================================
   Data loading

   `ABHYAS_READY` resolves once the archive is in memory, and also sets the
   globals `RESOURCES` and `CONTRIBUTORS` so pages written against them keep
   working unchanged. `fetchResources()` stays the seam it always was.
   ============================================================ */
globalThis.RESOURCES = [];
globalThis.CONTRIBUTORS = [];

/* Resolve against data.js's own URL, not the page's. The review console
   lives in /admin/, and a bare "api/data.php" would resolve to
   /admin/api/data.php and 404. */
const ABHYAS_BASE = (function () {
  const src = document.currentScript && document.currentScript.src;
  return src ? new URL(".", src).href : "./";
})();

/* Served through PHP, not fetched as a static file. resources.json and
   contributors.json used to sit directly in public_html — deployed
   alongside the site's source code, which meant every deploy could
   silently revert or delete real, live-published data (confirmed
   happening, twice, 2026-08-26). The actual files now live in
   abhyas-private/, outside anything a deploy touches; this endpoint is
   the only way to read them. See api/data.php. */
globalThis.ABHYAS_READY = (async function loadArchive() {
  try {
    const [resources, contributors] = await Promise.all([
      fetch(ABHYAS_BASE + "api/data.php?file=resources", { cache: "no-cache" }).then((r) => {
        if (!r.ok) throw new Error(`resources ${r.status}`);
        return r.json();
      }),
      /* A failed contributors.json used to be swallowed with `: {}`. The
         leaderboard then matched no contributor ids at all and rendered
         "No contributions yet" — a confident, wrong answer with nothing in
         the console. Loud is better than empty. */
      fetch(ABHYAS_BASE + "api/data.php?file=contributors", { cache: "no-cache" }).then((r) => {
        if (!r.ok) throw new Error(`contributors ${r.status}`);
        return r.json();
      }),
    ]);

    globalThis.RESOURCES = Array.isArray(resources) ? resources : [];
    /* stored keyed by id; the pages want a list carrying the id */
    globalThis.CONTRIBUTORS = Object.entries(contributors || {})
      .map(([id, c]) => ({ id, ...c }));

    /* Cross-check: resources referencing contributors that did not load is
       the exact shape of a stale cache, and it is invisible otherwise. */
    const known = new Set(globalThis.CONTRIBUTORS.map((c) => c.id));
    const orphaned = globalThis.RESOURCES.filter(
      (r) => r.contributor && !known.has(r.contributor)).length;
    if (orphaned) {
      console.warn(`[Abhyas] ${orphaned} resources name a contributor that is not in ` +
        `contributors.json. Usually a stale cache — hard-reload the page.`);
    }

    return globalThis.RESOURCES;
  } catch (err) {
    console.error("[Abhyas] could not load the archive:", err);
    showLoadFailure(err);
    return [];
  }
})();

/* A blank page invites a reload and teaches nobody anything. Say what broke. */
function showLoadFailure(err) {
  const onFile = location.protocol === "file:";
  document.addEventListener("DOMContentLoaded", () => {
    const main = document.querySelector("main") || document.body;
    const box = document.createElement("div");
    box.setAttribute("role", "alert");
    box.style.cssText =
      "margin:40px auto;max-width:640px;padding:26px 28px;border-radius:16px;" +
      "background:var(--surface,#FFFDF5);border:1px solid var(--hair,#EBE0CA);" +
      "font-family:var(--font-body,system-ui);color:var(--ink,#282129);line-height:1.6";
    box.innerHTML = onFile
      ? "<b>The archive could not load.</b><br>This page is open as a file, and browsers block " +
        "data loading over <code>file://</code>. Serve the folder instead:<br>" +
        "<code style=\"display:inline-block;margin-top:10px\">python3 -m http.server 8000</code>"
      : "<b>The archive could not load.</b><br>resources.json is missing or unreadable. " +
        "Everything else on the site still works.";
    main.prepend(box);
  });
}

/**
 * The single seam between the site and its data. Every page uses this.
 */
async function fetchResources() {
  return globalThis.ABHYAS_READY;
}
