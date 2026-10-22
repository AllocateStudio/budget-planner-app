/* Isolated application-state tests, not browser/visual tests. */
const test = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm'),
  fs = require('node:fs'),
  path = require('node:path'),
  B = require('../engine.js');
function harness() {
  const nodes = new Map(),
    storage = new Map();
  const node = (s) => {
    if (!nodes.has(s))
      nodes.set(s, {
        innerHTML: '',
        textContent: '',
        value: '',
        classList: { add() {}, remove() {} },
        showModal() {
          this.open = true;
        },
        close() {
          this.open = false;
        },
      });
    return nodes.get(s);
  };
  const ctx = {
    Budget: B,
    document: { querySelector: node, addEventListener() {} },
    localStorage: { getItem: (k) => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    crypto: require('node:crypto').webcrypto,
    structuredClone,
    Date,
    console,
    setTimeout: () => 0,
    clearTimeout() {},
    FormData: class {
      constructor(target) {
        this.data = target?.data || {};
      }
      set(k, v) {
        this.data[k] = v;
      }
      get(k) {
        return this.data[k] ?? null;
      }
      has(k) {
        return k in this.data;
      }
    },
    renderMonthPicker: () => '<div>Month picker</div>',
  };
  vm.createContext(ctx);
  let source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  source = source.replace(
    /if\s*\(state\.sampleProfile[\s\S]*?else render\(\);\s*\}\)\(\);\s*$/,
    'globalThis.api={get:()=>state,setSpendingExpanded:value=>{spendingExpanded=value;render();},updateDebtBalance,saveDebtBalance,debtRecurring,pauseRecurring,skipPayment,findPayment,mutate,empty,sample,cleanSamples,validateImport,editor,saveRecord,deleteRecord,removeRecord,commit,renderScreen:s=>{screen=s;render();},render};render();})();',
  );
  vm.runInContext(source, ctx);
  return { api: ctx.api, node, storage };
}
function save(h, kind, id, data) {
  h.api.editor(kind, id);
  const record =
    h.api.get().transactions.find((t) => t.id === id) ||
    B.entries(h.api.get(), '2199-12-31').find((t) => t.id === id);
  if (kind === 'transaction' && !('amount' in data)) {
    data = {
      ...data,
      amount: Number(data.actual) > 0 ? data.actual : data.expected,
      description: data.name,
      categoryGroup: h.api.get().categories.find((c) => c.id === data.categoryId)?.groupId,
    };
  }
  h.api.saveRecord({ preventDefault() {}, target: { data } });
}
test('All eight screens render empty and with the single sample dataset', () => {
  const h = harness();
  for (const profile of [null, 'Sample']) {
    if (profile) h.api.sample(profile);
    for (const screen of [
      'Dashboard',
      'Transactions',
      'Recurring',
      'Bill Calendar',
      'Accounts',
      'Debt Payoff',
      'Savings',
      'Setup',
    ]) {
      h.api.renderScreen(screen);
      assert.ok(h.node('#main').innerHTML.length > 100);
      assert.ok(!h.node('#main').innerHTML.includes('NaN'));
    }
    if (profile) {
      assert.equal(h.api.get().accounts.length, 2);
      assert.equal(h.api.get().sampleProfile, profile);
    }
  }
});
test('Create an account, income and expense; save and edit without duplicating', () => {
  const h = harness();
  save(h, 'account', '', { name: 'Checking', kind: 'Checking', opening: '100' });
  const id = h.api.get().accounts[0].id;
  save(h, 'transaction', '', {
    name: 'Salary',
    type: 'Income',
    categoryId: 'Income-0',
    accountId: id,
    expected: '1000',
    actual: '1100',
    date: '2026-10-01',
    paid: 'on',
  });
  let tx = h.api.get().transactions[0];
  assert.equal(B.accountBalance(h.api.get(), id), 1200);
  save(h, 'transaction', tx.id, {
    name: 'Salary revised',
    type: 'Income',
    categoryId: 'Income-0',
    accountId: id,
    expected: '1000',
    actual: '1200',
    date: '2026-10-01',
    paid: 'on',
  });
  assert.equal(h.api.get().transactions.length, 1);
  assert.equal(B.accountBalance(h.api.get(), id), 1300);
});
test('A generated payment becomes one saved transaction; deletion suppresses regeneration', () => {
  const h = harness();
  h.api.sample('Jessica');
  let s = h.api.get(),
    t = B.generated(s, '2199-12-31').find((t) => t.type === 'Expense');
  save(h, 'transaction', t.id, {
    ...t,
    expected: String(t.expected),
    actual: '70',
    principal: '0',
    paid: 'on',
  });
  s = h.api.get();
  assert.equal(B.entries(s, '2199-12-31').filter((x) => x.id === t.id).length, 1);
  h.api.editor('transaction', t.id);
  h.api.removeRecord();
  assert.ok(!B.entries(h.api.get(), '2199-12-31').some((x) => x.id === t.id));
});
test('Clear samples preserves custom transactions and referenced accounts', () => {
  const h = harness();
  h.api.sample('Alex');
  const id = h.api.get().accounts[0].id;
  save(h, 'transaction', '', {
    name: 'My grocery receipt',
    type: 'Expense',
    categoryId: 'Needs-2',
    accountId: id,
    expected: '50',
    actual: '45',
    date: '2026-10-01',
    paid: 'on',
  });
  h.api.mutate(h.api.cleanSamples);
  const s = h.api.get();
  assert.equal(s.transactions.length, 1);
  assert.equal(s.transactions[0].name, 'My grocery receipt');
  assert.equal(s.accounts.length, 1);
  assert.equal(s.recurring.length, 0);
  assert.equal(s.goals.length, 0);
  assert.equal(s.debts.length, 0);
  assert.equal(s.categories.find((c) => c.name === 'Groceries').budget, 0);
});
test('Backup validation accepts own data and rejects invalid dates, references and money', () => {
  const h = harness();
  h.api.sample('Julia');
  const s = structuredClone(h.api.get());
  assert.doesNotThrow(() => h.api.validateImport(s));
  for (const change of [
    (s) => (s.transactions[0].actual = -1),
    (s) => (s.transactions[0].date = '2026-02-31'),
    (s) => (s.transactions[0].accountId = 'missing'),
    (s) => (s.categories[0].groupId = 'missing'),
    (s) => (s.recurring[0].frequency = 'Daily'),
  ]) {
    const bad = structuredClone(s);
    change(bad);
    assert.throws(() => h.api.validateImport(bad));
  }
});
test('Cross-tab writes do not overwrite new saved data', () => {
  const h = harness();
  h.api.sample('Jessica');
  const before = h.api.get();
  h.storage.set('allocate-studio.ultimate-budget.v2', 'changed');
  assert.equal(h.api.commit(h.api.empty()), false);
  assert.equal(h.api.get(), before);
});
test('Category type cannot invalidate linked entries; debt principal cannot exceed actual', () => {
  const h = harness();
  h.api.sample('Jessica');
  assert.throws(
    () => save(h, 'category', 'Income-0', { name: 'Salary', groupId: 'group-food' }),
    /in use/,
  );
  const t = h.api.get().transactions.find((x) => x.debtId);
  assert.throws(
    () => save(h, 'transaction', t.id, { ...t, actual: '50', principal: '100', paid: 'on' }),
    /cannot exceed/,
  );
});
test('Income monthly budget saves, displays progress and never flags higher income as overspending', () => {
  const h = harness();
  h.api.sample('Jessica');
  save(h, 'category', 'Income-0', { name: 'Income', groupId: 'group-income', budget: '3000' });
  assert.equal(h.api.get().categories.find((c) => c.id === 'Income-0').budget, 3000);
  h.api.renderScreen('Dashboard');
  const html = h.node('#main').innerHTML;
  const row = html.match(
    /<div class="budget-line [^"]*">(?:(?!<div class="budget-line).)*data-id="group-income"[\s\S]*?<\/div><\/div>/,
  );
  assert.ok(row);
  assert.ok(row[0].includes('3,000.00'));
  assert.ok(!row[0].includes('over-budget'));
  assert.ok(row[0].includes('aria-valuenow="100"'));
  h.api.renderScreen('Setup');
  assert.ok(h.node('#main').innerHTML.includes('$3,000.00</button>'));
});
test('Calendar shows only recurring entries, including saved paid occurrences', () => {
  const h = harness();
  h.api.sample('Jessica');
  const account = h.api.get().accounts[0].id,
    month = h.api.get().month;
  for (const type of ['Income', 'Expense'])
    for (const paid of [true, false]) {
      const data = {
        name: `Ordinary ${type} ${paid}`,
        type,
        categoryId: type === 'Income' ? 'Income-0' : 'Needs-2',
        accountId: account,
        expected: '80',
        actual: paid ? '75' : '0',
        date: month + '-15',
      };
      if (paid) data.paid = 'on';
      save(h, 'transaction', '', data);
    }
  const r = h.api.get().recurring.find((r) => r.type === 'Expense');
  h.api.mutate((n) => {
    n.recurring.find((x) => x.id === r.id).start = month + '-10';
  });
  let occurrence = B.entries(h.api.get(), month + '-31').find(
    (t) => t.recurringId === r.id && t.date.startsWith(month),
  );
  save(h, 'transaction', occurrence.id, {
    ...occurrence,
    actual: '65',
    principal: '0',
    paid: 'on',
  });
  h.api.renderScreen('Bill Calendar');
  const html = h.node('#main').innerHTML;
  assert.ok(html.includes(`data-id="${occurrence.id}"`));
  assert.ok(html.includes('Paid'));
  assert.ok(!html.includes('Ordinary'));
  assert.ok(html.includes('data-edit="recurring"'));
  h.api.editor('transaction', occurrence.id);
  assert.ok(h.node('#editor').innerHTML.includes(occurrence.name));
});
test('New transaction defaults to today and remains in journal rather than calendar', () => {
  const h = harness();
  h.api.sample('Jessica');
  h.api.mutate((n) => (n.month = '2027-02'));
  h.api.editor('transaction', '');
  assert.ok(h.node('#editor').innerHTML.includes(`name="date" type="date" value="${B.today()}"`));
  save(h, 'transaction', '', {
    name: 'Future purchase',
    type: 'Expense',
    categoryId: 'Needs-2',
    accountId: h.api.get().accounts[0].id,
    expected: '20',
    actual: '20',
    date: '2027-03-12',
    paid: 'on',
  });
  assert.equal(h.api.get().month, '2027-03');
  h.api.renderScreen('Bill Calendar');
  assert.ok(!h.node('#main').innerHTML.includes('Future purchase'));
  h.api.renderScreen('Transactions');
  assert.ok(h.node('#main').innerHTML.includes('Future purchase'));
});
test('Setup contains grouped defaults and budget start; week setting belongs to calendar', () => {
  const h = harness();
  const s = h.api.get();
  assert.equal(s.groups.length, 10);
  assert.deepEqual(
    Array.from(
      s.categories.filter((c) => c.type === 'Income'),
      (c) => c.name,
    ),
    ['Income'],
  );
  for (const g of s.groups) {
    const count = s.categories.filter((c) => c.groupId === g.id).length;
    assert.ok(g.type === 'Income' ? count === 1 : count >= 2 && count <= 4);
  }
  h.api.renderScreen('Setup');
  let html = h.node('#main').innerHTML;
  assert.ok(html.includes('Budget start date'));
  assert.ok(!html.includes('Week starts on'));
  assert.ok(!html.includes('50 / 30'));
  h.api.renderScreen('Bill Calendar');
  assert.ok(h.node('#main').innerHTML.includes('Week starts on'));
});
test('Legacy backup migrates category limits into groups without changing transactions', () => {
  const h = harness();
  const legacy = structuredClone(h.api.empty());
  legacy.version = 2;
  delete legacy.groups;
  delete legacy.budgetStart;
  legacy.categories = [
    { id: 'old-salary', name: 'Salary', bucket: 'Income', budget: 3000 },
    { id: 'old-grocery', name: 'Groceries', bucket: 'Needs', budget: 400 },
    { id: 'old-dining', name: 'Dining Out', bucket: 'Wants', budget: 150 },
    { id: 'custom', name: 'My custom category', bucket: 'Savings', budget: 20 },
  ];
  legacy.accounts = [{ id: 'a', name: 'Checking', opening: 100 }];
  legacy.transactions = [
    {
      id: 't',
      name: 'Paycheck',
      type: 'Income',
      accountId: 'a',
      categoryId: 'old-salary',
      expected: 3000,
      actual: 2900,
      paid: true,
      date: '2026-10-01',
    },
  ];
  const next = h.api.validateImport(legacy);
  assert.equal(next.version, 4);
  assert.equal(
    next.categories.filter((c) => c.groupId === 'group-food').reduce((sum, c) => sum + c.budget, 0),
    550,
  );
  assert.equal(next.categories.find((c) => c.id === 'old-salary').budget, 3000);
  assert.equal(next.categories.find((c) => c.id === 'custom').name, 'My custom category');
  assert.equal(JSON.stringify(next.transactions), JSON.stringify(legacy.transactions));
  assert.ok(next.categories.every((c) => !('bucket' in c)));
  assert.equal(legacy.version, 2);
});
test('Hidden categories remain in history and group totals, require reassignment for deletion and are excluded from new entries', () => {
  const h = harness();
  h.api.sample('Jessica');
  save(h, 'category', 'Needs-2', { name: 'Groceries', groupId: 'group-food', hidden: 'on' });
  h.api.editor('transaction', '');
  assert.ok(!h.node('#editor').innerHTML.includes('value="Needs-2"'));
  const old = h.api.get().transactions.find((t) => t.categoryId === 'Needs-2');
  h.api.editor('transaction', old.id);
  assert.ok(h.node('#editor').innerHTML.includes('value="Needs-2"'));
  h.api.editor('category', 'Needs-2');
  assert.ok(h.node('#editor').innerHTML.includes('data-action="delete"'));
  h.api.removeRecord();
  assert.ok(h.api.get().categories.some((c) => c.id === 'Needs-2'));
  h.api.renderScreen('Dashboard');
  assert.ok(h.node('#main').innerHTML.includes('Groceries'));
  assert.ok(h.node('#main').innerHTML.includes('group-food'));
});
test('Subcategory budgets sum on dashboard; Setup is continuous and excludes recurring', () => {
  const h = harness();
  save(h, 'category', 'Needs-2', { name: 'Groceries', groupId: 'group-food', budget: '400' });
  const dining = h.api.get().categories.find((c) => c.name === 'Dining Out');
  save(h, 'category', dining.id, { name: dining.name, groupId: 'group-food', budget: '150' });
  h.api.renderScreen('Dashboard');
  assert.ok(h.node('#main').innerHTML.includes('$550.00'));
  h.api.renderScreen('Setup');
  const html = h.node('#main').innerHTML;
  assert.ok(
    html.includes(
      'class="editable-heading" data-edit="group" data-id="group-income">Income</button>',
    ),
  );
  assert.ok(html.includes('<h2>Expenses</h2>'));
  assert.ok(html.includes('preferences-actions'));
  assert.ok(html.includes('data-action="edit-budget" data-id="Needs-2"'));
  assert.ok(!html.includes('Recurring income'));
  assert.ok(!html.includes('class="dashboard-grid"'));
});
test('Version 3 group budgets distribute without losing cents or existing entries', () => {
  const h = harness();
  const legacy = structuredClone(h.api.empty());
  legacy.version = 3;
  legacy.categories.forEach((c) => delete c.budget);
  legacy.groups.forEach((g) => (g.budget = g.id === 'group-food' ? 100 : 0));
  const next = h.api.validateImport(legacy);
  const cats = next.categories.filter((c) => c.groupId === 'group-food');
  assert.equal(next.version, 4);
  assert.equal(
    B.sum(cats, (c) => c.budget),
    100,
  );
  assert.deepEqual(
    Array.from(cats, (c) => c.budget),
    [33.34, 33.33, 33.33],
  );
  assert.ok(next.groups.every((g) => !('budget' in g)));
});
test('Deleting a linked subcategory requires a valid destination and moves history, recurring and budget atomically', () => {
  const h = harness();
  h.api.sample('Jessica');
  const source = h.api.get().categories.find((c) => c.name === 'Internet'),
    dest = h.api.get().categories.find((c) => c.name === 'Phone');
  const r = h.api.get().recurring.find((r) => r.categoryId === source.id);
  const t = B.generated(h.api.get(), '2199-12-31').find((t) => t.recurringId === r.id);
  save(h, 'transaction', t.id, { ...t, actual: '60', principal: '0', paid: 'on' });
  h.api.mutate((n) => {
    n.categories.find((c) => c.id === source.id).budget = 65;
    n.categories.find((c) => c.id === dest.id).budget = 20;
  });
  const before = B.accountBalance(h.api.get(), t.accountId);
  h.api.editor('category', source.id);
  h.api.deleteRecord();
  assert.ok(h.node('#editor').innerHTML.includes('Move entries to'));
  h.api.removeRecord();
  assert.ok(h.api.get().categories.some((c) => c.id === source.id));
  h.node('[name="deleteTarget"]').value = 'Income-0';
  h.api.removeRecord();
  assert.ok(h.api.get().categories.some((c) => c.id === source.id));
  h.node('[name="deleteTarget"]').value = dest.id;
  h.api.removeRecord();
  const s = h.api.get();
  assert.ok(!s.categories.some((c) => c.id === source.id));
  assert.equal(s.transactions.find((x) => x.id === t.id).categoryId, dest.id);
  assert.equal(s.recurring.find((x) => x.id === r.id).categoryId, dest.id);
  assert.equal(s.categories.find((c) => c.id === dest.id).budget, 85);
  assert.equal(B.accountBalance(s, t.accountId), before);
  assert.doesNotThrow(() => h.api.validateImport(s));
});
test('Deleting a group moves its subcategories with their IDs and budgets intact', () => {
  const h = harness();
  h.api.sample('Jessica');
  const before = structuredClone(h.api.get());
  h.api.editor('group', 'group-food');
  h.api.deleteRecord();
  h.node('[name="deleteTarget"]').value = 'group-other';
  h.api.removeRecord();
  const s = h.api.get();
  assert.ok(!s.groups.some((g) => g.id === 'group-food'));
  for (const c of before.categories.filter((c) => c.groupId === 'group-food')) {
    const moved = s.categories.find((x) => x.id === c.id);
    assert.equal(moved.groupId, 'group-other');
    assert.equal(moved.budget, c.budget);
  }
  assert.equal(JSON.stringify(s.transactions), JSON.stringify(before.transactions));
  assert.doesNotThrow(() => h.api.validateImport(s));
});
test('Last group with records can move to a newly named group, and unused categories delete without reassignment', () => {
  const h = harness();
  h.api.sample('Jessica');
  h.api.editor('group', 'group-income');
  h.api.deleteRecord();
  h.node('[name="deleteTarget"]').value = '__new';
  h.node('[name="deleteNewName"]').value = 'Earnings';
  h.api.removeRecord();
  assert.ok(!h.api.get().groups.some((g) => g.id === 'group-income'));
  const g = h.api.get().groups.find((g) => g.name === 'Earnings');
  assert.equal(h.api.get().categories.find((c) => c.id === 'Income-0').groupId, g.id);
  const unused = h.api.get().categories.find((c) => c.name === 'Coffee');
  h.api.editor('category', unused.id);
  h.api.deleteRecord();
  h.api.removeRecord();
  assert.ok(!h.api.get().categories.some((c) => c.id === unused.id));
  assert.doesNotThrow(() => h.api.validateImport(h.api.get()));
});
test('Single sample fills all category budgets and ten months of non-duplicated history through October 22', () => {
  const h = harness();
  h.api.sample();
  const s = h.api.get();
  assert.equal(s.budgetStart, '2026-01-01');
  assert.equal(s.sampleProfile, 'Sample');
  assert.ok(s.categories.every((c) => c.budget > 0));
  assert.ok(s.recurring.length >= 10);
  assert.ok(s.transactions.length > 300);
  assert.ok(s.transactions.every((t) => t.date >= '2026-01-01' && t.date <= '2026-10-22'));
  for (let m = 1; m <= 10; m++)
    assert.ok(s.transactions.some((t) => t.date.startsWith(`2026-${String(m).padStart(2, '0')}`)));
  assert.equal(new Set(s.transactions.map((t) => t.id)).size, s.transactions.length);
  assert.equal(B.generated(s, '2026-10-22').filter((t) => t.sample).length, 1);
  assert.doesNotThrow(() => h.api.validateImport(s));
  const count = s.transactions.length;
  h.api.sample();
  assert.equal(h.api.get().transactions.length, count);
  h.api.renderScreen('Setup');
  assert.ok(!h.node('#main').innerHTML.includes('sample-profile'));
});
test('Sample budget fill restores original personal budgets when cleared', () => {
  const h = harness();
  h.api.mutate((n) => (n.categories.find((c) => c.id === 'Needs-2').budget = 999));
  h.api.sample();
  assert.equal(h.api.get().categories.find((c) => c.id === 'Needs-2').budget, 550);
  h.api.mutate(h.api.cleanSamples);
  assert.equal(h.api.get().categories.find((c) => c.id === 'Needs-2').budget, 999);
});
test('Spending breakdown sorts descending and expands from eight categories plus remainder', () => {
  const h = harness();
  h.api.sample();
  const s = h.api.get(),
    summary = B.summary(s, s.month);
  const expected = s.categories
    .filter((c) => c.type === 'Expense')
    .map((c) => ({
      ...c,
      amount: B.sum(
        summary.rows.filter((t) => t.paid && t.categoryId === c.id),
        (t) => t.actual,
      ),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  assert.ok(expected.length > 8);
  const legend = () =>
    h
      .node('#main')
      .innerHTML.match(/<ul class="chart-legend" id="spending-legend">([\s\S]*?)<\/ul>/)[1];
  let html = legend();
  assert.equal((html.match(/<li>/g) || []).length, 9);
  assert.ok(html.includes('Other categories'));
  const amounts = Array.from(html.matchAll(/<b>\$([\d,.]+)<\/b>/g), (m) =>
    Number(m[1].replaceAll(',', '')),
  );
  assert.equal(
    B.sum(amounts, (x) => x),
    summary.expense,
  );
  h.api.setSpendingExpanded(true);
  html = legend();
  assert.equal((html.match(/<li>/g) || []).length, expected.length);
  assert.ok(!html.includes('Other categories'));
  const names = Array.from(html.matchAll(/<span>(.*?)<\/span>/g), (m) => m[1]);
  assert.deepEqual(
    names,
    expected.map((c) => c.name.replaceAll('&', '&amp;')),
  );
  assert.ok(h.node('#main').innerHTML.includes('Show less'));
  h.api.setSpendingExpanded(false);
  assert.equal((legend().match(/<li>/g) || []).length, 9);
});
test('Simple transaction has type buttons, optional description, positive amount and today default', () => {
  const h = harness();
  h.api.editor('transaction', '');
  let html = h.node('#editor').innerHTML;
  for (const type of ['Expense', 'Income', 'Transfer'])
    assert.ok(html.includes(`data-id="${type}"`));
  assert.ok(html.includes('Category group *'));
  assert.ok(html.includes('min="0.01"'));
  assert.ok(html.includes(`value="${B.today()}"`));
  assert.ok(!html.includes('name="expected"'));
  assert.ok(!html.includes('name="paid"'));
  assert.ok(!html.includes('name="principal"'));
  assert.ok(!/name="description"[^>]*required/.test(html));
  h.api.editor('transaction', '', { type: 'Income' });
  html = h.node('#editor').innerHTML;
  assert.ok(!html.includes('Category group'));
  h.api.editor('transaction', '', { type: 'Transfer' });
  html = h.node('#editor').innerHTML;
  assert.ok(html.includes('From *'));
  assert.ok(html.includes('To *'));
  assert.ok(!html.includes('name="categoryId"'));
  assert.ok(!html.includes('name="description"'));
});
test('Empty descriptions save with category name and last account is remembered', () => {
  const h = harness();
  save(h, 'account', '', { name: 'Main', kind: 'Checking', opening: '100' });
  const account = h.api.get().accounts[0].id;
  save(h, 'transaction', '', {
    type: 'Expense',
    date: B.today(),
    amount: '12.50',
    categoryGroup: 'group-food',
    categoryId: 'Needs-2',
    accountId: account,
    description: '',
    notes: 'Receipt',
  });
  const s = h.api.get();
  assert.equal(s.transactions[0].name, 'Groceries');
  assert.equal(s.transactions[0].paid, true);
  assert.equal(s.lastAccountId, account);
  assert.equal(B.accountBalance(s, account), 87.5);
  h.api.editor('transaction', '');
  assert.ok(h.node('#editor').innerHTML.includes(`value="${account}" selected`));
});
test('Transfer create/edit/delete keeps totals, validates references and blocks deletion of destination', () => {
  const h = harness();
  save(h, 'account', '', { name: 'A', kind: 'Checking', opening: '1000' });
  save(h, 'account', '', { name: 'B', kind: 'Savings', opening: '200' });
  const [a, b] = h.api.get().accounts;
  const data = {
    type: 'Transfer',
    date: B.today(),
    amount: '150',
    accountId: a.id,
    destination: 'account:' + b.id,
    notes: 'Move funds',
  };
  save(h, 'transaction', '', data);
  let s = h.api.get(),
    t = s.transactions[0];
  assert.equal(B.accountBalance(s, a.id), 850);
  assert.equal(B.accountBalance(s, b.id), 350);
  assert.equal(B.summary(s, s.month).expense, 0);
  assert.doesNotThrow(() => h.api.validateImport(s));
  const invalid = structuredClone(s);
  invalid.transactions[0].toId = 'missing';
  assert.throws(() => h.api.validateImport(invalid));
  h.api.editor('account', b.id);
  h.api.deleteRecord();
  assert.ok(h.node('#form-error').textContent.includes('linked'));
  save(h, 'transaction', t.id, { ...data, amount: '250' });
  assert.equal(h.api.get().transactions.length, 1);
  assert.equal(B.accountBalance(h.api.get(), a.id), 750);
  h.api.editor('transaction', t.id);
  h.api.removeRecord();
  assert.equal(B.accountBalance(h.api.get(), a.id), 1000);
  assert.equal(B.accountBalance(h.api.get(), b.id), 200);
});
test('Transfer rejects identical accounts, negative/zero amounts and debt overpayment', () => {
  const h = harness();
  h.api.sample();
  const a = h.api.get().accounts[0],
    debt = h.api.get().debts[0],
    base = {
      type: 'Transfer',
      date: B.today(),
      amount: '10',
      accountId: a.id,
      destination: 'account:' + a.id,
    };
  assert.throws(() => save(h, 'transaction', '', base), /different accounts/);
  for (const amount of ['0', '-10', 'NaN'])
    assert.throws(() => save(h, 'transaction', '', { ...base, amount }), /greater than zero/);
  assert.throws(
    () => save(h, 'transaction', '', { ...base, amount: '999999', destination: 'debt:' + debt.id }),
    /exceeds/,
  );
  const before = B.debtBalance(h.api.get(), debt.id);
  save(h, 'transaction', '', { ...base, amount: '10', destination: 'debt:' + debt.id });
  assert.equal(B.debtBalance(h.api.get(), debt.id), before - 10);
});
test('Expense category must belong to the selected group', () => {
  const h = harness();
  h.api.sample();
  assert.throws(
    () =>
      save(h, 'transaction', '', {
        type: 'Expense',
        date: B.today(),
        amount: '10',
        categoryGroup: 'group-housing',
        categoryId: 'Needs-2',
        accountId: h.api.get().accounts[0].id,
      }),
    /selected group/,
  );
});
function recurringFixture(type = 'Expense', destination = '') {
  const h = harness();
  save(h, 'account', '', { name: 'Checking', kind: 'Checking', opening: '1000' });
  const accountId = h.api.get().accounts[0].id,
    category = h.api.get().categories.find((c) => c.type === type);
  const data = {
    name: 'Monthly payment',
    type,
    expected: '120',
    frequency: 'Monthly',
    start: B.today().slice(0, 7) + '-01',
    end: '',
    accountId,
    categoryId: category?.id,
    categoryGroup: category?.groupId,
    destination,
    notes: 'Template note',
  };
  save(h, 'recurring', '', data);
  return { h, data, id: h.api.get().recurring[0].id, accountId };
}
test('Recurring skip, restore and manual actual payment keep expectation and avoid duplicate balances', () => {
  const { h, accountId } = recurringFixture();
  let t = B.generated(h.api.get(), B.today())[0];
  assert.equal(h.api.get().transactions.length, 0);
  assert.equal(B.accountBalance(h.api.get(), accountId), 1000);
  h.api.skipPayment(t.id);
  assert.equal(B.generated(h.api.get(), B.today()).length, 0);
  assert.equal(B.summary(h.api.get(), t.date.slice(0, 7)).expectedExpense, 0);
  assert.equal(B.paymentSchedule(h.api.get(), B.today())[0].skipped, true);
  h.api.skipPayment(t.id, true);
  assert.equal(B.generated(h.api.get(), B.today()).length, 1);
  h.api.skipPayment(t.id);
  save(h, 'transaction', t.id, { amount: '134', date: t.date, notes: 'Actual bill' });
  const paid = h.api.get().transactions[0];
  assert.equal(paid.expected, 120);
  assert.equal(paid.actual, 134);
  assert.equal(paid.skipped, false);
  assert.equal(B.accountBalance(h.api.get(), accountId), 866);
  save(h, 'transaction', t.id, { amount: '130', date: t.date, notes: '' });
  assert.equal(h.api.get().transactions.length, 1);
  assert.equal(B.accountBalance(h.api.get(), accountId), 870);
  assert.equal(h.api.get().recurring[0].expected, 120);
  assert.doesNotThrow(() => h.api.validateImport(h.api.get()));
});
test('Template edits freeze due amounts; pause and deletion remove future instances, retaining paid history', () => {
  const { h, data, id } = recurringFixture(),
    past = B.generated(h.api.get(), B.today())[0],
    future = B.occurrence(data.start, 'Monthly', 1);
  h.api.skipPayment(id + '@' + future);
  save(h, 'recurring', id, { ...data, expected: '200' });
  assert.equal(B.generated(h.api.get(), B.today())[0].expected, 120);
  h.api.skipPayment(id + '@' + future, true);
  assert.equal(B.generated(h.api.get(), future).find((t) => t.date === future).expected, 200);
  h.api.pauseRecurring(id);
  assert.ok(!B.generated(h.api.get(), future).some((t) => t.date === future));
  h.api.pauseRecurring(id);
  assert.ok(B.generated(h.api.get(), future).some((t) => t.date === future));
  save(h, 'transaction', past.id, { amount: '125', date: past.date });
  h.api.editor('recurring', id);
  h.api.removeRecord();
  assert.equal(h.api.get().transactions.length, 1);
  assert.equal(B.generated(h.api.get(), future).length, 0);
  assert.doesNotThrow(() => h.api.validateImport(h.api.get()));
});
test('Recurring transfers update goals and debts only after Paid and round-trip in backups', () => {
  for (const kind of ['goal', 'debt']) {
    const h = harness();
    save(h, 'account', '', { name: 'Checking', kind: 'Checking', opening: '1000' });
    h.api.mutate((n) => {
      if (kind === 'goal')
        n.goals.push({
          id: 'dest',
          name: 'Emergency',
          saved: 0,
          target: 500,
          deadline: '2027-01-01',
        });
      else
        n.debts.push({
          id: 'dest',
          name: 'Loan',
          original: 500,
          balance: 500,
          apr: 0,
          minimum: 50,
          order: 0,
        });
    });
    save(h, 'recurring', '', {
      type: 'Transfer',
      name: 'Auto contribution',
      expected: '100',
      frequency: 'Monthly',
      start: B.today(),
      end: '',
      accountId: h.api.get().accounts[0].id,
      destination: kind + ':dest',
    });
    assert.doesNotThrow(() => h.api.validateImport(h.api.get()));
    const t = B.generated(h.api.get(), B.today())[0];
    assert.equal(
      kind === 'goal' ? B.goalSaved(h.api.get(), 'dest') : B.debtBalance(h.api.get(), 'dest'),
      kind === 'goal' ? 0 : 500,
    );
    save(h, 'transaction', t.id, { amount: '110', date: t.date });
    assert.equal(
      kind === 'goal' ? B.goalSaved(h.api.get(), 'dest') : B.debtBalance(h.api.get(), 'dest'),
      kind === 'goal' ? 110 : 390,
    );
    assert.doesNotThrow(() => h.api.validateImport(h.api.get()));
  }
});
test('Skipped payments disappear from calendar and restore inside their recurring template', () => {
  const { h, id } = recurringFixture(),
    t = B.generated(h.api.get(), B.today())[0];
  h.api.skipPayment(t.id);
  h.api.renderScreen('Bill Calendar');
  assert.ok(!h.node('#main').innerHTML.includes('data-id="' + t.id + '"'));
  h.api.editor('recurring', id);
  assert.ok(h.node('#editor').innerHTML.includes('Skipped payments'));
  assert.ok(h.node('#editor').innerHTML.includes('data-action="restore-payment"'));
  h.api.skipPayment(t.id, true);
  assert.equal(h.node('#skipped-payments').innerHTML, '');
  h.api.renderScreen('Bill Calendar');
  assert.ok(h.node('#main').innerHTML.includes('data-id="' + t.id + '"'));
  assert.equal(B.summary(h.api.get(), t.date.slice(0, 7)).expectedExpense, 120);
});
test('Debt form, statement reconciliation and recurring shortcut keep the ledger independent', () => {
  const h = harness();
  save(h, 'account', '', { name: 'Checking', kind: 'Checking', opening: '2000' });
  save(h, 'debt', '', {
    name: 'Card',
    kind: 'Credit card',
    balance: '1000',
    start: '2026-01-01',
    apr: '12',
    minimum: '100',
    dueDay: '15',
  });
  const d = h.api.get().debts[0];
  assert.equal(d.start, '2026-01-01');
  assert.equal(d.original, 1000);
  h.api.updateDebtBalance(d.id);
  h.api.saveDebtBalance({ get: () => '1050' });
  assert.equal(B.debtBalance(h.api.get(), d.id), 1050);
  assert.equal(h.api.get().transactions.length, 0);
  assert.equal(B.accountBalance(h.api.get(), h.api.get().accounts[0].id), 2000);
  save(h, 'transaction', '', {
    type: 'Transfer',
    amount: '150',
    date: B.today(),
    accountId: h.api.get().accounts[0].id,
    destination: 'debt:' + d.id,
  });
  assert.equal(B.debtBalance(h.api.get(), d.id), 900);
  assert.equal(B.debtPaid(h.api.get(), d.id), 150);
  assert.doesNotThrow(() => h.api.validateImport(h.api.get()));
  h.api.debtRecurring(d.id);
  const html = h.node('#editor').innerHTML;
  assert.ok(html.includes('value="Transfer"'));
  assert.ok(html.includes('debt:' + d.id));
  assert.ok(html.includes('value="100"'));
  h.api.renderScreen('Debt Payoff');
  for (const label of [
    'Total Debt',
    'Paid So Far',
    'Debt-Free Date',
    'Total Interest',
    'Balance over time',
    'Snowball',
    'Avalanche',
    'Update Balance',
    'View schedule',
  ])
    assert.ok(h.node('#main').innerHTML.includes(label));
  const invalid = structuredClone(h.api.get());
  invalid.debts[0].dueDay = 32;
  assert.throws(() => h.api.validateImport(invalid));
});
