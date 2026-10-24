(() => {
  'use strict';
  const B = Budget,
    KEY = 'allocate-studio.ultimate-budget.v2',
    $ = (s) => document.querySelector(s),
    esc = (s) =>
      String(s ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
      );
  const uid = () =>
    crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const defaults = {
    Income: ['Income'],
    Housing: ['Rent / Mortgage', 'Home Maintenance'],
    'Bills & Utilities': ['Electricity & Gas', 'Water', 'Internet', 'Phone'],
    Food: ['Groceries', 'Dining Out', 'Coffee'],
    Transportation: ['Car Payment', 'Gas', 'Car Maintenance', 'Public Transit'],
    Health: ['Medical', 'Fitness'],
    Family: ['Childcare', 'Kids Activities', 'Pets'],
    Shopping: ['Clothing', 'Household', 'Personal Care'],
    Lifestyle: ['Subscriptions', 'Entertainment', 'Travel', 'Gifts'],
    Other: ['Insurance', 'Fees', 'Miscellaneous'],
  };
  const groupId = (name) => 'group-' + name.toLowerCase().replace(/[^a-z]+/g, '-');
  function defaultGroups() {
    return Object.keys(defaults).map((name) => ({
      id: groupId(name),
      name,
      type: name === 'Income' ? 'Income' : 'Expense',
    }));
  }
  function defaultCategories() {
    return Object.entries(defaults).flatMap(([group, names]) =>
      names.map((name, i) => ({
        id:
          group === 'Income'
            ? `Income-${i}`
            : name === 'Groceries'
              ? 'Needs-2'
              : `${groupId(group)}-${i}`,
        name,
        type: group === 'Income' ? 'Income' : 'Expense',
        groupId: groupId(group),
        hidden: false,
        budget: 0,
      })),
    );
  }
  function migrate(s) {
    if (s.version === 3) {
      const n = structuredClone(s);
      n.version = 4;
      for (const g of n.groups) {
        const cats = n.categories.filter((c) => c.groupId === g.id),
          cents = Math.round((g.budget || 0) * 100),
          share = cats.length ? Math.floor(cents / cats.length) : 0;
        cats.forEach((c, i) => {
          c.budget = (share + (i < cents - share * cats.length ? 1 : 0)) / 100;
        });
        delete g.budget;
        delete g.sampleBudget;
        delete g.beforeSampleBudget;
      }
      return n;
    }
    if (s.version !== 2) return s;
    const n = structuredClone(s);
    n.version = 4;
    n.budgetStart = n.month + '-01';
    n.groups = defaultGroups();
    const aliases = {
      'Rent/Mortgage': 'Rent / Mortgage',
      Utilities: 'Electricity & Gas',
      'Phone & Internet': 'Internet',
      Healthcare: 'Medical',
      Shopping: 'Clothing',
      Transportation: 'Public Transit',
    };
    for (const c of n.categories) {
      const oldName = c.name,
        canonical = aliases[oldName] || oldName;
      const group =
        c.bucket === 'Income'
          ? 'Income'
          : Object.keys(defaults).find((g) => g !== 'Income' && defaults[g].includes(canonical)) ||
            'Other';
      c.type = c.bucket === 'Income' ? 'Income' : 'Expense';
      c.groupId = groupId(group);
      c.hidden = false;
      c.name = canonical;
      c.budget = c.budget || 0;
      delete c.bucket;
      delete c.sampleBudget;
      delete c.beforeSampleBudget;
    }
    for (const c of defaultCategories())
      if (!n.categories.some((x) => x.name === c.name && x.type === c.type)) {
        if (n.categories.some((x) => x.id === c.id)) c.id = uid();
        n.categories.push(c);
      }
    return n;
  }
  const currencyOptions =
    '<option value="$">USD \u2014 US dollar ($)</option><option value="\u20ac">EUR \u2014 Euro (\u20ac)</option><option value="\u00a3">GBP \u2014 British pound (\u00a3)</option><option value="CA$">CAD \u2014 Canadian dollar (CA$)</option><option value="A$">AUD \u2014 Australian dollar (A$)</option><option value="NZ$">NZD \u2014 New Zealand dollar (NZ$)</option><option value="CHF">CHF \u2014 Swiss franc</option><option value="\u00a5">JPY \u2014 Japanese yen (\u00a5)</option><option value="CN\u00a5">CNY \u2014 Chinese yuan (CN\u00a5)</option><option value="\u20b9">INR \u2014 Indian rupee (\u20b9)</option><option value="\u20bd">RUB \u2014 Russian ruble (\u20bd)</option><option value="\u20b4">UAH \u2014 Ukrainian hryvnia (\u20b4)</option><option value="z\u0142">PLN \u2014 Polish z\u0142oty (z\u0142)</option><option value="R$">BRL \u2014 Brazilian real (R$)</option><option value="MX$">MXN \u2014 Mexican peso (MX$)</option><option value="S$">SGD \u2014 Singapore dollar (S$)</option><option value="HK$">HKD \u2014 Hong Kong dollar (HK$)</option><option value="AED">AED \u2014 UAE dirham</option><option value="\u20a9">KRW \u2014 South Korean won (\u20a9)</option><option value="\u20ba">TRY \u2014 Turkish lira (\u20ba)</option><option value="custom">Other \u2014 custom symbol</option>';
  const currencySymbols = [
    '$',
    '€',
    '£',
    'CA$',
    'A$',
    'NZ$',
    'CHF',
    '¥',
    'CN¥',
    '₹',
    '₽',
    '₴',
    'zł',
    'R$',
    'MX$',
    'S$',
    'HK$',
    'AED',
    '₩',
    '₺',
  ];
  // Spending breakdown palette: pink, lavender, coral and warm yellow; no lime.
  const colours = [
    '#FFA0CE',
    '#DFC4F7',
    '#F3ACA8',
    '#FFE68A',
    '#ABDDE5',
    '#FFD09F',
    '#A9DED2',
    '#B7D7A8',
    '#BFC5E0',
    '#F4B3A3',
    '#E7BDD5',
    '#F1C574',
    '#B9DCEE',
    '#E5D19A',
    '#B1D1CA',
    '#F5D1BC',
    '#C7D0B8',
    '#E3C9DF',
    '#B0C6B7',
    '#D4CDE3',
    '#D5C2B3',
  ];
  function empty() {
    return {
      version: 4,
      incomeDefaultsVersion: 1,
      currency: '$',
      week: 'Monday',
      budgetStart: B.today().slice(0, 7) + '-01',
      month: B.today().slice(0, 7),
      onboarded: false,
      groups: defaultGroups(),
      categories: defaultCategories(),
      accounts: [],
      transactions: [],
      recurring: [],
      scheduled: [],
      skipped: [],
      debts: [],
      goals: [],
      extra: 0,
      strategy: 'Snowball',
    };
  }
  let state = empty(),
    raw = null,
    blocked = false;
  try {
    raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      state = validateImport(s);
    } else {
      const p = JSON.parse(localStorage.getItem('allocate-studio.ultimate-budget.preferences.v1'));
      if (p) {
        state.currency = p.currencySymbol || '$';
        state.week = p.weekStartsOn || 'Monday';
        state.month = p.month || state.month;
      }
    }
  } catch {
    blocked = true;
  }
  let editingBudget = null,
    spendingExpanded = false,
    dashMode = 'Month';
  const openBudgetGroups = new Set();
  let screen = 'Dashboard',
    tab = 'Payment Schedule',
    filters = { month: state.month, category: '', account: '', type: '', search: '' };
  const screens = [
    'Dashboard',
    'Transactions',
    'Recurring',
    'Bill Calendar',
    'Accounts',
    'Debt Payoff',
    'Savings',
    'Setup',
  ];
  // Negative amounts put the sign before the currency: −$120.00, not $-120.00.
  const signed = (value, format) =>
    (B.round(value) < 0 && format(Math.abs(value)) !== format(0) ? '−' : '') +
    esc(state.currency) +
    format(Math.abs(value));
  const money = (n) =>
    signed(Number(n || 0), (v) =>
      v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    );
  // Whole units for tight spaces such as phone calendar cells: $39, $1,800, $12k.
  const shortMoney = (n) =>
    signed(Number(n || 0), (v) =>
      v >= 10000
        ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
            .format(v)
            .toLowerCase()
        : Math.round(v).toLocaleString('en-US'),
    );
  const name = (list, id) => esc(state[list].find((x) => x.id === id)?.name || '—');
  const total = (rows, fn) => B.sum(rows, fn),
    pct = (a, b) => (b > 0 ? Math.min(100, Math.max(0, (a / b) * 100)) : 0);
  const bar = (a, b) =>
    `<div class="meter" role="progressbar" aria-valuenow="${Math.round(pct(a, b))}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct(a, b)}%"></span></div>`;
  const btn = (label, action, id = '', cls = 'btn') =>
    `<button type="button" class="${cls}" data-action="${action}" data-id="${esc(id)}">${label}</button>`;
  const edit = (kind, id, label, cls = 'row-link') =>
    `<button type="button" class="${cls}" data-edit="${kind}" data-id="${esc(id)}">${label}</button>`;
  const panel = (title, body, action = '') =>
    `<section class="panel"><div class="panel-head"><h2>${title}</h2>${action}</div>${body}</section>`;
  function toast(text) {
    $('#toast').textContent = text;
    $('#toast').classList.add('visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 3500);
  }
  function commit(next) {
    if (blocked) {
      toast('Saved data could not be read. Reload before making changes.');
      return false;
    }
    if (next.goals.some((g) => B.goalSaved(next, g.id) < 0)) {
      toast('This change would leave a goal below zero. Adjust its withdrawals first.');
      return false;
    }
    try {
      if (localStorage.getItem(KEY) !== raw) {
        toast('Another tab changed your budget. Reload this tab before saving.');
        return false;
      }
      const text = JSON.stringify(next);
      localStorage.setItem(KEY, text);
      raw = text;
      state = next;
      $('#save-state').textContent = 'Saved in this browser';
      return true;
    } catch {
      toast('Could not save. Browser storage may be full or unavailable.');
      return false;
    }
  }
  const mutate = (fn) => {
    const next = structuredClone(state);
    fn(next);
    if (commit(next)) {
      render();
      return true;
    }
    return false;
  };
  function heading(title, subtitle = '', actions = '') {
    return `<div class="budget-heading"><div class="stats-head"><h1>${title}</h1>${subtitle ? `<p class="muted">${subtitle}</p>` : ''}</div><div class="heading-actions">${screen === 'Dashboard' && dashMode === 'Year' ? `<div class="week-nav-picker year-picker"><button type="button" class="mp-step" data-action="dash-year" data-id="-1" aria-label="Previous year">‹</button><span class="mp-trigger">${state.month.slice(0, 4)}</span><button type="button" class="mp-step" data-action="dash-year" data-id="1" aria-label="Next year">›</button></div>` : ['Dashboard', 'Transactions', 'Recurring', 'Bill Calendar'].includes(screen) ? renderMonthPicker({ value: state.month, id: 'budget-month', locale: 'en-US' }) : ''}${actions}</div></div>`;
  }
  function stat(label, value, note, tone) {
    return `<div class="stat-tile ${tone}"><span class="stat-label">${label}</span><strong class="stat-value">${value}</strong><small>${note}</small></div>`;
  }
  function status(t) {
    if (t.skipped) return 'Skipped';
    if (t.paid)
      return t.recurringId
        ? 'Paid'
        : t.type === 'Transfer'
          ? 'Transferred'
          : t.type === 'Income'
            ? 'Received'
            : 'Paid';
    return t.date < B.today() ? 'Overdue' : t.date === B.today() ? 'Due today' : 'Upcoming';
  }
  // Withdrawals come from a goal rather than an account.
  const entrySource = (t) =>
    t.fromKind === 'goal' ? name('goals', t.fromId) : name('accounts', t.accountId);
  function entryCategory(t) {
    return t.type === 'Transfer'
      ? `Transfer → ${name({ account: 'accounts', debt: 'debts', goal: 'goals' }[t.toKind], t.toId)}`
      : name('categories', t.categoryId);
  }
  const dayLabel = (d) =>
    B.date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  function row(t, dated = false, showPaidCheck = false) {
    return edit(
      'transaction',
      t.id,
      `<span class="record-name">${esc(t.name)}${dated ? `<span class="record-date">${dayLabel(t.date)}</span>` : ''}<small>${esc(t.date)} · ${entryCategory(t)} · ${entrySource(t)}</small></span><span class="record-amount">${money(t.paid ? t.actual : t.expected)}<small class="${status(t) === 'Overdue' ? 'terracotta' : ''}">${showPaidCheck && t.paid ? '<i class="calendar-paid-check" aria-hidden="true">✓</i>Paid' : status(t)}</small></span>`,
    );
  }
  function rows(list, emptyText = 'No entries yet.') {
    return list.length
      ? `<div class="record-list">${list.map((t) => row(t)).join('')}</div>`
      : `<p class="empty-copy">${emptyText}</p>`;
  }
  function welcome() {
    return `<section class="welcome"><div><h2>Quick setup</h2><p>1. Add your accounts and opening balances in Setup.<br>2. Set monthly budgets for each category.<br>3. Record Actual amounts and mark entries Paid or Received.</p></div><div class="welcome-actions">${btn('Start setup', 'setup', '', 'btn primary')}${btn('Got it', 'dismiss')}${btn('Load sample data', 'sample')}</div></section>`;
  }
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const firstBudgetMonth = () => (state.budgetStart || '').slice(0, 7),
    thisMonth = () => B.today().slice(0, 7);
  // Budget months of the selected year that fall inside the budget.
  const budgetMonthsOf = (year) =>
    monthNames
      .map((_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
      .filter((m) => m >= firstBudgetMonth());
  function yearSummary(year) {
    const months = monthNames.map((_, i) => ({
      month: `${year}-${String(i + 1).padStart(2, '0')}`,
      ...B.summary(state, `${year}-${String(i + 1).padStart(2, '0')}`),
    }));
    const add = (key) => total(months, (m) => m[key]),
      income = add('income'),
      savings = add('savings');
    return {
      months,
      rows: months.flatMap((m) => m.rows),
      income,
      expense: add('expense'),
      expectedIncome: add('expectedIncome'),
      expectedExpense: add('expectedExpense'),
      left: add('left'),
      rate: income ? (savings / income) * 100 : 0,
    };
  }
  function spendingPanel(s) {
    const spent = state.categories
      .filter((c) => c.type !== 'Income')
      .map((c) => ({
        ...c,
        amount: total(
          s.rows.filter((t) => t.paid && t.type === 'Expense' && t.categoryId === c.id),
          (t) => t.actual,
        ),
      }));
    const allSegments = spent
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
    const segments =
      spendingExpanded || allSegments.length <= 8
        ? allSegments
        : [
            ...allSegments.slice(0, 8),
            { name: 'Other categories', amount: total(allSegments.slice(8), (c) => c.amount) },
          ];
    let offset = 0;
    const gradient = segments
      .map((c, i) => {
        const from = offset;
        offset += s.expense ? (c.amount / s.expense) * 100 : 0;
        return `${colours[i % colours.length]} ${from}% ${offset}%`;
      })
      .join(',');
    return panel(
      'Spending breakdown',
      `<div class="donut-wrap"><div class="donut-layout"><div class="donut" role="img" aria-label="Total actual expenses ${esc(state.currency)}${s.expense}" style="background:${segments.length ? 'conic-gradient(' + gradient + ')' : '#dededb'}"><div><small>Actual expenses</small><b>${money(s.expense)}</b></div></div><ul class="chart-legend" id="spending-legend">${segments.map((c, i) => `<li><i style="background:${colours[i % colours.length]}"></i><span>${esc(c.name)}</span><b>${money(c.amount)}</b></li>`).join('') || '<li>No expenses yet.</li>'}</ul></div></div>${allSegments.length > 8 ? `<div class="breakdown-actions"><button type="button" class="textbtn" data-action="toggle-spending" aria-expanded="${spendingExpanded}" aria-controls="spending-legend">${spendingExpanded ? 'Show less' : `Show all ${allSegments.length} categories`}</button></div>` : ''}`,
    );
  }
  function expectedPanel(s) {
    // Phones get rounded amounts so all four columns fit.
    const cell = (v, sign = '') =>
        `<td><span class="amt-full">${sign}${money(v)}</span><span class="amt-short">${sign}${shortMoney(v)}</span></td>`,
      line = (label, expected, actual) =>
        `<tr><th>${label}</th>${cell(expected)}${cell(actual)}${cell(actual - expected, B.round(actual - expected) > 0 ? '+' : '')}</tr>`;
    return panel(
      'Expected vs Actual',
      `<div class="table-wrap expected-wrap"><table class="expected-table"><thead><tr><th></th><th>Expected</th><th>Actual</th><th>Difference</th></tr></thead><tbody>${line('Income', s.expectedIncome, s.income)}${line('Expenses', s.expectedExpense, s.expense)}${line('Left to spend', s.expectedIncome - s.expectedExpense, s.left)}</tbody></table></div>`,
    );
  }
  // Group budgets for the given months; a single month can be edited per category.
  function budgetPanel(rowsList, months, editable) {
    const month = months[0],
      spentIn = (ids, type) =>
        total(
          rowsList.filter((t) => t.paid && t.type === type && ids.has(t.categoryId)),
          (t) => t.actual,
        ),
      budgetOf = (c) => total(months, (m) => B.budgetFor(c, m));
    const groups = state.groups
      .map((g) => {
        const cats = state.categories
          .filter((c) => c.groupId === g.id)
          .map((c) => ({ ...c, planned: budgetOf(c), spent: spentIn(new Set([c.id]), g.type) }))
          .filter((c) => !c.hidden || c.planned > 0 || c.spent > 0);
        return {
          ...g,
          cats,
          budget: total(cats, (c) => c.planned),
          amount: total(cats, (c) => c.spent),
        };
      })
      .filter((g) => g.cats.length && (editable || g.budget > 0 || g.amount > 0));
    const body = groups
      .map((g) => {
        const open = openBudgetGroups.has(g.id),
          over = g.type === 'Expense' && g.budget > 0 && g.amount > g.budget;
        const cats = open
          ? `<div class="budget-cats"><div class="budget-cat budget-cat-head"><span></span><span>Actual</span><span>Budget</span></div>${g.cats
              .map((c) => {
                const own = editable && c.budgetMonths?.[month] !== undefined,
                  catOver = g.type === 'Expense' && c.planned > 0 && c.spent > c.planned;
                return `<div class="budget-cat ${catOver ? 'over-budget' : ''}"><span>${esc(c.name)}</span><b>${money(c.spent)}</b>${editable ? `<button type="button" class="budget-input ${own ? 'is-own' : ''}" data-action="month-budget" data-id="${esc(c.id)}" aria-label="Edit ${esc(c.name)} budget">${money(c.planned)}</button>` : `<b class="budget-cat-plan">${money(c.planned)}</b>`}</div>`;
              })
              .join('')}</div>`
          : '';
        return `<div class="budget-line budget-group ${over ? 'over-budget' : ''} ${open ? 'is-open' : ''}"><button type="button" class="budget-label" data-action="toggle-budget-group" data-id="${esc(g.id)}" aria-expanded="${open}"><span><i class="budget-chevron" aria-hidden="true">›</i>${esc(g.name)}</span><b>${money(g.amount)} <small>/ ${g.budget ? money(g.budget) : g.type === 'Income' ? 'No target' : 'No limit'}</small></b></button>${g.budget ? bar(g.amount, g.budget) : ''}${cats}</div>`;
      })
      .join('');
    return panel(
      'Group budgets',
      body
        ? `<div class="budget-head"><span>Actual / Budget</span></div>${body}`
        : '<p class="empty-copy">Add categories in Setup.</p>',
    );
  }
  // Chart labels: $950, $3.6k, $12k; the currency hides on phones to fit 12 columns.
  const kMoney = (v) => {
    const n = Math.abs(v),
      text =
        n >= 1000
          ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k'
          : Math.round(n);
    return n
      ? `${v < 0 ? '−' : ''}<span class="year-cur">${esc(state.currency)}</span>${text}`
      : '';
  };
  function yearChart(y) {
    const top = Math.max(1, ...y.months.map((m) => Math.max(m.income, m.expense)));
    return panel(
      'Income vs Expenses',
      `<div class="year-chart">${y.months
        .map(
          (m, i) =>
            `<div class="year-col ${m.month === state.month ? 'is-current' : ''}" tabindex="0" role="img" aria-label="${monthNames[i]}: income ${money(m.income)}, expenses ${money(m.expense)}">${m.income || m.expense ? `<span class="year-tip ${i < 3 ? 'from-left' : i > 8 ? 'from-right' : ''}" aria-hidden="true"><b>${debtMonth(m.month)}</b><span><i class="year-in"></i>Income<b>${money(m.income)}</b></span><span><i class="year-out"></i>Expenses<b>${money(m.expense)}</b></span><span class="year-tip-net">Net<b>${money(m.income - m.expense)}</b></span></span>` : ''}<span class="year-bars"><i class="year-in" style="height:${(m.income / top) * 100}%"></i><i class="year-out" style="height:${(m.expense / top) * 100}%"></i></span><span class="year-label">${monthNames[i]}</span><span class="year-num in">${kMoney(m.income)}</span><span class="year-num out">${kMoney(m.expense)}</span></div>`,
        )
        .join(
          '',
        )}</div><div class="year-legend"><span><i class="year-in"></i>Income</span><span><i class="year-out"></i>Expenses</span></div>`,
    );
  }
  function dashboard() {
    const year = state.month.slice(0, 4),
      s = dashMode === 'Year' ? yearSummary(year) : B.summary(state, state.month);
    const tiles = `<div class="stats-strip">${stat('Income', money(s.income), 'Expected ' + money(s.expectedIncome), 'tone-mint')}${stat('Expenses', money(s.expense), 'Expected ' + money(s.expectedExpense), 'tone-blush')}${stat('Left to spend', money(s.left), 'Expected ' + money(s.expectedIncome - s.expectedExpense), 'tone-sky')}${stat('Savings rate', `${s.rate.toFixed(1)}%`, '', 'tone-ink')}</div>`;
    let body;
    if (dashMode === 'Year')
      body =
        expectedPanel(s) +
        yearChart(s) +
        spendingPanel(s) +
        budgetPanel(s.rows, budgetMonthsOf(year), false);
    else {
      const end = B.date(B.today());
      end.setFullYear(end.getFullYear() + 1);
      const upcoming = B.generated(state, B.iso(end))
        .filter((t) => t.type !== 'Income' && t.date >= B.today())
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 12);
      body =
        `<div class="dashboard-grid">${panel('Upcoming Bills', upcoming.length ? `<div class="record-list upcoming-list">${upcoming.map((t, i) => row(t, true).replace('<button ', `<button ${i >= 5 ? 'style="display:none" ' : ''}`)).join('')}</div>` : '<p class="empty-copy">No upcoming bills.</p>')}${spendingPanel(s)}</div>` +
        expectedPanel(s) +
        budgetPanel(s.rows, [state.month], true);
    }
    return (
      '<div class="dashboard-view">' +
      heading('Dashboard', '', edit('transaction', '', '+ Add transaction', 'btn primary')) +
      `<div class="screen-switch">${['Month', 'Year'].map((t) => btn(t, 'dash-mode', t, 'switch-pill ' + (dashMode === t ? 'active' : ''))).join('')}</div>` +
      (!state.onboarded ? welcome() : '') +
      tiles +
      body +
      '</div>'
    );
  }
  function options(list, value, blank = false) {
    return (
      (blank ? '<option value="">—</option>' : '') +
      list
        .map((x) => {
          const id = typeof x === 'string' ? x : x.id,
            label = typeof x === 'string' ? x : x.name;
          return `<option value="${esc(id)}" ${id === value ? 'selected' : ''}>${esc(label)}</option>`;
        })
        .join('')
    );
  }
  function transactionScreen() {
    let list = [...state.transactions]
      .filter((t) => t.paid)
      .sort((a, b) => b.date.localeCompare(a.date));
    list = list.filter(
      (t) =>
        (!filters.month || t.date.startsWith(filters.month)) &&
        (!filters.category || t.categoryId === filters.category) &&
        (!filters.account ||
          t.accountId === filters.account ||
          (t.type === 'Transfer' && t.toKind === 'account' && t.toId === filters.account)) &&
        (!filters.type || t.type === filters.type) &&
        (!filters.search ||
          `${t.name} ${t.notes || ''}`.toLowerCase().includes(filters.search.toLowerCase())),
    );
    return (
      heading('Transactions', '', edit('transaction', '', '+ Add transaction', 'btn primary')) +
      `<section class="panel"><div class="filters"><label>Month<div class="month-filter"><input type="month" id="filter-month" value="${esc(filters.month)}">${btn('—', 'reset-month', '', 'icon-btn')}</div></label><label>Type<select data-filter="type">${options(['Income', 'Expense', 'Transfer'], filters.type, true)}</select></label><label>Category<select data-filter="category">${options(state.categories, filters.category, true)}</select></label><label>Account<select data-filter="account">${options(state.accounts, filters.account, true)}</select></label><label class="search-field">Search<input id="search" value="${esc(filters.search)}" placeholder="Name or note"></label></div><div class="table-wrap"><table><thead><tr><th>Entry</th><th>Date</th><th>Category / Account</th><th>Expected</th><th>Actual</th><th>Status</th></tr></thead><tbody>${list.map((t) => `<tr><td>${edit('transaction', t.id, esc(t.name), 'table-link')}<small class="transaction-type-badge type-${esc(t.type.toLowerCase())}">${esc(t.type)}</small></td><td>${esc(t.date)}</td><td>${entryCategory(t)}<small>${entrySource(t)}</small></td><td>${money(t.expected)}</td><td>${t.paid ? money(t.actual) : '—'}</td><td class="${status(t) === 'Overdue' ? 'terracotta' : ''}">${status(t)}</td></tr>`).join('') || '<tr><td colspan="6">No matching entries.</td></tr>'}</tbody></table></div></section>`
    );
  }
  function nextRecurringLabel(r) {
    if (!r.active) return 'Paused';
    const today = B.today();
    const excluded = new Set([...state.skipped, ...state.transactions.map((t) => t.id)]);
    for (let i = 0; i < 16000; i++) {
      const date = B.occurrence(r.start, r.frequency, i, r.monthDay);
      if ((r.end && date > r.end) || date > '2199-12-31') break;
      if (
        date < today ||
        (r.effectiveFrom && date < r.effectiveFrom) ||
        excluded.has(`${r.id}@${date}`)
      )
        continue;
      return (
        'Next: ' +
        B.date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          ...(date.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}),
        })
      );
    }
    return 'No upcoming payments';
  }
  function recurringScreen() {
    const list = B.paymentSchedule(state, state.month + '-31', state.month + '-01').filter(
        (t) => !t.skipped,
      ),
      expected = total(
        list.filter((t) => !t.skipped && t.type === 'Expense'),
        (t) => t.expected,
      ),
      transfers = total(
        list.filter((t) => !t.skipped && t.type === 'Transfer'),
        (t) => t.expected,
      );
    return (
      heading('Recurring', '', edit('recurring', '', '+ Add recurring', 'btn primary')) +
      `<div class="screen-switch">${['Payment Schedule', 'Recurring'].map((t) => btn(t, 'tab', t, 'switch-pill ' + (tab === t ? 'active' : ''))).join('')}</div>` +
      (tab === 'Payment Schedule'
        ? panel(
            'Payment Schedule',
            `<div class="schedule-totals"><span>Monthly expenses <b>${money(expected)}</b></span><span>Monthly transfers <b>${money(transfers)}</b></span></div>` +
              (list.length
                ? list.map(scheduleRow).join('')
                : '<p class="empty-copy">No scheduled payments this month.</p>'),
          )
        : panel(
            'Recurring templates',
            state.recurring
              .map(
                (r) =>
                  `<div class="schedule-record">${edit('recurring', r.id, `<span class="record-name">${esc(r.name)}<small>${esc(r.frequency)} · ${name('accounts', r.accountId)} · ${nextRecurringLabel(r)}</small></span><span class="record-amount">${money(r.expected)}<small class="transaction-type-badge type-${esc(r.type.toLowerCase())}">${esc(r.type)}</small></span>`)}${btn(r.active ? 'Pause' : 'Resume', 'pause-recurring', r.id, 'textbtn')}</div>`,
              )
              .join('') || '<p class="empty-copy">Add a recurring template.</p>',
          ))
    );
  }

  function calendarScreen() {
    const d = B.date(state.month + '-01'),
      offset = (d.getDay() + (state.week === 'Monday' ? 6 : 0)) % 7,
      start = new Date(d);
    start.setDate(1 - offset);
    const list = B.paymentSchedule(state, state.month + '-31', state.month + '-01').filter(
      (t) => !t.skipped,
    );
    const weekdays =
      state.week === 'Monday'
        ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      heading('Bill Calendar', '', edit('recurring', '', '+ Add recurring', 'btn primary')) +
      `<div class="calendar-preferences"><label>Week starts on<select id="calendar-week">${options(['Monday', 'Sunday'], state.week)}</select></label></div><div id="cal-body"><div class="cal-grid">${weekdays.map((x) => `<div class="cal-weekday">${x}</div>`).join('')}${Array.from(
        { length: 42 },
        (_, i) => {
          const day = new Date(start);
          day.setDate(start.getDate() + i);
          const stamp = B.iso(day),
            outside = !stamp.startsWith(state.month),
            payments = list.filter((t) => (t.scheduledDate || t.date) === stamp),
            income = payments.filter((t) => t.type === 'Income');
          return `<div class="cal-day ${outside ? 'outside' : ''} ${stamp === B.today() ? 'is-today' : ''}">${income.length ? income.map((t, i) => `<button type="button" class="day-heading has-payday payday-band" data-edit="transaction" data-id="${esc(t.id)}" title="${esc(t.name + ' · ' + money(t.paid ? t.actual : t.expected) + ' · ' + status(t))}"><span class="day-num">${i === 0 ? day.getDate() : ''}</span><span class="calendar-paydays"><span class="payday-pill">${esc(t.name)}</span></span></button>`).join('') : `<div class="day-heading"><span class="day-num">${day.getDate()}</span></div>`}<div class="day-pills">${payments
            .filter((t) => t.type !== 'Income')
            .map((t) =>
              edit(
                'transaction',
                t.id,
                // Phones show the short amount and hide the status word (colour shows it).
                `<span class="cal-entry-name">${t.paid ? '<i class="calendar-paid-check" aria-hidden="true">✓</i>' : ''}${esc(t.name)}</span><small><span class="cal-amount">${money(t.paid ? t.actual : t.expected)}</span><span class="cal-amount-short">${shortMoney(t.paid ? t.actual : t.expected)}</span><span class="cal-entry-status"> · ${status(t)}</span></small>`,
                'calendar-entry status-' +
                  status(t).toLowerCase().replace(' today', '') +
                  ' ' +
                  (t.paid ? 'paid' : '') +
                  ' ' +
                  (status(t) === 'Overdue' ? 'overdue' : '') +
                  ' ' +
                  (t.type === 'Income' ? 'income' : ''),
              ),
            )
            .join('')}</div></div>`;
        },
      ).join('')}</div></div>`
    );
  }
  const accountKinds = ['Checking', 'Savings', 'Cash', 'Investment', 'Other asset'];
  function accountsScreen() {
    const balances = state.accounts.map((a) => ({ a, balance: B.accountBalance(state, a.id) })),
      inAccounts = total(balances, (x) => x.balance),
      inGoals = B.goalAssets(state),
      debt = total(state.debts, (d) => B.debtBalance(state, d.id)),
      month = B.today().slice(0, 7);
    // Group by type in the form's order; names keep their order within a type.
    balances.sort(
      (x, y) =>
        (accountKinds.indexOf(x.a.kind) + 1 || 99) - (accountKinds.indexOf(y.a.kind) + 1 || 99),
    );
    // Same layout as debt cards: badge and name, balance with actions, monthly flow footer.
    const card = ({ a, balance }) => {
      const flow = B.accountMonth(state, a.id, month),
        type =
          'type-' +
          (accountKinds.includes(a.kind) ? a.kind : 'Other asset').split(' ')[0].toLowerCase(),
        sameName = a.kind.toLowerCase() === a.name.trim().toLowerCase();
      return panel(
        `<span class="debt-priority-badge account-badge ${type}" aria-hidden="true">${esc([...a.name.trim()][0] || '?').toUpperCase()}</span> ${esc(a.name)}`,
        `<div class="debt-card-summary"><div><strong class="large-value${balance < 0 ? ' is-negative' : ''}">${money(balance)}</strong>${sameName ? '' : `<p>${esc(a.kind)}</p>`}</div><div class="debt-card-actions">${btn('Transfer', 'account-transfer', a.id, 'btn')}${btn('Update Balance', 'account-balance', a.id, 'btn')}</div></div><div class="debt-card-footer account-footer"><span>This month <span class="flow-part"><b class="flow-in">+${money(flow.in)}</b> in</span> <span class="flow-part"><b class="flow-out">−${money(flow.out)}</b> out</span></span><button type="button" class="textbtn" data-action="account-transactions" data-id="${esc(a.id)}">View transactions</button></div>`,
        edit('account', a.id, 'Edit', 'textbtn'),
      );
    };
    return (
      heading('Accounts', '', edit('account', '', '+ Add account', 'btn primary')) +
      (state.accounts.length
        ? `<div class="stats-strip">${stat('In accounts', money(inAccounts), '', 'tone-mint')}${stat('In goals', money(inGoals), '', 'tone-sky')}${stat('Debt', money(debt), '', 'tone-blush')}${stat('Net worth', money(inAccounts + inGoals - debt), '', 'tone-ink')}</div><div class="debt-list account-list">${balances.map(card).join('')}</div>`
        : panel(
            'Your accounts',
            '<p class="empty-copy">Add your first account and opening balance.</p>',
          ))
    );
  }
  // Desktop chart plot bottom in viewBox units; fitDebtChart() grows it to the panel height.
  let debtChartBottom = 380,
    redrawDebtPlot = null;
  const debtExpanded = new Set(),
    debtFull = new Set();
  const debtMonth = (m) =>
    B.date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const debtDay = (d) =>
    B.date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  function debtChart(plan, current, baseline) {
    // Start at the first projected month-end; do not prepend a duplicate current-month point.
    const month = B.today().slice(0, 7);
    const selected = plan.rows.length ? plan.rows.map((r) => r.balance) : [current];
    const showBaseline = state.extra > 0;
    const without = showBaseline
      ? baseline.rows.length
        ? baseline.rows.map((r) => r.balance)
        : [current]
      : [];
    const count = Math.max(1, selected.length - 1, without.length - 1);
    const rawStep = Math.max(1, ...selected, ...without) / 3;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const step = [1, 2, 2.5, 4, 5, 8, 10].find((n) => n * magnitude >= rawStep) * magnitude;
    const ceiling = step * 3;
    const tickLabel = (v) =>
      esc(state.currency) +
      new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
        .format(v)
        .toLowerCase();
    const rawMoney = (v) =>
      state.currency +
      Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const renderPlot = (compact) => {
      const width = compact ? 320 : 940,
        // Y labels start at the panel's content edge; the plot runs to the right edge.
        left = compact ? 44 : 64,
        right = width;
      const top = 62,
        bottom = compact ? 280 : debtChartBottom,
        plotWidth = right - left;
      const x = (i) => left + (i / count) * plotWidth,
        y = (v) => bottom - (v / ceiling) * (bottom - top);
      // Keep every month-end balance so hover markers match the plotted line.
      const points = (values) => values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
      const endX = x(selected.length - 1),
        endY = y(selected.at(-1));
      const grid = [0, 1, 2, 3]
        .map((i) => {
          const value = step * i;
          return `<line x1="${left}" y1="${y(value)}" x2="${right}" y2="${y(value)}" class="chart-gridline"/><text x="0" y="${y(value) + 4}" text-anchor="start">${tickLabel(value)}</text>`;
        })
        .join('');
      const ticks = [];
      // Leave room for the width of This month plus a 60px gap at the smallest layout.
      let lastTick = left + (compact ? 92 : 72);
      for (let i = 1; i <= count; i++) {
        const stamp = B.monthShift(month, i);
        if (stamp.endsWith('-01') && x(i) - lastTick >= (compact ? 80 : 60) && x(i) < right - 16) {
          ticks.push(
            `<text x="${x(i)}" y="${bottom + 30}" text-anchor="middle">${stamp.slice(0, 4)}</text>`,
          );
          lastTick = x(i) + (compact ? 28 : 24);
        }
      }
      if (!ticks.length && count > 0 && right - left > 200) {
        ticks.push(
          `<text x="${right}" y="${bottom + 30}" text-anchor="end">${B.monthShift(month, count).slice(0, 4)}</text>`,
        );
      }
      const hover = Array.from({ length: count + 1 }, (_, i) => {
        const primary = selected[i] ?? 0,
          secondary = without[i] ?? 0;
        const label =
          debtMonth(B.monthShift(month, i)) +
          ' · ' +
          state.strategy +
          ': ' +
          rawMoney(primary) +
          (showBaseline ? ' · Without extra: ' + rawMoney(secondary) : '');
        const start = Math.max(left, x(i) - plotWidth / count / 2),
          end = Math.min(right, x(i) + plotWidth / count / 2);
        return `<rect x="${start}" y="${top}" width="${end - start}" height="${bottom - top + 8}" fill="transparent" class="debt-chart-hit" data-index="${i}" data-x="${x(i)}" data-y="${y(primary)}" data-baseline-y="${y(secondary)}" data-chart-tip="${esc(label)}"/>`;
      }).join('');
      const finish = plan.paidOff
        ? `<circle cx="${endX}" cy="${endY}" r="5" fill="var(--blush)" stroke="var(--ink)"/><text x="${right}" y="28" text-anchor="end" class="chart-finish">Debt-free · ${debtMonth(plan.end)}</text>`
        : '';
      return `<div class="debt-chart-plot ${compact ? 'chart-mobile' : 'chart-desktop'}"><svg data-debt-chart tabindex="0" viewBox="0 0 ${width} ${bottom + 52}" role="img" aria-label="${esc(state.strategy)} monthly debt balance${showBaseline ? ' compared with no extra payment' : ''}. Use arrow keys to explore.">${grid}<polygon points="${left},${bottom} ${points(selected)} ${endX},${bottom}" fill="var(--accent)" opacity=".2"/>${showBaseline ? `<polyline points="${points(without)}" class="chart-baseline"/>` : ''}<polyline points="${points(selected)}" class="chart-selected"/><text x="${left}" y="${bottom + 30}" text-anchor="start">This month</text>${ticks.join('')}${finish}${hover}<circle class="chart-hover-marker" r="5" fill="var(--blush)" stroke="var(--ink)" visibility="hidden"/>${showBaseline ? '<circle class="chart-baseline-marker" r="4" fill="white" stroke="#8b8994" visibility="hidden"/>' : ''}</svg><output class="debt-chart-tooltip" aria-live="polite" hidden></output></div>`;
    };
    redrawDebtPlot = () => renderPlot(false);
    return `<div class="debt-chart enhanced-debt-chart">${renderPlot(false)}${renderPlot(true)}</div>`;
  }
  // Beside the strategy panel, stretch the desktop chart to match that panel's height.
  // Beside Spending breakdown, Upcoming Bills shows as many entries as fit its height (at least 5).
  function fitUpcoming() {
    const list = $('.upcoming-list');
    if (!list?.children) return;
    const panel = list.closest('.panel'),
      other = panel.nextElementSibling,
      items = [...list.children];
    items.forEach((el, i) => (el.style.display = i < 5 ? '' : 'none'));
    if (!other || other.offsetTop !== panel.offsetTop) return;
    panel.style.alignSelf = other.style.alignSelf = 'start';
    for (const el of items.slice(5)) {
      el.style.display = '';
      if (panel.offsetHeight > other.offsetHeight) {
        el.style.display = 'none';
        break;
      }
    }
    panel.style.alignSelf = other.style.alignSelf = '';
  }
  function fitDebtChart() {
    const overview = document.querySelector('.debt-overview'),
      [side, chart] = overview?.children || [],
      plot = chart?.querySelector('.chart-desktop');
    if (!plot?.getBoundingClientRect || !redrawDebtPlot) return;
    let bottom = 380;
    if (side.offsetTop === chart.offsetTop && plot.offsetWidth) {
      // The side panel's natural height, ignoring the grid stretch.
      const top = side.getBoundingClientRect().top,
        sideStyle = getComputedStyle(side),
        chartStyle = getComputedStyle(chart),
        sideHeight =
          Math.max(...[...side.children].map((c) => c.getBoundingClientRect().bottom)) -
          top +
          parseFloat(sideStyle.paddingBottom) +
          parseFloat(sideStyle.borderBottomWidth),
        slot = plot.parentElement,
        extras = [...slot.children]
          .filter((c) => c !== plot)
          .reduce((sum, c) => sum + c.offsetHeight, 0),
        available =
          sideHeight -
          (slot.getBoundingClientRect().top - chart.getBoundingClientRect().top) -
          parseFloat(chartStyle.paddingBottom) -
          parseFloat(chartStyle.borderBottomWidth) -
          extras;
      bottom = Math.max(380, (available * 940) / plot.offsetWidth - 52);
    }
    if (Math.abs(bottom - debtChartBottom) < 2) return;
    debtChartBottom = bottom;
    plot.outerHTML = redrawDebtPlot();
  }
  function showDebtHover(hit) {
    const plot = hit.closest('.debt-chart-plot'),
      svg = plot.querySelector('svg'),
      tooltip = plot.querySelector('.debt-chart-tooltip');
    const marker = svg.querySelector('.chart-hover-marker'),
      baselineMarker = svg.querySelector('.chart-baseline-marker');
    marker.setAttribute('cx', hit.dataset.x);
    marker.setAttribute('cy', hit.dataset.y);
    marker.setAttribute('visibility', 'visible');
    if (baselineMarker) {
      baselineMarker.setAttribute('cx', hit.dataset.x);
      baselineMarker.setAttribute('cy', hit.dataset.baselineY);
      baselineMarker.setAttribute('visibility', 'visible');
    }
    svg.dataset.activeIndex = hit.dataset.index;
    tooltip.textContent = hit.dataset.chartTip;
    tooltip.hidden = false;
    const point = svg.createSVGPoint();
    point.x = Number(hit.dataset.x);
    point.y = Number(hit.dataset.y);
    const position = point.matrixTransform(svg.getScreenCTM()),
      rect = plot.getBoundingClientRect();
    const left = Math.max(
      4,
      Math.min(
        position.x - rect.left - tooltip.offsetWidth / 2,
        rect.width - tooltip.offsetWidth - 4,
      ),
    );
    const above = position.y - rect.top - tooltip.offsetHeight - 14;
    tooltip.style.left = left + 'px';
    tooltip.style.top = (above < 0 ? position.y - rect.top + 14 : above) + 'px';
  }
  function hideDebtHover(plot) {
    if (!plot) return;
    plot.querySelector('.debt-chart-tooltip').hidden = true;
    plot
      .querySelectorAll('.chart-hover-marker,.chart-baseline-marker')
      .forEach((marker) => marker.setAttribute('visibility', 'hidden'));
  }
  const strategyHints = {
    Snowball: 'Smallest balance first',
    Avalanche: 'Highest APR first',
    Custom: 'Your priority order',
  };
  // First month in which any currently open debt reaches zero.
  function firstPayoff(plan) {
    const open = new Set(
      state.debts.filter((d) => B.debtBalance(state, d.id) > 0).map((d) => d.id),
    );
    return plan.rows.find((row) => row.debts.some((d) => open.has(d.id) && d.balance <= 0))?.month;
  }
  function strategyBenefit(label, plans) {
    const plan = (name) => plans.find(([l]) => l === name)[1];
    if (label === 'Snowball') {
      const month = firstPayoff(plan('Snowball'));
      return month ? `First debt paid off ${debtMonth(month)}` : 'Quick wins keep you motivated';
    }
    if (label === 'Avalanche') {
      const snowball = plan('Snowball'),
        avalanche = plan('Avalanche');
      if (!snowball.paidOff || !avalanche.paidOff) return 'Least interest over time';
      const saved = B.round(snowball.interest - avalanche.interest);
      return saved > 0
        ? `Saves ${money(saved)} vs Snowball`
        : 'Same interest as Snowball for these debts';
    }
    const first = state.debts
      .map((d) => ({ ...d, balance: B.debtBalance(state, d.id) }))
      .filter((d) => d.balance > 0)
      .sort((a, b) => B.debtPriority(a, b, 'Custom'))[0];
    return first ? `Pays ${esc(first.name)} first` : 'Pay debts in your own order';
  }
  function debtStrategies(plans) {
    // Show debt-free dates per row only when the strategies actually differ.
    const sameDate = new Set(plans.map(([, p]) => (p.paidOff ? p.end : 'never'))).size === 1;
    const options = plans
      .map(([label, p]) => {
        const selected = label === state.strategy,
          date = p.paidOff ? (p.months === 0 ? 'Paid off' : debtMonth(p.end)) : 'Not paid off',
          interest = p.paidOff ? money(p.interest) : '—';
        return `<button type="button" class="strategy-option${selected ? ' is-selected' : ''}" data-action="choose-debt-strategy" data-id="${label}" aria-pressed="${selected}"><span class="strategy-option-text"><span class="strategy-option-name">${label}</span><span class="strategy-option-hint">${strategyHints[label]}</span></span><span class="strategy-option-figures"><strong>${interest}</strong><span>${sameDate ? 'interest' : 'interest · ' + date}</span></span><span class="strategy-option-benefit">${strategyBenefit(label, plans)}</span></button>`;
      })
      .join('');
    return `<p class="field-label">Strategy</p><div class="strategy-options" role="group" aria-label="Payoff strategy">${options}</div>`;
  }
  let extraPaymentTimer;
  function queueDebtPlan(field) {
    clearTimeout(extraPaymentTimer);
    extraPaymentTimer = setTimeout(() => {
      if (screen === 'Debt Payoff' && $('#extra-payment') === field)
        applyDebtPlan(state.strategy, 0, true);
    }, 350);
  }
  function applyDebtPlan(strategy = state.strategy, increment = 0, quiet = false) {
    clearTimeout(extraPaymentTimer);
    const field = $('#extra-payment');
    if (!field) return;
    const focused = document.activeElement === field;
    // An empty field means no extra payment.
    const value = String($('#extra-payment').value).trim(),
      extra = Number(value || 0) + increment;
    if (
      !['Snowball', 'Avalanche', 'Custom'].includes(strategy) ||
      !Number.isFinite(extra) ||
      extra < 0 ||
      extra > 1e9
    ) {
      field.setAttribute?.('aria-invalid', 'true');
      if (!quiet) toast('Enter a valid extra payment.');
      return;
    }
    field.removeAttribute?.('aria-invalid');
    if (state.extra === B.round(extra) && state.strategy === strategy) return;
    mutate((n) => {
      n.extra = B.round(extra);
      n.strategy = strategy;
    });
    if (focused) $('#extra-payment')?.focus({ preventScroll: true });
  }
  function debtTable(d, plan) {
    const current = B.today().slice(0, 7),
      all = B.debtSchedule(state, d.id, plan),
      full = debtFull.has(d.id),
      rows = full
        ? all
        : all.filter(
            (r) => r.month >= B.monthShift(current, -3) && r.month <= B.monthShift(current, 12),
          );
    return `<div class="table-wrap"><table class="debt-schedule"><thead><tr><th>Month</th><th>Planned</th><th>Paid</th><th>Balance</th></tr></thead><tbody>${rows.map((r) => `<tr class="${r.month === current ? 'current-month' : ''}"><th>${debtMonth(r.month)}</th><td>${money(r.planned)}</td><td class="payment-${r.state}" aria-label="${r.state}">${r.paid ? money(r.paid) : '—'}${r.state === 'complete' ? '<span class="calendar-paid-check" aria-hidden="true"> ✓</span>' : ''}</td><td>${money(r.balance)}</td></tr>`).join('')}</tbody></table></div><div class="debt-table-actions">${btn(full ? 'Show less' : 'Show full schedule', 'debt-full', d.id, 'textbtn')}</div>`;
  }
  function debtScreen() {
    const plan = B.debtProjection(state),
      snow = B.debtProjection(state, 'Snowball'),
      avalanche = B.debtProjection(state, 'Avalanche'),
      custom = B.debtProjection(state, 'Custom'),
      baseline = B.debtProjection({ ...state, extra: 0 }, state.strategy),
      totalDebt = total(state.debts, (d) => B.debtBalance(state, d.id)),
      paid = total(state.debts, (d) => B.debtPaid(state, d.id));
    const finish = (p) =>
      p.paidOff ? (p.months === 0 ? 'Paid Off' : debtMonth(p.end)) : 'Increase payment';
    const debts = [...state.debts].sort(
      (a, b) =>
        (B.debtBalance(state, a.id) === 0) - (B.debtBalance(state, b.id) === 0) ||
        B.debtPriority(
          { ...a, balance: B.debtBalance(state, a.id) },
          { ...b, balance: B.debtBalance(state, b.id) },
          state.strategy,
        ),
    );
    return (
      heading('Debt Payoff', '', edit('debt', '', '+ Add Debt', 'btn primary')) +
      `<div class="stats-strip debt-stats">${stat('Total debt', money(totalDebt), '', 'tone-sky')}${stat('Paid', money(paid), '', 'tone-mint')}${stat('Debt-free date', finish(plan), '', 'tone-ink')}${stat('Total interest', plan.paidOff ? money(plan.interest) : '—', '', 'tone-blush')}</div>` +
      (debts.length
        ? '<div class="debt-overview">' +
          panel(
            'Choose your strategy',
            `<div class="extra-payment-control"><label for="extra-payment" class="field-label">Extra monthly payment</label><div class="extra-payment-input"><span>${esc(state.currency)}</span><input id="extra-payment" type="number" min="0" max="1000000000" step="0.01" inputmode="decimal" placeholder="0" value="${state.extra || ''}"><span>/ month</span></div><div class="extra-payment-quick">${[50, 100, 200].map((amount) => btn('+' + amount, 'extra-debt-payment', String(amount), 'btn')).join('')}</div></div>` +
              debtStrategies([
                ['Snowball', snow],
                ['Avalanche', avalanche],
                ['Custom', custom],
              ]),
          ) +
          panel(
            'Balance over time',
            debtChart(plan, totalDebt, baseline),
            `<div class="chart-legend-inline"><span><i class="chart-line-key"></i>${esc(state.strategy)}</span>${state.extra > 0 ? '<span><i class="chart-line-key dashed"></i>Without extra</span>' : ''}</div>`,
          ) +
          '</div>'
        : '') +
      '<div class="debt-list">' +
      (debts
        .map((d, index) => {
          const balance = B.debtBalance(state, d.id),
            closed = balance === 0,
            open = debtExpanded.has(d.id);
          return panel(
            (closed ? '' : '<span class="debt-priority-badge">' + (index + 1) + '</span> ') +
              esc(d.name) +
              (!closed && index === 0
                ? '<small class="debt-first-label">Extra payment first</small>'
                : ''),
            `<div class="debt-card-summary"><div><strong class="large-value">${money(balance)}</strong><p>${closed ? '<span class="paid-off-label">Paid Off</span>' : esc(d.kind || 'Other') + ' · ' + d.apr + '% APR · ' + money(d.minimum) + ' minimum'}${d.dueDay ? ' · Due ' + d.dueDay : ''}</p></div><div class="debt-card-actions">${btn('Update Balance', 'debt-balance', d.id, 'btn')}${!closed ? btn('Set recurring payment', 'debt-recurring', d.id, 'btn') : ''}</div></div>${bar(Math.max(0, d.balance - balance), d.balance)}<div class="debt-card-footer"><span>${money(B.debtPaid(state, d.id))} paid${state.strategy === 'Custom' ? ' · Priority ' + d.order : ''}</span><button type="button" class="textbtn" data-action="debt-expand" data-id="${esc(d.id)}" aria-expanded="${open}">${open ? 'Hide schedule' : 'View schedule'}</button></div>${open ? debtTable(d, plan) : ''}`,
            edit('debt', d.id, 'Edit', 'textbtn'),
          );
        })
        .join('') ||
        panel('Your debts', '<p class="empty-copy">Add a debt to build your payoff plan.</p>')) +
      '</div>'
    );
  }
  function updateDebtBalance(id) {
    const d = state.debts.find((d) => d.id === id);
    if (!d) return;
    editing = { kind: 'debt-balance', id, record: d };
    const earliest = debtBalanceEarliest(d);
    $('#editor').innerHTML =
      `<form id="debt-balance-form"><div class="dialog-head"><h2>Update Balance</h2>${btn('×', 'close', '', 'icon-btn')}</div><h3>${esc(d.name)}</h3><div class="form-grid">${input('Statement balance *', 'balance', B.debtBalance(state, id), 'number', 'required min="0" max="1000000000" step="0.01"')}${input('Statement date *', 'date', B.today(), 'date', `required max="${B.today()}"${earliest ? ` min="${earliest}"` : ''}`)}</div><p class="settings-note">Payments recorded after the statement date are subtracted automatically. This does not create a payment or change your account balance.</p><p id="form-error" class="form-error" role="alert"></p><div class="dialog-actions">${btn('Cancel', 'close', '', 'btn ghost')}<button type="submit" class="btn primary">Update Balance</button></div></form>`;
    $('#editor').showModal();
  }
  // A statement cannot predate the debt or its latest balance update.
  function debtBalanceEarliest(d) {
    return [d.start || '', ...(d.adjustments || []).map((a) => a.date)].sort().at(-1) || '';
  }
  function saveDebtBalance(data) {
    const value = Number(data.get('balance')),
      day = String(data.get('date') || ''),
      id = editing.id,
      earliest = debtBalanceEarliest(state.debts.find((d) => d.id === id));
    if (
      data.get('balance') === null ||
      String(data.get('balance')).trim() === '' ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1e9
    )
      throw Error('Enter a valid statement balance.');
    if (
      !/^(19|20|21)\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(day) ||
      B.iso(B.date(day)) !== day ||
      day > B.today()
    )
      throw Error('Enter a statement date that is not in the future.');
    if (day < earliest)
      throw Error(
        earliest === state.debts.find((d) => d.id === id).start
          ? `Choose a date on or after the debt start (${debtDay(earliest)}).`
          : `Choose a date on or after your last balance update (${debtDay(earliest)}).`,
      );
    if (
      mutate((n) => {
        const d = n.debts.find((d) => d.id === id);
        // Reconcile the balance as of the statement date; later payments still apply.
        const delta = B.round(value - (B.debtBasis(d, day) - B.debtPaid(n, id, day)));
        d.adjustments ||= [];
        d.adjustments.push({ date: day, amount: delta });
      })
    )
      $('#editor').close();
  }
  // A month's category budget: this month only, or this month and every later month.
  function editMonthBudget(id) {
    const c = state.categories.find((c) => c.id === id);
    if (!c) return;
    editing = { kind: 'month-budget', id, record: c };
    $('#editor').innerHTML =
      `<form id="month-budget-form"><div class="dialog-head"><h2>${esc(c.name)}</h2>${btn('×', 'close', '', 'icon-btn')}</div><h3>${debtMonth(state.month)}</h3><div class="form-grid">${input('Edit budget', 'amount', B.budgetFor(c, state.month), 'number', 'required min="0" max="1000000000" step="0.01"')}</div><p id="form-error" class="form-error" role="alert"></p><div class="dialog-actions">${btn('Cancel', 'close', '', 'btn ghost')}<button type="submit" class="btn" value="month">This month only</button><button type="submit" class="btn primary" value="following">Apply to following months</button></div></form>`;
    $('#editor').showModal();
    $('[name="amount"]')?.select?.();
  }
  function saveMonthBudget(data, scope) {
    const amount = Number(data.get('amount')),
      id = editing.id;
    if (
      String(data.get('amount') ?? '').trim() === '' ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 1e9
    )
      throw Error('Enter a valid budget.');
    if (
      mutate((n) => {
        const c = n.categories.find((c) => c.id === id);
        if (!c) return;
        if (scope === 'following') B.setBudgetFrom(c, n.month, amount, firstBudgetMonth());
        else B.setBudgetMonth(c, n.month, amount);
      })
    )
      $('#editor').close();
  }
  function updateAccountBalance(id) {
    const a = state.accounts.find((a) => a.id === id);
    if (!a) return;
    editing = { kind: 'account-balance', id, record: a };
    const earliest =
      (a.adjustments || [])
        .map((x) => x.date)
        .sort()
        .at(-1) || '';
    $('#editor').innerHTML =
      `<form id="account-balance-form"><div class="dialog-head"><h2>Update Balance</h2>${btn('×', 'close', '', 'icon-btn')}</div><h3>${esc(a.name)}</h3><div class="form-grid">${input('Statement balance *', 'balance', B.accountBalance(state, id), 'number', 'required min="-1000000000" max="1000000000" step="0.01"')}${input('Statement date *', 'date', B.today(), 'date', `required max="${B.today()}"${earliest ? ` min="${earliest}"` : ''}`)}</div><p class="settings-note">Entries recorded after the statement date still apply. The difference is not counted as income or an expense.</p><p id="form-error" class="form-error" role="alert"></p><div class="dialog-actions">${btn('Cancel', 'close', '', 'btn ghost')}<button type="submit" class="btn primary">Update Balance</button></div></form>`;
    $('#editor').showModal();
  }
  function saveAccountBalance(data) {
    const value = Number(data.get('balance')),
      day = String(data.get('date') || ''),
      id = editing.id,
      account = state.accounts.find((a) => a.id === id),
      earliest =
        (account.adjustments || [])
          .map((x) => x.date)
          .sort()
          .at(-1) || '';
    if (
      data.get('balance') === null ||
      String(data.get('balance')).trim() === '' ||
      !Number.isFinite(value) ||
      Math.abs(value) > 1e9
    )
      throw Error('Enter a valid statement balance.');
    if (
      !/^(19|20|21)\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(day) ||
      B.iso(B.date(day)) !== day ||
      day > B.today()
    )
      throw Error('Enter a statement date that is not in the future.');
    if (day < earliest)
      throw Error(`Choose a date on or after your last balance update (${debtDay(earliest)}).`);
    if (
      mutate((n) => {
        const a = n.accounts.find((a) => a.id === id);
        // Reconcile as of the statement date; later entries still apply.
        const delta = B.round(value - B.accountBalance(n, id, day));
        a.adjustments ||= [];
        a.adjustments.push({ date: day, amount: delta });
      })
    )
      $('#editor').close();
  }
  function debtRecurring(id) {
    const d = state.debts.find((d) => d.id === id),
      existing = state.recurring.find(
        (r) => r.type === 'Transfer' && r.toKind === 'debt' && r.toId === id,
      );
    if (existing) {
      editor('recurring', existing.id);
      return;
    }
    const today = B.today(),
      start = d.start && d.start > today ? d.start : today;
    const day = Number(d.dueDay || start.slice(-2));
    const dueInMonth = (month) => {
      const first = B.date(month + '-01');
      const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      return month + '-' + String(Math.min(day, last)).padStart(2, '0');
    };
    let stamp = dueInMonth(start.slice(0, 7));
    if (stamp < start) stamp = dueInMonth(B.monthShift(start.slice(0, 7), 1));
    editor('recurring', '', {
      type: 'Transfer',
      name: d.name,
      expected: d.minimum,
      start: stamp,
      monthDay: day,
      frequency: 'Monthly',
      toKind: 'debt',
      toId: id,
    });
  }

  function goalRecurring(id) {
    const g = state.goals.find((g) => g.id === id),
      existing = state.recurring.find(
        (r) => r.type === 'Transfer' && r.toKind === 'goal' && r.toId === id,
      );
    if (existing) {
      editor('recurring', existing.id);
      return;
    }
    const plan = B.goalPlan(state, id);
    editor('recurring', '', {
      type: 'Transfer',
      name: g.name,
      expected: plan.needed || '',
      start: B.today(),
      monthDay: Number(B.today().slice(-2)),
      frequency: 'Monthly',
      end: g.deadline || '',
      toKind: 'goal',
      toId: id,
    });
  }
  function savingsScreen() {
    const plans = state.goals.map((g) => ({ g, plan: B.goalPlan(state, g.id) })),
      reached = plans.filter(({ plan }) => plan.status === 'reached').length;
    // Open goals first by target date (no date last), reached goals at the end.
    plans.sort(
      (a, b) =>
        (a.plan.status === 'reached') - (b.plan.status === 'reached') ||
        (a.g.deadline || '9999').localeCompare(b.g.deadline || '9999'),
    );
    const badge = {
      reached: ['Reached', 'is-good'],
      'on-track': ['On track', 'is-good'],
      behind: ['Behind', 'is-warn'],
      overdue: ['Overdue', 'is-warn'],
    };
    const card = ({ g, plan }) => {
      // Behind is only shown against a recurring contribution, not when none is set.
      const [label, tone] =
          plan.status === 'behind' && !plan.planned ? [] : badge[plan.status] || [],
        when = g.deadline ? ' · by ' + debtMonth(g.deadline.slice(0, 7)) : '';
      const detail =
        plan.status === 'reached'
          ? 'Goal reached'
          : plan.status === 'overdue'
            ? money(plan.remaining) + ' to go · target date passed'
            : plan.status === 'open'
              ? money(plan.remaining) + ' to go'
              : money(plan.needed) + ' / month' + when;
      return panel(
        esc(g.name),
        `<div class="goal-meta"><span class="eyebrow">${esc(g.kind)}</span>${label ? `<span class="goal-status ${tone}">${label}</span>` : ''}</div><strong class="large-value">${money(plan.saved)} <small>/ ${money(g.target)}</small></strong>${bar(plan.saved, g.target)}<p class="goal-detail">${detail}</p><div class="goal-actions">${btn('Add money', 'goal-add', g.id, 'btn')}${plan.saved > 0 ? btn('Withdraw', 'goal-withdraw', g.id, 'btn') : ''}${plan.status !== 'reached' ? btn(plan.planned ? 'Edit recurring' : 'Set recurring', 'goal-recurring', g.id, 'btn') : ''}</div>`,
        edit('goal', g.id, 'Edit', 'textbtn'),
      );
    };
    return (
      heading('Savings', '', edit('goal', '', '+ Add goal', 'btn primary')) +
      (plans.length
        ? `<div class="stats-strip">${stat('Total saved', money(total(plans, ({ plan }) => plan.saved)), '', 'tone-mint')}${stat('Total target', money(total(state.goals, (g) => g.target)), '', 'tone-sky')}${stat('Needed / month', money(total(plans, ({ plan }) => plan.needed || 0)), '', 'tone-ink')}${stat('Goals reached', reached + ' of ' + plans.length, '', 'tone-blush')}</div><div class="goal-grid">${plans.map(card).join('')}</div>`
        : panel(
            'Savings goals',
            '<p class="empty-copy">Create a savings goal or sinking fund.</p>',
          ))
    );
  }
  function groupPanel(g) {
    const cats = state.categories.filter((c) => c.groupId === g.id);
    return `<section class="setup-group"><div class="setup-group-head"><h3>${edit('group', g.id, esc(g.name), 'editable-heading')}</h3>${edit('category', '', '+ Add', 'textbtn').replace('data-edit="category"', `data-edit="category" data-group="${esc(g.id)}"`)}</div><div class="setup-categories">${cats.map((c) => `<div class="setup-category ${c.hidden ? 'is-hidden' : ''}">${edit('category', c.id, esc(c.name), 'table-link')}<div class="subcategory-budget"><span>Monthly budget</span>${editingBudget === c.id ? `<input id="active-budget-input" type="number" min="0" max="1000000000" step="0.01" data-category-budget="${esc(c.id)}" value="${B.budgetFor(c, thisMonth())}" aria-label="${esc(c.name)} monthly budget">` : `<button type="button" class="budget-value" data-action="edit-budget" data-id="${esc(c.id)}" aria-label="Edit ${esc(c.name)} monthly budget">${money(B.budgetFor(c, thisMonth()))}</button>`}</div>${edit('category', c.id, 'Edit', 'textbtn')}</div>`).join('')}</div></section>`;
  }

  function setupScreen() {
    const income = state.groups.find((g) => g.type === 'Income');
    return (
      heading('Setup') +
      panel(
        'Preferences',
        `<form id="preferences" class="form-grid"><label>Currency<select name="currency" id="setup-currency">${currencyOptions.replace(`value="${currencySymbols.includes(state.currency) ? esc(state.currency) : 'custom'}"`, `value="${currencySymbols.includes(state.currency) ? esc(state.currency) : 'custom'}" selected`)}</select></label><label id="setup-custom-currency" ${currencySymbols.includes(state.currency) ? 'hidden' : ''}>Custom symbol<input name="currencyCustom" value="${esc(state.currency)}" maxlength="8"></label><label>Budget start date<input name="budgetStart" type="date" value="${esc(state.budgetStart)}" min="1900-01-01" max="2199-12-31" required></label><div class="preferences-actions"><button class="btn primary" type="submit">Save preferences</button></div></form>`,
      ) +
      panel(
        'Income',
        state.groups
          .filter((g) => g.type === 'Income')
          .map(groupPanel)
          .join(''),
        btn('+ Add group', 'add-income-group', '', 'textbtn'),
      ) +
      panel(
        'Expenses',
        `<div class="setup-expenses">${state.groups
          .filter((g) => g.type === 'Expense')
          .map(groupPanel)
          .join('')}</div>`,
        btn('+ Add group', 'add-expense-group', '', 'textbtn'),
      ) +
      panel(
        'Accounts',
        state.accounts
          .map((a) =>
            edit(
              'account',
              a.id,
              `<span>${esc(a.name)}</span><b>${money(B.accountBalance(state, a.id))}</b>`,
            ),
          )
          .join('') || '<p class="empty-copy">Add an account with its opening balance.</p>',
        edit('account', '', '+ Add', 'textbtn'),
      ) +
      panel(
        'Your data',
        `<div class="button-row">${btn('Export backup', 'export')}${btn('Import backup', 'import')}<input type="file" id="import-file" accept="application/json,.json" hidden></div><div class="button-row">${btn('Load sample data', 'sample')}${btn('Clear sample data', 'clear-sample', '', 'btn danger')}</div>`,
      )
    );
  }

  function render() {
    $('#navigation').innerHTML = screens
      .map(
        (s) =>
          `<button type="button" data-screen="${s}" class="nav-item ${s === screen ? 'active' : ''}" ${s === screen ? 'aria-current="page"' : ''}>${s}</button>`,
      )
      .join('');
    $('#main').innerHTML =
      (blocked
        ? '<p class="save-warning">Saved data could not be read. Changes are disabled to protect it.</p>'
        : '') +
      {
        Dashboard: dashboard,
        Transactions: transactionScreen,
        Recurring: recurringScreen,
        'Bill Calendar': calendarScreen,
        Accounts: accountsScreen,
        'Debt Payoff': debtScreen,
        Savings: savingsScreen,
        Setup: setupScreen,
      }[screen]();
    if (screen === 'Debt Payoff') fitDebtChart();
    if (screen === 'Dashboard') fitUpcoming();
  }
  const collections = {
    transaction: 'transactions',
    recurring: 'recurring',
    account: 'accounts',
    category: 'categories',
    group: 'groups',
    debt: 'debts',
    goal: 'goals',
  };
  let editing = null;
  function input(label, key, value = '', type = 'text', attrs = '') {
    return `<label>${label}<input name="${key}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
  }
  const num = (label, key, value = 0, attrs = '') =>
    input(label, key, value, 'number', `min="0" max="1000000000" step="0.01" required ${attrs}`);
  function defaultEntryDate() {
    const today = B.today();
    if (state.month === today.slice(0, 7)) return today;
    const first = B.date(state.month + '-01');
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return state.month + '-' + String(Math.min(Number(today.slice(-2)), last)).padStart(2, '0');
  }
  const select = (label, key, list, value, blank = false) =>
    `<label>${label}<select name="${key}">${options(list, value, blank)}</select></label>`;
  function transactionFields(x) {
    const type = x.type || 'Expense',
      currentCategory = state.categories.find((c) => c.id === x.categoryId),
      group = x.groupId || currentCategory?.groupId || '';
    // A transfer from a goal is a withdrawal; its source is stored as fromKind/fromId.
    const account =
      x.accountId || (x.fromKind === 'goal' ? 'goal:' + x.fromId : '') || state.lastAccountId || '';
    const requiredSelect = (label, key, list, value) =>
      select(label + ' *', key, list, value, true).replace('<select ', '<select required ');
    let fields =
      input(
        'Date *',
        'date',
        x.date || B.today(),
        'date',
        'required min="1900-01-01" max="2199-12-31"',
      ) +
      input(
        'Amount *',
        'amount',
        x.amount ?? (x.paid ? x.actual : x.expected) ?? '',
        'number',
        'required min="0.01" max="1000000000" step="0.01" inputmode="decimal"',
      );
    if (type === 'Transfer') {
      fields += requiredSelect(
        'From',
        'accountId',
        [
          ...state.accounts,
          ...state.goals.map((g) => ({ id: 'goal:' + g.id, name: 'Goal · ' + g.name })),
        ],
        account,
      );
      const fromGoal = account.startsWith('goal:');
      const targets = [
        ...state.accounts
          .filter((a) => a.id !== account)
          .map((a) => ({ id: 'account:' + a.id, name: 'Account · ' + a.name })),
        ...(fromGoal
          ? []
          : [
              ...state.debts.map((d) => ({ id: 'debt:' + d.id, name: 'Debt · ' + d.name })),
              ...state.goals.map((g) => ({ id: 'goal:' + g.id, name: 'Goal · ' + g.name })),
            ]),
      ];
      fields += requiredSelect(
        'To',
        'destination',
        targets,
        x.destination || (x.toKind && x.toId ? x.toKind + ':' + x.toId : ''),
      );
    } else {
      if (type === 'Expense')
        fields += requiredSelect(
          'Category group',
          'categoryGroup',
          state.groups.filter((g) => g.type === 'Expense'),
          group,
        );
      const categories = state.categories.filter(
        (c) =>
          c.type === type &&
          (!c.hidden || c.id === x.categoryId) &&
          (type === 'Income' || c.groupId === group),
      );
      fields += requiredSelect('Category', 'categoryId', categories, x.categoryId);
      fields += requiredSelect('Account', 'accountId', state.accounts, account);
      fields += input(
        'Description',
        'description',
        x.description ?? x.name ?? '',
        'text',
        'maxlength="100" placeholder="Trader Joe’s, Netflix"',
      );
    }
    return (
      fields +
      `<label class="full">Notes<textarea name="notes" maxlength="1000">${esc(x.notes || '')}</textarea></label>`
    );
  }
  function drawTransaction(x) {
    const type = x.type || 'Expense';
    editing.draft = { ...x, type };
    $('#editor').innerHTML =
      `<form id="record-form" data-simple-transaction="true"><div class="dialog-head"><h2 id="editor-title">${editing.id ? 'Edit' : 'Add'} transaction</h2>${btn('×', 'close', '', 'icon-btn')}</div><div class="transaction-types" role="group" aria-label="Transaction type">${['Expense', 'Income', 'Transfer'].map((t) => `<button type="button" class="switch-pill ${t === type ? 'active' : ''}" data-action="transaction-type" data-id="${t}" aria-pressed="${t === type}">${t}</button>`).join('')}</div><input name="type" type="hidden" value="${type}"><div class="form-grid">${transactionFields(x)}</div><p id="form-error" class="form-error" role="alert"></p><div class="dialog-actions">${editing.id ? btn('Delete', 'delete', '', 'btn danger') : ''}<span class="spacer"></span>${btn('Cancel', 'close', '', 'btn ghost')}<button class="btn primary" type="submit">Save</button></div></form>`;
    $('#editor').showModal();
  }
  function transactionDraft() {
    const data = new FormData($('#record-form'));
    return {
      ...editing.draft,
      type: data.get('type'),
      date: data.get('date'),
      amount: data.get('amount'),
      accountId: data.get('accountId'),
      groupId: data.get('categoryGroup') || '',
      categoryId: data.get('categoryId') || '',
      description: data.get('description') || '',
      notes: data.get('notes') || '',
      destination: data.get('destination') || '',
    };
  }
  function saveTransaction(data) {
    const get = (k) => String(data.get(k) || '').trim(),
      amount = B.round(Number(get('amount'))),
      type = get('type'),
      date = get('date'),
      accountId = get('accountId'),
      { id, record } = editing;
    if (!['Expense', 'Income', 'Transfer'].includes(type))
      throw Error('Choose a transaction type.');
    if (!get('amount') || !Number.isFinite(amount) || amount <= 0 || amount > 1e9)
      throw Error('Enter an amount greater than zero.');
    if (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(date) || B.iso(B.date(date)) !== date)
      throw Error('Choose a valid date.');
    const fromGoal =
      type === 'Transfer' && accountId.startsWith('goal:')
        ? state.goals.find((g) => 'goal:' + g.id === accountId)
        : null;
    if (!fromGoal && !state.accounts.some((a) => a.id === accountId))
      throw Error('Choose an account.');
    const x = {
      ...record,
      id: id || uid(),
      type,
      date,
      accountId,
      actual: amount,
      expected: id && record.type === type ? record.expected : amount,
      paid: true,
      skipped: false,
      notes: get('notes'),
    };
    if (type === 'Transfer') {
      const destination = get('destination'),
        split = destination.indexOf(':'),
        toKind = destination.slice(0, split),
        toId = destination.slice(split + 1),
        list = { account: 'accounts', debt: 'debts', goal: 'goals' }[toKind];
      if (!list || !state[list].some((t) => t.id === toId))
        throw Error('Choose a destination account, debt or goal.');
      if (toKind === 'account' && toId === accountId)
        throw Error('From and To must be different accounts.');
      if (fromGoal) {
        if (toKind !== 'account') throw Error('Move money from a goal into an account.');
        const oldWithdrawal =
          record.paid && record.fromKind === 'goal' && record.fromId === fromGoal.id
            ? record.actual
            : 0;
        if (amount > B.goalSaved(state, fromGoal.id) + oldWithdrawal)
          throw Error('Amount exceeds the money saved in this goal.');
      }
      if (toKind === 'debt') {
        const oldCredit =
          record.paid &&
          record.type === 'Transfer' &&
          record.toKind === 'debt' &&
          record.toId === toId
            ? record.actual
            : record.paid && record.debtId === toId
              ? record.principal || 0
              : 0;
        if (amount > B.debtBalance(state, toId) + oldCredit)
          throw Error('Amount exceeds the outstanding debt.');
      }
      Object.assign(x, {
        toKind,
        toId,
        name: fromGoal
          ? `Withdrawal from ${fromGoal.name}`
          : `Transfer to ${state[list].find((t) => t.id === toId).name}`,
        description: '',
      });
      if (fromGoal) {
        Object.assign(x, { fromKind: 'goal', fromId: fromGoal.id });
        delete x.accountId;
      } else {
        delete x.fromKind;
        delete x.fromId;
      }
      delete x.categoryId;
      delete x.goalId;
      delete x.debtId;
      delete x.principal;
    } else {
      const category = state.categories.find((c) => c.id === get('categoryId') && c.type === type);
      if (!category || (category.hidden && record.categoryId !== category.id))
        throw Error('Choose a visible category.');
      if (type === 'Expense' && category.groupId !== get('categoryGroup'))
        throw Error('Choose a category in the selected group.');
      Object.assign(x, {
        categoryId: category.id,
        description: get('description'),
        name: get('description') || category.name,
      });
      delete x.toKind;
      delete x.toId;
      delete x.fromKind;
      delete x.fromId;
      if (record.type !== type) {
        delete x.goalId;
        delete x.debtId;
        delete x.principal;
      }
      if ((x.principal || 0) > amount) throw Error('Debt principal cannot exceed Actual.');
    }
    // Editing a historical linked payment must not silently remove a debt repayment
    // already needed to keep other payments within the starting balance.
    const next = structuredClone(state),
      i = next.transactions.findIndex((t) => t.id === id);
    if (i < 0) next.transactions.push(x);
    else next.transactions[i] = x;
    for (const d of next.debts) {
      const repaid = B.sum(
        next.transactions.filter((t) => t.paid),
        (t) =>
          t.type === 'Transfer' && t.toKind === 'debt' && t.toId === d.id
            ? t.actual
            : t.type === 'Expense' && t.debtId === d.id
              ? t.principal || 0
              : 0,
      );
      if (repaid > B.debtBasis(d))
        throw Error('Total debt payments exceed the starting debt balance.');
    }
    next.skipped = next.skipped.filter((key) => key !== x.id);
    if (!fromGoal) next.lastAccountId = accountId;
    next.month = date.slice(0, 7);
    if (commit(next)) {
      filters.month = next.month;
      $('#editor').close();
      render();
    }
  }
  function recurringFormFields(x) {
    const type = x.type || 'Expense',
      group = x.groupId || state.categories.find((c) => c.id === x.categoryId)?.groupId || '';
    const requiredSelect = (label, key, list, value) =>
      select(label + ' *', key, list, value, true).replace('<select ', '<select required ');
    const account = x.accountId || state.lastAccountId || '';
    let fields =
      input('Name *', 'name', x.name || '', 'text', 'required maxlength="100"') +
      input(
        'Amount *',
        'expected',
        x.expected ?? '',
        'number',
        'required min="0.01" max="1000000000" step="0.01"',
      );
    const frequencyOptions =
      x.frequency === 'Every 4 Weeks' ? [...B.frequencies, 'Every 4 Weeks'] : B.frequencies;
    fields +=
      requiredSelect('Frequency', 'frequency', frequencyOptions, x.frequency || 'Monthly') +
      input(
        'Start Date *',
        'start',
        x.start || B.today(),
        'date',
        'required min="1900-01-01" max="2199-12-31"',
      ) +
      input('End Date', 'end', x.end || '', 'date', 'min="1900-01-01" max="2199-12-31"');
    if (type === 'Transfer') {
      fields += requiredSelect('From', 'accountId', state.accounts, account);
      fields += requiredSelect(
        'To',
        'destination',
        [
          ...state.accounts
            .filter((a) => a.id !== account)
            .map((a) => ({ id: 'account:' + a.id, name: 'Account · ' + a.name })),
          ...state.debts.map((d) => ({ id: 'debt:' + d.id, name: 'Debt · ' + d.name })),
          ...state.goals.map((g) => ({ id: 'goal:' + g.id, name: 'Goal · ' + g.name })),
        ],
        x.destination || (x.toKind && x.toId ? x.toKind + ':' + x.toId : ''),
      );
    } else {
      if (type === 'Expense')
        fields += requiredSelect(
          'Group',
          'categoryGroup',
          state.groups.filter((g) => g.type === 'Expense'),
          group,
        );
      fields += requiredSelect(
        'Category',
        'categoryId',
        state.categories.filter(
          (c) =>
            c.type === type &&
            (!c.hidden || c.id === x.categoryId) &&
            (type === 'Income' || c.groupId === group),
        ),
        x.categoryId,
      );
      fields += requiredSelect('Account', 'accountId', state.accounts, account);
    }
    return (
      fields +
      `<label class="full">Notes<textarea name="notes" maxlength="1000">${esc(x.notes || '')}</textarea></label>`
    );
  }
  function skippedPayments(id) {
    const list = state.skipped
      .filter((key) => key.startsWith(id + '@'))
      .map(findPayment)
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date));
    return list.length
      ? '<h3>Skipped payments</h3>' +
          list
            .map(
              (t) =>
                `<div class="skipped-payment"><span>${esc(t.scheduledDate || t.date)} · ${money(t.expected)}</span>${btn('Restore', 'restore-payment', t.id, 'textbtn')}</div>`,
            )
            .join('')
      : '';
  }
  function drawRecurring(x) {
    const type = x.type || 'Expense';
    editing.draft = { ...x, type };
    $('#editor').innerHTML =
      `<form id="record-form" data-recurring-template="true"><div class="dialog-head"><h2 id="editor-title">${editing.id ? 'Edit' : 'Add'} recurring</h2>${btn('×', 'close', '', 'icon-btn')}</div><div class="transaction-types" role="group" aria-label="Recurring type">${['Expense', 'Income', 'Transfer'].map((t) => `<button class="switch-pill ${type === t ? 'active' : ''}" type="button" data-action="recurring-type" data-id="${t}" aria-pressed="${type === t}">${t}</button>`).join('')}</div><input type="hidden" name="type" value="${type}"><div class="form-grid">${recurringFormFields(x)}</div><section id="skipped-payments" class="skipped-payments">${editing.id ? skippedPayments(editing.id) : ''}</section><p id="form-error" class="form-error" role="alert"></p><div class="dialog-actions">${editing.id ? btn(x.active === false ? 'Resume' : 'Pause', 'pause-recurring', editing.id) + btn('Delete', 'delete', '', 'btn danger') : ''}<span class="spacer"></span>${btn('Cancel', 'close', '', 'btn ghost')}<button class="btn primary" type="submit">Save template</button></div></form>`;
    $('#editor').showModal();
  }
  function recurringDraft() {
    const data = new FormData($('#record-form'));
    return {
      ...editing.draft,
      type: data.get('type'),
      name: data.get('name'),
      expected: data.get('expected'),
      frequency: data.get('frequency'),
      start: data.get('start'),
      end: data.get('end'),
      groupId: data.get('categoryGroup') || '',
      categoryId: data.get('categoryId') || '',
      accountId: data.get('accountId'),
      destination: data.get('destination') || '',
      notes: data.get('notes') || '',
    };
  }
  function saveRecurring(data) {
    const get = (k) => String(data.get(k) || '').trim(),
      { id, record } = editing,
      type = get('type'),
      amount = B.round(Number(get('expected')));
    if (!get('name')) throw Error('Enter a name.');
    if (
      !['Expense', 'Income', 'Transfer'].includes(type) ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1e9
    )
      throw Error('Enter a positive amount and a type.');
    const validDate = (d) =>
      /^(19|20|21)\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(d) && B.iso(B.date(d)) === d;
    if (
      !validDate(get('start')) ||
      (get('end') && (!validDate(get('end')) || get('end') < get('start')))
    )
      throw Error('Choose valid start and end dates.');
    if (
      !B.frequencies.includes(get('frequency')) &&
      !(record.frequency === 'Every 4 Weeks' && get('frequency') === record.frequency)
    )
      throw Error('Choose a frequency.');
    if (!state.accounts.some((a) => a.id === get('accountId'))) throw Error('Choose an account.');
    const x = {
      ...record,
      id: id || uid(),
      name: get('name'),
      type,
      expected: amount,
      frequency: get('frequency'),
      start: get('start'),
      end: get('end'),
      accountId: get('accountId'),
      notes: get('notes'),
      active: record.active !== false,
    };
    if (x.frequency !== 'Monthly' || x.start !== record.start) delete x.monthDay;
    delete x.categoryId;
    delete x.goalId;
    delete x.debtId;
    delete x.toKind;
    delete x.toId;
    if (type === 'Transfer') {
      const dest = get('destination'),
        split = dest.indexOf(':'),
        toKind = dest.slice(0, split),
        toId = dest.slice(split + 1),
        list = { account: 'accounts', debt: 'debts', goal: 'goals' }[toKind];
      if (
        !list ||
        !state[list].some((t) => t.id === toId) ||
        (toKind === 'account' && toId === x.accountId)
      )
        throw Error('Choose a different valid destination.');
      Object.assign(x, { toKind, toId });
    } else {
      const c = state.categories.find((c) => c.id === get('categoryId') && c.type === type);
      if (
        !c ||
        (c.hidden && record.categoryId !== c.id) ||
        (type === 'Expense' && c.groupId !== get('categoryGroup'))
      )
        throw Error('Choose a category in the selected group.');
      x.categoryId = c.id;
    }
    if (
      mutate((n) => {
        if (id) {
          B.freezePast(n, id);
          n.scheduled = n.scheduled.filter(
            (t) => t.recurringId !== id || t.date <= B.today() || n.skipped.includes(t.id),
          );
          x.effectiveFrom = B.tomorrow();
          n.recurring[n.recurring.findIndex((r) => r.id === id)] = x;
        } else n.recurring.push(x);
        n.lastAccountId = x.accountId;
      })
    )
      $('#editor').close();
  }
  function pauseRecurring(id) {
    if (
      mutate((n) => {
        const r = n.recurring.find((r) => r.id === id);
        if (!r) return;
        B.freezePast(n, id);
        n.scheduled = n.scheduled.filter(
          (t) => t.recurringId !== id || t.date <= B.today() || n.skipped.includes(t.id),
        );
        r.active = !r.active;
        r.effectiveFrom = B.tomorrow();
      })
    )
      $('#editor').close();
  }
  function findPayment(id) {
    return (
      state.transactions.find((t) => t.id === id) ||
      B.generated(state, id.slice(-10), true).find((t) => t.id === id)
    );
  }
  function drawPayment(t) {
    editing = { kind: 'transaction', id: t.id, record: t };
    $('#editor').innerHTML =
      `<form id="payment-record-form"><div class="dialog-head"><h2 id="editor-title">${t.paid ? 'Edit payment' : 'Mark as Paid'}</h2>${btn('×', 'close', '', 'icon-btn')}</div><h3>${esc(t.name)}</h3><p class="settings-note">Expected ${money(t.expected)} · ${esc(t.scheduledDate || t.date)}</p><div class="form-grid">${input('Actual amount *', 'amount', t.paid ? t.actual : t.expected, 'number', 'required min="0.01" max="1000000000" step="0.01"')}${input('Payment date *', 'date', t.date, 'date', 'required min="1900-01-01" max="2199-12-31"')}<label class="full">Notes<textarea name="notes" maxlength="1000">${esc(t.notes || '')}</textarea></label></div><p id="form-error" class="form-error" role="alert"></p><div class="dialog-actions">${!t.paid ? btn(t.skipped ? 'Restore payment' : 'Skip this time', t.skipped ? 'restore-payment' : 'skip-payment', t.id) : ''}<span class="spacer"></span>${btn('Cancel', 'close', '', 'btn ghost')}<button type="submit" class="btn primary">${t.paid ? 'Save payment' : 'Mark as Paid'}</button></div></form>`;
    $('#editor').showModal();
  }
  function savePayment(data) {
    const t = editing.record;
    const payload = new FormData();
    payload.set('type', t.type);
    payload.set('amount', data.get('amount'));
    payload.set('date', data.get('date'));
    payload.set('notes', data.get('notes') || '');
    payload.set('accountId', t.accountId);
    payload.set('description', t.name);
    if (t.type === 'Transfer') payload.set('destination', t.toKind + ':' + t.toId);
    else {
      payload.set('categoryId', t.categoryId);
      payload.set(
        'categoryGroup',
        state.categories.find((c) => c.id === t.categoryId)?.groupId || '',
      );
    }
    editing.record = { ...t, scheduledDate: t.scheduledDate || t.date };
    saveTransaction(payload);
  }
  function skipPayment(id, restore = false) {
    const t = findPayment(id);
    if (!t || t.paid) return;
    if (
      mutate((n) => {
        n.scheduled ||= [];
        if (!n.scheduled.some((x) => x.id === id)) n.scheduled.push({ ...t, skipped: false });
        n.skipped = n.skipped.filter((x) => x !== id);
        if (!restore) n.skipped.push(id);
        else if (t.date > B.today()) {
          const refreshed = { ...n, scheduled: n.scheduled.filter((x) => x.id !== id) };
          if (B.generated(refreshed, t.date, true).some((x) => x.id === id))
            n.scheduled = refreshed.scheduled;
        }
      })
    ) {
      if (restore && editing.kind === 'recurring')
        $('#skipped-payments').innerHTML = skippedPayments(editing.id);
      else $('#editor').close();
    }
  }
  function scheduleRow(t) {
    t = { ...t, date: t.scheduledDate || t.date };
    return `<div class="schedule-record ${t.paid ? 'is-paid' : ''}">${row(t, false, true)}<div class="schedule-actions">${t.paid ? btn('Edit', 'open-payment', t.id, 'textbtn') : t.skipped ? btn('Restore', 'restore-payment', t.id, 'textbtn') : btn('Mark as Paid', 'open-payment', t.id, 'btn primary') + btn('Skip this time', 'skip-payment', t.id, 'btn')}</div></div>`;
  }
  function editor(kind, id = '', preset = {}) {
    let record = state[collections[kind]].find((t) => t.id === id);
    if (kind === 'transaction' && !record && id) {
      const stamp = id.slice(-10);
      record = B.generated(state, stamp, true).find((t) => t.id === id);
    }
    if (id && !record) {
      toast('This record is no longer available.');
      return;
    }
    const x = { ...record, ...preset };
    editing = { kind, id, record: x };
    if (kind === 'recurring') {
      drawRecurring(x);
      return;
    }
    if (kind === 'transaction') {
      if (x.recurringId) drawPayment(x);
      else drawTransaction(x);
      return;
    }
    let fields = '';
    if (kind === 'account')
      fields =
        input('Account name', 'name', x.name || '', 'text', 'required maxlength="60"') +
        select('Account type', 'kind', accountKinds, x.kind || 'Checking') +
        input(
          'Opening balance',
          'opening',
          x.opening || 0,
          'number',
          'required min="-1000000000" max="1000000000" step="0.01"',
        ) +
        '<p class="hint full">Balance before the transactions in this budget. Record loans and credit-card liabilities in Debt to avoid double counting.</p>';
    else if (kind === 'category')
      fields =
        input('Category name', 'name', x.name || '', 'text', 'required maxlength="60"') +
        select('Group', 'groupId', state.groups, x.groupId || groupId('Other')) +
        num('Monthly budget', 'budget', B.budgetFor(x, thisMonth())) +
        `<label class="check-label"><input name="hidden" type="checkbox" ${x.hidden ? 'checked' : ''}> Hidden</label>`;
    else if (kind === 'group')
      fields =
        input('Group name', 'name', x.name || '', 'text', 'required maxlength="60"') +
        `<div class="full">${state.categories
          .filter((c) => c.groupId === x.id)
          .map((c) =>
            edit('category', c.id, `${esc(c.name)} <b>${money(B.budgetFor(c, thisMonth()))}</b>`),
          )
          .join('')}</div>`;
    else if (kind === 'debt')
      fields =
        input('Name *', 'name', x.name || '', 'text', 'required maxlength="60"') +
        select(
          'Type',
          'kind',
          ['Credit card', 'Student loan', 'Auto loan', 'Mortgage', 'Personal loan', 'Other'],
          x.kind || 'Other',
        ) +
        input(
          'Starting Balance *',
          'balance',
          x.balance ?? '',
          'number',
          'required min="0.01" max="1000000000" step="0.01"',
        ) +
        input(
          'Start Date *',
          'start',
          x.start || state.budgetStart || B.today(),
          'date',
          'required min="1900-01-01" max="2199-12-31"',
        ) +
        input('APR (%) *', 'apr', x.apr ?? '', 'number', 'required min="0" max="100" step="0.01"') +
        input(
          'Minimum Payment *',
          'minimum',
          x.minimum ?? '',
          'number',
          'required min="0" max="1000000000" step="0.01"',
        ) +
        input('Due Day', 'dueDay', x.dueDay || '', 'number', 'min="1" max="31" step="1"') +
        input(
          'Custom priority',
          'order',
          x.order || state.debts.length + 1,
          'number',
          'required min="1" max="1000" step="1"',
        );
    else if (kind === 'goal')
      fields =
        input('Goal name', 'name', x.name || '', 'text', 'required maxlength="60"') +
        select('Type', 'kind', ['Savings goal', 'Sinking fund'], x.kind || 'Savings goal') +
        num('Target amount', 'target', x.target || 0) +
        num('Starting saved amount', 'saved', x.saved || 0) +
        input(
          'Target date',
          'deadline',
          x.deadline ?? '',
          'date',
          'min="1900-01-01" max="2199-12-31"',
        );
    $('#editor').innerHTML =
      `<form id="record-form"><div class="dialog-head"><h2 id="editor-title">${id ? 'Edit' : 'Add'} ${kind === 'goal' ? 'savings goal' : kind}</h2>${btn('×', 'close', '', 'icon-btn')}</div>${x.sample ? '<p class="sample-tag">Sample data</p>' : ''}<div class="form-grid">${fields}</div><p id="form-error" class="form-error" role="alert"></p><div class="dialog-actions">${id ? btn('Delete', 'delete', '', 'btn danger') : ''}<span class="spacer"></span>${btn('Cancel', 'close', '', 'btn ghost')}<button class="btn primary" type="submit">Save ${kind === 'transaction' ? 'entry' : kind}</button></div></form>`;
    $('#editor').showModal();
  }
  function saveRecord(event) {
    event.preventDefault();
    const f = event.target,
      data = new FormData(f),
      { kind, id, record } = editing;
    let x = { ...record, id: id || uid() };
    if (kind === 'recurring') {
      saveRecurring(data);
      return;
    }
    if (kind === 'transaction') {
      if (record.recurringId) savePayment(data);
      else saveTransaction(data);
      return;
    }
    const get = (k) => String(data.get(k) || '').trim(),
      number = (k) => B.round(Number(get(k)));
    x.name = get('name');
    if (!x.name) throw Error('Enter a name.');
    if (kind === 'account') Object.assign(x, { kind: get('kind'), opening: number('opening') });
    else if (kind === 'category') {
      const group = state.groups.find((g) => g.id === get('groupId'));
      if (!group) throw Error('Choose a group.');
      Object.assign(x, {
        groupId: group.id,
        type: group.type,
        hidden: data.has('hidden'),
      });
      const budget = number('budget');
      if (!Number.isFinite(budget) || budget < 0 || budget > 1e9)
        throw Error('Enter a valid budget.');
      // Budget edits apply from this month on, so earlier months keep their plan.
      if (!id) x.budget = budget;
      else if (budget !== B.budgetFor(x, thisMonth()))
        B.setBudgetFrom(x, thisMonth(), budget, firstBudgetMonth());
      if (
        state.categories.some((c) => c.id !== id && c.name.toLowerCase() === x.name.toLowerCase())
      )
        throw Error('A category with this name already exists.');
      if (
        [...state.transactions, ...state.recurring, ...(state.scheduled || [])].some(
          (t) => t.categoryId === id && t.type !== x.type,
        )
      )
        throw Error('This category is in use. Keep its income/expense type.');
    } else if (kind === 'group') {
      if (!['Income', 'Expense'].includes(x.type))
        throw Error('Choose an income or expense group.');
      if (state.groups.some((g) => g.id !== id && g.name.toLowerCase() === x.name.toLowerCase()))
        throw Error('A group with this name already exists.');
      delete x.budget;
    } else if (kind === 'debt') {
      Object.assign(x, {
        original: number('balance'),
        balance: number('balance'),
        kind: get('kind') || record.kind || 'Other',
        start: get('start') || record.start || state.budgetStart,
        apr: number('apr'),
        minimum: number('minimum'),
        dueDay: get('dueDay') ? Number(get('dueDay')) : null,
        order: get('order') ? Number(get('order')) : record.order || state.debts.length + 1,
      });
      if (
        !['balance', 'apr', 'minimum'].every(
          (k) => get(k) !== '' && Number.isFinite(x[k]) && x[k] >= 0 && x[k] <= 1e9,
        ) ||
        x.balance <= 0 ||
        x.apr > 100
      )
        throw Error('Enter valid balance, APR and minimum payment.');
      if (!/^(19|20|21)\d{2}-\d{2}-\d{2}$/.test(x.start) || B.iso(B.date(x.start)) !== x.start)
        throw Error('Choose a valid start date.');
      if (
        (x.dueDay !== null && (!Number.isInteger(x.dueDay) || x.dueDay < 1 || x.dueDay > 31)) ||
        !Number.isInteger(x.order) ||
        x.order < 1 ||
        x.order > 1000
      )
        throw Error('Choose a valid due day or priority.');
      if (B.debtBasis(x) < B.debtPaid(state, id))
        throw Error(
          'Starting balance cannot be less than recorded payments. Use Update Balance to reconcile.',
        );
    } else if (kind === 'goal') {
      Object.assign(x, {
        kind: get('kind'),
        target: number('target'),
        saved: number('saved'),
        deadline: get('deadline'),
      });
      if (x.target <= 0) throw Error('Target must be greater than zero.');
      if (
        x.deadline &&
        (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(x.deadline) ||
          B.iso(B.date(x.deadline)) !== x.deadline)
      )
        throw Error('Choose a valid target date or leave it empty.');
    }
    if (
      mutate((n) => {
        const list = n[collections[kind]],
          i = list.findIndex((t) => t.id === id);
        if (i < 0) list.push(x);
        else list[i] = x;
        if (kind === 'transaction') n.month = x.date.slice(0, 7);
        if (['transaction', 'recurring'].includes(kind)) n.lastAccountId = x.accountId;
      })
    ) {
      if (kind === 'transaction') {
        filters.month = state.month;
        render();
      }
      $('#editor').close();
    }
  }
  function deletionInfo() {
    const { kind, id } = editing,
      source = state[collections[kind]].find((x) => x.id === id);
    if (!source) throw Error('Record no longer exists.');
    const cats = kind === 'group' ? state.categories.filter((c) => c.groupId === id) : [source],
      ids = new Set(cats.map((c) => c.id));
    const transactions = [...state.transactions, ...(state.scheduled || [])].filter((t) =>
        ids.has(t.categoryId),
      ),
      recurring = state.recurring.filter((t) => ids.has(t.categoryId));
    const needsTarget =
      kind === 'group' ? cats.length > 0 : transactions.length + recurring.length > 0;
    const targets = state[kind === 'group' ? 'groups' : 'categories'].filter(
      (x) => x.id !== id && x.type === source.type,
    );
    return { kind, id, source, cats, ids, transactions, recurring, needsTarget, targets };
  }
  function openCategoryDeletion() {
    const d = deletionInfo();
    const choices = d.targets.map((x) => ({
      id: x.id,
      name:
        d.kind === 'group'
          ? x.name
          : `${state.groups.find((g) => g.id === x.groupId)?.name || ''} / ${x.name}${x.hidden ? ' (hidden)' : ''}`,
    }));
    choices.push({
      id: '__new',
      name: d.kind === 'group' ? '+ Create a new group' : '+ Create a new subcategory',
    });
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`,
      linked =
        d.kind === 'group'
          ? `It has ${plural(d.cats.length, 'subcategory').replace('ys', 'ies')}.`
          : `It has ${plural(d.transactions.length, 'transaction')}${d.recurring.length ? ` and ${plural(d.recurring.length, 'recurring payment')}` : ''}.`;
    $('#editor').innerHTML =
      `<div class="dialog-head"><h2 id="editor-title">Delete ${esc(d.source.name)}?</h2></div>${d.needsTarget ? `<p>${linked}</p><div class="form-grid delete-move">${select('Move them to', 'deleteTarget', choices, '', true)}<div class="full" id="delete-new-name" hidden>${input(d.kind === 'group' ? 'New group name' : 'New category name', 'deleteNewName', '', 'text', 'maxlength="60"')}</div></div>` : ''}<p id="delete-error" class="form-error" role="alert"></p><div class="dialog-actions">${btn('Cancel', 'delete-cancel')}${btn(d.needsTarget ? 'Move & delete' : 'Delete', 'delete-confirm', '', 'btn danger')}</div>`;
  }
  function finishCategoryDeletion() {
    try {
      const d = deletionInfo();
      let targetId = '',
        created = null;
      if (d.needsTarget) {
        targetId = $('[name="deleteTarget"]').value;
        if (targetId === '__new') {
          const label = $('[name="deleteNewName"]').value.trim();
          if (!label || label.length > 60) throw Error('Enter a name for the new destination.');
          if (
            state[collections[d.kind]].some(
              (x) => x.id !== d.id && x.name.toLowerCase() === label.toLowerCase(),
            )
          )
            throw Error('Choose the existing destination with that name.');
          targetId = uid();
          created =
            d.kind === 'group'
              ? { id: targetId, name: label, type: d.source.type }
              : {
                  id: targetId,
                  name: label,
                  type: d.source.type,
                  groupId: d.source.groupId,
                  budget: 0,
                  hidden: false,
                };
        } else if (!d.targets.some((x) => x.id === targetId))
          throw Error('Choose where to move the linked records.');
        if (d.kind === 'category') {
          const target = created || d.targets.find((x) => x.id === targetId);
          if (Math.max(...B.budgetAmounts(B.mergeBudgets(target, d.source))) > 1e9)
            throw Error('Combined budget is too large. Reduce it before moving.');
        }
      }
      if (
        mutate((n) => {
          if (created) n[collections[d.kind]].push(created);
          if (d.kind === 'group') {
            n.categories.forEach((c) => {
              if (c.groupId === d.id) c.groupId = targetId;
            });
            n.groups = n.groups.filter((g) => g.id !== d.id);
          } else {
            if (d.needsTarget) {
              [...n.transactions, ...n.recurring, ...(n.scheduled || [])].forEach((t) => {
                if (t.categoryId === d.id) t.categoryId = targetId;
              });
              const target = n.categories.find((c) => c.id === targetId);
              const merged = B.mergeBudgets(target, d.source);
              delete target.budgetPlan;
              delete target.budgetMonths;
              Object.assign(target, merged);
              // A merged budget is now user-managed, independent of demo cleanup.
              delete target.sampleBudget;
              delete target.beforeSampleBudget;
            }
            n.categories = n.categories.filter((c) => c.id !== d.id);
          }
        })
      ) {
        if (d.ids.has(filters.category)) filters.category = '';
        $('#editor').close();
        render();
        toast('Category deleted. Linked records preserved.');
      }
    } catch (error) {
      $('#delete-error').textContent = error.message;
    }
  }
  function deleteRecord() {
    const { kind, id } = editing;
    if (['category', 'group'].includes(kind)) {
      openCategoryDeletion();
      return;
    }
    if (['account', 'category', 'debt', 'goal'].includes(kind)) {
      const field = {
        account: 'accountId',
        category: 'categoryId',
        debt: 'debtId',
        goal: 'goalId',
      }[kind];
      if (
        [...state.transactions, ...state.recurring, ...(state.scheduled || [])].some(
          (t) =>
            t[field] === id ||
            (t.type === 'Transfer' &&
              ((t.toKind === kind && t.toId === id) || (t.fromKind === kind && t.fromId === id))),
        )
      ) {
        $('#form-error').textContent =
          'This record is linked to entries. Reassign or delete those entries first.';
        return;
      }
    }
    $('#editor').innerHTML =
      `<div class="dialog-head"><h2 id="editor-title">Delete this ${kind}?</h2></div><p>${kind === 'recurring' ? 'Future payments will be removed. Paid transactions and payments already due remain.' : 'This cannot be undone without a backup.'}</p><div class="dialog-actions">${btn('Cancel', 'delete-cancel')}${btn('Delete', 'delete-confirm', '', 'btn danger')}</div>`;
  }
  function removeRecord() {
    const { kind, id } = editing;
    if (['category', 'group'].includes(kind)) {
      finishCategoryDeletion();
      return;
    }
    if (
      mutate((n) => {
        if (kind === 'recurring') {
          B.freezePast(n, id);
          n.scheduled = n.scheduled.filter((t) => t.recurringId !== id || t.date <= B.today());
          n.skipped = n.skipped.filter((x) => !x.startsWith(id + '@') || x.slice(-10) <= B.today());
        }
        n[collections[kind]] = n[collections[kind]].filter((x) => x.id !== id);
        if (kind === 'transaction' && id.includes('@')) n.skipped.push(id);
      })
    ) {
      $('#editor').close();
      toast('Record deleted.');
    }
  }
  function cleanSamples(n) {
    const sampleAccounts = new Set(n.accounts.filter((a) => a.sample).map((a) => a.id)),
      sampleDebts = new Set(n.debts.filter((a) => a.sample).map((a) => a.id)),
      sampleGoals = new Set(n.goals.filter((a) => a.sample).map((a) => a.id));
    n.transactions = n.transactions.filter((t) => !t.sample);
    n.recurring = n.recurring.filter((t) => !t.sample);
    n.scheduled = (n.scheduled || []).filter((t) => !t.sample);
    // Retain sample containers that now hold the user's own entries.
    const used = (field, id) =>
      [...n.transactions, ...n.recurring, ...(n.scheduled || [])].some(
        (t) =>
          t[field] === id ||
          (t.type === 'Transfer' &&
            ((t.toId === id &&
              t.toKind === { accountId: 'account', debtId: 'debt', goalId: 'goal' }[field]) ||
              (field === 'goalId' && t.fromKind === 'goal' && t.fromId === id))),
      );
    n.accounts = n.accounts.filter((a) => !sampleAccounts.has(a.id) || used('accountId', a.id));
    n.debts = n.debts.filter((a) => !sampleDebts.has(a.id) || used('debtId', a.id));
    n.goals = n.goals.filter((a) => !sampleGoals.has(a.id) || used('goalId', a.id));
    n.categories.forEach((c) => {
      if (c.sampleBudget !== undefined) {
        if (c.budget === c.sampleBudget) c.budget = c.beforeSampleBudget || 0;
        delete c.sampleBudget;
        delete c.beforeSampleBudget;
      }
    });
    n.skipped = n.skipped.filter((id) => !id.startsWith('sample-'));
    delete n.sampleProfile;
    delete n.sampleDataVersion;
    delete n.extraSampleDebtsVersion;
    delete n.sampleDebtPaymentsVersion;
    delete n.sampleIncomeVersion;
    delete n.samplePaycheckVersion;
  }
  function addExtraSampleDebts(n) {
    if (n.extraSampleDebtsVersion === 1) return;
    const debts = [
      ['auto', 'Auto loan', 'Auto loan', 7800, 6.9, 260, 8],
      ['personal', 'Personal loan', 'Personal loan', 2400, 12.5, 140, 12],
      ['store', 'Store card', 'Credit card', 650, 29.9, 45, 20],
    ];
    const firstOrder = Math.max(0, ...n.debts.map((d) => d.order || 0)) + 1;
    debts.forEach(([key, name, kind, balance, apr, minimum, dueDay], i) => {
      const id = 'sample-extra-debt-' + key;
      if (!n.debts.some((d) => d.id === id))
        n.debts.push({
          id,
          name,
          kind,
          original: balance,
          balance,
          start: '2026-10-22',
          apr,
          minimum,
          dueDay,
          order: firstOrder + i,
          sample: true,
        });
    });
    n.extraSampleDebtsVersion = 1;
  }
  function addSampleDebtPayments(n) {
    if (n.sampleDebtPaymentsVersion === 1) return;
    const account = n.accounts.find((a) => a.sample && a.id.endsWith('-checking'));
    if (!account) return;
    const add = (debt, date, amount) => {
      if (!debt || !debt.sample || (debt.start && date < debt.start)) return;
      const id = 'sample-payment-' + debt.id + '@' + date;
      if (n.transactions.some((t) => t.id === id)) return;
      const actual = Math.min(amount, B.debtBalance(n, debt.id));
      if (actual <= 0) return;
      n.transactions.push({
        id,
        type: 'Transfer',
        name: 'Transfer to ' + debt.name,
        description: '',
        accountId: account.id,
        toKind: 'debt',
        toId: debt.id,
        date,
        expected: amount,
        actual,
        paid: true,
        sample: true,
        notes: 'Fictional sample debt payment',
      });
    };
    const student = n.debts.find((d) => d.sample && d.id.endsWith('-loan'));
    for (let month = 1; month <= 10; month++)
      add(student, '2026-' + String(month).padStart(2, '0') + '-15', 180);
    for (const [key, amount] of [
      ['auto', 260],
      ['personal', 140],
      ['store', 45],
    ])
      add(
        n.debts.find((d) => d.id === 'sample-extra-debt-' + key),
        '2026-10-22',
        amount,
      );
    n.sampleDebtPaymentsVersion = 1;
  }
  function addSampleIncome(n) {
    if (n.sampleIncomeVersion === 1) return;
    const checking = n.accounts.find((a) => a.sample && a.id.endsWith('-checking'));
    if (!checking) return;
    const savings = n.accounts.find((a) => a.sample && a.id.endsWith('-savings')) || checking;
    let group = n.groups.find((g) => g.type === 'Income');
    if (!group) {
      group = { id: uid(), name: 'Income', type: 'Income' };
      n.groups.push(group);
    }
    for (const [label, budget, account, day, amounts] of [
      ['Freelance', 600, checking, '18', [450, 720, 550, 900, 650, 480, 800, 620, 1050, 750]],
      [
        'Interest',
        15,
        savings,
        '20',
        [10.4, 11.2, 12.15, 12.8, 13.65, 14.1, 15.25, 16.4, 17.1, 18.35],
      ],
    ]) {
      let category = n.categories.find(
        (c) => c.type === 'Income' && c.name.toLowerCase() === label.toLowerCase(),
      );
      if (!category) {
        category = {
          id: uid(),
          name: label,
          type: 'Income',
          groupId: group.id,
          hidden: false,
          budget,
          sampleBudget: budget,
          beforeSampleBudget: 0,
        };
        n.categories.push(category);
      }
      amounts.forEach((amount, i) => {
        const date = `2026-${String(i + 1).padStart(2, '0')}-${day}`;
        const id = `sample-income-${label.toLowerCase()}-${account.id}@${date}`;
        if (date > B.today() || n.transactions.some((t) => t.id === id)) return;
        n.transactions.push({
          id,
          type: 'Income',
          categoryId: category.id,
          accountId: account.id,
          name: label === 'Freelance' ? 'Freelance project payment' : 'Savings interest',
          description: label === 'Freelance' ? 'Client project' : 'Monthly savings interest',
          date,
          expected: amount,
          actual: amount,
          paid: true,
          sample: true,
          notes: 'Fictional sample income',
        });
      });
    }
    n.sampleIncomeVersion = 1;
  }
  function renameSampleIncome(n) {
    if (n.samplePaycheckVersion === 1) return;
    const category = n.categories.find(
      (c) =>
        c.type === 'Income' &&
        c.name === 'Income' &&
        [...n.transactions, ...n.recurring].some((t) => t.sample && t.categoryId === c.id),
    );
    if (category && !n.categories.some((c) => c.name === 'Paycheck' && c.type === 'Income'))
      category.name = 'Paycheck';
    n.samplePaycheckVersion = 1;
  }
  function sample() {
    mutate((n) => {
      cleanSamples(n);
      const cutoff = '2026-10-22',
        tag = 'sample-' + uid(),
        account = tag + '-checking',
        goal = tag + '-goal',
        debt = tag + '-debt';
      n.month = cutoff.slice(0, 7);
      n.budgetStart = '2026-01-01';
      n.onboarded = true;
      n.sampleProfile = 'Sample';
      n.sampleDataVersion = 4;
      const limits = {
        Income: 7200,
        Salary: 7200,
        'Rent / Mortgage': 1800,
        'Home Maintenance': 120,
        'Electricity & Gas': 140,
        Water: 45,
        Internet: 65,
        Phone: 55,
        Groceries: 550,
        'Dining Out': 220,
        Coffee: 65,
        'Car Payment': 320,
        Gas: 150,
        'Car Maintenance': 90,
        'Public Transit': 50,
        Medical: 100,
        Fitness: 45,
        Childcare: 500,
        'Kids Activities': 90,
        Pets: 80,
        Clothing: 130,
        Household: 100,
        'Personal Care': 90,
        Subscriptions: 55,
        Entertainment: 100,
        Travel: 200,
        Gifts: 100,
        Insurance: 160,
        Fees: 180,
        Miscellaneous: 350,
      };
      const paycheck = n.categories.find((c) => c.id === 'Income-0' && c.name === 'Paycheck');
      if (paycheck && !n.categories.some((c) => c.type === 'Income' && c.name === 'Income'))
        paycheck.name = 'Income';
      // Restore any missing starter categories without replacing custom categories.
      for (const g of defaultGroups()) if (!n.groups.some((x) => x.id === g.id)) n.groups.push(g);
      for (const c of defaultCategories())
        if (!n.categories.some((x) => x.name === c.name && x.type === c.type)) {
          if (n.categories.some((x) => x.id === c.id)) c.id = uid();
          n.categories.push(c);
        }
      n.categories.forEach((c) => {
        c.beforeSampleBudget = c.budget || 0;
        c.budget = limits[c.name] || (c.type === 'Income' ? 1000 : 100);
        c.sampleBudget = c.budget;
      });
      const cat = (name) => n.categories.find((c) => c.name === name)?.id;
      n.accounts.push(
        { id: account, name: 'Checking', kind: 'Checking', opening: 2400, sample: true },
        { id: tag + '-savings', name: 'Savings', kind: 'Savings', opening: 3200, sample: true },
      );
      n.debts.push(
        {
          id: debt,
          name: 'Credit card',
          original: 4800,
          balance: 3600,
          apr: 18.9,
          minimum: 150,
          order: 1,
          sample: true,
        },
        {
          id: tag + '-loan',
          name: 'Student loan',
          original: 18000,
          balance: 12000,
          apr: 5.2,
          minimum: 180,
          order: 2,
          sample: true,
        },
      );
      n.goals.push(
        {
          id: goal,
          name: 'Emergency fund',
          kind: 'Savings goal',
          target: 6000,
          saved: 700,
          deadline: '2027-06-30',
          sample: true,
        },
        {
          id: tag + '-travel',
          name: 'Summer trip',
          kind: 'Sinking fund',
          target: 2400,
          saved: 600,
          deadline: '2027-07-01',
          sample: true,
        },
      );
      const schedules = [
        ['Paycheck', 'Income', 3600, 'Bi-weekly', 2],
        ['Rent', 'Rent / Mortgage', 1800, 'Monthly', 1],
        ['Electricity', 'Electricity & Gas', 125, 'Monthly', 18],
        ['Water bill', 'Water', 42, 'Monthly', 24],
        ['Internet', 'Internet', 65, 'Monthly', 25],
        ['Phone plan', 'Phone', 55, 'Monthly', 12],
        ['Car payment', 'Car Payment', 320, 'Monthly', 8],
        ['Gym membership', 'Fitness', 45, 'Monthly', 6],
        ['Childcare', 'Childcare', 500, 'Monthly', 3],
        ['Streaming services', 'Subscriptions', 39, 'Monthly', 15],
        ['Insurance', 'Insurance', 160, 'Monthly', 27],
      ];
      schedules.forEach(([name, category, expected, frequency, day], i) =>
        n.recurring.push({
          id: tag + '-recurring-' + i,
          name,
          type: category === 'Income' ? 'Income' : 'Expense',
          categoryId: cat(category),
          accountId: account,
          expected,
          frequency,
          start: `2026-01-${String(day).padStart(2, '0')}`,
          end: '',
          active: true,
          sample: true,
        }),
      );
      // Starts after the sample history, so it only drives the goal's On track status.
      n.recurring.push({
        id: tag + '-recurring-goal',
        name: 'Emergency fund',
        type: 'Transfer',
        accountId: account,
        toKind: 'goal',
        toId: goal,
        expected: 300,
        frequency: 'Monthly',
        start: '2026-11-10',
        end: '',
        active: true,
        sample: true,
      });
      B.generated(n, cutoff)
        .filter((t) => t.sample)
        .forEach((t) => {
          const month = Number(t.date.slice(5, 7));
          const unpaid = t.name === 'Electricity' && month === 10;
          if (unpaid) return;
          n.transactions.push({
            ...t,
            actual: unpaid ? 0 : t.name === 'Electricity' ? B.round(112 + month * 3.7) : t.expected,
            paid: !unpaid,
            notes: 'Fictional sample data',
          });
        });
      const add = (name, category, expected, actual, date, extra = {}) => {
        if (date > cutoff) return;
        n.transactions.push({
          id: tag + '-' + uid(),
          name,
          type: 'Expense',
          categoryId: cat(category),
          accountId: account,
          expected,
          actual: B.round(actual),
          date,
          paid: true,
          principal: 0,
          notes: 'Fictional sample data',
          sample: true,
          ...extra,
        });
      };
      const variable = [
        ['Home Maintenance', 'Home supplies', 2, 65],
        ['Dining Out', 'Dinner out', 3, 70],
        ['Coffee', 'Coffee shop', 4, 18],
        ['Gas', 'Fuel', 3, 48],
        ['Car Maintenance', 'Vehicle care', 1, 65],
        ['Public Transit', 'Transit pass', 1, 38],
        ['Medical', 'Pharmacy', 1, 48],
        ['Kids Activities', 'After-school club', 1, 75],
        ['Pets', 'Pet food', 1, 62],
        ['Clothing', 'Clothes', 1, 95],
        ['Household', 'Household supplies', 2, 38],
        ['Personal Care', 'Haircut & care', 1, 65],
        ['Entertainment', 'Cinema & weekend plans', 2, 40],
        ['Travel', 'Weekend travel', 1, 120],
        ['Gifts', 'Birthday gift', 1, 65],
      ];
      for (let month = 1; month <= 10; month++) {
        const date = (day) =>
          `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        [4, 11, 18, 25].forEach((day, i) =>
          add('Grocery shopping', 'Groceries', 130, 110 + ((month * 13 + i * 17) % 55), date(day)),
        );
        variable.forEach(([category, name, count, base], index) => {
          for (let j = 0; j < count; j++) {
            const day = 2 + ((index * 3 + j * 8 + month) % 26);
            const actual = base * (0.85 + ((month + index + j) % 6) * 0.07);
            add(name, category, base, actual, date(day));
          }
        });
        if (date(15) <= cutoff)
          n.transactions.push({
            id: tag + '-' + uid(),
            type: 'Transfer',
            name: 'Transfer to Savings',
            description: '',
            accountId: account,
            toKind: 'account',
            toId: tag + '-savings',
            date: date(15),
            expected: 400,
            actual: 400,
            paid: true,
            sample: true,
            notes: 'Fictional sample data',
          });
        if (date(10) <= cutoff)
          n.transactions.push({
            id: tag + '-' + uid(),
            type: 'Transfer',
            name: 'Transfer to Emergency fund',
            description: '',
            accountId: account,
            toKind: 'goal',
            toId: goal,
            date: date(10),
            expected: 300,
            actual: 300,
            paid: true,
            sample: true,
            notes: 'Fictional sample data',
          });
        add('Credit card payment', 'Fees', 150, 150, date(16), {
          debtId: debt,
          principal: 95 + month * 2,
        });
      }
      addExtraSampleDebts(n);
      addSampleDebtPayments(n);
      addSampleIncome(n);
      renameSampleIncome(n);
    });
    filters.month = state.month;
    render();
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = `ultimate-budget-${B.today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  let pendingImport = null;
  function validateImport(s) {
    if (!s || ![2, 3, 4].includes(s.version)) throw Error('Unsupported backup.');
    s = migrate(structuredClone(s));
    s.scheduled ??= [];
    if (Array.isArray(s.transactions) && Array.isArray(s.scheduled)) {
      s.scheduled.push(...s.transactions.filter((t) => t.recurringId && !t.paid));
      s.transactions = s.transactions.filter((t) => !t.recurringId || t.paid);
    }
    if (Array.isArray(s.recurring))
      s.recurring.forEach((r) => {
        r.frequency = B.frequencyAliases[r.frequency] || r.frequency;
      });
    if (s.version !== 4) throw Error('Unsupported backup.');
    for (const key of [
      'accounts',
      'categories',
      'transactions',
      'recurring',
      'scheduled',
      'skipped',
      'debts',
      'goals',
      'groups',
    ])
      if (!Array.isArray(s[key]) || s[key].length > 20000) throw Error('Invalid backup data.');
    if (
      typeof s.currency !== 'string' ||
      !s.currency.trim() ||
      s.currency.length > 8 ||
      !['Monday', 'Sunday'].includes(s.week) ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(s.month) ||
      !['Snowball', 'Avalanche', 'Custom'].includes(s.strategy)
    )
      throw Error('Invalid preferences.');
    const finite = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e9,
      monthKey = (m) => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m),
      validBudgetPlan = (c) =>
        (c.budgetPlan === undefined ||
          (Array.isArray(c.budgetPlan) &&
            c.budgetPlan.every(
              (p, i) =>
                p &&
                monthKey(p.from) &&
                finite(p.amount) &&
                (!i || c.budgetPlan[i - 1].from < p.from),
            ))) &&
        (c.budgetMonths === undefined ||
          (c.budgetMonths &&
            typeof c.budgetMonths === 'object' &&
            !Array.isArray(c.budgetMonths) &&
            Object.entries(c.budgetMonths).every(([m, v]) => monthKey(m) && finite(v)))),
      validDate = (v) =>
        typeof v === 'string' &&
        /^(19|20|21)\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(v) &&
        B.iso(B.date(v)) === v;
    if (!finite(s.extra)) throw Error('Invalid payment plan.');
    for (const list of [
      'accounts',
      'categories',
      'transactions',
      'recurring',
      'scheduled',
      'debts',
      'goals',
      'groups',
    ]) {
      const ids = new Set();
      for (const x of s[list]) {
        if (
          !x ||
          typeof x.id !== 'string' ||
          !x.id ||
          ids.has(x.id) ||
          typeof x.name !== 'string' ||
          !x.name.trim()
        )
          throw Error('Invalid records.');
        ids.add(x.id);
      }
    }
    if (!validDate(s.budgetStart)) throw Error('Invalid budget start date.');
    for (const g of s.groups)
      if (!['Income', 'Expense'].includes(g.type)) throw Error('Invalid group.');
    for (const c of s.categories)
      if (
        !['Income', 'Expense'].includes(c.type) ||
        typeof c.hidden !== 'boolean' ||
        !finite(c.budget) ||
        !validBudgetPlan(c) ||
        !s.groups.some((g) => g.id === c.groupId && g.type === c.type)
      )
        throw Error('Invalid category.');
    for (const a of s.accounts)
      if (
        typeof a.opening !== 'number' ||
        !Number.isFinite(a.opening) ||
        Math.abs(a.opening) > 1e9 ||
        (a.adjustments &&
          (!Array.isArray(a.adjustments) ||
            a.adjustments.some(
              (x) =>
                !validDate(x.date) ||
                typeof x.amount !== 'number' ||
                !Number.isFinite(x.amount) ||
                Math.abs(x.amount) > 2e9,
            )))
      )
        throw Error('Invalid account.');
    for (const d of s.debts)
      if (
        !['original', 'balance', 'apr', 'minimum', 'order'].every((k) => finite(d[k])) ||
        d.apr > 100 ||
        d.original < d.balance
      )
        throw Error('Invalid debt.');
    for (const d of s.debts) {
      if (
        (d.start && !validDate(d.start)) ||
        (d.dueDay != null && (!Number.isInteger(d.dueDay) || d.dueDay < 1 || d.dueDay > 31)) ||
        (d.adjustments &&
          (!Array.isArray(d.adjustments) ||
            d.adjustments.some(
              (a) =>
                !validDate(a.date) ||
                typeof a.amount !== 'number' ||
                !Number.isFinite(a.amount) ||
                Math.abs(a.amount) > 1e9,
            )))
      )
        throw Error('Invalid debt details.');
    }
    for (const g of s.goals)
      if (
        !finite(g.target) ||
        g.target <= 0 ||
        !finite(g.saved) ||
        (g.deadline && !validDate(g.deadline))
      )
        throw Error('Invalid goal.');
    for (const t of [...s.transactions, ...s.recurring, ...s.scheduled]) {
      // Goal withdrawals are one-off transfers from a goal into an account.
      const withdrawal = t.fromKind !== undefined;
      if (
        withdrawal &&
        (t.fromKind !== 'goal' ||
          !s.goals.some((g) => g.id === t.fromId) ||
          t.type !== 'Transfer' ||
          t.toKind !== 'account' ||
          t.accountId !== undefined ||
          !s.transactions.includes(t))
      )
        throw Error('Invalid goal withdrawal.');
      if (!finite(t.expected) || (!withdrawal && !s.accounts.some((a) => a.id === t.accountId)))
        throw Error('Invalid linked entry.');
      if (t.type === 'Transfer') {
        const list = { account: 'accounts', debt: 'debts', goal: 'goals' }[t.toKind];
        if (
          !list ||
          !s[list].some((x) => x.id === t.toId) ||
          (t.toKind === 'account' && t.accountId === t.toId) ||
          (s.transactions.includes(t) && (!finite(t.actual) || t.actual <= 0 || !t.paid)) ||
          t.categoryId ||
          t.goalId ||
          t.debtId
        )
          throw Error('Invalid transfer.');
      } else if (
        !['Income', 'Expense'].includes(t.type) ||
        !s.categories.some((c) => c.id === t.categoryId && c.type === t.type) ||
        (t.goalId && !s.goals.some((g) => g.id === t.goalId)) ||
        (t.debtId && !s.debts.some((d) => d.id === t.debtId))
      )
        throw Error('Invalid linked entry.');
    }
    for (const t of s.transactions)
      if (
        !validDate(t.date) ||
        !finite(t.actual) ||
        typeof t.paid !== 'boolean' ||
        !finite(t.principal || 0) ||
        (t.principal || 0) > t.actual
      )
        throw Error('Invalid transaction.');
    for (const r of s.recurring)
      if (
        !validDate(r.start) ||
        (r.end && (!validDate(r.end) || r.end < r.start)) ||
        (!B.frequencies.includes(r.frequency) && r.frequency !== 'Every 4 Weeks') ||
        typeof r.active !== 'boolean' ||
        r.expected <= 0 ||
        (r.effectiveFrom && !validDate(r.effectiveFrom))
      )
        throw Error('Invalid schedule.');
    for (const r of s.recurring)
      if (
        r.monthDay != null &&
        (!Number.isInteger(r.monthDay) || r.monthDay < 1 || r.monthDay > 31)
      )
        throw Error('Invalid monthly due day.');
    for (const t of s.scheduled)
      if (!validDate(t.date) || !t.recurringId || t.paid || !finite(t.actual))
        throw Error('Invalid scheduled payment.');
    for (const t of s.transactions)
      if (t.scheduledDate && !validDate(t.scheduledDate)) throw Error('Invalid scheduled date.');
    if (!s.skipped.every((x) => typeof x === 'string')) throw Error('Invalid exclusions.');
    if (!s.incomeDefaultsVersion) {
      s = structuredClone(s);
      const names = ['Salary', 'Side Income', 'Interest', 'Other Income'];
      const originals = s.categories.filter(
        (c) =>
          c.type === 'Income' &&
          names.some((name, i) => c.id === `Income-${i}` && c.name === name) &&
          c.groupId === 'group-income',
      );
      if (originals.length) {
        const target =
          s.categories.find(
            (c) => c.type === 'Income' && c.name === 'Income' && c.groupId === 'group-income',
          ) || originals[0];
        target.name = 'Income';
        const ids = new Set(originals.filter((c) => c.id !== target.id).map((c) => c.id));
        const merged = originals
          .filter((c) => ids.has(c.id))
          .reduce((sum, c) => B.mergeBudgets(sum, c), target);
        delete target.budgetPlan;
        delete target.budgetMonths;
        Object.assign(target, merged);
        [...s.transactions, ...s.recurring, ...s.scheduled].forEach((t) => {
          if (ids.has(t.categoryId)) t.categoryId = target.id;
        });
        s.categories = s.categories.filter((c) => !ids.has(c.id));
      }
      s.incomeDefaultsVersion = 1;
    }
    return s;
  }
  document.addEventListener('click', (event) => {
    const e = event.target.closest('button');
    if (!e) return;
    if (e.dataset.screen) {
      screen = e.dataset.screen;
      render();
      return;
    }
    if (e.dataset.edit) {
      editor(e.dataset.edit, e.dataset.id, e.dataset.group ? { groupId: e.dataset.group } : {});
      return;
    }
    const a = e.dataset.action,
      id = e.dataset.id;
    if (a === 'dash-mode') {
      dashMode = id;
      render();
    } else if (a === 'dash-year') {
      const m = B.monthShift(state.month, Number(id) * 12);
      filters.month = m;
      mutate((n) => (n.month = m));
    } else if (a === 'toggle-budget-group') {
      if (!openBudgetGroups.delete(id)) openBudgetGroups.add(id);
      render();
    } else if (a === 'month-budget') editMonthBudget(id);
    else if (a === 'toggle-spending') {
      spendingExpanded = !spendingExpanded;
      render();
      $('[data-action="toggle-spending"]')?.focus();
    } else if (a === 'open-payment') {
      const t = findPayment(id);
      if (t) drawPayment(t);
    } else if (a === 'skip-payment') skipPayment(id);
    else if (a === 'restore-payment') skipPayment(id, true);
    else if (a === 'pause-recurring') pauseRecurring(id);
    else if (a === 'recurring-type') {
      const draft = recurringDraft();
      drawRecurring({ ...draft, type: id, categoryId: '', groupId: '', destination: '' });
    } else if (a === 'transaction-type') {
      const draft = transactionDraft();
      drawTransaction({ ...draft, type: id, categoryId: '', groupId: '', destination: '' });
    } else if (a === 'setup') {
      screen = 'Setup';
      render();
    } else if (a === 'transactions') {
      screen = 'Transactions';
      render();
    } else if (a === 'edit-budget') {
      editingBudget = id;
      render();
      const input = $('#active-budget-input');
      input?.focus();
      input?.select();
    } else if (a === 'toggle-category')
      mutate((n) => {
        const c = n.categories.find((c) => c.id === id);
        if (c) c.hidden = !c.hidden;
      });
    else if (a === 'dismiss') mutate((n) => (n.onboarded = true));
    else if (a === 'close') $('#editor').close();
    else if (a === 'tab') {
      tab = id;
      render();
    } else if (a === 'reset-month') {
      filters.month = '';
      render();
    } else if (a === 'add-income-group') editor('group', '', { type: 'Income' });
    else if (a === 'add-expense-group') editor('group', '', { type: 'Expense' });
    else if (a === 'income') editor('recurring', '', { type: 'Income' });
    else if (a === 'delete') deleteRecord();
    else if (a === 'delete-cancel') editor(editing.kind, editing.id);
    else if (a === 'delete-confirm') removeRecord();
    else if (a === 'debt-expand') {
      debtExpanded.has(id) ? debtExpanded.delete(id) : debtExpanded.add(id);
      render();
    } else if (a === 'debt-full') {
      debtFull.has(id) ? debtFull.delete(id) : debtFull.add(id);
      render();
    } else if (a === 'debt-balance') updateDebtBalance(id);
    else if (a === 'debt-recurring') debtRecurring(id);
    else if (a === 'goal-add')
      editor('transaction', '', {
        type: 'Transfer',
        accountId: state.lastAccountId || state.accounts[0]?.id || '',
        destination: 'goal:' + id,
      });
    else if (a === 'goal-withdraw')
      editor('transaction', '', { type: 'Transfer', accountId: 'goal:' + id, destination: '' });
    else if (a === 'goal-recurring') goalRecurring(id);
    else if (a === 'account-balance') updateAccountBalance(id);
    else if (a === 'account-transfer')
      editor('transaction', '', { type: 'Transfer', accountId: id, destination: '' });
    else if (a === 'account-transactions') {
      filters.account = id;
      screen = 'Transactions';
      render();
      globalThis.scrollTo?.(0, 0);
    } else if (a === 'choose-debt-strategy') applyDebtPlan(id);
    else if (a === 'extra-debt-payment') applyDebtPlan(state.strategy, Number(id));
    else if (a === 'sample') sample();
    else if (a === 'clear-sample') {
      mutate(cleanSamples);
      toast('Sample records cleared. Your entries are kept.');
    } else if (a === 'export') exportData();
    else if (a === 'import') $('#import-file').click();
    else if (a === 'import-confirm') {
      if (pendingImport && commit(pendingImport)) {
        pendingImport = null;
        filters.month = state.month;
        $('#editor').close();
        render();
        toast('Backup restored.');
      }
    }
  });
  document.addEventListener('submit', (event) => {
    if (event.target.id === 'debt-balance-form') {
      event.preventDefault();
      try {
        saveDebtBalance(new FormData(event.target));
      } catch (error) {
        $('#form-error').textContent = error.message;
      }
    } else if (event.target.id === 'month-budget-form') {
      event.preventDefault();
      try {
        saveMonthBudget(new FormData(event.target), event.submitter?.value);
      } catch (error) {
        $('#form-error').textContent = error.message;
      }
    } else if (event.target.id === 'account-balance-form') {
      event.preventDefault();
      try {
        saveAccountBalance(new FormData(event.target));
      } catch (error) {
        $('#form-error').textContent = error.message;
      }
    } else if (event.target.id === 'payment-record-form') {
      event.preventDefault();
      try {
        savePayment(new FormData(event.target));
      } catch (error) {
        $('#form-error').textContent = error.message;
      }
    } else if (event.target.id === 'record-form') {
      try {
        saveRecord(event);
      } catch (error) {
        $('#form-error').textContent = error.message;
      }
    } else if (event.target.id === 'preferences') {
      event.preventDefault();
      const data = new FormData(event.target),
        currency = String(
          data.get('currency') === 'custom' ? data.get('currencyCustom') : data.get('currency'),
        ).trim();
      if (!currency) {
        toast('Enter a currency symbol.');
        return;
      }
      mutate((n) => {
        n.currency = currency;
        n.budgetStart = String(data.get('budgetStart'));
        if (n.month < n.budgetStart.slice(0, 7)) n.month = n.budgetStart.slice(0, 7);
      });
    }
  });
  document.addEventListener('change', async (event) => {
    const e = event.target;
    if (e.id === 'extra-payment') {
      queueDebtPlan(e);
    } else if (e.name === 'deleteTarget') {
      const box = $('#delete-new-name');
      if (box) box.hidden = e.value !== '__new';
    } else if (e.id === 'budget-month') {
      const m = e.value;
      filters.month = m;
      mutate((n) => (n.month = m));
    } else if (e.dataset.categoryBudget) {
      const amount = Number(e.value);
      if (!e.value.trim() || !Number.isFinite(amount) || amount < 0 || amount > 1e9) {
        toast('Enter a valid monthly budget.');
        const c = state.categories.find((c) => c.id === e.dataset.categoryBudget);
        e.value = c ? B.budgetFor(c, thisMonth()) : 0;
        return;
      }
      const id = e.dataset.categoryBudget;
      editingBudget = null;
      if (
        !mutate((n) => {
          const c = n.categories.find((c) => c.id === id);
          if (c && B.round(amount) !== B.budgetFor(c, thisMonth()))
            B.setBudgetFrom(c, thisMonth(), amount, firstBudgetMonth());
        })
      ) {
        editingBudget = id;
        render();
      }
    } else if (e.id === 'calendar-week') {
      if (['Monday', 'Sunday'].includes(e.value)) mutate((n) => (n.week = e.value));
    } else if (e.dataset.filter) {
      filters[e.dataset.filter] = e.value;
      render();
    } else if (e.id === 'setup-currency') {
      $('#setup-custom-currency').hidden = e.value !== 'custom';
    } else if (e.id === 'filter-month') {
      filters.month = e.value;
      render();
    } else if (
      e.closest?.('[data-recurring-template]') &&
      (e.name === 'categoryGroup' || (e.name === 'accountId' && editing.draft.type === 'Transfer'))
    ) {
      const draft = recurringDraft();
      if (e.name === 'categoryGroup') draft.categoryId = '';
      if (e.name === 'accountId' && draft.destination === 'account:' + draft.accountId)
        draft.destination = '';
      drawRecurring(draft);
    } else if (
      e.closest?.('[data-simple-transaction]') &&
      (e.name === 'categoryGroup' || (e.name === 'accountId' && editing.draft.type === 'Transfer'))
    ) {
      const draft = transactionDraft();
      if (e.name === 'categoryGroup') draft.categoryId = '';
      if (
        e.name === 'accountId' &&
        (draft.destination === 'account:' + draft.accountId ||
          (draft.accountId.startsWith('goal:') && !draft.destination.startsWith('account:')))
      )
        draft.destination = '';
      drawTransaction(draft);
      $(
        '#record-form [name="' + (e.name === 'categoryGroup' ? 'categoryId' : 'destination') + '"]',
      )?.focus();
    } else if (e.name === 'type' && e.closest('#record-form')) {
      const cat = $('#record-form [name="categoryId"]');
      cat.innerHTML = options(
        state.categories.filter(
          (c) => (c.type === 'Income') === (e.value === 'Income') && !c.hidden,
        ),
        '',
        true,
      );
    } else if (e.id === 'import-file' && e.files[0]) {
      try {
        if (e.files[0].size > 10000000) throw Error('Backup is too large.');
        pendingImport = validateImport(JSON.parse(await e.files[0].text()));
        $('#editor').innerHTML =
          `<h2 id="editor-title">Replace this budget?</h2><p class="settings-note">The backup contains ${pendingImport.transactions.length} transactions. Download your current data first if you need to keep it.</p><div class="dialog-actions">${btn('Export current', 'export')}${btn('Cancel', 'close')}${btn('Replace with backup', 'import-confirm', '', 'btn primary')}</div>`;
        $('#editor').showModal();
      } catch (error) {
        toast(error.message);
      }
    }
  });
  globalThis.addEventListener?.('resize', () => {
    if (screen === 'Debt Payoff') fitDebtChart();
    if (screen === 'Dashboard') fitUpcoming();
  });
  document.fonts?.ready.then(() => {
    if (screen === 'Debt Payoff') fitDebtChart();
    if (screen === 'Dashboard') fitUpcoming();
  });
  document.addEventListener('pointermove', (event) => {
    const hit = event.target.closest?.('[data-chart-tip]');
    if (hit) showDebtHover(hit);
  });
  document.addEventListener('pointerout', (event) => {
    const plot = event.target.closest?.('.debt-chart-plot');
    if (plot && !plot.contains(event.relatedTarget)) hideDebtHover(plot);
  });
  document.addEventListener('focusout', (event) => {
    if (event.target.matches?.('[data-debt-chart]'))
      hideDebtHover(event.target.closest('.debt-chart-plot'));
  });
  document.addEventListener('keydown', (event) => {
    const svg = event.target;
    if (
      !svg.matches?.('[data-debt-chart]') ||
      !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)
    )
      return;
    event.preventDefault();
    if (event.key === 'Escape') {
      hideDebtHover(svg.closest('.debt-chart-plot'));
      return;
    }
    const hits = svg.querySelectorAll('[data-chart-tip]');
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? hits.length - 1
          : Math.max(
              0,
              Math.min(
                hits.length - 1,
                Number(svg.dataset.activeIndex || 0) + (event.key === 'ArrowRight' ? 1 : -1),
              ),
            );
    if (hits[index]) showDebtHover(hits[index]);
  });
  document.addEventListener('keydown', (event) => {
    if (!event.target.matches?.('[data-category-budget]')) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      event.target.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      editingBudget = null;
      render();
    }
  });
  document.addEventListener('focusout', (event) => {
    const e = event.target;
    if (e.dataset?.categoryBudget && editingBudget === e.dataset.categoryBudget) {
      const amount = Number(e.value);
      if (
        e.value.trim() &&
        Number.isFinite(amount) &&
        amount >= 0 &&
        amount <= 1e9 &&
        B.round(amount) ===
          B.budgetFor(state.categories.find((c) => c.id === editingBudget) || {}, thisMonth())
      ) {
        editingBudget = null;
        render();
      }
    }
  });
  document.addEventListener('input', (event) => {
    if (event.target.id === 'extra-payment') queueDebtPlan(event.target);
    else if (event.target.id === 'search') {
      const cursor = event.target.selectionStart;
      filters.search = event.target.value;
      render();
      $('#search').focus();
      $('#search').setSelectionRange(cursor, cursor);
    }
  });
  // A new demo version must never replace saved or edited records on page load.
  // The latest dataset is available through the explicit Load sample data action.
  if (
    state.sampleProfile &&
    !blocked &&
    (state.extraSampleDebtsVersion !== 1 ||
      state.sampleDebtPaymentsVersion !== 1 ||
      state.sampleIncomeVersion !== 1 ||
      state.samplePaycheckVersion !== 1)
  )
    mutate((n) => {
      addExtraSampleDebts(n);
      addSampleDebtPayments(n);
      addSampleIncome(n);
      renameSampleIncome(n);
    });
  else render();
})();
