const KEYS = {
  studyLog: 'cfa_study_log',
  dailyGoal: 'cfa_daily_goal',
  completed: 'cfa_completed',
};

// Queue a cloud sync if the helper is available (set by firebase-sync.js)
function queueSync(reason = 'change') {
  if (window.queueCloudSync) window.queueCloudSync(reason);
}

function today() {
  return new Date().toISOString().split('T')[0];
}
function getStudyLog() {
  return JSON.parse(localStorage.getItem(KEYS.studyLog) || '[]');
}
function applyEntryMetrics(entry, goal) {
  const hours = Number(entry.hours || 0);
  const missed = Math.max(0, goal - hours);
  entry.missed = missed;
  entry.rollover = goal - hours;
}
function saveStudyLog(log) {
  localStorage.setItem(KEYS.studyLog, JSON.stringify(log));
  queueSync('study-log');
}
function getDailyGoal() {
  return parseFloat(localStorage.getItem(KEYS.dailyGoal) || '3');
}
function saveDailyGoal(g) {
  localStorage.setItem(KEYS.dailyGoal, g.toString());
  queueSync('daily-goal');
}
function getCompleted() {
  return JSON.parse(localStorage.getItem(KEYS.completed) || '{}');
}
function saveCompleted(c) {
  localStorage.setItem(KEYS.completed, JSON.stringify(c));
  queueSync('completed');
}
function toggleCompleted(subjectId, topicId) {
  const c = getCompleted();
  const key = `s${subjectId}_t${topicId}`;
  c[key] = c[key] ? false : today();
  saveCompleted(c);
  return c[key];
}
function isCompleted(subjectId, topicId) {
  return !!getCompleted()[`s${subjectId}_t${topicId}`];
}
function logHoursForDate(date, hours) {
  const log = getStudyLog();
  const existing = log.find(l => l.date === date);
  const goal = getDailyGoal();
  if (existing) {
    existing.hours = hours;
    existing.auto = false;
    if (!Array.isArray(existing.topics)) existing.topics = [];
    applyEntryMetrics(existing, goal);
  } else {
    const entry = { date, hours, topics: [], auto: false };
    applyEntryMetrics(entry, goal);
    log.push(entry);
  }
  log.sort((a, b) => a.date.localeCompare(b.date));
  saveStudyLog(log);
}

// Remove any auto-filled entries so missing days don't affect rollover.
function purgeAutoEntries() {
  const log = getStudyLog();
  const filtered = log.filter(l => !(l && l.auto));
  if (filtered.length !== log.length) {
    saveStudyLog(filtered);
  }
}

function enrichStudyLogWithMetrics() {
  const goal = getDailyGoal();
  const log = getStudyLog();
  let changed = false;
  log.forEach(entry => {
    if (!entry || !entry.date) return;
    if (!Array.isArray(entry.topics)) { entry.topics = []; changed = true; }
    const beforeMissed = entry.missed;
    const beforeRollover = entry.rollover;
    applyEntryMetrics(entry, goal);
    if (beforeMissed !== entry.missed || beforeRollover !== entry.rollover) changed = true;
  });
  if (changed) saveStudyLog(log);
  return log;
}

