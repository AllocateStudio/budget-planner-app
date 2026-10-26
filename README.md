# Ultimate Budget · Allocate Studio

A standalone budgeting app that runs entirely in the browser. There is nothing to install or build: open `index.html`. All fonts and assets are bundled locally, and all data stays in the browser.

## Getting started

1. Open **Setup** and choose a currency and a budget start date.
2. Add your accounts with their opening balances as of **before** the first transaction you plan to enter.
3. Review categories and set a monthly budget for each subcategory. Every category belongs either to the Income group or to one of the expense groups.
4. Add recurring income and bills on the **Recurring** screen, and one-off entries from **+ Add transaction**.

### Sample data

**Load sample data** (on the welcome panel or in Setup) loads one fictional dataset. The budget starts on 1 January 2026 and the history runs through 22 October 2026. Every subcategory has a monthly budget, and there are 11 recurring bills and income schedules, several debts with payment history, two savings goals (the Emergency fund is funded by monthly transfers and has a recurring contribution from November), and a monthly $400 transfer from Checking to Savings.

**Clear sample data** removes only the sample records. Your own entries are kept, and category budgets return to their previous values unless you edited them after loading the sample. If an older sample profile is found on page load, it is replaced with the current one automatically.

## Screens

- **Dashboard:** a Month / Year switch. Month shows income, expenses, left to spend and the amount saved to goals, upcoming bills next to the spending breakdown, Expected vs Actual with the difference (plus when better than expected, so spending less is a plus; minus and terracotta when worse), and group budgets that can be edited for that month. Year shows the same totals for the calendar year, Expected vs Actual (for the current year, expected amounts count only through this month), income vs expenses by month with the amounts under each month, the yearly spending breakdown (the 14 largest categories, the rest grouped as Other) and yearly group budgets. In both views, hovering or tapping a spending chart segment or legend row shows the period, amount spent, share of expenses and the budget with what is left or over.
- **Transactions:** one journal for income, expenses and transfers. Filter by month, category, account and type, or search by name and notes. Choosing "—" clears a filter. Only saved transactions appear here; a recurring payment shows up once it is marked Paid. The table shows the entry, date, category or account, and the amount actually paid or received; there is no Status column, since every entry here is paid. On phones the table becomes rows: name and amount, then the type badge with date, category and account.
- **Recurring:** create and edit schedules. The Payment Schedule tab lists the occurrences for the selected month.
- **Bill Calendar:** a Month / List switch; List shows the month's payments and paydays grouped by day, each row like Payment Schedule (check box to mark paid, the rest of the row opens it). Month is the calendar grid of recurring payments and income only, including occurrences that were already paid. One-off transactions stay in the journal. Click an entry to open it; Paid / Received is always set by hand. Unpaid entries past their date are highlighted. Up to 1000 px wide, entries show a one-line name and a whole amount (for example $1,800); the status is shown by colour and the paid check.
- **Accounts:** tiles for money in accounts, money in goals, debt and Net worth, then account cards two per row (one on phones), grouped by type. Each card shows the name with a coloured type chip (hidden when the name is the type), the balance, this month's money in and out as soft green and pink chips, Transfer and Update balance, and View transactions (the journal filtered to that account). Update balance reconciles an account with a bank statement as of the statement date; the difference is an adjustment, never income or an expense.
- **Debt Payoff:** Snowball, Avalanche and Custom strategies, extra monthly payment, debt-free date, projected interest and debt cards two per row (one on phones), each with a schedule that opens inside the card. An unpaid month counts as missed after its Due day; a debt without a Due day is only missed once the month has ended.
- **Savings:** totals across goals, then goal cards two per row, in the same layout as debt cards. Each card shows the name with a status (On track, Behind, Not scheduled when a dated goal has no recurring contribution, Overdue, Reached), the saved and target amounts, the type with the monthly amount needed by the target date, Add money and Withdraw, progress, the amount added this month, Set / Edit recurring, and View history, which opens inside the card like a debt schedule: each move in or out of the goal, newest first, with the account it came from or went to and the saved amount after it (six rows, then Show all). Goals are also listed in the journal's Account filter.
- **Setup:** preferences, categories with monthly budgets, accounts with opening balances, and data (backups, sample data).

