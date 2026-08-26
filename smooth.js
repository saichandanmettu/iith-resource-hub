/* ------------------------------------------------------------
   Abhyas — Smooth Motion Engine & Micro-Interactions
   Inertial scrolling, floating glass header, word reveals,
   and tactile physics.
   ------------------------------------------------------------ */
(function () {
  const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 1. Lenis Smooth Scrolling */
  if (typeof window.Lenis !== "undefined" && !isReduced) {
    const lenis = new window.Lenis({
      lerp: 0.085,
      wheelMultiplier: 0.95,
      smoothWheel: true,
      syncTouch: false,      /* Preserve native 120Hz touch physics on mobile */
      touchMultiplier: 1.5,
      /* Lenis's own wheel/touch listeners intercept and preventDefault()
         everywhere by default — lenis.stop() (see __pauseLenis below) only
         pauses it applying scroll to ITS OWN target, it does NOT stop that
         interception. Without this, a scrollable area inside a modal
         (.fm-body, .lbg-m-files-list, .m-facts, any file list that
         overflows) is unscrollable by wheel/trackpad even while "paused",
         because the event never reaches the browser's native scroll
         handling for that element. Excluding anything inside .modal fixes
         it regardless of Lenis's running state. */
      prevent: (node) => !!node.closest?.(".modal"),
    });
    window.__lenis = lenis;

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    /* Smooth anchor links with quartic deceleration */
    document.addEventListener("click", (e) => {
      const anchor = e.target.closest('a[href^="#"]');
      const href = anchor?.getAttribute("href");
      if (!anchor || !href || href === "#") return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        lenis.scrollTo(target, {
          offset: -84,
          duration: 1.35,
          easing: (t) => 1 - Math.pow(1 - t, 4),
        });
        history.replaceState(null, "", href);
      }
    });

    /* Global modal pause/resume hooks */
    window.__pauseLenis = () => lenis.stop();
    window.__resumeLenis = () => lenis.start();
  }

  /* 2. Floating Glass Morphing Header */
  const header = document.querySelector("header.top");
  if (header) {
    let ticking = false;
    const updateHeader = () => {
      const scrolled = window.scrollY > 20;
      if (header.getAttribute("data-scrolled") !== String(scrolled)) {
        header.setAttribute("data-scrolled", String(scrolled));
      }
      ticking = false;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          requestAnimationFrame(updateHeader);
          ticking = true;
        }
      },
      { passive: true }
    );
    updateHeader();
  }

  /* 3. Smooth Hero & Header Reveal Observer (No DOM Text Splitting) */
  document.addEventListener("DOMContentLoaded", () => {
    const heroes = document.querySelectorAll(".hero, .faq-intro, .reveal-header");
    if (!isReduced && heroes.length) {
      // Trigger visible hero elements immediately on load for silky entrance
      requestAnimationFrame(() => {
        heroes.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            el.classList.add("in");
            const h1 = el.querySelector("h1, h2");
            if (h1) h1.classList.add("in");
          }
        });
      });

      if ("IntersectionObserver" in window) {
        const obs = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("in");
                const h1 = entry.target.querySelector("h1, h2");
                if (h1) h1.classList.add("in");
                obs.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.1, rootMargin: "0px 0px -5% 0px" }
        );
        heroes.forEach((el) => obs.observe(el));
      } else {
        heroes.forEach((el) => {
          el.classList.add("in");
          const h1 = el.querySelector("h1, h2");
          if (h1) h1.classList.add("in");
        });
      }
    } else {
      document.querySelectorAll(".hero, .faq-intro").forEach((h) => {
        h.classList.add("in");
        const h1 = h.querySelector("h1, h2");
        if (h1) h1.classList.add("in");
      });
    }
  });
})();
