const test = require('node:test'),
  assert = require('node:assert/strict'),
  B = require('../engine.js');
const base = () => ({
  accounts: [
    { id: 'a', opening: 100 },
    { id: 'b', opening: 500 },
  ],
  categories: [
    { id: 'income', bucket: 'Income' },
    { id: 'needs', bucket: 'Needs' },
    { id: 'save', bucket: 'Savings' },
  ],
  transactions: [],
  recurring: [],
  skipped: [],
  debts: [],
  goals: [],
});
test('Month-end anchors, leap years and all 8 frequencies', () => {
  assert.equal(B.occurrence('2024-01-31', 'Monthly', 1), '2024-02-29');
  assert.equal(B.occurrence('2024-01-31', 'Monthly', 2), '2024-03-31');
  assert.equal(B.occurrence('2024-02-29', 'Yearly', 1), '2025-02-28');
  const expected = [
    '2024-02-07',
    '2024-02-14',
    '2024-02-15',
    '2024-02-29',
    '2024-03-31',
    '2024-04-30',
    '2024-07-31',
    '2025-01-31',
  ];
  B.frequencies.forEach((f, i) => assert.equal(B.occurrence('2024-01-31', f, 1), expected[i]));
});
test('Generated payments are deterministic, stop at end, and never duplicate saved overrides', () => {
  const s = base();
  s.recurring = [
    {
      id: 'r',
      start: '2026-01-31',
      end: '2026-03-31',
      frequency: 'Monthly',
      active: true,
      name: 'Rent',
      expected: 100,
      type: 'Expense',
    },
  ];
  assert.deepEqual(
    B.generated(s, '2026-12-31').map((t) => t.date),
    ['2026-01-31', '2026-02-28', '2026-03-31'],
  );
  s.transactions.push({
    ...B.generated(s, '2026-12-31')[0],
    paid: true,
    actual: 90,
    date: '2026-02-01',
  });
  s.skipped = ['r@2026-02-28'];
  assert.equal(B.entries(s, '2026-12-31').length, 2);
  assert.equal(B.entries(s, '2026-12-31').filter((x) => x.id === 'r@2026-01-31').length, 1);
  s.recurring[0].active = false;
  assert.equal(B.entries(s, '2026-12-31').length, 1);
});
test('Accounts are independent and only paid Actual affects balances', () => {
  const s = base();
  s.transactions = [
    { accountId: 'a', paid: true, type: 'Income', actual: 1000, expected: 900 },
    { accountId: 'a', paid: true, type: 'Expense', actual: 50, expected: 40 },
    { accountId: 'b', paid: false, type: 'Expense', actual: 200, expected: 200 },
  ];
  assert.equal(B.accountBalance(s, 'a'), 1050);
  assert.equal(B.accountBalance(s, 'b'), 500);
});
test('Expected, Actual and linked savings contributions stay separate', () => {
  const s = base();
  s.transactions = [
    {
      id: '1',
      date: '2026-10-01',
      name: 'Salary',
      type: 'Income',
      expected: 1000,
      actual: 900,
      paid: true,
      categoryId: 'income',
    },
    {
      id: '2',
      date: '2026-10-02',
      name: 'Savings',
      type: 'Expense',
      expected: 200,
      actual: 180,
      paid: true,
      categoryId: 'save',
      goalId: 'g',
    },
    {
      id: '3',
      date: '2026-10-03',
      name: 'Rent',
      type: 'Expense',
      expected: 300,
      actual: 300,
      paid: false,
      categoryId: 'needs',
    },
  ];
  const x = B.summary(s, '2026-10');
  assert.equal(x.expectedExpense, 500);
  assert.equal(x.expense, 180);
  assert.equal(x.left, 720);
  assert.equal(x.rate, 20);
});
test('Debt principal and goal allocations reduce/update exactly once', () => {
  const s = base();
  s.debts = [{ id: 'd', balance: 1000 }];
  s.goals = [{ id: 'g', saved: 100 }];
  s.transactions = [
    { paid: true, type: 'Expense', debtId: 'd', actual: 100, principal: 75 },
    { paid: true, type: 'Expense', goalId: 'g', actual: 50 },
    { paid: false, type: 'Expense', debtId: 'd', principal: 400 },
  ];
  assert.equal(B.debtBalance(s, 'd'), 925);
  assert.equal(B.goalSaved(s, 'g'), 150);
});
test('Debt projections: zero APR, interest, extra payments and impossible plan', () => {
  assert.deepEqual(B.payoff([{ balance: 1200, apr: 0, minimum: 100, order: 1 }]), {
    months: 12,
    interest: 0,
    paidOff: true,
  });
  const ds = [{ balance: 1000, apr: 12, minimum: 100, order: 1 }];
  const base = B.payoff(ds),
    extra = B.payoff(ds, 100);
  assert.equal(base.months, 11);
  assert.equal(extra.months, 6);
  assert.ok(extra.interest < base.interest);
  assert.equal(B.payoff([{ balance: 1000, apr: 20, minimum: 0, order: 1 }]).paidOff, false);
});
test('Priority strategies differ and freed minimums roll into remaining balances', () => {
  const ds = [
    { balance: 500, apr: 2, minimum: 30, order: 2 },
    { balance: 2000, apr: 20, minimum: 70, order: 1 },
  ];
  assert.ok(B.payoff(ds, 50, 'Avalanche').interest < B.payoff(ds, 50, 'Snowball').interest);
  assert.deepEqual(B.payoff(ds, 50, 'Custom'), B.payoff(ds, 50, 'Avalanche'));
  assert.equal(
    B.payoff([
      { balance: 100, apr: 0, minimum: 100, order: 1 },
      { balance: 900, apr: 0, minimum: 100, order: 2 },
    ]).months,
    5,
  );
});
test('Budget start limits dashboard totals while keeping earlier account history', () => {
  const s = base();
  s.budgetStart = '2026-10-15';
  s.transactions = [
    {
      id: 'before',
      name: 'Before',
      date: '2026-10-01',
      type: 'Income',
      expected: 100,
      actual: 100,
      paid: true,
      accountId: 'a',
    },
    {
      id: 'after',
      name: 'After',
      date: '2026-10-20',
      type: 'Income',
      expected: 200,
      actual: 200,
      paid: true,
      accountId: 'a',
    },
  ];
  assert.equal(B.summary(s, '2026-10').income, 200);
  assert.equal(B.accountBalance(s, 'a'), 400);
  assert.equal(s.transactions.length, 2);
});
test('Transfers balance both accounts and never inflate income or expenses', () => {
  const s = base();
  s.transactions = [
    {
      id: 't',
      name: 'Move',
      type: 'Transfer',
      date: '2026-10-10',
      paid: true,
      actual: 50,
      expected: 50,
      accountId: 'a',
      toKind: 'account',
      toId: 'b',
    },
  ];
  assert.equal(B.accountBalance(s, 'a'), 50);
  assert.equal(B.accountBalance(s, 'b'), 550);
  assert.equal(B.totalAssets(s), 600);
  const summary = B.summary(s, '2026-10');
  assert.equal(summary.income, 0);
  assert.equal(summary.expense, 0);
  assert.equal(summary.expectedExpense, 0);
});
test('Debt and goal transfers preserve net worth while updating their destination', () => {
  const s = base();
  s.debts = [{ id: 'debt', balance: 200 }];
  s.goals = [{ id: 'goal', saved: 25 }];
  const net = B.totalAssets(s) - B.debtBalance(s, 'debt');
  s.transactions = [
    {
      id: 'd',
      name: 'Debt',
      type: 'Transfer',
      date: '2026-10-10',
      paid: true,
      actual: 40,
      expected: 40,
      accountId: 'b',
      toKind: 'debt',
      toId: 'debt',
    },
    {
      id: 'g',
      name: 'Save',
      type: 'Transfer',
      date: '2026-10-11',
      paid: true,
      actual: 100,
      expected: 100,
      accountId: 'b',
      toKind: 'goal',
      toId: 'goal',
    },
  ];
  assert.equal(B.accountBalance(s, 'b'), 360);
  assert.equal(B.debtBalance(s, 'debt'), 160);
  assert.equal(B.goalSaved(s, 'goal'), 125);
  assert.equal(B.totalAssets(s) - B.debtBalance(s, 'debt'), net);
  assert.equal(B.summary(s, '2026-10').expense, 0);
});
test('Semi-monthly uses the first and fifteenth on or after Start Date', () => {
  for (const [start, expected] of [
    ['2026-01-01', ['2026-01-01', '2026-01-15', '2026-02-01']],
    ['2026-01-09', ['2026-01-15', '2026-02-01', '2026-02-15']],
    ['2026-01-16', ['2026-02-01', '2026-02-15', '2026-03-01']],
  ])
    assert.deepEqual(
      [0, 1, 2].map((n) => B.occurrence(start, 'Semi-monthly', n)),
      expected,
    );
});
test('Late actual payment preserves expected month and calendar date', () => {
  const s = base();
  s.transactions = [
    {
      id: 'r@2026-01-15',
      recurringId: 'r',
      name: 'Utility',
      type: 'Expense',
      date: '2026-02-02',
      scheduledDate: '2026-01-15',
      expected: 120,
      actual: 134,
      paid: true,
      accountId: 'a',
    },
  ];
  assert.equal(B.summary(s, '2026-01').expectedExpense, 120);
  assert.equal(B.summary(s, '2026-01').expense, 0);
  assert.equal(B.summary(s, '2026-02').expectedExpense, 0);
  assert.equal(B.summary(s, '2026-02').expense, 134);
  assert.equal(B.paymentSchedule(s, '2026-01-31')[0].scheduledDate, '2026-01-15');
});
test('Debt projection rolls repaid minimums forward and credits current-month actuals', () => {
  const s = base();
  s.strategy = 'Snowball';
  s.extra = 0;
  s.debts = [
    { id: 'a', balance: 100, minimum: 100, apr: 0, start: '2026-01-01', order: 1 },
    { id: 'b', balance: 900, minimum: 100, apr: 0, start: '2026-01-01', order: 2 },
  ];
  let p = B.debtProjection(s, 'Snowball', '2026-10-22');
  assert.equal(p.months, 5);
  assert.equal(p.end, '2027-02');
  assert.equal(p.rows[0].balance, 800);
  s.transactions = [
    { type: 'Transfer', toKind: 'debt', toId: 'a', actual: 100, paid: true, date: '2026-10-02' },
  ];
  p = B.debtProjection(s, 'Snowball', '2026-10-22');
  assert.equal(p.rows[0].balance, 800);
  assert.equal(p.rows[0].debts[0].planned, 100);
  assert.equal(p.months, 5);
  s.transactions[0].date = '2026-09-02';
  p = B.debtProjection(s, 'Snowball', '2026-10-22');
  assert.equal(p.rows[0].balance, 700);
  assert.equal(p.rows[0].debts[1].planned, 200);
});
test('Debt reconciliation is dated, does not count as paid and handles subsequent transfers', () => {
  const s = base();
  s.debts = [{ id: 'd', balance: 1000, adjustments: [{ date: '2026-10-15', amount: 25 }] }];
  s.transactions = [
    {
      type: 'Transfer',
      toKind: 'debt',
      toId: 'd',
      actual: 100,
      paid: true,
      date: '2026-10-01',
      accountId: 'a',
    },
  ];
  assert.equal(B.debtBalanceAt(s, 'd', '2026-10-14'), 900);
  assert.equal(B.debtBalance(s, 'd'), 925);
  assert.equal(B.debtPaid(s, 'd'), 100);
  assert.equal(B.accountBalance(s, 'a'), 0);
});
test('A statement entered this month skips interest for that month only', () => {
  const s = base();
  s.extra = 0;
  s.debts = [{ id: 'd', balance: 1000, minimum: 100, apr: 12, start: '2026-01-01' }];
  let p = B.debtProjection(s, 'Snowball', '2026-10-22');
  assert.equal(p.rows[0].balance, 910);
  s.debts[0].adjustments = [{ date: '2026-10-05', amount: 0 }];
  p = B.debtProjection(s, 'Snowball', '2026-10-22');
  assert.equal(p.rows[0].balance, 900);
  assert.equal(p.rows[1].balance, 809);
  s.debts[0].adjustments = [{ date: '2026-09-28', amount: 0 }];
  assert.equal(B.debtProjection(s, 'Snowball', '2026-10-22').rows[0].balance, 910);
});
test('Debt history distinguishes paid, partial, missed, future and shows future paid-off rows', () => {
  const s = base();
  s.extra = 0;
  s.budgetStart = '2026-07-01';
  s.debts = [{ id: 'd', balance: 1000, minimum: 100, apr: 0, start: '2026-07-01', dueDay: 15 }];
  s.transactions = [
    { type: 'Transfer', toKind: 'debt', toId: 'd', actual: 100, paid: true, date: '2026-07-01' },
    { type: 'Transfer', toKind: 'debt', toId: 'd', actual: 40, paid: true, date: '2026-08-01' },
  ];
  const p = B.debtProjection(s, 'Snowball', '2026-10-22'),
    r = B.debtSchedule(s, 'd', p, '2026-10-22');
  assert.equal(r.find((x) => x.month === '2026-07').state, 'complete');
  assert.equal(r.find((x) => x.month === '2026-08').state, 'partial');
  assert.equal(r.find((x) => x.month === '2026-09').state, 'missed');
  assert.equal(r.find((x) => x.month === '2026-10').state, 'missed');
  assert.equal(r.find((x) => x.month === '2026-11').state, 'future');
  assert.equal(r.at(-1).month, '2027-10');
  assert.equal(r.at(-1).balance, 0);
});
test('Debt strategy comparison, monthly interest and impossible plan are deterministic', () => {
  const s = base();
  s.extra = 50;
  s.debts = [
    { id: 'a', balance: 500, minimum: 30, apr: 2, order: 2 },
    { id: 'b', balance: 2000, minimum: 70, apr: 20, order: 1 },
  ];
  const a = B.debtProjection(s, 'Avalanche', '2026-10-22'),
    b = B.debtProjection(s, 'Snowball', '2026-10-22'),
    c = B.debtProjection(s, 'Custom', '2026-10-22');
  assert.ok(a.interest < b.interest);
  assert.equal(c.interest, a.interest);
  assert.equal(a.rows.at(-1).balance, 0);
  s.extra = 0;
  s.debts = [{ id: 'a', balance: 1000, minimum: 0, apr: 20 }];
  assert.equal(B.debtProjection(s, 'Snowball', '2026-10-22').paidOff, false);
});
test('Fully paid debt still shows this month actual payment with a check state', () => {
  const s = base();
  s.debts = [{ id: 'd', balance: 100, minimum: 100, apr: 0, start: '2026-10-01' }];
  s.transactions = [
    { type: 'Transfer', toKind: 'debt', toId: 'd', paid: true, actual: 100, date: '2026-10-10' },
  ];
  const p = B.debtProjection(s, 'Snowball', '2026-10-22');
  assert.equal(p.months, 0);
  const r = B.debtSchedule(s, 'd', p, '2026-10-22')[0];
  assert.equal(r.paid, 100);
  assert.equal(r.state, 'complete');
  assert.equal(r.balance, 0);
});

