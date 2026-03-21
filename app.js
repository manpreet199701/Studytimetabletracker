// app.js — shared helpers for Study Time Table Tracker
// Provides: data helpers, nav, heatmap, subject counters

// ── Date ─────────────────────────────────────────────────
// Uses LOCAL date, not UTC — avoids off-by-one in timezones like IST (UTC+5:30)
// where toISOString() can return yesterday before 5:30am local time.
function today() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// ── Study Log ────────────────────────────────────────────
function getStudyLog() {
  return JSON.parse(localStorage.getItem('cfa_study_log') || '[]');
}
function saveStudyLog(log) {
  localStorage.setItem('cfa_study_log', JSON.stringify(log));
}
function getHoursForDate(dateStr) {
  const entry = getStudyLog().find(l => l.date === dateStr);
  return entry ? entry.hours : 0;
}
function logHoursForDate(dateStr, hours) {
  const log = getStudyLog();
  const idx = log.findIndex(l => l.date === dateStr);
  if (idx !== -1) {
    log[idx].hours = hours;
  } else {
    log.push({ date: dateStr, hours });
  }
  saveStudyLog(log);
}

// ── Daily Goal ───────────────────────────────────────────
function getDailyGoal() {
  return parseFloat(localStorage.getItem('cfa_daily_goal') || '3');
}
function saveDailyGoal(val) {
  localStorage.setItem('cfa_daily_goal', String(val));
}

// ── Start Date ───────────────────────────────────────────
// Recorded automatically the very first time the app loads.
// Never overwritten — so Day 1 is always Day 1.
// Can be manually corrected via the date picker on the dashboard.
function getStartDate() {
  let stored = localStorage.getItem('cfa_start_date');
  if (stored) return stored;

  // First time ever: auto-set to today and save it permanently
  const t = today();
  localStorage.setItem('cfa_start_date', t);
  return t;
}
function setStartDate(dateStr) {
  localStorage.setItem('cfa_start_date', dateStr);
}

// ── Today's Target (with rollover) ───────────────────────
// Rule: every day you explicitly log 0 hours = +goal to rollover.
// Days you studied (any hours > 0) = no effect on rollover.
// Days with no log entry at all = ignored.
function getTodayTarget() {
  const goal     = getDailyGoal();
  const log      = getStudyLog();
  const todayStr = today();

  // Simple rule:
  // Every past entry where hours === 0 means "I didn't study" → +goal to rollover.
  // Days with no entry at all are ignored (user hasn't said anything about them).
  // Days with hours > 0 are ignored (they studied, no rollover for that day).
  const missedEntries = log.filter(l =>
    l.date < todayStr &&
    !l.auto &&
    (l.hours === 0 || l.hours === '0')
  );

  const rollover = missedEntries.length * goal;
  return goal + rollover;
}

// ── Completed Topics ─────────────────────────────────────
function getCompleted() {
  return JSON.parse(localStorage.getItem('cfa_completed') || '{}');
}
function saveCompleted(obj) {
  localStorage.setItem('cfa_completed', JSON.stringify(obj));
}

// ── Subject Topic Counters ───────────────────────────────
// Rules:
//   - Built-in subject (isCustom=false, has topics[]): only count topics[].
//     subject.html renders ONLY topics[] for built-in subjects and returns early,
//     so any customChapters on a built-in subject are invisible and uncountable.
//   - Custom subject (isCustom=true, no topics[]): count customChapters subtopics.
//   - If a subject has neither, count = 0.
function countSubtopics(subject) {
  // Built-in subject: has real topics[] — only count those
  if (Array.isArray(subject.topics) && subject.topics.length > 0) {
    return subject.topics.length;
  }
  // Custom subject: count all subtopics inside customChapters
  let n = 0;
  if (Array.isArray(subject.customChapters)) {
    subject.customChapters.forEach(ch => {
      n += (ch.subtopics || []).length;
    });
  }
  return n;
}

function countCompletedSubtopics(subject, completed) {
  // Built-in subject: only check topics[] keys
  if (Array.isArray(subject.topics) && subject.topics.length > 0) {
    return subject.topics.filter(t => {
      const v = completed[`s${subject.id}_t${t.id}`];
      return v && v !== false;
    }).length;
  }
  // Custom subject: check customChapters subtopic keys
  let n = 0;
  if (Array.isArray(subject.customChapters)) {
    subject.customChapters.forEach(ch => {
      (ch.subtopics || []).forEach(st => {
        const v = completed[`c${ch.id}_st${st.id}`];
        if (v && v !== false) n++;
      });
    });
  }
  return n;
}

