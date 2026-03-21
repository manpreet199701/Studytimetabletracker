// app.js — shared helpers for Study Time Table Tracker
// Provides: data helpers, nav, heatmap, subject counters

// ── Date ─────────────────────────────────────────────────
function today() {
  return new Date().toISOString().split('T')[0];
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

// ── Today's Target (with rollover) ───────────────────────
// Looks at all past days since the last fully-met day and adds any deficit.
function getTodayTarget() {
  const goal = getDailyGoal();
  const log  = getStudyLog();
  const todayStr = today();
  let deficit = 0;

  // Walk backwards through all logged dates before today
  const pastEntries = log
    .filter(l => l.date < todayStr && !l.auto)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const entry of pastEntries) {
    const shortfall = goal - entry.hours;
    if (shortfall > 0) {
      deficit += shortfall;
    } else {
      // Surplus cancels deficit
      deficit = Math.max(0, deficit + shortfall);
    }
  }

  return goal + deficit;
}

// ── Completed Topics ─────────────────────────────────────
function getCompleted() {
  return JSON.parse(localStorage.getItem('cfa_completed') || '{}');
}
function saveCompleted(obj) {
  localStorage.setItem('cfa_completed', JSON.stringify(obj));
}

// ── Subject Topic Counters ───────────────────────────────
// Handles both built-in subjects (topics[]) and custom subjects (customChapters[])
function countSubtopics(subject) {
  let n = 0;
  if (Array.isArray(subject.topics)) n += subject.topics.length;
  if (Array.isArray(subject.customChapters)) {
    subject.customChapters.forEach(ch => {
      n += (ch.subtopics || []).length;
    });
  }
  return n;
}
function countCompletedSubtopics(subject, completed) {
  let n = 0;
  if (Array.isArray(subject.topics)) {
    subject.topics.forEach(t => {
      const v = completed[`s${subject.id}_t${t.id}`];
      if (v && v !== false) n++;
    });
  }
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

// ── Active Nav ───────────────────────────────────────────
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

  // Update login/profile link based on auth state
  window.initUserNav = function() {
    const profile = getUserProfile();
    const link = document.getElementById('loginLink');
    if (!link) return;
    if (profile) {
      link.textContent = profile.name;
      link.href = 'login.html';
    } else {
      link.textContent = 'Login';
      link.href = 'login.html';
    }
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