// Backfill missing days (as 0h) so rollover + calendar show gaps consistently.
// Only fills up to the past year, and only if there is at least one entry already.
function getHoursForDate(date) {
  const log = getStudyLog();
  const entry = log.find(l => l.date === date);
  return entry ? entry.hours : 0;
}
function getTodayTarget() {
  const goal = getDailyGoal();
  const log = getStudyLog();
  const todayStr = today();
  let deficit = 0;
  log.filter(l => l.date < todayStr && !l.auto).forEach(l => { deficit += (goal - l.hours); });
  return Math.max(0, goal + deficit);
}
function progressRing(pct, color, size = 80, stroke = 7) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return `<svg width="${size}" height="${size}" style="transform:rotate(-90deg)">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--surface2)" stroke-width="${stroke}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"
      style="transition:stroke-dashoffset 0.6s ease"/>
  </svg>`;
}
async function loadData(options = {}) {
  const includeHidden = options && options.includeHidden === true;
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error('Failed to load data.json');
    const data = await res.json();
    const customSubjects = JSON.parse(localStorage.getItem('cfa_custom_subjects') || '[]');
    const customIds = new Set(customSubjects.map(s => s.id));
    data.subjects = [...data.subjects, ...customSubjects];
    const customOverlay = JSON.parse(localStorage.getItem('cfa_subject_overlays') || '{}');
    data.subjects.forEach(subject => {
      const overlay = customOverlay[subject.id] || null;
      subject.isCustom = customIds.has(subject.id);
      subject.isHidden = !!(overlay && overlay.hidden);
      if (overlay) {
        if (overlay.name) subject.name = overlay.name;
        if (overlay.shortName) subject.shortName = overlay.shortName;
        if (overlay.icon) subject.icon = overlay.icon;
        if (overlay.color) subject.color = overlay.color;
        if (overlay.chapters) subject.customChapters = overlay.chapters;
      }
    });
    if (!includeHidden) {
      data.subjects = data.subjects.filter(s => !s.isHidden);
    }
    return data;
  } catch (e) {
    console.error('Could not load data.json:', e);
    const customSubjects = JSON.parse(localStorage.getItem('cfa_custom_subjects') || '[]');
    const customOverlay = JSON.parse(localStorage.getItem('cfa_subject_overlays') || '{}');
    const subjects = customSubjects.map(subject => {
      const overlay = customOverlay[subject.id] || null;
      subject.isCustom = true;
      subject.isHidden = !!(overlay && overlay.hidden);
      if (overlay) {
        if (overlay.name) subject.name = overlay.name;
        if (overlay.shortName) subject.shortName = overlay.shortName;
        if (overlay.icon) subject.icon = overlay.icon;
        if (overlay.color) subject.color = overlay.color;
        if (overlay.chapters) subject.customChapters = overlay.chapters;
      }
      return subject;
    });
    return { subjects: includeHidden ? subjects : subjects.filter(s => !s.isHidden) };
  }
}

// Handles both built-in subjects (flat topics array) AND custom subjects (customChapters)
function countSubtopics(subject) {
  let count = 0;
  if (subject.topics) { count += subject.topics.length; }
  if (subject.customChapters) {
    subject.customChapters.forEach(chapter => {
      if (chapter.subtopics) count += chapter.subtopics.length;
    });
  }
  return count;
}

function countCompletedSubtopics(subject, completed) {
  let count = 0;
  if (subject.topics) {
    subject.topics.forEach(topic => {
      const key = `s${subject.id}_t${topic.id}`;
      if (completed[key] && completed[key] !== false) count++;
    });
  }
  if (subject.customChapters) {
    subject.customChapters.forEach(chapter => {
      if (chapter.subtopics) {
        chapter.subtopics.forEach(subtopic => {
          const key = `c${chapter.id}_st${subtopic.id}`;
          if (completed[key] && completed[key] !== false) count++;
        });
      }
    });
  }
  return count;
}

function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href').split('/').pop();
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

function getUserProfile() {
  const userId = localStorage.getItem('user_id');
  if (!userId) return null;
  const email = (localStorage.getItem('user_email') || '').trim();
  const storedName = (localStorage.getItem('user_name') || '').trim();
  const fallbackName = email ? email.split('@')[0] : 'Student';
  const name = storedName || fallbackName;
  return { userId, name, email };
}

