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

  /* 3. Cinematic Word-by-Word Text Splitting */
  function splitWordsInElement(el, startIndex = 0) {
    if (el.dataset.wordsSplit) return startIndex;
    el.dataset.wordsSplit = "true";
    el.classList.add("word-reveal");

    let count = startIndex;
    const childNodes = Array.from(el.childNodes);

    childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        const words = text.split(/\s+/).filter(Boolean);
        if (!words.length) {
          if (text.trim() === '') {
            node.replaceWith(document.createTextNode(text));
          }
          return;
        }
        const frag = document.createDocumentFragment();
        if (/^\s/.test(text)) frag.appendChild(document.createTextNode(" "));
        words.forEach((word, idx) => {
          const span = document.createElement("span");
          span.className = "word-span";
          const inner = document.createElement("span");
          inner.className = "word-inner";
          inner.style.setProperty("--i", count++);
          inner.textContent = word;
          span.appendChild(inner);
          frag.appendChild(span);
          if (idx < words.length - 1) {
            frag.appendChild(document.createTextNode(" "));
          }
        });
        if (/\s$/.test(text)) frag.appendChild(document.createTextNode(" "));
        node.replaceWith(frag);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName.toLowerCase() === 'svg' || node.classList.contains('no-split')) return;
        count = splitWordsInElement(node, count);
      }
    });
    return count;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const titles = document.querySelectorAll(".hero h1, .split-words, .faq-intro h2");
    if (!isReduced && titles.length) {
      titles.forEach((title) => {
        splitWordsInElement(title);
        const heroParent = title.closest(".hero");
        if ("IntersectionObserver" in window) {
          const obs = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  title.classList.add("in");
                  if (heroParent) heroParent.classList.add("in");
                  obs.unobserve(title);
                }
              });
            },
            { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
          );
          obs.observe(title);
          setTimeout(() => {
            title.classList.add("in");
            if (heroParent) heroParent.classList.add("in");
          }, 1200);
        } else {
          title.classList.add("in");
          if (heroParent) heroParent.classList.add("in");
        }
      });
    } else {
      document.querySelectorAll(".hero").forEach((h) => h.classList.add("in"));
    }
  });
})();