Dates on the Transactions and Recurring screens always include the year ("Oct 10, 2026"). Elsewhere the year appears only outside the current year ("Oct 10", "Jan 2, 2027").

Any entry opened from Upcoming, the calendar or a list uses the same form, with create, edit and delete. An account, goal or debt that still has linked entries can only be deleted after those links are moved or removed.

## Setup

**Preferences** holds the currency and the budget start date. The week start setting lives on the Bill Calendar.

**Budget start date** limits Dashboard totals. Account history before that date is kept and still counts toward balances.

**Categories.** An Income / Expenses switch shows one type at a time. Groups are collapsed and show their monthly total; open a group to see its subcategories. Click a subcategory's amount to change its monthly budget; the change saves on Enter or when the field loses focus and applies from the current month on, so earlier months keep their budgets. The Dashboard budget for a group is the sum of its subcategories, including hidden ones. Categories can be renamed, hidden, shown again, or deleted.

**Deleting categories:**

- Deleting a group moves its subcategories, budgets and links into another group of the same type.
- Deleting a subcategory that is in use moves its saved entries and recurring schedules to another subcategory of the same type and adds its budget to the destination month by month. A new destination can be created in the confirmation dialog.
- An unused subcategory can be deleted directly; its budget is removed.
- Amounts, dates, paid status and account balances never change during reassignment.

Recurring schedules are managed only on the Recurring screen. They use the visible categories from Setup; existing links to hidden categories stay valid.

## Transactions

A new entry starts with a choice of **Expense**, **Income** or **Transfer**. The date defaults to today. Amount is required and must be positive; the type decides the sign. The account remembers your last choice. Description and Notes are optional; if Description is empty, the journal shows the category name.

| Type     | Fields                                                               |
| -------- | -------------------------------------------------------------------- |
| Expense  | Date, Amount, Category group → Category, Account, Description, Notes |
| Income   | Date, Amount, Category, Account, Description, Notes                  |
| Transfer | Date, Amount, From account, To account / debt / goal, Notes          |

Hidden categories are offered only when editing an entry that already uses them.

One-off income and expenses take effect immediately and have no status or Expected amount. Recurring occurrences keep their own payment form with Expected / Actual and a manual Paid / Received toggle.

**Transfers:**

- Between accounts: the source decreases and the destination increases.
- To a debt: the source account and the debt balance both decrease by the full amount. Interest charges are recorded separately.
- To a goal: the source account decreases and the goal's saved amount increases. The money is still counted as an asset in Net Worth.
- From a goal (a withdrawal): choose the goal in **From** and an account in **To**. The goal decreases and the account increases. A withdrawal cannot exceed what is saved in the goal, and no change may leave a goal below zero. Withdrawals are one-off only.
- Transfers never count as income or expenses. Transfers to goals count as saved.
- Editing or deleting a transfer recalculates both sides. An account, debt or goal referenced by a transfer cannot be deleted.

One-off transfers stay in the journal. Recurring transfers appear in the Bill Calendar and create a journal entry only when marked Paid.

## Recurring schedules

Schedules support Expense, Income, and Transfer to an account, debt or goal. Name, Frequency, Start date, source account and a positive Expected amount are required; End date and Notes are optional. Expenses use Group → Category; income uses Category.

**Frequencies:** Weekly, Bi-weekly, Semi-monthly, Monthly, Every 2 months, Quarterly, Semi-annually, Annually. Semi-monthly falls on the 1st and 15th, starting with the first of those on or after the start date. Older "Every 4 Weeks" schedules are still supported but cannot be created anymore.

**Dates.** Occurrences are generated deterministically and never duplicate when you switch months. For days 29 to 31, a short month uses its last day and later months return to the original day. Monthly debt payments created from a debt's due day keep that day as their anchor.

