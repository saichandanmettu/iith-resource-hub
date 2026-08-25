/**
 * Leaderboard-Gemini — Gamified Contributor Recognition
 * Abhyas Course Resource Hub (IIT Hyderabad)
 *
 * Computes live scores and metrics dynamically from `data.js` (RESOURCES, CONTRIBUTORS, POINTS, DEPARTMENTS).
 * Pure JavaScript, accessible, responsive, and performance-optimized.
 */

(function () {
  'use strict';

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
    if (points >= 100) return { name: 'Academic Legend', icon: '🏆', class: 'tier-legend' };
    if (points >= 50) return { name: 'Master Contributor', icon: '🎖️', class: 'tier-master' };
    if (points >= 25) return { name: 'Scholar', icon: '🏅', class: 'tier-scholar' };
    if (points >= 10) return { name: 'Active Contributor', icon: '⭐', class: 'tier-active' };
    return { name: 'Fresh Contributor', icon: '🌱', class: 'tier-fresh' };
  }

  // --- Compute Contributor Scores ---
  function computeContributors(scope) {
    if (typeof CONTRIBUTORS === 'undefined' || typeof RESOURCES === 'undefined') {
      return [];
    }

    const semStart = typeof SEMESTER_START !== 'undefined' ? SEMESTER_START : '2026-07-01';

    return CONTRIBUTORS.map(c => {
      const userResources = RESOURCES.filter(r => {
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

  // --- Render Podium Showcase (Top 3 in Staircase) ---
  function renderPodium(rankedList) {
    if (!lbgPodium) return;

    if (rankedList.length === 0) {
      lbgPodium.innerHTML = `<div class="lbg-empty-msg">No contributors found for this scope.</div>`;
      return;
    }

    const first = rankedList[0];
    const second = rankedList[1] || null;
    const third = rankedList[2] || null;

    // Ordered 2nd -> 1st -> 3rd for the podium staircase
    const cards = [];

    // 2nd Place Card
    if (second) {
      cards.push(`
        <div class="lbg-podium-slot slot-2" data-id="${second.id}" tabindex="0" role="button" aria-label="Rank 2: ${second.name}">
          <div class="podium-card card-silver">
            <div class="podium-rank-badge">2</div>
            <div class="podium-avatar">${getInitials(second.name)}</div>
            <div class="podium-name">${second.name}</div>
            <div class="podium-meta">
              <span class="podium-roll">${second.roll}</span>
              <span class="podium-dept-dot" style="background:${second.department ? second.department.accent : '#F28700'}"></span>
              <span>${second.department ? second.department.short : second.roll}</span>
            </div>
            <div class="podium-score">
              <b>${second.totalPoints}</b>
              <span>points</span>
            </div>
            ${createStackedBar(second)}
            <div class="podium-counts">
              <span><b>${second.totalCount}</b> files</span> &middot; 
              <span>${second.tier.name}</span>
            </div>
            <div class="podium-pedestal pedestal-2">
              <span>2nd</span>
            </div>
          </div>
        </div>
      `);
    }

    // 1st Place Card (Elevated, Champion Amber styling)
    if (first) {
      cards.push(`
        <div class="lbg-podium-slot slot-1" data-id="${first.id}" tabindex="0" role="button" aria-label="Rank 1 Champion: ${first.name}">
          <div class="podium-card card-gold">
            <div class="podium-crown">👑 Top Contributor</div>
            <div class="podium-rank-badge gold-badge">1</div>
            <div class="podium-avatar gold-avatar">${getInitials(first.name)}</div>
            <div class="podium-name gold-name">${first.name}</div>
            <div class="podium-meta">
              <span class="podium-roll">${first.roll}</span>
              <span class="podium-dept-dot" style="background:${first.department ? first.department.accent : '#F28700'}"></span>
              <span>${first.department ? secondDepartmentName(first.department) : first.roll}</span>
            </div>
            <div class="podium-score gold-score">
              <b>${first.totalPoints}</b>
              <span>points</span>
            </div>
            ${createStackedBar(first)}
            <div class="podium-counts gold-counts">
              <span><b>${first.totalCount}</b> files shared</span> &middot; 
              <span>${first.tier.name}</span>
            </div>
            <div class="podium-pedestal pedestal-1">
              <span>1st</span>
            </div>
          </div>
        </div>
      `);
    }

    // 3rd Place Card
    if (third) {
      cards.push(`
        <div class="lbg-podium-slot slot-3" data-id="${third.id}" tabindex="0" role="button" aria-label="Rank 3: ${third.name}">
          <div class="podium-card card-bronze">
            <div class="podium-rank-badge">3</div>
            <div class="podium-avatar">${getInitials(third.name)}</div>
            <div class="podium-name">${third.name}</div>
            <div class="podium-meta">
              <span class="podium-roll">${third.roll}</span>
              <span class="podium-dept-dot" style="background:${third.department ? third.department.accent : '#F28700'}"></span>
              <span>${third.department ? third.department.short : third.roll}</span>
            </div>
            <div class="podium-score">
              <b>${third.totalPoints}</b>
              <span>points</span>
            </div>
            ${createStackedBar(third)}
            <div class="podium-counts">
              <span><b>${third.totalCount}</b> files</span> &middot; 
              <span>${third.tier.name}</span>
            </div>
            <div class="podium-pedestal pedestal-3">
              <span>3rd</span>
            </div>
          </div>
        </div>
      `);
    }

    lbgPodium.innerHTML = cards.join('');

    // Attach click handlers to podium cards
    lbgPodium.querySelectorAll('.lbg-podium-slot').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        openContributorModal(id);
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const id = el.getAttribute('data-id');
          openContributorModal(id);
        }
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

    DEPARTMENTS.forEach(dept => {
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

    rankedList.forEach((c, idx) => {
      const rankNum = idx + 1;
      const isTop3 = rankNum <= 3;
      const rankClass = rankNum === 1 ? 'rank-1' : rankNum === 2 ? 'rank-2' : rankNum === 3 ? 'rank-3' : '';
      const deptAccent = c.department ? c.department.accent : '#F28700';
      const deptShort = c.department ? c.department.short : c.roll;

      rowsHtml += `
        <div class="lbg-row ${rankClass}" data-id="${c.id}" tabindex="0" role="button" aria-label="Rank ${rankNum}: ${c.name}, ${c.totalPoints} points">
          
          <!-- Rank Column -->
          <div class="col-rank">
            <span class="lbg-rank-num">${rankNum}</span>
            ${rankNum === 1 ? '<span class="lbg-crown-icon" title="First Place">👑</span>' : ''}
          </div>

          <!-- User Column -->
          <div class="col-user">
            <div class="lbg-u-avatar">${getInitials(c.name)}</div>
            <div class="lbg-u-info">
              <div class="lbg-u-name-line">
                <span class="lbg-u-name">${c.name}</span>
                <span class="lbg-u-roll">${c.roll}</span>
              </div>
              <div class="lbg-u-tier">
                <span class="tier-pill ${c.tier.class}">${c.tier.icon} ${c.tier.name}</span>
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
          </div>

          <!-- Breakdown Column (Kind Counts) -->
          <div class="col-breakdown">
            <div class="lbg-counts-chips">
              <span class="chip-k chip-papers" title="${c.counts.papers} Past Papers">${c.counts.papers}p</span>
              <span class="chip-k chip-assignment" title="${c.counts.assignment} Assignments">${c.counts.assignment}a</span>
              <span class="chip-k chip-notes" title="${c.counts.notes} Notes">${c.counts.notes}n</span>
              <span class="chip-k chip-reference" title="${c.counts.reference} Books">${c.counts.reference}b</span>
            </div>
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
    computedList = computeContributors(currentScope);
    
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
    if (modalRoll) modalRoll.textContent = c.roll;
    if (modalDept) modalDept.textContent = c.department ? (c.department.name || c.department.short) : c.roll;
    if (modalTier) {
      modalTier.textContent = `${c.tier.icon} ${c.tier.name}`;
      modalTier.className = `lbg-m-tier ${c.tier.class}`;
    }
    if (modalScore) modalScore.textContent = c.totalPoints;
    if (modalBar) modalBar.innerHTML = createStackedBar(c);
    if (modalFileCount) modalFileCount.textContent = c.resources.length;

    // Stats Grid
    if (modalStatsGrid) {
      modalStatsGrid.innerHTML = `
        <div class="m-stat-item k-papers">
          <span class="m-stat-count">${c.counts.papers}</span>
          <span class="m-stat-lbl">Papers (+${c.pointsBreakdown.papers} pts)</span>
        </div>
        <div class="m-stat-item k-assignment">
          <span class="m-stat-count">${c.counts.assignment}</span>
          <span class="m-stat-lbl">Assignments (+${c.pointsBreakdown.assignment} pts)</span>
        </div>
        <div class="m-stat-item k-notes">
          <span class="m-stat-count">${c.counts.notes}</span>
          <span class="m-stat-lbl">Notes (+${c.pointsBreakdown.notes} pts)</span>
        </div>
        <div class="m-stat-item k-reference">
          <span class="m-stat-count">${c.counts.reference}</span>
          <span class="m-stat-lbl">Books (+${c.pointsBreakdown.reference} pts)</span>
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
                <span class="m-file-kind" style="background:${kindConf.tint}; color:${kindConf.ink}">${r.type}</span>
                <div class="m-file-info">
                  <div class="m-file-title">${r.title || r.course}</div>
                  <div class="m-file-meta">
                    <span class="m-file-code">${r.code || ''}</span>
                    <span>&middot;</span>
                    <span>Sem ${r.semester || 1}</span>
                    <span>&middot;</span>
                    <span>${r.year || 2024}</span>
                    ${r.pages ? `<span>&middot; ${r.pages} pgs</span>` : ''}
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
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    setTimeout(() => {
      modal.hidden = true;
      document.body.style.overflow = '';
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
        <span class="tier-icon">${tier.icon}</span>
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

    // Scope Toggle
    if (scopeSemesterBtn && scopeAllTimeBtn) {
      scopeSemesterBtn.addEventListener('click', () => {
        if (currentScope === 'semester') return;
        currentScope = 'semester';
        scopeSemesterBtn.classList.add('on');
        scopeSemesterBtn.setAttribute('aria-selected', 'true');
        scopeAllTimeBtn.classList.remove('on');
        scopeAllTimeBtn.setAttribute('aria-selected', 'false');
        refreshView();
      });

      scopeAllTimeBtn.addEventListener('click', () => {
        if (currentScope === 'all') return;
        currentScope = 'all';
        scopeAllTimeBtn.classList.add('on');
        scopeAllTimeBtn.setAttribute('aria-selected', 'true');
        scopeSemesterBtn.classList.remove('on');
        scopeSemesterBtn.setAttribute('aria-selected', 'false');
        refreshView();
      });
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
  function init() {
    initEvents();
    renderDeptPills();
    refreshView();
    updateSimulator();
  }

  if (document.readyState === 'loading') {
    /* the archive now loads from JSON — wait for it before first paint */
    document.addEventListener('DOMContentLoaded', async () => {
      await globalThis.ABHYAS_READY;
      init();
    });
  } else {
    init();
  }

})();