// ── Load Data ─────────────────────────────────────────────
// Built-in CFA subjects baseline — merged with custom subjects and overlays.
const BUILT_IN_SUBJECTS = [
  {
    id: 1,
    name: 'Ethical and Professional Standards',
    shortName: 'Ethics',
    icon: '⚖️',
    color: '#6C47FF',
    topics: [
      { id: 1, name: 'Ethics and Trust in the Investment Profession' },
      { id: 2, name: 'Code of Ethics and Standards of Professional Conduct' },
      { id: 3, name: 'Guidance for Standards I–VII' },
      { id: 4, name: 'Introduction to the Global Investment Performance Standards (GIPS)' },
      { id: 5, name: 'Ethics Application' }
    ]
  },
  {
    id: 2,
    name: 'Quantitative Methods',
    shortName: 'Quant',
    icon: '📐',
    color: '#38BFFF',
    topics: [
      { id: 1, name: 'Rates and Returns' },
      { id: 2, name: 'Time Value of Money in Finance' },
      { id: 3, name: 'Statistical Measures of Asset Returns' },
      { id: 4, name: 'Probability Trees and Conditional Expectations' },
      { id: 5, name: 'Portfolio Mathematics' },
      { id: 6, name: 'Simulation Methods' },
      { id: 7, name: 'Estimation and Inference' },
      { id: 8, name: 'Hypothesis Testing' },
      { id: 9, name: 'Parametric and Non-Parametric Tests of Independence' },
      { id: 10, name: 'Simple Linear Regression' },
      { id: 11, name: 'Introduction to Big Data Techniques' }
    ]
  },
  {
    id: 3,
    name: 'Economics',
    shortName: 'Econ',
    icon: '🌐',
    color: '#00C896',
    topics: [
      { id: 1, name: 'The Firm and Market Structures' },
      { id: 2, name: 'Understanding Business Cycles' },
      { id: 3, name: 'Fiscal Policy' },
      { id: 4, name: 'Monetary Policy' },
      { id: 5, name: 'Introduction to Geopolitics' },
      { id: 6, name: 'International Trade and Capital Flows' },
      { id: 7, name: 'Currency Exchange Rates' }
    ]
  },
  {
    id: 4,
    name: 'Financial Statement Analysis',
    shortName: 'FSA',
    icon: '📊',
    color: '#FF6B9D',
    topics: [
      { id: 1, name: 'Introduction to Financial Statement Analysis' },
      { id: 2, name: 'Analyzing Income Statements' },
      { id: 3, name: 'Analyzing Balance Sheets' },
      { id: 4, name: 'Analyzing Statements of Cash Flows I' },
      { id: 5, name: 'Analyzing Statements of Cash Flows II' },
      { id: 6, name: 'Analysis of Inventories' },
      { id: 7, name: 'Analysis of Long-Term Assets' },
      { id: 8, name: 'Topics in Long-Term Liabilities and Equity' },
      { id: 9, name: 'Analysis of Income Taxes' },
      { id: 10, name: 'Financial Reporting Quality' },
      { id: 11, name: 'Financial Analysis Techniques' },
      { id: 12, name: 'Introduction to Financial Statement Modeling' }
    ]
  },
  {
    id: 5,
    name: 'Corporate Issuers',
    shortName: 'Corp',
    icon: '🏢',
    color: '#FFB347',
    topics: [
      { id: 1, name: 'Organizational Forms, Corporate Issuer Features, and Ownership' },
      { id: 2, name: 'Investors and Other Stakeholders' },
      { id: 3, name: 'Corporate Governance: Conflicts, Mechanisms, Risks, and Benefits' },
      { id: 4, name: 'Working Capital and Liquidity' },
      { id: 5, name: 'Capital Investments and Capital Allocation' },
      { id: 6, name: 'Capital Structure' },
      { id: 7, name: 'Business Models' }
    ]
  },
  {
    id: 6,
    name: 'Equity Investments',
    shortName: 'Equity',
    icon: '📈',
    color: '#A78BFA',
    topics: [
      { id: 1, name: 'Market Organization and Structure' },
      { id: 2, name: 'Security Market Indexes' },
      { id: 3, name: 'Market Efficiency' },
      { id: 4, name: 'Overview of Equity Securities' },
      { id: 5, name: 'Introduction to Industry and Company Analysis' },
      { id: 6, name: 'Equity Valuation: Concepts and Basic Tools' }
    ]
  },
  {
    id: 7,
    name: 'Fixed Income',
    shortName: 'Fixed Inc.',
    icon: '🏦',
    color: '#00D4AA',
    topics: [
      { id: 1, name: 'Fixed-Income Instrument Features' },
      { id: 2, name: 'Fixed-Income Cash Flows and Types' },
      { id: 3, name: 'Fixed-Income Issuance and Trading' },
      { id: 4, name: 'Fixed-Income Markets for Corporate Issuers' },
      { id: 5, name: 'Fixed-Income Markets for Government Issuers' },
      { id: 6, name: 'Fixed-Income Bond Valuation: Prices and Yields' },
      { id: 7, name: 'Yield and Yield Spread Measures for Fixed-Rate Bonds' },
      { id: 8, name: 'Yield and Yield Spread Measures for Floating-Rate Instruments' },
      { id: 9, name: 'The Term Structure of Interest Rates: Spot, Par, and Forward Curves' },
      { id: 10, name: 'Interest Rate Risk and Return' },
      { id: 11, name: 'Credit Risk' },
      { id: 12, name: 'Asset-Backed Security (ABS) Instrument and Market Features' }
    ]
  },
  {
    id: 8,
    name: 'Derivatives',
    shortName: 'Deriv.',
    icon: '🔄',
    color: '#FF9F1C',
    topics: [
      { id: 1, name: 'Derivative Instrument and Derivative Market Features' },
      { id: 2, name: 'Forward Commitment and Contingent Claim Features and Instruments' },
      { id: 3, name: 'Derivative Benefits, Risks, and Issuer and Investor Uses' },
      { id: 4, name: 'Arbitrage, Replication, and the Cost of Carry in Pricing Derivatives' },
      { id: 5, name: 'Pricing and Valuation of Forward Contracts and for an Underlying with Varying Maturities' },
      { id: 6, name: 'Pricing and Valuation of Futures Contracts' },
      { id: 7, name: 'Pricing and Valuation of Interest Rates and Other Swaps' },
      { id: 8, name: 'Pricing and Valuation of Options' },
      { id: 9, name: 'Option Replication Using Put–Call Parity' },
      { id: 10, name: 'Valuing a Derivative Using a One-Period Binomial Model' }
    ]
  },
  {
    id: 9,
    name: 'Alternative Investments',
    shortName: 'Alts',
    icon: '💎',
    color: '#FF4D6D',
    topics: [
      { id: 1, name: 'Alternative Investment Features, Methods, and Structures' },
      { id: 2, name: 'Alternative Investment Performance and Returns' },
      { id: 3, name: 'Investments in Private Capital: Equity and Debt' },
      { id: 4, name: 'Real Estate and Infrastructure' },
      { id: 5, name: 'Natural Resources' },
      { id: 6, name: 'Hedge Funds' },
      { id: 7, name: 'Introduction to Digital Assets' }
    ]
  },
  {
    id: 10,
    name: 'Portfolio Management',
    shortName: 'Portfolio',
    icon: '🗂️',
    color: '#F59E0B',
    topics: [
      { id: 1, name: 'Portfolio Risk and Return: Part I' },
      { id: 2, name: 'Portfolio Risk and Return: Part II' },
      { id: 3, name: 'Portfolio Management: An Overview' },
      { id: 4, name: 'Basics of Portfolio Planning and Construction' },
      { id: 5, name: 'The Behavioral Biases of Individuals' },
      { id: 6, name: 'Introduction to Risk Management' },
      { id: 7, name: 'Technical Analysis' },
      { id: 8, name: 'FinTech in Investment Management' }
    ]
  }
];