**Paying an occurrence.** Paid opens a form with the Actual amount and Payment date (defaults to the scheduled date). Expected and the calendar position stay in the scheduled month; Actual counts in the month it was paid. Saving again edits the same transaction. Paid is never set automatically.

**Skip** removes an occurrence from expected totals and balances; **Restore** brings it back. Editing a single occurrence detaches it from the schedule; deleting it removes only that occurrence.

**Changing a schedule** takes effect from the next day. Occurrences whose date has already passed keep their original terms. Templates are one list: income, then expenses, then transfers, each by name; each row shows its type badge (as in Transactions) under the name, and the next payment date (with the year only when it is not this year) over the frequency. Paused and ended templates go last. The Recurring tab has no month picker. The square button at the end of a row pauses the template (it hides future occurrences) and resumes it again; periods skipped while paused are not restored. Deleting a schedule keeps paid transactions and occurrences that have already passed.

Calendar colours distinguish Upcoming, Due, Overdue, Paid and Skipped. Payment Schedule follows the month picker and shows the month’s expected expense and transfer totals, then one row per payment: a check box, the name, and the amount with its status. The check box records the payment in one click at the expected amount on its scheduled date; clicking a filled box marks it unpaid again. There is no notice or Undo: clicking the box again reverses it. Clicking or tapping the rest of the row opens the payment to change the amount, date or notes, or to skip or restore it. Dashboard Upcoming Bills lists the next five unpaid outgoing payments.

## Debt Payoff

Each debt has a Name, Type, Starting balance, Start date, APR, Minimum payment, optional Due day and a Custom priority (used by the Custom strategy).

**Current balance** = starting balance − paid transfers to the debt ± dated balance adjustments. **Update balance** records a reconciliation adjustment (for example, bank interest or fees) as of the statement date; it is never a payment and never touches an account. The statement date defaults to today, cannot be in the future, and cannot be earlier than the debt start or the last balance update. Payments recorded after the statement date are still subtracted. **Paid** counts payments only, not adjustments. **Set recurring payment** opens a Monthly transfer prefilled with the debt and its minimum; choose the source account and save it in Recurring.

**Layout.** The left panel, **Choose your strategy**, holds the extra monthly payment and the strategy list. The right panel, **Balance over time**, holds the chart. When the panels sit side by side, the chart grows to the height of the strategy panel and refits when the window is resized. Below 1100 px the panels stack.

**Strategy.** Pick Snowball (smallest balance first), Avalanche (highest APR first) or Custom (your priority order) from the list. Each row shows total interest and one concrete benefit: Snowball shows when the first debt is paid off, Avalanche shows how much interest it saves compared with Snowball, and Custom names the debt it pays first. Debt-free dates appear in the rows only when they differ between strategies. Debts are listed in payment order.

**Extra monthly payment** applies 350 ms after you stop typing. Clearing the field sets the extra payment to $0. Invalid input (for example, a negative number) never overwrites the saved amount. The +50 / +100 / +200 buttons and strategy cards apply immediately.

**Chart.** Total balance by month, starting from the first projected month-end. When extra is above zero, a dashed "Without extra" line shows the same strategy with no extra payment. Hover or use the arrow keys (Home / End, Escape) to see monthly values.

**Projection rules:**

- Fixed APR, monthly interest, and a constant monthly pool of all minimums plus extra.
- The payment order for each month is set before interest and minimums are applied.
- Payments already made this month are credited before planning the rest.
- If a debt's balance was updated this month, the projection does not charge interest on it again for this month, since the statement already includes it.
- When a debt is paid off, its minimum stays in the pool for the remaining debts.
- No new borrowing or fees are assumed. The horizon is 1,200 months; a plan that cannot finish is marked as such.

**Per-debt schedule.** Each debt expands to Month / Planned / Paid / Balance. Past months compare actual payments with the minimum due; future months follow the selected strategy. The default range is three months back, the current month and twelve months ahead; **Show full schedule** shows the whole history and forecast. Paid-off debts are listed last.

