/* Pure budget calculations. Money is rounded to cents at calculation boundaries. */
(function (root) {
  'use strict';
  const round = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const date = (s) => new Date(`${s}T12:00:00`);
  const today = () => iso(new Date());
  const frequencies = [
    'Weekly',
    'Bi-weekly',
    'Semi-monthly',
    'Monthly',
    'Every 2 months',
    'Quarterly',
    'Semi-annually',
    'Annually',
  ];
  const frequencyAliases = {
    'Every 2 Weeks': 'Bi-weekly',
    'Every 2 Months': 'Every 2 months',
    'Every 3 Months': 'Quarterly',
    'Every 6 Months': 'Semi-annually',
    Yearly: 'Annually',
  };
  function occurrence(start, frequency, n, anchorDay) {
    frequency = frequencyAliases[frequency] || frequency;
    const d = date(start),
      days = { Weekly: 7, 'Bi-weekly': 14, 'Every 4 Weeks': 28 }[frequency];
    if (days) {
      d.setDate(d.getDate() + days * n);
      return iso(d);
    }
    if (frequency === 'Semi-monthly') {
      let slot = d.getDate() === 1 ? 0 : d.getDate() <= 15 ? 1 : 2;
      slot += n;
      d.setDate(1);
      d.setMonth(d.getMonth() + Math.floor(slot / 2));
      d.setDate(slot % 2 === 0 ? 1 : 15);
      return iso(d);
    }
    const step = {
      Monthly: 1,
      'Every 2 months': 2,
      Quarterly: 3,
      'Semi-annually': 6,
      Annually: 12,
    }[frequency];
    if (!step) throw Error('Unknown frequency');
    const day = anchorDay || d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + step * n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return iso(d);
  }
  function generated(state, through, includeSkipped = false) {
    const rows = [],
      saved = new Set(state.transactions.map((t) => t.id)),
      skipped = new Set(state.skipped),
      frozen = new Map((state.scheduled || []).map((t) => [t.id, t]));
    const append = (t) => {
      if (saved.has(t.id) || t.date > through) return;
      if (skipped.has(t.id)) {
        if (includeSkipped) rows.push({ ...t, skipped: true });
      } else rows.push({ ...t, skipped: false });
    };
    frozen.forEach(append);
    for (const r of state.recurring) {
      if (!r.active) continue;
      for (let n = 0; n < 16000; n++) {
        const when = occurrence(r.start, r.frequency, n, r.monthDay);
        if (when > through || (r.end && when > r.end)) break;
        if (r.effectiveFrom && when < r.effectiveFrom) continue;
        const id = `${r.id}@${when}`;
        if (frozen.has(id)) continue;
        append({
          id,
          recurringId: r.id,
          name: r.name,
          type: r.type,
          categoryId: r.categoryId,
          accountId: r.accountId,
          date: when,
          scheduledDate: when,
          expected: r.expected,
          actual: 0,
          paid: false,
          goalId: r.goalId || '',
          debtId: r.debtId || '',
          principal: 0,
          toKind: r.toKind,
          toId: r.toId,
          notes: r.notes || '',
          sample: r.sample || false,
        });
      }
    }
    return rows;
  }
  function entries(state, through = today()) {
    return [...state.transactions, ...generated(state, through)].sort(
      (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
    );
  }
  function paymentSchedule(state, through, from = '1900-01-01') {
    return [
      ...state.transactions
        .filter((t) => t.recurringId)
        .map((t) => ({ ...t, scheduledDate: t.scheduledDate || t.id.slice(-10) })),
      ...generated(state, through, true),
    ]
      .filter((t) => (t.scheduledDate || t.date) >= from && (t.scheduledDate || t.date) <= through)
      .sort(
        (a, b) =>
          (a.scheduledDate || a.date).localeCompare(b.scheduledDate || b.date) ||
          a.name.localeCompare(b.name),
      );
  }
  function freezePast(state, recurringId, through = today()) {
    state.scheduled ||= [];
    const ids = new Set(state.scheduled.map((t) => t.id));
    generated(state, through, true)
      .filter((t) => t.recurringId === recurringId)
      .forEach((t) => {
        if (!ids.has(t.id)) {
          state.scheduled.push(t);
          ids.add(t.id);
        }
      });
  }
  function tomorrow() {
    const d = date(today());
    d.setDate(d.getDate() + 1);
    return iso(d);
  }
  const sum = (rows, fn) => round(rows.reduce((s, t) => s + fn(t), 0));
  // Signed effect of one paid transaction on an account.
  const accountFlow = (t, id) =>
    !t.paid
      ? 0
      : t.type === 'Transfer'
        ? (t.toKind === 'account' && t.toId === id ? t.actual : 0) -
          (t.accountId === id ? t.actual : 0)
        : t.accountId === id
          ? t.type === 'Income'
            ? t.actual
            : -t.actual
          : 0;
  // Adjustments reconcile an account with a bank statement; they are never income or expenses.
  function accountBalance(state, id, through = '2199-12-31') {
    const a = state.accounts.find((a) => a.id === id);
    return round(
      (a?.opening || 0) +
        sum(
          (a?.adjustments || []).filter((x) => x.date <= through),
          (x) => x.amount,
        ) +
        sum(
          state.transactions.filter((t) => !t.date || t.date <= through),
          (t) => accountFlow(t, id),
        ),
    );
  }
  // Money in and out of an account during one month (paid entries and transfers only).
  function accountMonth(state, id, month) {
    const flows = state.transactions
      .filter((t) => t.date?.startsWith(month))
      .map((t) => accountFlow(t, id));
    return {
      in: sum(
        flows.filter((v) => v > 0),
        (v) => v,
      ),
      out: sum(
        flows.filter((v) => v < 0),
        (v) => -v,
      ),
    };
  }
  function debtBalance(state, id) {
    return debtBalanceAt(state, id);
  }
  // Money moved into a goal (transfers and legacy linked expenses) minus withdrawals.
  const goalFlow = (t, id) =>
    !t.paid
      ? 0
      : t.type === 'Transfer' && t.toKind === 'goal' && (id === undefined || t.toId === id)
        ? t.actual
        : t.type === 'Transfer' && t.fromKind === 'goal' && (id === undefined || t.fromId === id)
          ? -t.actual
          : t.type === 'Expense' && t.goalId && (id === undefined || t.goalId === id)
            ? t.actual
            : 0;
  function goalSaved(state, id) {
    const g = state.goals.find((g) => g.id === id);
    return round((g?.saved || 0) + sum(state.transactions, (t) => goalFlow(t, id)));
  }
  // The starting saved amount is assumed to sit in an account already.
  function goalAssets(state) {
    return sum(state.transactions, (t) => goalFlow(t));
  }
  function totalAssets(state) {
    return round(sum(state.accounts, (a) => accountBalance(state, a.id)) + goalAssets(state));
  }
  const monthlyFactor = {
    Weekly: 52 / 12,
    'Bi-weekly': 26 / 12,
    'Every 4 Weeks': 13 / 12,
    'Semi-monthly': 2,
    Monthly: 1,
    'Every 2 months': 1 / 2,
    Quarterly: 1 / 3,
    'Semi-annually': 1 / 6,
    Annually: 1 / 12,
  };
  // A recurring template's amount per month.
  const monthlyAmount = (r) =>
    r.expected * (monthlyFactor[frequencyAliases[r.frequency] || r.frequency] || 0);
  // Active recurring transfers into a goal, as a monthly amount.
  function goalPlanned(state, id, asOf = today()) {
    return sum(
      state.recurring.filter(
        (r) =>
          r.active &&
          r.type === 'Transfer' &&
          r.toKind === 'goal' &&
          r.toId === id &&
          (!r.end || r.end >= asOf),
      ),
      monthlyAmount,
    );
  }
  // Calendar months until the target date, including the current month.
  function goalPlan(state, id, asOf = today()) {
    const g = state.goals.find((g) => g.id === id),
      saved = goalSaved(state, id),
      remaining = Math.max(0, round(g.target - saved)),
      planned = goalPlanned(state, id, asOf);
    if (remaining === 0) return { saved, remaining, planned, status: 'reached' };
    if (!g.deadline) return { saved, remaining, planned, status: 'open' };
    if (g.deadline < asOf) return { saved, remaining, planned, status: 'overdue' };
    const months =
      (Number(g.deadline.slice(0, 4)) - Number(asOf.slice(0, 4))) * 12 +
      Number(g.deadline.slice(5, 7)) -
      Number(asOf.slice(5, 7)) +
      1;
    const needed = round(remaining / months);
    return {
      saved,
      remaining,
      planned,
      months,
      needed,
      status: planned + 0.005 >= needed ? 'on-track' : 'behind',
    };
  }
  function summary(state, month) {
    const inMonth = (d) => d.startsWith(month) && (!state.budgetStart || d >= state.budgetStart),
      rows = entries(state, month + '-31').filter((t) => inMonth(t.date));
    const actual = (type) =>
      sum(
        state.transactions.filter((t) => t.paid && t.type === type && inMonth(t.date)),
        (t) => t.actual,
      );
    const expected = (type) =>
      sum(
        paymentSchedule(state, month + '-31', month + '-01').filter(
          (t) => !t.skipped && t.type === type && inMonth(t.scheduledDate || t.date),
        ),
        (t) => t.expected,
      ) +
      sum(
        state.transactions.filter((t) => !t.recurringId && t.type === type && inMonth(t.date)),
        (t) => t.expected,
      );
    const income = actual('Income'),
      expense = actual('Expense'),
      expectedIncome = round(expected('Income')),
      expectedExpense = round(expected('Expense'));
    const savings = sum(
      rows.filter(
        (t) =>
          t.paid &&
          ((t.type === 'Expense' && t.goalId) || (t.type === 'Transfer' && t.toKind === 'goal')),
      ),
      (t) => t.actual,
    );
    return {
      rows,
      income,
      expense,
      expectedIncome,
      expectedExpense,
      left: round(income - expense),
      savings,
      rate: income ? (savings / income) * 100 : 0,
    };
  }
  // Category budgets: a base amount, step changes from a month on, and one-month overrides.
  function planBudget(c, month) {
    let amount = c.budget || 0;
    for (const p of c.budgetPlan || []) if (p.from <= month) amount = p.amount;
    return amount;
  }
  function budgetFor(c, month) {
    const own = c.budgetMonths?.[month];
    return own === undefined ? planBudget(c, month) : own;
  }
  function tidyBudget(c) {
    if (!c.budgetPlan?.length) delete c.budgetPlan;
    if (!Object.keys(c.budgetMonths || {}).length) delete c.budgetMonths;
    return c;
  }
  // Changes one month only; matching the planned amount clears the override.
  function setBudgetMonth(c, month, amount) {
    const months = { ...(c.budgetMonths || {}) };
    if (round(amount) === planBudget(c, month)) delete months[month];
    else months[month] = round(amount);
    c.budgetMonths = months;
    return tidyBudget(c);
  }
  // Sets the amount from `month` on; earlier months keep their budgets.
  function setBudgetFrom(c, month, amount, firstMonth = month) {
    const plan = (c.budgetPlan || []).filter((p) => p.from < month),
      months = Object.fromEntries(Object.entries(c.budgetMonths || {}).filter(([m]) => m < month));
    if (month <= firstMonth) {
      c.budget = round(amount);
      plan.length = 0;
    } else if (
      planBudget({ budget: c.budget, budgetPlan: plan }, monthShift(month, -1)) !== round(amount)
    )
      plan.push({ from: month, amount: round(amount) });
    c.budgetPlan = plan;
    c.budgetMonths = months;
    return tidyBudget(c);
  }
  // Budget fields of two categories added together month by month.
  function mergeBudgets(a, b) {
    const froms = [
        ...new Set([...(a.budgetPlan || []), ...(b.budgetPlan || [])].map((p) => p.from)),
      ],
      months = new Set([
        ...Object.keys(a.budgetMonths || {}),
        ...Object.keys(b.budgetMonths || {}),
      ]);
    return tidyBudget({
      budget: round((a.budget || 0) + (b.budget || 0)),
      budgetPlan: froms.sort().map((from) => ({
        from,
        amount: round(planBudget(a, from) + planBudget(b, from)),
      })),
      budgetMonths: Object.fromEntries(
        [...months].sort().map((m) => [m, round(budgetFor(a, m) + budgetFor(b, m))]),
      ),
    });
  }
  const budgetAmounts = (c) => [
    c.budget || 0,
    ...(c.budgetPlan || []).map((p) => p.amount),
    ...Object.values(c.budgetMonths || {}),
  ];
  function debtPriority(a, b, strategy) {
    return strategy === 'Avalanche'
      ? b.apr - a.apr || a.balance - b.balance
      : strategy === 'Custom'
        ? a.order - b.order || a.balance - b.balance
        : a.balance - b.balance || b.apr - a.apr;
  }
  /* Fixed monthly payment pool; interest accrues before payments. Unused minimums
   roll into the selected priority debt. Baseline uses the same pool, no extra. */
  function payoff(debts, extra = 0, strategy = 'Snowball') {
    let ds = debts.filter((d) => d.balance > 0).map((d) => ({ ...d, balance: round(d.balance) }));
    const pool = round(sum(ds, (d) => d.minimum) + Number(extra));
    let interest = 0,
      months = 0;
    if (!ds.length) return { months: 0, interest: 0, paidOff: true };
    while (months < 1200) {
      months++;
      let remaining = pool;
      // Lock priority before interest and minimum payments change the balances.
      const ordered = [...ds].sort((a, b) => debtPriority(a, b, strategy));
      ds.forEach((d) => {
        const i = round((d.balance * d.apr) / 1200);
        interest = round(interest + i);
        d.balance = round(d.balance + i);
      });
      ds.forEach((d) => {
        const p = Math.min(d.balance, d.minimum, remaining);
        d.balance = round(d.balance - p);
        remaining = round(remaining - p);
      });
      for (const d of ordered) {
        const p = Math.min(d.balance, remaining);
        d.balance = round(d.balance - p);
        remaining = round(remaining - p);
      }
      ds = ds.filter((d) => d.balance > 0.005);
      if (!ds.length) return { months, interest, paidOff: true };
      if (pool <= 0 || ds.some((d) => !Number.isFinite(d.balance))) break;
    }
    return { months: null, interest, paidOff: false };
  }
  // Legacy principal allocations remain readable; new repayments are Transfers.
  const debtPayment = (t, id) =>
    t.paid
      ? t.type === 'Transfer' && t.toKind === 'debt' && t.toId === id
        ? t.actual
        : t.type === 'Expense' && t.debtId === id
          ? t.principal || 0
          : 0
      : 0;
  function debtPaid(state, id, through = '2199-12-31') {
    return sum(
      state.transactions.filter((t) => !t.date || t.date <= through),
      (t) => debtPayment(t, id),
    );
  }
  function debtBasis(d, through = '2199-12-31') {
    return round(
      (d?.balance || 0) +
        sum(
          (d?.adjustments || []).filter((a) => a.date <= through),
          (a) => a.amount,
        ),
    );
  }
  function debtBalanceAt(state, id, through = '2199-12-31') {
    const d = state.debts.find((d) => d.id === id);
    return Math.max(0, round(debtBasis(d, through) - debtPaid(state, id, through)));
  }
  function monthShift(month, n) {
    const d = date(month + '-01');
    d.setMonth(d.getMonth() + n);
    return iso(d).slice(0, 7);
  }
  function debtProjection(state, strategy = state.strategy, asOf = today()) {
    const month = asOf.slice(0, 7),
      ds = state.debts.map((d) => ({ ...d, balance: debtBalanceAt(state, d.id, asOf) })),
      rows = [];
    const pool = round(sum(ds, (d) => d.minimum) + Number(state.extra || 0));
    let interest = 0;
    if (!ds.some((d) => d.balance > 0))
      return { rows, interest: 0, paidOff: true, months: 0, end: month };
    for (let n = 0; n < 1200; n++) {
      const stamp = monthShift(month, n),
        eligible = ds.filter((d) => d.balance > 0 && (!d.start || d.start.slice(0, 7) <= stamp));
      const paid = (d) =>
        n === 0
          ? sum(
              state.transactions.filter((t) => t.date?.startsWith(month) && t.date <= asOf),
              (t) => debtPayment(t, d.id),
            )
          : 0;
      const firstPaid = n === 0 ? sum(ds, paid) : 0;
      let available = Math.max(0, round(pool - firstPaid));
      // Future debts do not release their minimum until their start month.
      available = Math.max(
        0,
        round(
          available -
            sum(
              ds.filter((d) => d.balance > 0 && d.start?.slice(0, 7) > stamp),
              (d) => d.minimum,
            ),
        ),
      );
      // Lock priority before interest and minimum payments change the balances.
      const ordered = [...eligible].sort((a, b) => debtPriority(a, b, strategy));
      const allocations = {};
      for (const d of eligible) {
        // A statement entered this month already includes this month's interest.
        const reconciled =
          n === 0 && (d.adjustments || []).some((a) => a.date.startsWith(month) && a.date <= asOf);
        const charge = reconciled ? 0 : round((d.balance * d.apr) / 1200);
        interest = round(interest + charge);
        d.balance = round(d.balance + charge);
        allocations[d.id] = 0;
      }
      for (const d of eligible) {
        const amount = Math.min(d.balance, Math.max(0, round(d.minimum - paid(d))), available);
        d.balance = round(d.balance - amount);
        available = round(available - amount);
        allocations[d.id] += amount;
      }
      for (const d of ordered) {
        const amount = Math.min(d.balance, available);
        d.balance = round(d.balance - amount);
        available = round(available - amount);
        allocations[d.id] = round(allocations[d.id] + amount);
      }
      rows.push({
        month: stamp,
        balance: sum(ds, (d) => d.balance),
        debts: ds.map((d) => ({
          id: d.id,
          planned: round((allocations[d.id] || 0) + paid(d)),
          balance: d.balance,
          paid: paid(d),
        })),
      });
      if (ds.every((d) => d.balance <= 0))
        return { rows, interest, paidOff: true, months: n + 1, end: stamp };
    }
    return { rows, interest, paidOff: false, months: null, end: null };
  }
  function debtSchedule(state, id, projection, asOf = today()) {
    const d = state.debts.find((d) => d.id === id),
      current = asOf.slice(0, 7),
      start = (d.start || state.budgetStart || asOf).slice(0, 7),
      rows = [];
    for (let m = start; m < current; m = monthShift(m, 1)) {
      const prior = monthShift(m, -1) + '-31';
      const paid = sum(
        state.transactions.filter((t) => t.date?.startsWith(m)),
        (t) => debtPayment(t, id),
      );
      const opening = m === start ? d.balance : debtBalanceAt(state, id, prior);
      rows.push({
        month: m,
        planned: Math.min(opening, d.minimum),
        paid,
        balance: debtBalanceAt(state, id, m + '-31'),
      });
    }
    for (const row of projection.rows) {
      if (row.month < start) continue;
      const item = row.debts.find((x) => x.id === id);
      rows.push({ month: row.month, ...item });
    }
    // Keep twelve future months visible even when the debt is already paid off.
    const end = monthShift(current, 12);
    let next = rows.length ? monthShift(rows.at(-1).month, 1) : start > current ? start : current;
    for (; next <= end; next = monthShift(next, 1)) {
      const paid =
        next === current
          ? sum(
              state.transactions.filter((t) => t.date?.startsWith(current) && t.date <= asOf),
              (t) => debtPayment(t, id),
            )
          : 0;
      rows.push({ month: next, planned: paid, paid, balance: 0 });
    }
    return rows.map((r) => ({
      ...r,
      state:
        r.month > current
          ? 'future'
          : r.paid > 0 && r.paid >= r.planned
            ? 'complete'
            : r.paid > 0
              ? 'partial'
              : r.planned > 0 &&
                  (r.month < current || Number(asOf.slice(-2)) >= Number(d.dueDay || 1))
                ? 'missed'
                : 'future',
    }));
  }
  const api = {
    debtPriority,
    debtPaid,
    debtBasis,
    debtBalanceAt,
    monthShift,
    debtProjection,
    debtSchedule,
    round,
    iso,
    date,
    today,
    frequencies,
    frequencyAliases,
    occurrence,
    entries,
    generated,
    paymentSchedule,
    freezePast,
    tomorrow,
    sum,
    accountBalance,
    debtBalance,
    goalSaved,
    goalAssets,
    accountMonth,
    goalPlanned,
    monthlyAmount,
    goalPlan,
    totalAssets,
    summary,
    planBudget,
    budgetFor,
    setBudgetMonth,
    setBudgetFrom,
    mergeBudgets,
    budgetAmounts,
    payoff,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = api;
})(typeof window !== 'undefined' ? window : globalThis);
