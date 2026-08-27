/**
 * Honor Roll — Gamified Contributor Recognition
 * Abhyas Course Resource Hub (IIT Hyderabad)
 *
 * Computes live scores and metrics dynamically from `data.js` (RESOURCES, CONTRIBUTORS, POINTS, DEPARTMENTS).
 * Pure JavaScript, accessible, responsive, and performance-optimized.
 */

(function () {
  'use strict';

  // Contributor names/rolls and resource titles/courses all ultimately come
  // from user-submitted data (contribute.html) — never trust them raw in
  // innerHTML.
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // --- State ---
  let currentScope = 'semester'; // 'semester' | 'all'
  let currentDept = 'all';       // 'all' | 'CS' | 'EE' | ...
  let currentSort = 'points';    // 'points' | 'papers' | 'assignment' | 'notes' | 'reference' | 'count'
  let searchQuery = '';

  // DOM Elements
  const scopeSemesterBtn = document.getElementById('scopeSemesterBtn');
  const scopeAllTimeBtn = document.getElementById('scopeAllTimeBtn');
  const scopeSemesterLabel = document.getElementById('scopeSemesterLabel');
  const lbgStatsStrip = document.getElementById('lbgStatsStrip');
  const lbgPodium = document.getElementById('lbgPodium');
  const lbgPodiumSub = document.getElementById('lbgPodiumSub');
  const lbgDeptPills = document.getElementById('lbgDeptPills');
  const lbgTableBody = document.getElementById('lbgTableBody');
  const lbgFilterCount = document.getElementById('lbgFilterCount');
  const lbgSearch = document.getElementById('lbgSearch');
  const lbgSortSelect = document.getElementById('lbgSortSelect');

  // Modal Elements
  const modal = document.getElementById('lbgProfileModal');
  const modalBack = document.getElementById('lbgModalBack');
  const modalClose = document.getElementById('lbgModalClose');
  const modalAvatar = document.getElementById('lbgModalAvatar');
  const modalName = document.getElementById('lbgModalName');
  const modalRoll = document.getElementById('lbgModalRoll');
  const modalDept = document.getElementById('lbgModalDept');
  const modalTier = document.getElementById('lbgModalTier');
  const modalScore = document.getElementById('lbgModalScore');
  const modalBar = document.getElementById('lbgModalBar');
  const modalStatsGrid = document.getElementById('lbgModalStatsGrid');
  const modalFilesList = document.getElementById('lbgModalFilesList');
  const modalFileCount = document.getElementById('lbgModalFileCount');

  // Simulator Elements
  const simPapers = document.getElementById('simPapers');
  const simAssignment = document.getElementById('simAssignment');
  const simNotes = document.getElementById('simNotes');
  const simReference = document.getElementById('simReference');
  const simTotalScore = document.getElementById('simTotalScore');
  const simTierBadge = document.getElementById('simTierBadge');

  // Points values from data.js or system defaults
  const SCORE_RULES = typeof POINTS !== 'undefined' ? POINTS : {
    papers: 10,
    assignment: 8,
    notes: 5,
    reference: 2,
  };

  const KIND_CONFIG = {
    papers: { label: 'Past Papers', color: 'var(--papers)', tint: 'var(--papers-tint)', ink: 'var(--papers-ink)' },
    assignment: { label: 'Assignments', color: 'var(--assignment)', tint: 'var(--assignment-tint)', ink: 'var(--assignment-ink)' },
    notes: { label: 'Notes & Slides', color: 'var(--notes)', tint: 'var(--notes-tint)', ink: 'var(--notes-ink)' },
    reference: { label: 'Reference Books', color: 'var(--reference)', tint: 'var(--reference-tint)', ink: 'var(--reference-ink)' },
  };

  // Helper: Extract Department from Roll (e.g. "CS23" -> "CS", "MS24" -> "MSME" or matching code)
  function getDeptFromRoll(roll) {
    if (!roll) return null;
    const match = roll.match(/^[A-Za-z]+/);
    if (!match) return null;
    const code = match[0].toUpperCase();
    
    // Exact match in DEPARTMENTS
    if (typeof DEPARTMENTS !== 'undefined') {
      const found = DEPARTMENTS.find(d => d.code.toUpperCase() === code);
      if (found) return found;
      // Handle prefix aliases like MS -> MSME
      if (code === 'MS') {
        const msme = DEPARTMENTS.find(d => d.code === 'MSME');
        if (msme) return msme;
      }
      if (code === 'MC') {
        const mnc = DEPARTMENTS.find(d => d.code === 'MNC');
        if (mnc) return mnc;
      }
    }
    return { code: code, name: code, short: code, accent: '#F28700' };
  }

  // Contributor Tier Calculator
  function getTier(points) {
    if (points >= 100) return { name: 'Lead Contributor', class: 'tier-legend' };
    if (points >= 50) return { name: 'Core Contributor', class: 'tier-master' };
    if (points >= 25) return { name: 'Regular Contributor', class: 'tier-scholar' };
    if (points >= 10) return { name: 'Contributor', class: 'tier-active' };
    return { name: 'New Contributor', class: 'tier-fresh' };
  }

  // --- Compute Contributor Scores ---
  //
  // No mock-data fallback here on purpose, not even for an empty archive.
  // This used to fall back to a hardcoded fake dataset whenever
  // RESOURCES.length was 0 — which doesn't just mean "no real content
  // yet," it silently means "invent 19 fake papers and show them."
  // Confirmed live, 2026-08-27: contributors.json still had two real
  // people's names in it (deleting a resource doesn't remove the
  // contributor it referenced) while resources.json was genuinely
  // empty — so the fake fallback resources (tagged contributor "c1",
  // "c2") got matched against those REAL names, and the Honor Roll
  // displayed fabricated papers and points under real, identifiable
  // people. An empty archive must render as an empty leaderboard,
  // never as a substitute for one.
  function computeContributors(scope) {
    const rawContributors = globalThis.CONTRIBUTORS || [];
    const rawResources = globalThis.RESOURCES || [];

    const semStart = typeof SEMESTER_START !== 'undefined' ? SEMESTER_START : '2026-07-01';

    return rawContributors.map(c => {
      const userResources = rawResources.filter(r => {
        if (r.contributor !== c.id) return false;
        if (scope === 'semester' && r.added && r.added < semStart) return false;
        return true;
      });

      const counts = {
        papers: 0,
        assignment: 0,
        notes: 0,
        reference: 0,
      };

      userResources.forEach(r => {
        const t = r.type || 'papers';
        if (counts[t] !== undefined) {
          counts[t]++;
        } else {
          counts.papers++;
        }
      });

      const pointsBreakdown = {
        papers: counts.papers * (SCORE_RULES.papers || 10),
        assignment: counts.assignment * (SCORE_RULES.assignment || 8),
        notes: counts.notes * (SCORE_RULES.notes || 5),
        reference: counts.reference * (SCORE_RULES.reference || 2),
      };

      const totalPoints = pointsBreakdown.papers + pointsBreakdown.assignment + pointsBreakdown.notes + pointsBreakdown.reference;
      const totalCount = userResources.length;
      const dept = getDeptFromRoll(c.roll);
      const tier = getTier(totalPoints);

      return {
        ...c,
        department: dept,
        resources: userResources,
        counts,
        pointsBreakdown,
        totalPoints,
        totalCount,
        tier,
      };
    });
  }

  // --- Render Top Summary Stats ---
  function renderStats(contributors) {
    const totalPoints = contributors.reduce((sum, c) => sum + c.totalPoints, 0);
    const activeContributors = contributors.filter(c => c.totalCount > 0).length;
    const totalFiles = contributors.reduce((sum, c) => sum + c.totalCount, 0);

    // Calculate Top Department
    const deptScores = {};
    contributors.forEach(c => {
      if (c.department && c.department.code) {
        deptScores[c.department.code] = (deptScores[c.department.code] || 0) + c.totalPoints;
      }
    });

    let topDeptCode = '—';
    let maxScore = -1;
    Object.entries(deptScores).forEach(([code, sc]) => {
      if (sc > maxScore && sc > 0) {
        maxScore = sc;
        topDeptCode = code;
      }
    });

    const elPoints = document.getElementById('statTotalPoints');
    const elContrib = document.getElementById('statContributors');
    const elFiles = document.getElementById('statFilesShared');
    const elTopDept = document.getElementById('statTopDept');

    if (elPoints) elPoints.textContent = totalPoints.toLocaleString();
    if (elContrib) elContrib.textContent = activeContributors.toLocaleString();
    if (elFiles) elFiles.textContent = totalFiles.toLocaleString();
    if (elTopDept) elTopDept.textContent = topDeptCode;
  }

  // --- Render Stacked Kind Bar Helper ---
  function createStackedBar(c) {
    const total = c.totalPoints || 1;
    const pPapers = ((c.pointsBreakdown.papers / total) * 100).toFixed(1);
    const pAsg = ((c.pointsBreakdown.assignment / total) * 100).toFixed(1);
    const pNotes = ((c.pointsBreakdown.notes / total) * 100).toFixed(1);
    const pRef = ((c.pointsBreakdown.reference / total) * 100).toFixed(1);

    return `
      <div class="lbg-stacked-bar" title="Papers: ${c.counts.papers} (${c.pointsBreakdown.papers}pts) | Assignments: ${c.counts.assignment} (${c.pointsBreakdown.assignment}pts) | Notes: ${c.counts.notes} (${c.pointsBreakdown.notes}pts) | Books: ${c.counts.reference} (${c.pointsBreakdown.reference}pts)">
        ${c.pointsBreakdown.papers > 0 ? `<div class="bar-seg seg-papers" style="width:${pPapers}%"></div>` : ''}
        ${c.pointsBreakdown.assignment > 0 ? `<div class="bar-seg seg-assignment" style="width:${pAsg}%"></div>` : ''}
        ${c.pointsBreakdown.notes > 0 ? `<div class="bar-seg seg-notes" style="width:${pNotes}%"></div>` : ''}
        ${c.pointsBreakdown.reference > 0 ? `<div class="bar-seg seg-reference" style="width:${pRef}%"></div>` : ''}
      </div>
    `;
  }

  const LAUREL_SVG = `
    <svg class="laurel-svg" viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.6">
      <path d="M10 24 C8 18, 10 10, 18 6" stroke-linecap="round"/>
      <path d="M26 24 C28 18, 26 10, 18 6" stroke-linecap="round"/>
      <circle cx="8.5" cy="18" r="1.5" fill="currentColor"/>
      <circle cx="10" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="14" cy="8" r="1.5" fill="currentColor"/>
      <circle cx="27.5" cy="18" r="1.5" fill="currentColor"/>
      <circle cx="26" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="22" cy="8" r="1.5" fill="currentColor"/>
    </svg>
  `;

  function createDonutSvg(c) {
    const totalPts = c.totalPoints || 1;
    const pPts = (c.pointsByKind?.papers || 0);
    const aPts = (c.pointsByKind?.assignment || 0);
    const nPts = (c.pointsByKind?.notes || 0);
    const rPts = (c.pointsByKind?.reference || 0);

    let pPct = Math.round((pPts / totalPts) * 100);
    let aPct = Math.round((aPts / totalPts) * 100);
    let nPct = Math.round((nPts / totalPts) * 100);
    let rPct = Math.round((rPts / totalPts) * 100);

    if (pPct === 0 && aPct === 0 && nPct === 0 && rPct === 0) {
      pPct = c.counts?.papers ? 45 : 0;
      aPct = c.counts?.assignment ? 30 : 0;
      nPct = c.counts?.notes ? 25 : 0;
    }

    let offset = 0;
    const paths = [];

    if (pPct > 0) {
      paths.push(`<path class="donut-seg seg-pap" stroke-dasharray="${pPct}, 100" stroke-dashoffset="${offset}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>`);
      offset -= pPct;
    }
    if (aPct > 0) {
      paths.push(`<path class="donut-seg seg-asg" stroke-dasharray="${aPct}, 100" stroke-dashoffset="${offset}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>`);
      offset -= aPct;
    }
    if (nPct > 0) {
      paths.push(`<path class="donut-seg seg-not" stroke-dasharray="${nPct}, 100" stroke-dashoffset="${offset}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>`);
      offset -= nPct;
    }
    if (rPct > 0) {
      paths.push(`<path class="donut-seg seg-ref" stroke-dasharray="${rPct}, 100" stroke-dashoffset="${offset}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>`);
    }

    return `
      <svg class="pod-donut-svg" viewBox="0 0 36 36">
        <path class="donut-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
        ${paths.join('')}
      </svg>
    `;
  }

  function createSpecimenGrid(c) {
    const pap = c.counts?.papers || 0;
    const asg = c.counts?.assignment || 0;
    const not = c.counts?.notes || 0;

    return `
      <div class="pod-specimen-grid">
        <div class="specimen-card sc-papers">
          <span class="specimen-num">${pap}</span>
          <span class="specimen-lbl">${pap === 1 ? 'Paper' : 'Papers'}</span>
        </div>
        <div class="specimen-card sc-asg">
          <span class="specimen-num">${asg}</span>
          <span class="specimen-lbl">Lab</span>
        </div>
        <div class="specimen-card sc-notes">
          <span class="specimen-num">${not}</span>
          <span class="specimen-lbl">${not === 1 ? 'Note' : 'Notes'}</span>
        </div>
      </div>
    `;
  }

  // --- Render Podium Showcase (Top 3 in 3D Olympic Staircase) ---
  /* ------------------------------------------------------------
     Podium — version B.

     Rank is colour: amber, olive, mauve. Three of the four families
     the archive already owns, descending in prominence. Not gold /
     silver / bronze — "silver" is cold and this palette is tuned
     warm, so a cold grey is the one thing it cannot absorb.

     Each sheet inside a folder is one KIND that person actually
     shared, tinted accordingly, with the count hidden low on the
     sheet until hover springs the stack apart. Rank and kind
     therefore live in different registers — saturation for place,
     pale tint for kind — and the white ring on each sheet is what
     keeps an olive notes sheet off the olive second-place folder.
     ------------------------------------------------------------ */
  const PODIUM_KIND_LABEL = {
    papers: 'Past papers',
    assignment: 'Assignments',
    notes: 'Notes',
    reference: 'Reference',
  };

  function podiumSheets(c) {
    // biggest contribution sits at the front, where it is most visible
    const kinds = Object.keys(PODIUM_KIND_LABEL)
      .filter(k => (c.counts && c.counts[k]) > 0)
      .sort((a, b) => c.counts[b] - c.counts[a])
      .slice(0, 3);
    if (!kinds.length) return '';
    // rendered back-to-front: s3, s2, s1
    const slots = ['s1', 's2', 's3'];
    return kinds.map((k, i) => ({ k, slot: slots[i] }))
      .reverse()
      .map(({ k, slot }) => `
        <div class="pbsh ${slot} k-${k}">
          <div class="pbsh-top">
            <span class="pbsh-name">${PODIUM_KIND_LABEL[k]}</span>
            <span class="dot"></span>
          </div>
          <div class="pbsh-count">${c.counts[k]}<span>shared</span></div>
        </div>`).join('');
  }

  function podiumCard(c, rank) {
    const place = ['First', 'Second', 'Third'][rank - 1];
    return `
      <div class="pbcol r${rank}" data-id="${c.id}">
        <div class="pbfolder" tabindex="0" role="button" aria-label="Rank ${rank}: ${esc(c.name)}, ${c.totalPoints} points">
          <div class="pbback"></div>
          ${podiumSheets(c)}
          <div class="pbfront">
            <div class="pbtop">
              <p class="pbname">${esc(c.name)}</p>
              <span class="pbroll">${esc(batchOf(c.roll))}</span>
            </div>
            <div class="pbbot">
              <span class="pbscore"><b>${c.totalPoints}</b><span>pts</span></span>
              <span class="pbfiles">${c.totalCount} ${c.totalCount === 1 ? 'file' : 'files'}</span>
            </div>
          </div>
        </div>
        <div class="pbplate">${place}</div>
      </div>`;
  }

  function renderPodium(rankedList) {
    if (!lbgPodium) return;

    if (!rankedList.length) {
      lbgPodium.innerHTML = `<div class="lbg-empty-msg">No contributors in this window yet.</div>`;
      return;
    }

    lbgPodium.className = 'pbstage';
    lbgPodium.innerHTML = rankedList.slice(0, 3)
      .map((c, i) => podiumCard(c, i + 1)).join('');

    /* the folder opens the same contributor panel the table rows do */
    lbgPodium.querySelectorAll('.pbcol').forEach(col => {
      const open = () => openContributorModal(col.dataset.id);
      col.querySelector('.pbfolder').addEventListener('click', open);
      col.querySelector('.pbfolder').addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }

  function secondDepartmentName(dept) {
    if (!dept) return '';
    return dept.short || dept.name || dept.code;
  }

  function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // --- Render Department Filter Pills ---
  function renderDeptPills() {
    if (!lbgDeptPills || typeof DEPARTMENTS === 'undefined') return;

    let html = `
      <button class="lbg-dept-pill ${currentDept === 'all' ? 'on' : ''}" data-dept="all" type="button">
        <i></i> All Branches
      </button>
    `;

    // GEN is not a branch anyone belongs to -- it marks an open elective's
    // resources, and no roll number maps to it, so a pill for it would
    // never match a single contributor.
    DEPARTMENTS.filter(d => !d.elective).forEach(dept => {
      const active = currentDept === dept.code ? 'on' : '';
      html += `
        <button class="lbg-dept-pill ${active}" data-dept="${dept.code}" type="button">
          <i style="background:${dept.accent}"></i> ${dept.code}
        </button>
      `;
    });

    lbgDeptPills.innerHTML = html;

    lbgDeptPills.querySelectorAll('.lbg-dept-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const dept = btn.getAttribute('data-dept');
        currentDept = dept;
        lbgDeptPills.querySelectorAll('.lbg-dept-pill').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        refreshView();
      });
    });
  }

  // --- Filter and Sort List ---
  function getFilteredAndSortedList(allContributors) {
    let list = [...allContributors];

    // 1. Department Filter
    if (currentDept !== 'all') {
      list = list.filter(c => {
        if (!c.department) return false;
        return c.department.code === currentDept;
      });
    }

    // 2. Search Query Filter (name or roll)
    if (searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(c => {
        const nameMatch = c.name && c.name.toLowerCase().includes(q);
        // Searches the FULL roll even though only the batch is shown --
        // typing a whole roll number should find its owner.
        const rollMatch = c.roll && c.roll.toLowerCase().includes(q);
        const deptMatch = c.department && (c.department.code.toLowerCase().includes(q) || c.department.name.toLowerCase().includes(q));
        return nameMatch || rollMatch || deptMatch;
      });
    }

    // 3. Sorting
    list.sort((a, b) => {
      if (currentSort === 'points') {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return b.totalCount - a.totalCount;
      }
      if (currentSort === 'papers') {
        return b.counts.papers - a.counts.papers || b.totalPoints - a.totalPoints;
      }
      if (currentSort === 'assignment') {
        return b.counts.assignment - a.counts.assignment || b.totalPoints - a.totalPoints;
      }
      if (currentSort === 'notes') {
        return b.counts.notes - a.counts.notes || b.totalPoints - a.totalPoints;
      }
      if (currentSort === 'reference') {
        return b.counts.reference - a.counts.reference || b.totalPoints - a.totalPoints;
      }
      if (currentSort === 'count') {
        return b.totalCount - a.totalCount || b.totalPoints - a.totalPoints;
      }
      return 0;
    });

    return list;
  }

  // --- Render Ranking Table Body ---
  function renderTable(rankedList) {
    if (!lbgTableBody) return;

    if (rankedList.length === 0) {
      lbgTableBody.innerHTML = `
        <div class="lbg-empty-row">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <p>No contributors found matching your criteria.</p>
        </div>
      `;
      if (lbgFilterCount) lbgFilterCount.textContent = '0 contributors found';
      return;
    }

    if (lbgFilterCount) {
      lbgFilterCount.textContent = `Showing ${rankedList.length} contributor${rankedList.length === 1 ? '' : 's'}`;
    }

    let rowsHtml = '';

    const ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd' };

    rankedList.forEach((c, idx) => {
      const rankNum = idx + 1;
      const isTop3 = rankNum <= 3;
      const rankClass = rankNum === 1 ? 'rank-1' : rankNum === 2 ? 'rank-2' : rankNum === 3 ? 'rank-3' : '';
      const deptAccent = c.department ? c.department.accent : '#F28700';
      const deptShort = c.department ? c.department.short : batchOf(c.roll);

      rowsHtml += `
        <div class="lbg-row ${rankClass} ${isTop3 ? 'is-podium' : ''}" data-id="${c.id}" tabindex="0" role="button" aria-label="Rank ${rankNum}: ${esc(c.name)}, ${c.totalPoints} points">

          <!-- Rank Column -->
          <div class="col-rank">
            <span class="lbg-rank-badge">${rankNum}</span>
            ${isTop3 ? `<span class="lbg-rank-ordinal">${ORDINAL[rankNum]}</span>` : ''}
          </div>

          <!-- User Column -->
          <div class="col-user">
            <div class="lbg-u-avatar">${esc(getInitials(c.name))}</div>
            <div class="lbg-u-info">
              <div class="lbg-u-name-line">
                <span class="lbg-u-name">${esc(c.name)}</span>
                <span class="lbg-u-roll">${esc(batchOf(c.roll))}</span>
              </div>
            </div>
          </div>

          <!-- Branch Column -->
          <div class="col-branch">
            <div class="lbg-branch-tag">
              <span class="lbg-branch-dot" style="background:${deptAccent}"></span>
              <span class="lbg-branch-name">${deptShort}</span>
            </div>
          </div>

          <!-- Stacked Composition Bar Column -->
          <div class="col-composition">
            ${createStackedBar(c)}
            <span class="lbg-file-count">${c.totalCount} ${c.totalCount === 1 ? 'file' : 'files'}</span>
          </div>

          <!-- Total Score Column -->
          <div class="col-score">
            <div class="lbg-score-badge">
              <span class="score-val">${c.totalPoints}</span>
              <span class="score-pts">pts</span>
            </div>
          </div>

        </div>
      `;
    });

    lbgTableBody.innerHTML = rowsHtml;

    // Attach click listeners to rows
    lbgTableBody.querySelectorAll('.lbg-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-id');
        openContributorModal(id);
      });
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const id = row.getAttribute('data-id');
          openContributorModal(id);
        }
      });
    });
  }

  // --- Full Refresh Function ---
  let computedList = [];

  function refreshView() {
    // A contributor with zero real files right now — either nothing
    // published yet, or their only resource was since deleted — doesn't
    // rank. contributors.json can carry orphaned entries (deleting a
    // resource doesn't remove the contributor it referenced); this is
    // where that stops being visible rather than showing a 0-point ghost
    // row or, worse, an empty archive rendering as a populated-looking
    // board. See the note on computeContributors() above for the related
    // bug this was found alongside.
    computedList = computeContributors(currentScope).filter(c => c.totalCount > 0);

    // Sort all contributors by points for podium & stats
    const allRanked = [...computedList].sort((a, b) => b.totalPoints - a.totalPoints || b.totalCount - a.totalCount);

    renderStats(allRanked);
    renderPodium(allRanked);

    const filtered = getFilteredAndSortedList(computedList);
    renderTable(filtered);
  }

  // --- Contributor Profile Inspection Modal ---
  function openContributorModal(contributorId) {
    const c = computedList.find(item => item.id === contributorId);
    if (!c || !modal) return;

    if (modalAvatar) modalAvatar.textContent = getInitials(c.name);
    if (modalName) modalName.textContent = c.name;
    if (modalRoll) modalRoll.textContent = batchOf(c.roll);
    if (modalDept) modalDept.textContent = c.department ? (c.department.name || c.department.short) : c.roll;
    if (modalTier) {
      modalTier.textContent = c.tier.name;
      modalTier.className = `lbg-m-tier ${c.tier.class}`;
    }
    if (modalScore) modalScore.textContent = c.totalPoints;
    if (modalBar) modalBar.innerHTML = createStackedBar(c);
    if (modalFileCount) modalFileCount.textContent = c.resources.length;

    // Stats Grid (Option 1: Tactile Kind Badges)
    if (modalStatsGrid) {
      const pCnt = c.counts?.papers || 0;
      const aCnt = c.counts?.assignment || 0;
      const nCnt = c.counts?.notes || 0;
      const rCnt = c.counts?.reference || 0;

      const pPts = c.pointsBreakdown?.papers || 0;
      const aPts = c.pointsBreakdown?.assignment || 0;
      const nPts = c.pointsBreakdown?.notes || 0;
      const rPts = c.pointsBreakdown?.reference || 0;

      modalStatsGrid.innerHTML = `
        <div class="lbg-m-stat-card k-papers ${pCnt === 0 ? 'is-zero' : ''}">
          <div class="m-stat-l">
            <span class="m-stat-dot"></span>
            <div class="m-stat-info">
              <span class="m-stat-name">Past Papers</span>
              <span class="m-stat-files">${pCnt} ${pCnt === 1 ? 'paper' : 'papers'}</span>
            </div>
          </div>
          <span class="m-stat-pill">+${pPts} pts</span>
        </div>

        <div class="lbg-m-stat-card k-assignment ${aCnt === 0 ? 'is-zero' : ''}">
          <div class="m-stat-l">
            <span class="m-stat-dot"></span>
            <div class="m-stat-info">
              <span class="m-stat-name">Assignments</span>
              <span class="m-stat-files">${aCnt} ${aCnt === 1 ? 'file' : 'files'}</span>
            </div>
          </div>
          <span class="m-stat-pill">+${aPts} pts</span>
        </div>

        <div class="lbg-m-stat-card k-notes ${nCnt === 0 ? 'is-zero' : ''}">
          <div class="m-stat-l">
            <span class="m-stat-dot"></span>
            <div class="m-stat-info">
              <span class="m-stat-name">Notes & Slides</span>
              <span class="m-stat-files">${nCnt} ${nCnt === 1 ? 'file' : 'files'}</span>
            </div>
          </div>
          <span class="m-stat-pill">+${nPts} pts</span>
        </div>

        <div class="lbg-m-stat-card k-reference ${rCnt === 0 ? 'is-zero' : ''}">
          <div class="m-stat-l">
            <span class="m-stat-dot"></span>
            <div class="m-stat-info">
              <span class="m-stat-name">Reference Books</span>
              <span class="m-stat-files">${rCnt} ${rCnt === 1 ? 'book' : 'books'}</span>
            </div>
          </div>
          <span class="m-stat-pill">+${rPts} pts</span>
        </div>
      `;
    }

    // Resource rows list
    if (modalFilesList) {
      if (c.resources.length === 0) {
        modalFilesList.innerHTML = `<div class="m-files-empty">No resources recorded for this period.</div>`;
      } else {
        let filesHtml = '';
        c.resources.forEach(r => {
          const kindConf = KIND_CONFIG[r.type] || KIND_CONFIG.papers;
          const scoreForThis = SCORE_RULES[r.type] || 10;
          filesHtml += `
            <div class="m-file-card">
              <div class="m-file-l">
                <span class="m-file-kind" style="background:${kindConf.tint}; color:${kindConf.ink}">${esc(r.type)}</span>
                <div class="m-file-info">
                  <div class="m-file-title">${esc(r.title || r.course)}</div>
                  <div class="m-file-meta">
                    <span class="m-file-code">${esc(r.code || '')}</span>
                    ${r.year ? `<span>&middot;</span><span>${academicYear(r.year)}</span>` : ''}
                    ${r.pages ? `<span>&middot;</span><span>${r.pages} pgs</span>` : ''}
                  </div>
                </div>
              </div>
              <div class="m-file-r">
                <span class="m-file-score">+${scoreForThis} pts</span>
              </div>
            </div>
          `;
        });
        modalFilesList.innerHTML = filesHtml;
      }
    }

    modal.hidden = false;
    modal.offsetHeight; // trigger reflow
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    window.__pauseLenis?.();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    setTimeout(() => {
      modal.hidden = true;
      document.body.style.overflow = '';
      window.__resumeLenis?.();
    }, 200);
  }

  // --- Interactive Score Simulator ---
  function updateSimulator() {
    const numPapers = Math.max(0, parseInt(simPapers.value, 10) || 0);
    const numAsg = Math.max(0, parseInt(simAssignment.value, 10) || 0);
    const numNotes = Math.max(0, parseInt(simNotes.value, 10) || 0);
    const numRef = Math.max(0, parseInt(simReference.value, 10) || 0);

    const pts = (numPapers * (SCORE_RULES.papers || 10)) +
                (numAsg * (SCORE_RULES.assignment || 8)) +
                (numNotes * (SCORE_RULES.notes || 5)) +
                (numRef * (SCORE_RULES.reference || 2));

    if (simTotalScore) {
      simTotalScore.textContent = pts;
    }

    if (simTierBadge) {
      const tier = getTier(pts);
      simTierBadge.innerHTML = `
        <span class="tier-dot"></span>
        <span class="tier-name">${tier.name}</span>
      `;
      simTierBadge.className = `lbg-sim-tier ${tier.class}`;
    }
  }

  // --- Init Event Handlers ---
  function initEvents() {
    // Semester label
    if (scopeSemesterLabel && typeof SEMESTER_LABEL !== 'undefined') {
      scopeSemesterLabel.textContent = SEMESTER_LABEL;
    }

    // Scope Toggle with Thanos Snap Transition
    function switchScopeWithSnap(newScope) {
      if (currentScope === newScope) return;
      currentScope = newScope;

      if (newScope === 'semester') {
        scopeSemesterBtn.classList.add('on');
        scopeSemesterBtn.setAttribute('aria-selected', 'true');
        scopeAllTimeBtn.classList.remove('on');
        scopeAllTimeBtn.setAttribute('aria-selected', 'false');
      } else {
        scopeAllTimeBtn.classList.add('on');
        scopeAllTimeBtn.setAttribute('aria-selected', 'true');
        scopeSemesterBtn.classList.remove('on');
        scopeSemesterBtn.setAttribute('aria-selected', 'false');
      }

      const snapTargets = [lbgPodium, lbgTableBody, lbgStatsStrip].filter(Boolean);
      snapTargets.forEach(el => {
        el.classList.remove('is-snapping-in');
        el.classList.add('is-snapping-out');
      });

      setTimeout(() => {
        if (lbgPodiumSub) {
          lbgPodiumSub.textContent = newScope === 'semester'
            ? 'The most generous study partners across IIT Hyderabad this term.'
            : 'The most generous study partners across all batches and terms.';
        }
        refreshView();
        snapTargets.forEach(el => {
          el.classList.remove('is-snapping-out');
          el.classList.add('is-snapping-in');
        });
        setTimeout(() => {
          snapTargets.forEach(el => el.classList.remove('is-snapping-in'));
        }, 380);
      }, 160);
    }

    if (scopeSemesterBtn && scopeAllTimeBtn) {
      scopeSemesterBtn.addEventListener('click', () => switchScopeWithSnap('semester'));
      scopeAllTimeBtn.addEventListener('click', () => switchScopeWithSnap('all'));
    }

    // Search Input
    if (lbgSearch) {
      lbgSearch.addEventListener('input', e => {
        searchQuery = e.target.value;
        const filtered = getFilteredAndSortedList(computedList);
        renderTable(filtered);
      });
    }

    // Sort Dropdown
    if (lbgSortSelect) {
      lbgSortSelect.addEventListener('change', e => {
        currentSort = e.target.value;
        const filtered = getFilteredAndSortedList(computedList);
        renderTable(filtered);
      });
    }

    // Modal close events
    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalBack) modalBack.addEventListener('click', closeModal);
    document.addEventListener('keydown', e => {
      if (e && e.key === 'Escape' && modal && !modal.hidden) {
        closeModal();
      }
    });

    // Simulator Stepper Buttons
    document.querySelectorAll('.lbg-step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.getAttribute('data-field');
        const dir = parseInt(btn.getAttribute('data-dir'), 10) || 1;
        let input;
        if (field === 'papers') input = simPapers;
        else if (field === 'assignment') input = simAssignment;
        else if (field === 'notes') input = simNotes;
        else if (field === 'reference') input = simReference;

        if (input) {
          let val = (parseInt(input.value, 10) || 0) + dir;
          if (val < 0) val = 0;
          if (val > 99) val = 99;
          input.value = val;
          updateSimulator();
        }
      });
    });

    [simPapers, simAssignment, simNotes, simReference].forEach(input => {
      if (input) {
        input.addEventListener('input', updateSimulator);
      }
    });
  }

  // --- Main Boot ---
  async function boot() {
    if (globalThis.ABHYAS_READY) {
      try {
        await globalThis.ABHYAS_READY;
      } catch (err) {
        console.warn('[Honor Roll] ABHYAS_READY error, falling back to mock dataset:', err);
      }
    }
    initEvents();
    renderDeptPills();
    refreshView();
    updateSimulator();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
