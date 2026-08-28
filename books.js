/* ============================================================
   BookShelf — covers, shelves, and the opening-book detail panel.
   Shared by the home page shelf and the full library page.

   The page must contain the #bookModal markup (see library.html).
   ============================================================ */

const BookShelf = (function () {
  const COVER_CLASS = {
    ink: "c-ink", amber: "c-amber", crimson: "c-crimson",
    mint: "c-mint", violet: "c-violet", sky: "c-sky",
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let BOOKS = [];
  let openSource = null;   /* the cover we flew out of, so we can fly back */

  function title(r) {
    return r.title.replace(/\s+[—–-]\s+Reference (Book|Guide)$/i, "");
  }

  /* A real cover scan carries its own title, author and edition, so when
     one was uploaded it fills the whole board and the typeset face steps
     aside — the spine and page-block stay for the shelf's 3D read. With
     no image we fall back to the generated cover, which is why every book
     still needs an author and a cover colour. coverImage is a path under
     /files/, same convention as r.file (see api/publish.php). */
  function coverFace(r) {
    if (r.book.coverImage) {
      return `
        <span class="cover-art">
          <img src="api/file.php?path=${encodeURIComponent(r.book.coverImage)}" alt="" loading="lazy" decoding="async">
        </span>
        <span class="spine"></span>
        <span class="pages"></span>`;
    }
    return `
      <span class="spine"></span>
      <span class="pages"></span>
      <span class="cover-in">
        <span class="b-code">${esc(r.code || "")}</span>
        <span class="b-title">${esc(title(r))}</span>
        <span class="b-rule"></span>
        <span class="b-author">${esc(r.book.author)}</span>
      </span>`;
  }

  function coverClass(r) { return COVER_CLASS[r.book.cover] || "c-ink"; }

  /* ---- shelves ---------------------------------------------------- */

  function render(container, books) {
    if (!container) return;
    container.innerHTML = books.map((r) => `
      <button class="book ${coverClass(r)}" type="button"
              data-book="${r.id}" aria-haspopup="dialog"
              aria-label="${esc(title(r))} by ${esc(r.book.author)}">
        ${coverFace(r)}
      </button>`).join("");
  }

  /* ---- the panel --------------------------------------------------- */

  function fill(r) {
    document.getElementById("modalCover").innerHTML =
      `<span class="book ${coverClass(r)}">${coverFace(r)}</span>`;
    // Most reference books have no hosted file at all — they're a pointer
    // to a real, usually copyrighted, textbook, not a copy of one (see
    // api/publish.php build_record()). Link out when there's a link,
    // open the actual file only when one was actually uploaded, and if
    // somehow neither exists, don't render a dead "#" button.
    const openHref = r.file
      ? "api/file.php?path=" + encodeURIComponent(r.file)
      : (r.book.link || "");
    const openLabel = r.file ? "Open the PDF" : "Find this book online";
    const cta = openHref
      ? `<a class="cta-solid" href="${esc(openHref)}"${r.file ? "" : ' target="_blank" rel="noopener"'}>${openLabel}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M12 5l7 7-7 7"/></svg>
        </a>`
      : "";

    document.getElementById("modalBody").innerHTML = `
      <p class="m-kind">${esc(r.code || r.department)} &middot; Reference</p>
      <h3 class="m-title">${esc(title(r))}</h3>
      <p class="m-author">${esc(r.book.author)}</p>
      <p class="m-gist">${esc(r.book.gist)}</p>
      <div class="m-facts">
        <div><b>${esc(r.book.publisher)}</b><span>Publisher</span></div>
        <div><b>${r.pages || "—"}</b><span>Pages</span></div>
        <div><b>${esc(r.course)}</b><span>Prescribed for</span></div>
      </div>
      <div class="m-cta">
        ${cta}
        <a class="cta-ghost" href="index.html?course=${encodeURIComponent(r.course)}&tab=${esc(r.type)}#archive" data-close>See the course folder</a>
      </div>`;
  }

  /* FLIP: measure the cover where the reader clicked it, drop the panel's
     cover there, then release it to its real place. */
  function flip(fromRect) {
    const target = document.getElementById("modalCover");
    const to = target.getBoundingClientRect();
    target.style.transition = "none";
    target.style.transform =
      `translate(${fromRect.left - to.left}px, ${fromRect.top - to.top}px) scale(${fromRect.width / to.width})`;
    target.getBoundingClientRect();
    target.style.transition = "transform .6s cubic-bezier(.34, 1.32, .64, 1)";
    target.style.transform = "translate(0, 0) scale(1)";
  }

  function open(id, sourceEl) {
    const r = BOOKS.find((x) => String(x.id) === String(id));
    if (!r || !r.book) return;

    const modal = document.getElementById("bookModal");
    const from = sourceEl.getBoundingClientRect();

    fill(r);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    window.__pauseLenis?.();

    flip(from);
    if (sourceEl.classList.contains("book")) {
      sourceEl.style.visibility = "hidden";   /* it left the shelf */
      openSource = sourceEl;
    } else {
      openSource = null;                      /* came from a folder card */
    }

    /* layout flush rather than rAF — rAF is throttled in a background tab
       and the panel would never animate in */
    modal.getBoundingClientRect();
    modal.classList.add("open");
    /* the cover swings open a beat after the panel lands */
    setTimeout(() => modal.classList.add("opened"), 380);

    document.getElementById("modalClose").focus();
  }

  function close() {
    const modal = document.getElementById("bookModal");
    if (modal.hidden) return;
    const target = document.getElementById("modalCover");

    modal.classList.remove("opened");          /* the page falls shut first */

    /* measure the gap the book left, then fly the cover back into it */
    if (openSource) {
      openSource.style.visibility = "";
      const back = openSource.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      openSource.style.visibility = "hidden";
      target.style.transition = "transform .46s cubic-bezier(.4, 0, .2, 1) .12s";
      target.style.transform =
        `translate(${back.left - to.left}px, ${back.top - to.top}px) scale(${back.width / to.width})`;
    }

    setTimeout(() => modal.classList.remove("open"), 220);
    setTimeout(() => {
      modal.hidden = true;
      target.style.transition = "none";
      target.style.transform = "none";
      document.body.style.overflow = "";
      window.__resumeLenis?.();
      if (openSource) {
        openSource.style.visibility = "";
        openSource.focus({ preventScroll: true });
        openSource = null;
      }
    }, 620);
  }

  function init(all) {
    BOOKS = all.filter((r) => r.book);

    document.addEventListener("click", (e) => {
      const b = e.target.closest(".book[data-book]");
      if (b) { open(b.dataset.book, b); return; }
      if (e.target.closest("[data-close]")) close();
      if (e.target.closest(".modal-back") || e.target.closest(".modal-close")) close();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

  return { init, render, open, close, esc, title, coverClass, coverFace, list: () => BOOKS };
})();
