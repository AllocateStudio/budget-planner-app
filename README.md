# Ultimate Budget · Allocate Studio

Самостоятельное локальное приложение без установки и сборки. Откройте `index.html` в браузере. Интерфейс — на английском, как у исходного Bill Tracker. Все шрифты и ресурсы локальные.

## Первый запуск

1. Откройте Setup, выберите валюту и дату начала бюджета.
2. Создайте счета и укажите начальные балансы **до** операций, которые будете вводить.
3. Настройте категории и месячные лимиты. Каждая категория относится к группе Income или одной из расходных групп.
4. Добавьте регулярные доходы и расходы либо отдельные операции. Expected — план, Actual — факт. Отметьте Paid / Received, чтобы факт участвовал в расчётах.

Нажмите Load sample data на стартовом блоке или в Setup: доступен один вымышленный набор Sample. Начало бюджета — 1 января 2026, история операций — по 22 октября 2026 включительно. Заполнены Monthly budget всех подкатегорий и 11 recurring-расписаний. Clear sample data удаляет только демо-записи и возвращает прежние бюджеты, если вы не изменили их вручную после загрузки. Личные операции сохраняются. При обновлении страницы прежний загруженный демо-профиль автоматически заменяется этим набором.

## Экраны

- **Transactions:** доходы и расходы в едином журнале, фильтры по месяцу, категории, счёту и типу, поиск по имени и примечанию. «—» сбрасывает фильтр. Показываются только сохранённые транзакции. Регулярный платёж появляется здесь после ручной отметки Paid.
- **Recurring:** создание и редактирование расписаний. Вкладка Payment Schedule показывает их записи в выбранном месяце. Восемь частот: Weekly, Bi-weekly, Semi-monthly (1-е и 15-е), Monthly, Every 2 months, Quarterly, Semi-annually, Annually.
- **Bill Calendar:** только регулярные платежи и доходы, включая сохранённые оплаченные повторения. Обычные разовые транзакции остаются в журнале. Календарь в стиле Bill Tracker. Нажатие открывает запись; Paid / Received отмечается вручную. Неоплаченные записи с прошедшей датой подсвечены Terracotta.
- **Accounts:** независимые балансы; Net Worth автоматически вычитает Debt из суммы счетов.
- **Debt Payoff:** Snowball, Avalanche и Custom; дополнительный месячный платёж, прогноз даты погашения и процентов, прогресс. Custom использует возрастающий номер приоритета в карточке долга.
- **Savings:** цели и sinking funds, срок, требуемый месячный взнос и прогресс.
- **Setup:** валюта, счета, категории и месячные бюджеты групп, регулярные доходы, инструкция, демо, резервные копии.

Любая запись из Upcoming, календаря и списков открывается в одной форме. Есть создание, редактирование и удаление. Счёт, цель или долг с привязанными операциями удаляется после переноса/удаления ссылок.

## Правила расчётов

- Expected и Actual независимы. В факт, баланс и прогресс входят только записи с Paid / Received. Нулевая фактическая сумма допустима.
- Баланс счёта = начальный баланс + полученные доходы − оплаченные расходы именно этого счёта. Приложение не выполняет банковские платежи.
- Expenses включает накопительные отчисления. Left to spend = фактический доход − все фактические расходы. Savings rate = оплаченные расходы, связанные с целями Savings / фактический доход.
- Месячный лимит категории применяется ко всем месяцам. Перерасход определяется по Actual.
- Регулярные записи генерируются детерминированно и не дублируются при переключении месяцев. Изменение отдельной записи фиксирует её независимо от расписания; удаление исключает это повторение. Для 29–31 числа используется последний допустимый день месяца с сохранением исходного дня в последующих месяцах.
- Изменение шаблона действует со следующего дня. Платежи, дата которых уже наступила, сохраняются с прежними условиями. Pause убирает будущие платежи до Resume; пропущенный во время паузы период не восстанавливается. Удаление шаблона сохраняет оплаченные транзакции и уже наступившие платежи.
- Остаток долга = Starting outstanding balance − principal оплаченных связанных расходов. Полная сумма расхода списывается со счёта; только principal уменьшает долг. Original debt служит базой прогресса. Начисленные банком проценты и новые заимствования автоматически в текущий остаток не добавляются.
- Прогноз Debt Payoff использует фиксированный APR, месячные проценты и постоянную сумму минимальных платежей плюс extra. Освободившиеся платежи направляются на следующий долг. Interest saved сравнивается с той же стратегией без extra. Горизонт — 1200 месяцев; невозможный/слишком долгий план явно обозначается.
- Saved цели = Starting saved amount + Actual оплаченных расходов, связанных с целью. Можно выбрать любую расходную категорию. Требуемый взнос делит остаток на число календарных месяцев до срока включительно, начиная с текущего; просроченная цель обозначается отдельно.
- Net Worth = сумма балансов Accounts − текущие остатки Debt. Цели повторно к активам не прибавляются. Кредитные обязательства заводите только в Debt, чтобы не вычитать их дважды.