function initUserNav() {
  const navLinks = document.querySelector('.nav-links');
  if (!navLinks) return;
  const existingMenu = navLinks.querySelector('.user-menu');
  if (existingMenu) existingMenu.remove();
  const loginAnchor = navLinks.querySelector('a[href="login.html"]');
  const profile = getUserProfile();
  if (!profile) {
    if (!loginAnchor) {
      const login = document.createElement('a');
      login.href = 'login.html';
      login.textContent = 'Login';
      navLinks.appendChild(login);
    } else {
      loginAnchor.textContent = 'Login';
    }
    return;
  }
  if (loginAnchor) loginAnchor.remove();
  const initials = profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'U';
  const menu = document.createElement('div');
  menu.className = 'user-menu';
  menu.innerHTML = `
    <button type="button" class="user-menu-toggle" aria-expanded="false">
      <span class="user-avatar">${initials}</span>
      <span class="user-name">${profile.name}</span>
    </button>
    <div class="user-menu-dropdown" hidden>
      <p class="user-menu-name">${profile.name}</p>
      <p class="user-menu-email">${profile.email || 'No email available'}</p>
      <button type="button" class="user-save-btn">Sync Now</button>
      <button type="button" class="user-save-logout-btn">Sync & Logout</button>
      <button type="button" class="user-logout-btn">Logout</button>
    </div>
  `;
  navLinks.appendChild(menu);
  const toggle = menu.querySelector('.user-menu-toggle');
  const dropdown = menu.querySelector('.user-menu-dropdown');
  const logoutBtn = menu.querySelector('.user-logout-btn');
  const saveBtn = menu.querySelector('.user-save-btn');
  const saveLogoutBtn = menu.querySelector('.user-save-logout-btn');
  const closeMenu = () => { dropdown.hidden = true; toggle.setAttribute('aria-expanded', 'false'); menu.classList.remove('open'); };
  const openMenu = () => { dropdown.hidden = false; toggle.setAttribute('aria-expanded', 'true'); menu.classList.add('open'); };
  toggle.addEventListener('click', (e) => { e.stopPropagation(); if (menu.classList.contains('open')) closeMenu(); else openMenu(); });
  menu.addEventListener('click', (e) => { e.stopPropagation(); });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) closeMenu(); });
  logoutBtn.addEventListener('click', async () => {
    if (window.firebaseSignOut) {
      try {
        await window.firebaseSignOut();
      } catch (err) {
        console.warn('Firebase sign-out failed', err);
      }
    }
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_name');
    window.location.href = 'login.html';
  });

  async function saveAllData(reason = 'manual-save') {
    enrichStudyLogWithMetrics();
    if (window.forceCloudSync) {
      await window.forceCloudSync(reason);
      return;
    }
    if (window.queueCloudSync) window.queueCloudSync(reason);
  }

  async function runSave(button, labelWhenDone = 'Saved') {
    if (!button) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Saving...';
    try {
      if (window.cloudSyncReady) await window.cloudSyncReady;
      await saveAllData();
      button.textContent = labelWhenDone;
      setTimeout(() => { button.textContent = original; button.disabled = false; }, 1200);
    } catch (err) {
      console.warn('Save failed', err);
      button.textContent = original;
      button.disabled = false;
      alert('Save failed. Please try again.');
    }
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => runSave(saveBtn, 'Saved'));
  }

  if (saveLogoutBtn) {
    saveLogoutBtn.addEventListener('click', async () => {
      await runSave(saveLogoutBtn, 'Saved');
      logoutBtn.click();
    });
  }
}

function initQA() {
  document.querySelectorAll('.qa-question').forEach(q => {
    q.addEventListener('click', () => {
      const ans = q.nextElementSibling;
      const chev = q.querySelector('.qa-chevron');
      ans.classList.toggle('open');
      if (chev) chev.classList.toggle('open');
    });
  });
}

initUserNav();
purgeAutoEntries();

function buildHeatmap(containerId, log, goal) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const todayDate = new Date();
  const cells = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const entry = log.find(l => l.date === dateStr);
    const hours = entry ? entry.hours : 0;
    let level = 0;
    if (hours > 0) {
      const ratio = hours / goal;
      if (ratio >= 1) level = 4;
      else if (ratio >= 0.75) level = 3;
      else if (ratio >= 0.5) level = 2;
      else level = 1;
    }
    cells.push(`<div class="heat-cell heat-${level}" data-tip="${dateStr}: ${hours}h"></div>`);
  }
  el.innerHTML = cells.join('');
}
