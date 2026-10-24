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
  function occurrence(start, frequency, n) {
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
    const day = d.getDate();
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
        const when = occurrence(r.start, r.frequency, n);
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
  function accountBalance(state, id) {
    const a = state.accounts.find((a) => a.id === id);
    return round(
      (a?.opening || 0) +
        sum(
          state.transactions.filter((t) => t.paid),
          (t) => {
            if (t.type === 'Transfer')
              return (
                (t.toKind === 'account' && t.toId === id ? t.actual : 0) -
                (t.accountId === id ? t.actual : 0)
              );
            return t.accountId === id ? (t.type === 'Income' ? t.actual : -t.actual) : 0;
          },
        ),
    );
  }
  function debtBalance(state, id) {
    return debtBalanceAt(state, id);
  }
  function goalSaved(state, id) {
    const g = state.goals.find((g) => g.id === id);
    return round(
      (g?.saved || 0) +
        sum(
          state.transactions.filter((t) => t.paid),
          (t) =>
            t.type === 'Transfer' && t.toKind === 'goal' && t.toId === id
              ? t.actual
              : t.type === 'Expense' && t.goalId === id
                ? t.actual
                : 0,
        ),
    );
  }
  function goalTransferAssets(state) {
    return sum(
      state.transactions.filter((t) => t.paid && t.type === 'Transfer' && t.toKind === 'goal'),
      (t) => t.actual,
    );
  }
  function totalAssets(state) {
    return round(
      sum(state.accounts, (a) => accountBalance(state, a.id)) + goalTransferAssets(state),
    );
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
        const charge = round((d.balance * d.apr) / 1200);
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
    goalTransferAssets,
    totalAssets,
    summary,
    payoff,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = api;
})(typeof window !== 'undefined' ? window : globalThis);
