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
      prevent: (node) => !!(node.closest?.(".modal") || node.closest?.(".mobile-menu") || node.closest?.(".mobile-backdrop")),
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

  /* 3. Smooth Hero & Kinetic Word-by-Word Reveal */
  document.addEventListener("DOMContentLoaded", () => {
    const heroes = document.querySelectorAll(".hero, .faq-intro, .reveal-header");
    
    // Auto-prepare kinetic word spans if not already pre-wrapped in HTML
    heroes.forEach((hero) => {
      const h1 = hero.querySelector("h1, h2");
      if (h1 && !h1.querySelector(".h-word")) {
        let wordIndex = 0;
        const processNode = (node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (!text.trim()) return;
            const words = text.split(/(\s+)/);
            const frag = document.createDocumentFragment();
            words.forEach((chunk) => {
              if (!chunk) return;
              if (/^\s+$/.test(chunk)) {
                frag.appendChild(document.createTextNode(chunk));
              } else {
                const span = document.createElement("span");
                span.className = "h-word";
                span.style.setProperty("--w", wordIndex++);
                span.textContent = chunk;
                frag.appendChild(span);
              }
            });
            node.parentNode.replaceChild(frag, node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName.toLowerCase() === "svg" || node.classList.contains("no-split")) {
              return;
            }
            Array.from(node.childNodes).forEach(processNode);
          }
        };
        Array.from(h1.childNodes).forEach(processNode);
      }
    });

    if (!isReduced && heroes.length) {
      // Micro-tick delay allows initial blur & translateY state to register before .in transition kicks off
      setTimeout(() => {
        heroes.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            el.classList.add("in");
            const h1 = el.querySelector("h1, h2");
            if (h1) h1.classList.add("in");
          }
        });
      }, 40);

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

  /* 4. Mobile Navigation Menu Controller
     Its own top-level listener, not nested inside the hero-reveal one
     above — that coupling meant an edit to unrelated hero logic could
     silently take the menu down with it.

     One flag, one place it's written: body[data-menu-open]. Compare to
     iith-athletics' nav[data-open], which drives its whole dropdown the
     same way — a single attribute CSS reads everywhere, instead of three
     separately-toggled classes on three separate elements (the toggle
     button, the menu, the backdrop) that have to all agree with each
     other. Three independent writes are three chances to end up out of
     sync — the toggle icon can visually flip to "X" while the panel
     underneath never got its class, or vice versa, if any one of the
     three DOM writes is skipped (a null check that fails quietly, a
     script that throws partway through). One write can't disagree with
     itself. */
  document.addEventListener("DOMContentLoaded", () => {
    const menuToggle = document.getElementById("menuToggle");
    const mobileMenu = document.getElementById("mobileMenu");
    const mobileBackdrop = document.getElementById("mobileBackdrop");
    if (!menuToggle || !mobileMenu) return;

    const isMenuOpen = () => document.body.getAttribute("data-menu-open") === "true";

    const setMobileMenu = (open) => {
      document.body.setAttribute("data-menu-open", open ? "true" : "false");
      menuToggle.setAttribute("aria-expanded", String(open));
      mobileMenu.setAttribute("aria-hidden", String(!open));
      if (open) {
        if (typeof window.__pauseLenis === "function") window.__pauseLenis();
      } else {
        if (typeof window.__resumeLenis === "function") window.__resumeLenis();
      }
    };

    menuToggle.addEventListener("click", () => setMobileMenu(!isMenuOpen()));

    if (mobileBackdrop) {
      mobileBackdrop.addEventListener("click", () => setMobileMenu(false));
    }

    mobileMenu.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => setMobileMenu(false));
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isMenuOpen()) setMobileMenu(false);
    });

    // Auto close on resize to desktop (> 720px) — e.g. rotating a tablet.
    window.addEventListener(
      "resize",
      () => {
        if (window.innerWidth > 720 && isMenuOpen()) setMobileMenu(false);
      },
      { passive: true }
    );
  });
})();