## Хранение и резервные копии

Данные хранятся в `allocate-studio.ultimate-budget.v2` в localStorage браузера. Существующие настройки первой версии автоматически подхватываются при отсутствии новых данных. Bill Tracker использует отдельные файлы и хранилище.

Export backup скачивает JSON. Import backup проверяет формат и связи, затем требует подтверждения замены текущего бюджета. Сначала экспортируйте текущие данные, если они нужны. Одновременное изменение из другой вкладки блокирует запись до перезагрузки. Очистка данных браузера может удалить бюджет; регулярно сохраняйте резервные копии. Разные браузеры и адреса не синхронизируются.

## Файлы и проверки

- `index.html` — оболочка; `app.js` — экраны, формы, сохранение и демо.
- `engine.js` — расчёты и генерация повторов без DOM.
- `styles.css`, `month-picker.js`, `assets/` — независимые копии дизайна Bill Tracker; `budget.css` — оформление новых экранов.
- `tests/engine.test.cjs`, `tests/app.test.cjs` — 41 проверка расчётов и состояния приложения, включая все экраны и единый демо-набор, CRUD и очистку демо.

Запуск проверок: `node --test tests/*.test.cjs`.

Автоматические проверки пройдены. Визуальная проверка в браузере не выполнена: инструмент блокирует адреса file://. Тесты состояния используют изолированное окружение и не заменяют проверку реального браузера.

Исходный дизайн: `/Users/tatianasergeeva/Documents/Codex/2026-09-30/bill-calendar`. Оригинальные файлы не изменялись. Шрифты Plus Jakarta Sans и DM Sans, лицензии в `assets/fonts`.

## Setup

Preferences contains currency and Budget start date, with Save preferences centered below the fields. Week starts on belongs to Bill Calendar.

Income and Expenses share the same heading style. Expenses is a continuous list: group headings are larger than subcategory names. Each subcategory has an editable Monthly budget field that saves on change. Dashboard calculates each group budget as the sum of its subcategories, including hidden ones. Categories can be renamed, hidden and shown, and deleted with reassignment of linked records.

Recurring schedules are managed only on the Recurring screen. They use the visible categories from Setup; existing links to hidden categories remain valid.

Version 4 keeps monthly budgets on subcategories. Version 2 imports retain their original category budgets. Existing version 3 group budgets are split evenly across their subcategories, preserving the exact total to the cent; this allocation can be adjusted in Setup. Transaction IDs, balances and links remain unchanged. The localStorage key remains the same.

Budget start date limits Dashboard totals; earlier account history is preserved.

Deletion: deleting a group moves its subcategories, budgets and links into another group of the same type. Deleting a linked subcategory moves saved entries and recurring schedules to another subcategory of the same type and adds its monthly budget to the destination. A new destination can be created in the confirmation dialog. Unused subcategories can be deleted without reassignment; their budgets are removed. Amounts, dates, paid status and account balances are unchanged.

## Transaction form

New journal entries start with Expense / Income / Transfer buttons. Date defaults to today. Amount is required and positive; the type determines the sign. Account remembers the last saved selection. Description and Notes are optional. If Description is blank, the category name is used in the journal.

