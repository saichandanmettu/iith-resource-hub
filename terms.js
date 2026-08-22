/* ------------------------------------------------------------
   Terms page animations & FAQ accordion.
   ------------------------------------------------------------ */
(function () {
  const faq = document.querySelector(".faq");
  const items = [...document.querySelectorAll(".faq-item")];

  /* 1. Scroll-triggered arrival reveal for FAQ section */
  if (faq && items.length) {
    const revealFaq = () => {
      faq.classList.add("in");
      items.forEach((item, index) => {
        item.style.setProperty("--faq-d", `${index * 75}ms`);
        item.classList.add("in");
      });
    };

    if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            revealFaq();
            obs.unobserve(faq);
          }
        });
      }, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });
      observer.observe(faq);

      /* Safety fallback in case of fast scroll or edge cases */
      setTimeout(revealFaq, 2500);
    } else {
      revealFaq();
    }
  }

  /* 2. Smooth FAQ Accordion */
  if (!items.length) return;

  function close(item) {
    item.classList.remove("is-open");
    item.querySelector(".faq-q").setAttribute("aria-expanded", "false");
  }

  items.forEach((item) => {
    const btn = item.querySelector(".faq-q");
    btn.addEventListener("click", () => {
      const open = item.classList.contains("is-open");
      items.forEach(close); /* one open at a time */
      if (!open) {
        item.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });
})();
