/* ------------------------------------------------------------
   FAQ accordion.

   The panel animates `grid-template-rows: 0fr -> 1fr`, not max-height:
   that eases to the answer's real height whatever its length, instead of
   to a guessed maximum that either clips long answers or coasts through
   empty space at the end. The JS only toggles a class and aria state.
   ------------------------------------------------------------ */
(function () {
  const items = [...document.querySelectorAll(".faq-item")];
  if (!items.length) return;

  function close(item) {
    item.classList.remove("is-open");
    item.querySelector(".faq-q").setAttribute("aria-expanded", "false");
  }

  items.forEach((item) => {
    const btn = item.querySelector(".faq-q");
    btn.addEventListener("click", () => {
      const open = item.classList.contains("is-open");
      items.forEach(close);              /* one open at a time */
      if (!open) {
        item.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });
})();
