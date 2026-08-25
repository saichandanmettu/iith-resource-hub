/**
 * Contribute Gemini — Interactive Archive Intake Controller
 * Full dynamic binding with DEPARTMENTS, RESOURCES, and POINTS from data.js
 */

(function () {
  "use strict";

  // Staged files memory
  let stagedFiles = [];
  let currentKind = "papers";
  let isAttributionEnabled = true;

  // Points estimator state
  const estimatorState = {
    papers: 1,
    assignment: 1,
    notes: 2,
    reference: 0,
  };

  /* ------------------------------------------------------------
     DOM Initialization
     ------------------------------------------------------------ */
  /* the archive now loads from JSON — wait for it before first paint */
  document.addEventListener("DOMContentLoaded", async () => {
    await globalThis.ABHYAS_READY;
    initPulseMetrics();
    initDepartmentDropdown();
    initModeTabs();
    initDropzone();
    initKindSelector();
    initAttributionToggle();
    initGapRadar();
    initPointsEstimator();
    initFaqAccordion();
    initCopyButtons();
    initFormSubmissions();
  });

  /* ------------------------------------------------------------
     1. Community Pulse Metrics
     ------------------------------------------------------------ */
  function initPulseMetrics() {
    const totalCountEl = document.getElementById("cgPulseTotal");
    const deptsCountEl = document.getElementById("cgPulseDepts");
    const gapsCountEl = document.getElementById("cgPulseGaps");

    if (totalCountEl && typeof RESOURCES !== "undefined") {
      totalCountEl.textContent = RESOURCES.length;
    }

    if (typeof DEPARTMENTS !== "undefined" && typeof RESOURCES !== "undefined") {
      const activeDepts = new Set(RESOURCES.map((r) => r.department));
      if (deptsCountEl) {
        deptsCountEl.textContent = `${activeDepts.size} / ${DEPARTMENTS.length}`;
      }

      // Count empty or thin branches (< 2 files)
      const gapCount = DEPARTMENTS.filter((d) => {
        const count = RESOURCES.filter((r) => r.department === d.code).length;
        return count <= 1;
      }).length;

      if (gapsCountEl) {
        gapsCountEl.textContent = gapCount;
      }
    }
  }

  /* ------------------------------------------------------------
     2. Populate Department Dropdown
     ------------------------------------------------------------ */
  function initDepartmentDropdown() {
    const deptSelect = document.getElementById("cgDept");
    const linkDeptSelect = document.getElementById("cgLinkDept");
    if (!deptSelect || typeof DEPARTMENTS === "undefined") return;

    const populate = (selectEl) => {
      if (!selectEl) return;
      selectEl.innerHTML = '<option value="">Select your department / branch…</option>';
      DEPARTMENTS.forEach((dept) => {
        const opt = document.createElement("option");
        opt.value = dept.code;
        opt.textContent = `${dept.code} — ${dept.name}`;
        selectEl.appendChild(opt);
      });
    };

    populate(deptSelect);
    populate(linkDeptSelect);
  }

  /* ------------------------------------------------------------
     3. Mode Switching Tabs
     ------------------------------------------------------------ */
  function initModeTabs() {
    const modeBtns = document.querySelectorAll(".cg-mode-btn");
    const panels = document.querySelectorAll(".cg-panel");

    modeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetMode = btn.getAttribute("data-mode");

        modeBtns.forEach((b) => b.classList.remove("on"));
        panels.forEach((p) => p.classList.remove("on"));

        btn.classList.add("on");
        const activePanel = document.getElementById(`cgPanel-${targetMode}`);
        if (activePanel) activePanel.classList.add("on");
      });
    });
  }

  /* ------------------------------------------------------------
     4. Dropzone & File Staging
     ------------------------------------------------------------ */
  function initDropzone() {
    const dropzone = document.getElementById("cgDropzone");
    const fileInput = document.getElementById("cgFileInput");
    const fileList = document.getElementById("cgFileList");

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener("click", () => fileInput.click());

    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("drag-over");
      });
    });

    dropzone.addEventListener("drop", (e) => {
      const files = Array.from(e.dataTransfer.files);
      handleFilesAdded(files);
    });

    fileInput.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      handleFilesAdded(files);
      fileInput.value = "";
    });

    function handleFilesAdded(files) {
      if (!files.length) return;
      files.forEach((file) => {
        if (!stagedFiles.some((f) => f.name === file.name && f.size === file.size)) {
          stagedFiles.push(file);
        }
      });
      renderFileList();
    }

    function renderFileList() {
      if (!fileList) return;
      fileList.innerHTML = "";

      stagedFiles.forEach((file, index) => {
        const item = document.createElement("div");
        item.className = "cg-file-item";

        const sizeKb = (file.size / 1024).toFixed(0);
        const sizeStr = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${sizeKb} KB`;

        item.innerHTML = `
          <div class="cg-file-info">
            <div class="cg-file-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
            <div style="min-width:0">
              <div class="cg-file-name">${escapeHtml(file.name)}</div>
              <div class="cg-file-meta">${sizeStr} &middot; Staged for intake</div>
            </div>
          </div>
          <button type="button" class="cg-file-remove" title="Remove file" data-index="${index}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        `;

        item.querySelector(".cg-file-remove").addEventListener("click", (e) => {
          e.stopPropagation();
          stagedFiles.splice(index, 1);
          renderFileList();
        });

        fileList.appendChild(item);
      });
    }
  }

  /* ------------------------------------------------------------
     5. Resource Kind Selector
     ------------------------------------------------------------ */
  function initKindSelector() {
    const kindOpts = document.querySelectorAll(".cg-kind-opt");
    kindOpts.forEach((opt) => {
      opt.addEventListener("click", () => {
        kindOpts.forEach((o) => o.classList.remove("on"));
        opt.classList.add("on");
        currentKind = opt.getAttribute("data-kind");
      });
    });
  }

  /* ------------------------------------------------------------
     6. Contributor Attribution & Live Preview
     ------------------------------------------------------------ */
  function initAttributionToggle() {
    const switchEl = document.getElementById("cgAttrSwitch");
    const fieldsRow = document.getElementById("cgAttrFields");
    const nameInput = document.getElementById("cgContribName");
    const rollInput = document.getElementById("cgContribRoll");
    const previewName = document.getElementById("cgPrevName");
    const previewRoll = document.getElementById("cgPrevRoll");
    const previewAvatar = document.getElementById("cgPrevAvatar");

    if (!switchEl || !fieldsRow) return;

    switchEl.addEventListener("click", () => {
      isAttributionEnabled = !isAttributionEnabled;
      switchEl.classList.toggle("on", isAttributionEnabled);
      fieldsRow.style.display = isAttributionEnabled ? "grid" : "none";
    });

    const updatePreview = () => {
      const name = nameInput.value.trim() || "Your Name";
      const roll = rollInput.value.trim().toUpperCase() || "BATCH CODE";

      if (previewName) previewName.textContent = name;
      if (previewRoll) previewRoll.textContent = roll;

      if (previewAvatar) {
        const initials = name
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase() || "YOU";
        previewAvatar.textContent = initials;
      }
    };

    if (nameInput) nameInput.addEventListener("input", updatePreview);
    if (rollInput) rollInput.addEventListener("input", updatePreview);
  }

  /* ------------------------------------------------------------
     7. Live Gap Bounty Radar
     ------------------------------------------------------------ */
  function initGapRadar() {
    const radarGrid = document.getElementById("cgRadarGrid");
    const filterTabs = document.querySelectorAll(".cg-radar-tab");
    if (!radarGrid || typeof DEPARTMENTS === "undefined" || typeof RESOURCES === "undefined") return;

    let activeFilter = "all";

    function renderRadar() {
      radarGrid.innerHTML = "";

      // Compute statistics per department
      const stats = DEPARTMENTS.map((dept) => {
        const files = RESOURCES.filter((r) => r.department === dept.code);
        const papers = files.filter((r) => r.type === "papers").length;
        const total = files.length;
        return {
          ...dept,
          total,
          papers,
          hasGaps: total <= 1,
          missingPapers: papers === 0,
        };
      });

      let filtered = stats;
      if (activeFilter === "gaps") {
        filtered = stats.filter((s) => s.hasGaps);
      } else if (activeFilter === "papers") {
        filtered = stats.filter((s) => s.missingPapers);
      }

      // Sort by scarcity (thinnest branches first)
      filtered.sort((a, b) => a.total - b.total);

      filtered.forEach((item) => {
        const card = document.createElement("div");
        card.className = `cg-radar-item ${item.total === 0 ? "is-empty" : ""}`;

        let statusText = `${item.total} file${item.total === 1 ? "" : "s"} (${item.papers} papers)`;
        if (item.total === 0) statusText = "0 files &middot; Completely unstocked";
        else if (item.missingPapers) statusText = `${item.total} files &middot; Quizzes needed`;

        card.innerHTML = `
          <div class="cg-radar-left">
            <span class="cg-radar-dot" style="background:${item.accent}"></span>
            <div class="cg-radar-name">
              <b>${escapeHtml(item.name)}</b>
              <span>${statusText}</span>
            </div>
          </div>
          <button type="button" class="cg-radar-action-btn" data-code="${item.code}" data-name="${escapeHtml(item.name)}">
            I have this
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6"></path>
            </svg>
          </button>
        `;

        card.querySelector(".cg-radar-action-btn").addEventListener("click", () => {
          prefillIntake(item.code);
        });

        radarGrid.appendChild(card);
      });
    }

    filterTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        filterTabs.forEach((t) => t.classList.remove("on"));
        tab.classList.add("on");
        activeFilter = tab.getAttribute("data-filter");
        renderRadar();
      });
    });

    renderRadar();
  }

  function prefillIntake(deptCode) {
    const deptSelect = document.getElementById("cgDept");
    const courseCodeInput = document.getElementById("cgCourseCode");
    const studio = document.getElementById("intakeStudio");

    if (deptSelect) {
      deptSelect.value = deptCode;
    }

    if (studio) {
      studio.scrollIntoView({ behavior: "smooth" });
    }

    if (courseCodeInput) {
      setTimeout(() => courseCodeInput.focus(), 400);
    }
  }

  /* ------------------------------------------------------------
     8. Points Estimator & Rank Simulator
     ------------------------------------------------------------ */
  function initPointsEstimator() {
    const steppers = document.querySelectorAll(".cg-step-btn");
    const scoreNumEl = document.getElementById("cgCalcScore");
    const tierBadgeEl = document.getElementById("cgCalcTier");
    const msgEl = document.getElementById("cgCalcMsg");

    if (!scoreNumEl || typeof POINTS === "undefined") return;

    steppers.forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.getAttribute("data-type");
        const action = btn.getAttribute("data-action");
        const valEl = document.getElementById(`cgStepVal-${type}`);

        if (action === "plus") {
          estimatorState[type] = Math.min(25, estimatorState[type] + 1);
        } else if (action === "minus") {
          estimatorState[type] = Math.max(0, estimatorState[type] - 1);
        }

        if (valEl) valEl.textContent = estimatorState[type];
        updateCalculatedScore();
      });
    });

    function updateCalculatedScore() {
      const total =
        estimatorState.papers * (POINTS.papers || 10) +
        estimatorState.assignment * (POINTS.assignment || 8) +
        estimatorState.notes * (POINTS.notes || 5) +
        estimatorState.reference * (POINTS.reference || 2);

      scoreNumEl.textContent = total;

      let tier = "New Contributor";
      let msg = "A single verified past paper immediately earns you 10 points on the board.";

      if (total >= 100) {
        tier = "🏆 Archive Legend (Podium)";
        msg = "This score comfortably places you near the #1 spot on the global Leaderboard!";
      } else if (total >= 50) {
        tier = "⚡ Gold Contributor";
        msg = "High-impact contribution! You will secure a prominent top-5 placement.";
      } else if (total >= 25) {
        tier = "🌿 Silver Scholar";
        msg = "A strong semester contribution helping dozens of peers in your batch.";
      } else if (total >= 10) {
        tier = "📙 Bronze Contributor";
        msg = "You are on the board! Every verified resource adds permanent score.";
      }

      if (tierBadgeEl) tierBadgeEl.textContent = tier;
      if (msgEl) msgEl.textContent = msg;
    }

    updateCalculatedScore();
  }

  /* ------------------------------------------------------------
     9. FAQ Accordion (grid-template-rows 0fr -> 1fr)
     ------------------------------------------------------------ */
  function initFaqAccordion() {
    const faqItems = document.querySelectorAll(".faq");
    faqItems.forEach((item) => {
      const btn = item.querySelector(".faq-q");
      if (!btn) return;

      btn.addEventListener("click", () => {
        const isOpen = item.classList.contains("is-open");
        // Close others
        faqItems.forEach((other) => {
          other.classList.remove("is-open");
          const otherBtn = other.querySelector(".faq-q");
          if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
        });

        if (!isOpen) {
          item.classList.add("is-open");
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });
  }

  /* ------------------------------------------------------------
     10. Clipboard Copy Buttons
     ------------------------------------------------------------ */
  function initCopyButtons() {
    const copyBtns = document.querySelectorAll(".cg-copy-btn");
    copyBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const textToCopy = btn.getAttribute("data-copy") || "ms24btech11021@iith.ac.in";
        navigator.clipboard.writeText(textToCopy).then(() => {
          const originalText = btn.textContent;
          btn.textContent = "COPIED!";
          btn.classList.add("is-done");
          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove("is-done");
          }, 2000);
        });
      });
    });
  }

  /* ------------------------------------------------------------
     11. Form Submissions & Celebrations
     ------------------------------------------------------------ */
  function initFormSubmissions() {
    const submitBtn = document.getElementById("cgSubmitBtn");
    const linkSubmitBtn = document.getElementById("cgLinkSubmitBtn");
    const receiptModal = document.getElementById("cgReceiptModal");
    const receiptCloseBtn = document.getElementById("cgReceiptClose");

    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        const dept = document.getElementById("cgDept")?.value;
        const code = document.getElementById("cgCourseCode")?.value.trim();

        if (!dept) {
          alert("Please select a department / branch for your contribution.");
          return;
        }

        if (stagedFiles.length === 0) {
          alert("Please attach or drag at least one course file into the drop tray.");
          return;
        }

        launchConfetti();
        showReceipt({
          dept,
          code: code || "General Course",
          type: currentKind,
          fileCount: stagedFiles.length,
        });

        // Reset staged files
        stagedFiles = [];
        const fileList = document.getElementById("cgFileList");
        if (fileList) fileList.innerHTML = "";
      });
    }

    if (linkSubmitBtn) {
      linkSubmitBtn.addEventListener("click", () => {
        const linkUrl = document.getElementById("cgLinkUrl")?.value.trim();
        const dept = document.getElementById("cgLinkDept")?.value;

        if (!linkUrl) {
          alert("Please enter your Google Drive or OneDrive folder URL.");
          return;
        }

        launchConfetti();
        showReceipt({
          dept: dept || "Multi-Department",
          code: "Cloud Drive Archive",
          type: "Folder Intake",
          fileCount: "Cloud Link",
        });

        const urlInput = document.getElementById("cgLinkUrl");
        if (urlInput) urlInput.value = "";
      });
    }

    if (receiptCloseBtn && receiptModal) {
      receiptCloseBtn.addEventListener("click", () => {
        receiptModal.classList.remove("is-open");
      });
    }

    function showReceipt(details) {
      if (!receiptModal) return;
      const detailsEl = document.getElementById("cgReceiptDetails");
      if (detailsEl) {
        detailsEl.innerHTML = `
          <div><strong>Branch:</strong> ${escapeHtml(details.dept)}</div>
          <div><strong>Course / Subject:</strong> ${escapeHtml(details.code)}</div>
          <div><strong>Category:</strong> ${escapeHtml(details.type)}</div>
          <div><strong>Payload:</strong> ${escapeHtml(String(details.fileCount))} file(s) attached</div>
          <div><strong>Status:</strong> Staged in queue &middot; Hand-check in 24–48 hrs</div>
        `;
      }
      receiptModal.classList.add("is-open");
    }
  }

  /* ------------------------------------------------------------
     12. Canvas Confetti Particle Celebration
     ------------------------------------------------------------ */
  function launchConfetti() {
    const canvas = document.getElementById("cgConfettiCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#F28700", "#698B39", "#D04724", "#8C6597", "#FFAE47"];
    const particles = [];
    const count = 75;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() * 200 - 100),
        y: canvas.height * 0.45 + (Math.random() * 100 - 50),
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.7) * 14,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    let animationFrame;
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.rotation += p.rSpeed;
        p.opacity -= 0.012;

        if (p.opacity > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (alive) {
        animationFrame = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    render();
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