test('Snowball fixes priority before minimum payments change relative balances', () => {
  const debts = [
    { id: 'small', balance: 500, minimum: 10, apr: 0, order: 1 },
    { id: 'large', balance: 600, minimum: 500, apr: 12, order: 2 },
  ];
  const s = { debts, transactions: [], extra: 100, strategy: 'Snowball' };
  const plan = B.debtProjection(s, 'Snowball', '2026-10-23');
  assert.equal(plan.rows[0].debts.find((d) => d.id === 'small').planned, 110);
  assert.equal(plan.rows[0].debts.find((d) => d.id === 'large').planned, 500);
  const oldPlan = B.payoff(debts, 100, 'Snowball');
  assert.equal(oldPlan.months, plan.months);
  assert.equal(oldPlan.interest, plan.interest);
});
test('Monthly due-day anchor survives short months', () => {
  const s = base();
  s.recurring = [
    {
      id: 'r',
      name: 'Debt',
      type: 'Transfer',
      start: '2091-02-28',
      monthDay: 31,
      frequency: 'Monthly',
      active: true,
      expected: 100,
    },
  ];
  assert.deepEqual(
    B.generated(s, '2091-05-31').map((t) => t.date),
    ['2091-02-28', '2091-03-31', '2091-04-30', '2091-05-31'],
  );
});