## Calculation rules

- Only entries marked Paid / Received count toward actual totals, balances and progress. An actual amount of zero is allowed.
- **Account balance** = opening balance + balance adjustments + received income − paid expenses ± transfers for that account. The app never makes real bank payments.
- **Left to spend** = actual income − actual expenses.
- **Saved** = paid expenses linked to a savings goal + transfers to goals. Withdrawals do not reduce it.
- A category budget has a base amount and can change from a given month on. On the Dashboard, clicking a subcategory's budget opens an editor for the selected month: **This month only** changes just that month; **Apply to following months** sets the amount from that month on and replaces later changes. Months before the selected one never change.
- A year's group budget is the sum of its monthly budgets from the budget start date. Overspending is measured against Actual.
- In Group budgets, an expense bar turns red as soon as spending passes the budget. An income bar turns red only once the month (or year) is over and less came in than the target, so a paycheck that is still due does not look like a shortfall.
- **Goal saved amount** = starting saved amount + paid expenses linked to the goal + transfers to the goal − withdrawals. The target date is optional. With a date, the monthly amount needed divides what is left by the number of calendar months until that date, including the current month. A goal shows **On track** or **Behind** by comparing that amount with its active recurring contributions (converted to a monthly amount); without a recurring contribution no status is shown. Goals past their date are marked **Overdue**, and reached goals are listed last.
- **Net Worth** = account balances + money held in goals − current debt balances. Money held in goals is everything moved into them (transfers and older linked expenses) minus withdrawals; the starting saved amount is assumed to sit in an account already. Record loans and credit cards only under Debt so they are not subtracted twice.
- Older debt payments recorded as expenses with a principal amount are still read, so upgrading does not change past balances.

## Storage and backups

Data is saved in the browser's localStorage under `allocate-studio.ultimate-budget.v2`. If no data exists yet, preferences from the earlier `allocate-studio.ultimate-budget.preferences.v1` key are picked up.

- **Export backup** downloads a JSON file.
- **Import backup** validates the format and all references, then asks before replacing the current budget. Export your current data first if you need it.
- If another tab changes the budget, this tab stops saving until it is reloaded.
- Clearing browser data can delete the budget. Export backups regularly. Different browsers and different web addresses do not share data.

**Data versions.** Version 4 stores monthly budgets on subcategories. Version 2 backups keep their original category budgets. Version 3 group budgets are split evenly across their subcategories, exact to the cent, and can be adjusted in Setup. Transaction IDs, balances and links are unchanged by migration.

## Project files

| File                            | Purpose                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `index.html`                    | App shell                                                                                                    |
| `app.js`                        | Screens, forms, saving, sample data                                                                          |
| `engine.js`                     | Calculations and recurring generation, no DOM                                                                |
| `styles.css`, `month-picker.js` | Base design system and month picker                                                                          |
| `budget.css`                    | Styles for the budget screens                                                                                |
| `assets/`                       | Logo and fonts (Plus Jakarta Sans for headings and all digits, DM Sans for text; licences in `assets/fonts`) |
| `tests/`                        | `engine.test.cjs` (calculations) and `app.test.cjs` (app state in an isolated harness)                       |

## Development

- Run the tests with `node --test tests/*.test.cjs`.
- Code is formatted with Prettier using `.prettierrc` (print width 100, single quotes). Keep new code in that style.
- `tests/app.test.cjs` loads `app.js` by matching its last few lines. Keep the shape of the final `if (state.sampleProfile …) … else render();` block, or update the test harness with it.
- On phones, the Save, Delete and Cancel buttons of every edit window stay pinned to its bottom edge while the form scrolls.
- The tests check state and HTML output without a real browser. Layout and CSS changes still need a check in a browser at phone (375 px) and desktop widths.
- Commit after each step and push to `origin` (`main`). Pull before starting work.