async function loadData(options = {}) {
  const includeHidden = options.includeHidden || false;

  // Load overlays (user edits / hidden flags for built-in subjects)
  const overlays = JSON.parse(localStorage.getItem('cfa_subject_overlays') || '{}');

  // Apply overlays to built-in subjects
  let subjects = BUILT_IN_SUBJECTS.map(s => {
    const ov = overlays[s.id] || {};
    const merged = {
      ...s,
      name:           ov.name      || s.name,
      shortName:      ov.shortName || s.shortName,
      icon:           ov.icon      || s.icon,
      color:          ov.color     || s.color,
      isHidden:       ov.hidden    || false,
      isCustom:       false,
      customChapters: ov.chapters  || []
    };
    return merged;
  });

  // Load custom subjects
  const customSubjects = JSON.parse(localStorage.getItem('cfa_custom_subjects') || '[]');
  const customMerged = customSubjects.map(s => ({
    ...s,
    isCustom: true,
    isHidden: false
  }));

  subjects = [...subjects, ...customMerged];

  if (!includeHidden) {
    subjects = subjects.filter(s => !s.isHidden);
  }

  return { subjects };
}

// ── User Profile ─────────────────────────────────────────
function getUserProfile() {
  const name  = localStorage.getItem('user_name');
  const email = localStorage.getItem('user_email');
  const id    = localStorage.getItem('user_id');
  if (!id) return null;
  return { name: name || email || 'Student', email: email || '', id };
}