Expense: Date, Amount, Category group → Category, Account, Description, Notes. Income: Date, Amount, Category, Account, Description, Notes. Categories come from Setup. Transfer: Date, Amount, From account, To account/debt/goal, Notes. The category list depends on the selected expense group. Hidden categories remain available only when editing an existing linked entry.

Ordinary Income / Expense entries take effect immediately. They have no status, Expected or payment-method fields. Existing recurring occurrences keep their separate payment editor with manual Paid / Received and Expected / Actual. Ordinary transfers stay in the journal. Recurring transfers appear in Bill Calendar and create a journal transaction only when marked Paid.

Transfers between accounts reduce the source and increase the destination. Transfers to debt reduce the source account and the outstanding principal by the full amount; interest charges remain separate expenses. Transfers to goals reduce the source account and increase funds held in that goal. Those transferred funds remain assets in Net Worth, so a transfer does not destroy wealth. All transfers are excluded from Income and Expenses; goal transfers contribute to the savings rate. Editing or deleting a transfer recalculates both sides. Account/debt/goal deletion is blocked while referenced by transfers.

41 automated state/calculation checks passed. These do not replace browser visual QA.


## Recurring lifecycle

Templates support Expense, Income and Transfer to an account, debt or goal. Expected is positive; Name, Frequency, Start Date and source account are required. Expense uses Group → Category; Income uses Category. End Date and Notes are optional. Semi-monthly starts on the first or fifteenth on or after Start Date. Existing Every 4 Weeks templates remain supported for compatibility; new templates use the eight options above.

Upcoming, Due, Overdue, Paid and Skipped have separate calendar colours. Payment Schedule includes Paid / Skip / Restore actions and monthly expected expense and transfer totals. Dashboard Upcoming Bills shows the next five unpaid outgoing payments.

Paid opens an Actual amount and Payment date form. The date defaults to the scheduled date and can be changed. Expected and the calendar date remain attached to the original scheduled month; Actual is counted in the chosen payment month. Saving again edits the same transaction without duplication. Skip excludes the occurrence from expected totals and balances; Restore brings it back. Paid is never automatic.

Paid transfers reduce the source account and credit the destination account, debt principal or goal. Pending and skipped transfers do not affect balances. The template amount does not change when Actual is edited. Frozen past occurrences and their category/account references are preserved in backups and category reassignment.


## Debt Payoff

Debt records now contain Name, Type, Starting Balance, Start Date, APR, Minimum Payment and optional Due Day. Custom priority is shown for the Custom strategy. Existing debt records and legacy principal allocations remain readable so the upgrade does not change historical balances.

Current Balance subtracts paid debt transfers from the starting balance, plus dated statement adjustments. Update Balance records a reconciliation adjustment, never a payment or an account debit. Paid So Far counts recorded payments, excluding adjustments. Set recurring payment opens a Monthly Transfer template with the debt and minimum prefilled; the user selects the source account and saves it in Recurring.

The screen shows Total Debt, Paid So Far, Debt-Free Date and projected Total Interest, one total-balance line, and Snowball/Avalanche comparison. The projection uses monthly interest, a constant minimum-plus-extra pool, and credits this month's actual payments before planning any remaining payment. Paid-off minimums remain in the pool for remaining debts. Actual balances do not accrue forecast interest; statement reconciliation captures bank interest or fees.

Each debt expands to Month / Planned / Paid / Balance. Past rows compare actual payments with the minimum due (capped by the opening balance); future rows use the selected allocation strategy from the current actual balances. The current row contains this month's planned end balance. Default range: three prior months, current month, twelve future months. Show full schedule includes tracked history and forecast, with a 1,200-month projection limit. Current month is highlighted; paid is muted with a pink check, partial/missed payments are accented, future is muted. Paid-off debts sort last. No combined Payment Plan tab in this version.

47 automated checks cover state, calculations, reconciliation, strategy comparison and transfers. Browser visual QA remains unavailable.