// ── Active Nav + User Menu ────────────────────────────────
function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    } else {
      a.classList.remove('active');
    }
  });

  // Build/update the user menu in the nav
  window.initUserNav = function() {
    const profile = getUserProfile();
    const nav     = document.querySelector('nav');
    if (!nav) return;

    // Remove any existing user menu
    const existing = nav.querySelector('.user-menu');
    if (existing) existing.remove();

    if (!profile) {
      // Not signed in — show plain Login link
      const link = document.getElementById('loginLink');
      if (link) { link.textContent = 'Login'; link.href = 'login.html'; }
      return;
    }

    // Hide the plain loginLink — replaced by the menu
    const link = document.getElementById('loginLink');
    if (link) link.style.display = 'none';

    // Build initials avatar
    const initials = profile.name
      ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
      : '?';

    const menu = document.createElement('div');
    menu.className = 'user-menu';
    menu.innerHTML = `
      <button class="user-menu-toggle" id="userMenuToggle">
        <span class="user-avatar">${initials}</span>
        <span class="user-name">${profile.name}</span>
        <span style="font-size:0.65rem;color:var(--text-dim);margin-left:2px">▾</span>
      </button>
      <div class="user-menu-dropdown" id="userMenuDropdown" style="display:none">
        <div class="user-menu-name">${profile.name}</div>
        <div class="user-menu-email">${profile.email}</div>
        <hr style="border:none;border-top:1px solid var(--border);margin:0.75rem 0"/>
        <button class="user-save-btn" id="userSaveBtn">☁️ Save to Cloud</button>
        <button class="user-save-logout-btn" id="userSaveLogoutBtn">💾 Save &amp; Logout</button>
        <button class="user-logout-btn" id="userLogoutBtn">🚪 Logout</button>
      </div>
    `;
    nav.appendChild(menu);

    // Toggle dropdown
    document.getElementById('userMenuToggle').addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = document.getElementById('userMenuDropdown');
      dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    });

    // Close on outside click
    document.addEventListener('click', () => {
      const dd = document.getElementById('userMenuDropdown');
      if (dd) dd.style.display = 'none';
    });

    // Save to cloud
    document.getElementById('userSaveBtn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.target;
      btn.textContent = '⏳ Saving…';
      btn.disabled = true;
      try {
        if (typeof window.forceCloudSync === 'function') await window.forceCloudSync('manual-save');
        btn.textContent = '✅ Saved!';
        setTimeout(() => { btn.textContent = '☁️ Save to Cloud'; btn.disabled = false; }, 1800);
      } catch {
        btn.textContent = '❌ Failed';
        setTimeout(() => { btn.textContent = '☁️ Save to Cloud'; btn.disabled = false; }, 1800);
      }
    });

    // Save & Logout
    document.getElementById('userSaveLogoutBtn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.target;
      btn.textContent = '⏳ Saving…';
      btn.disabled = true;
      try {
        if (typeof window.forceCloudSync === 'function') await window.forceCloudSync('save-logout');
        if (typeof window.firebaseSignOut === 'function') await window.firebaseSignOut();
        window.location.href = 'login.html';
      } catch {
        btn.textContent = '❌ Failed';
        setTimeout(() => { btn.textContent = '💾 Save & Logout'; btn.disabled = false; }, 1800);
      }
    });

    // Logout
    document.getElementById('userLogoutBtn').addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        if (typeof window.firebaseSignOut === 'function') await window.firebaseSignOut();
        window.location.href = 'login.html';
      } catch (err) {
        console.error('Logout failed', err);
      }
    });
  };

  window.initUserNav();
}

// ── Heatmap ──────────────────────────────────────────────
function buildHeatmap(containerId, log, goal) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const todayStr = today();
  const cells = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const entry = log.find(l => l.date === dateStr);
    const hours = entry ? entry.hours : 0;
    let level = 0;
    if (hours > 0) {
      const ratio = hours / goal;
      if (ratio >= 1)        level = 4;
      else if (ratio >= 0.75) level = 3;
      else if (ratio >= 0.5)  level = 2;
      else                    level = 1;
    }
    const isToday = dateStr === todayStr;
    cells.push(`<div class="heat-cell heat-${level}${isToday ? ' heat-today' : ''}" data-tip="${dateStr}: ${hours}h" title="${dateStr}: ${hours}h"></div>`);
  }
  el.innerHTML = cells.join('');
}

// ── queueCloudSync alias ─────────────────────────────────
// firebase-sync.js sets window.queueCloudSync; this alias
// ensures pages that call queueSync() still work.
window.queueSync = function(...args) {
  if (typeof window.queueCloudSync === 'function') {
    window.queueCloudSync(...args);
  }
};
