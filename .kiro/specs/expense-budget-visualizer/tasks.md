# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a client-side personal finance tracker using vanilla JavaScript, HTML5 Canvas, and the LocalStorage API. The implementation is delivered as three files: `index.html` (structure only), `css/style.css` (all styles), and `js/script.js` (all application logic). No frameworks, no build step, no backend.

The tasks below build the application incrementally: data layer first, then UI scaffolding, then chart rendering, and finally wiring everything together.

---

## Tasks

- [x] 1. Set up project file structure and constants
  - Create `index.html` at the project root with semantic HTML structure: `<header>`, `<main class="app-layout">`, left panel (`<section class="panel-left">`) containing `.transaction-form`, `.month-filter`, `.transaction-list`, and `.budget-panel`; right panel (`<section class="panel-right">`) containing `<canvas id="pieChart">`, `<canvas id="barChart">`, and `<div id="progressBars">`
  - Create `css/style.css` with placeholder rule sets for all CSS class names used in HTML
  - Create `js/script.js` with top-level `CATEGORIES` constant array and `LS_TRANSACTIONS` / `LS_BUDGETS` key constants
  - Add `CATEGORY_COLORS` map assigning a distinct hex color to each of the 8 categories
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 2. Implement the DataStore module
  - [x] 2.1 Implement LocalStorage read/write helpers
    - Write `DataStore.readTransactions()` — reads `ebv_transactions` from LocalStorage, JSON-parses it, returns array; returns `[]` if key absent or parse fails (catches JSON error and logs to console)
    - Write `DataStore.writeTransactions(array)` — JSON-stringifies and writes to `ebv_transactions`; catches `DOMException` and calls `showStorageError()` notification
    - Write `DataStore.readBudgets()` and `DataStore.writeBudgets(array)` with same pattern
    - _Requirements: 3.1, 3.2, 3.6, 3.7_

  - [x] 2.2 Implement transaction CRUD
    - Write `DataStore.addTransaction(tx)` — reads current array, pushes the new transaction, writes back; returns `true`
    - Write `DataStore.deleteTransaction(id)` — reads array, filters out record with matching id, writes back; returns `true`
    - Write `generateUUID()` helper using `Math.random()` nibble replacement (RFC 4122 variant 4 format)
    - _Requirements: 2.1, 2.9, 2.10, 3.4_

  - [-] 2.3 Write property test for DataStore round-trip (Property 2)
    - **Property 2: Transaction round-trip persistence**
    - Generate random valid Transaction objects, call addTransaction, read back, assert array contains structurally equivalent object
    - **Validates: Requirements 2.1, 3.1, 3.4**

  - [x] 2.4 Implement budget CRUD
    - Write `DataStore.setBudget(category, monthKey, amount)` — reads budgets array, finds existing record matching `(category, monthKey)`, updates it or pushes new record (upsert), writes back
    - _Requirements: 5.2, 3.5_

  - [-] 2.5 Write property test for budget upsert idempotence (Property 4)
    - **Property 4: Budget upsert idempotence**
    - For any (category, monthKey, amount), call setBudget twice, assert exactly one record exists for that pair
    - **Validates: Requirements 5.2**

  - [-] 2.6 Write property test for delete completeness (Property 5)
    - **Property 5: Delete completeness**
    - Add a transaction, delete it by ID, assert no transaction with that ID remains in readTransactions()
    - **Validates: Requirements 2.9**

  - [-] 2.7 Write property test for unique IDs (Property 9)
    - **Property 9: Unique transaction identifiers**
    - Generate N transactions, assert all generated UUIDs are distinct
    - **Validates: Requirements 2.10**

- [ ] 3. Implement Validator module
  - [x] 3.1 Implement `validateTransaction(formData)`
    - Validate `description`: reject if null/undefined/empty or if `description.trim() === ""`; reject if `description.length > 100`
    - Validate `amount`: reject if not a finite positive number (`<= 0`, `NaN`, `Infinity`)
    - Validate `type`: reject if not `"income"` or `"expense"`
    - Validate `category`: reject for expense transactions if not in `CATEGORIES`; for income, set category to `"income"`
    - Validate `date`: reject if not a parseable ISO 8601 date string
    - Return `{ valid: true }` if all pass, or `{ valid: false, errors: { fieldName: message } }` on failure
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 11.1_

  - [x] 3.2 Implement `validateBudget(amount)`
    - Reject if `amount < 0` or not a finite number; return `{ valid: true }` or `{ valid: false, error: message }`
    - _Requirements: 5.4, 11.2_

  - [-] 3.3 Write property test for validation rejection of invalid inputs (Property 6)
    - **Property 6: Validation rejection of invalid inputs**
    - For any all-whitespace description string: assert `validateTransaction` returns `valid: false` on description
    - For any amount ≤ 0: assert `validateTransaction` returns `valid: false` on amount
    - For any string not in CATEGORIES (for expense type): assert `validateTransaction` returns `valid: false` on category
    - **Validates: Requirements 2.2, 2.3, 2.5, 2.7**

- [~] 4. Checkpoint — Core data layer
  - Ensure DataStore and Validator are working correctly; run all property tests written so far; ask the user if questions arise.

- [ ] 5. Implement aggregation and filter logic
  - [x] 5.1 Implement `getMonthKey(isoDateString)`
    - Parse the date string and return `"YYYY-MM"` format string
    - _Requirements: 4.3_

  - [-] 5.2 Implement `aggregateMonth(transactions, monthKey)`
    - Filter transactions by monthKey using `getMonthKey(tx.date)`
    - Sum income and expense amounts separately
    - Build `byCategory` map summing expenses per category
    - Return `MonthSummary` object
    - _Requirements: 11.3, 11.4, 11.5_

  - [-] 5.3 Write property test for aggregation consistency (Property 1)
    - **Property 1: Aggregation consistency**
    - For any array of transactions and a monthKey, assert `SUM(byCategory.values()) === totalExpense`
    - **Validates: Requirements 11.3, 11.5**

  - [x] 5.4 Implement `getTransactionsForMonth(transactions, monthKey)`
    - Return filtered array of transactions matching monthKey
    - _Requirements: 4.3_

  - [-] 5.5 Write property test for month filter exclusivity (Property 3)
    - **Property 3: Month filter exclusivity**
    - For any monthKey and transaction array, assert every transaction in the result has `getMonthKey(tx.date) === monthKey`
    - **Validates: Requirements 4.3**

  - [x] 5.6 Implement `getLast6Months(activeMonthKey)`
    - Compute array of 6 MonthKey strings ending with activeMonthKey in chronological order
    - _Requirements: 7.2_

  - [-] 5.7 Write property test for six-month window (Property 10)
    - **Property 10: Six-month window correctness**
    - For any activeMonthKey, assert result has exactly 6 items, is sorted ascending, and last item equals activeMonthKey
    - **Validates: Requirements 7.2**

  - [x] 5.8 Implement `buildBudgetComparisons(budgets, summary, monthKey)`
    - For each category in CATEGORIES, find matching budget record, compute `actual`, `budgeted`, `percentage`
    - When `budgeted === 0`, set `percentage` to `0` (no division by zero)
    - _Requirements: 5.5, 8.2, 8.7_

  - [-] 5.9 Write property test for budget percentage invariant (Property 7)
    - **Property 7: Budget percentage invariant**
    - For any BudgetComparison where budgeted = 0, assert percentage === 0
    - For any comparison where actual > budgeted > 0, assert the capped visual fill is 100
    - **Validates: Requirements 5.5, 8.2, 8.7**

- [ ] 6. Implement ChartRenderer — Canvas utility helpers
  - [-] 6.1 Implement `resizeCanvas(canvas)`
    - Read `window.devicePixelRatio`, read `canvas.getBoundingClientRect()`, set `canvas.width` and `canvas.height` to rect dimensions × dpr, scale context by dpr
    - _Requirements: 6.7, 7.8, 9.3_

  - [-] 6.2 Implement `drawEmptyState(ctx, canvas, message)`
    - Center the message text on the canvas using `ctx.fillText` with appropriate font and color
    - _Requirements: 6.6_

  - [-] 6.3 Implement `drawYAxis(ctx, padding, chartHeight, maxValue)` and `drawXAxisLabels(ctx, padding, chartWidth, chartHeight, months)`
    - Draw Y-axis line, tick marks at even intervals, value labels; draw X-axis labels for month abbreviations
    - _Requirements: 7.5_

- [ ] 7. Implement ChartRenderer — Pie chart
  - [~] 7.1 Implement `renderPieChart(canvas, monthSummary)`
    - Clear canvas; compute total expense; if zero call `drawEmptyState`; otherwise iterate categories drawing arcs proportional to their share of total; draw 2px white stroke between slices
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_

  - [~] 7.2 Implement `drawPieLegend(ctx, canvas, monthSummary, totalExpense)`
    - Render colored square + category name + percentage for each category with non-zero spend, below the pie circle
    - _Requirements: 6.5_

- [ ] 8. Implement ChartRenderer — Bar chart
  - [~] 8.1 Implement `renderBarChart(canvas, store, activeMonthKey)`
    - Compute last 6 months; for each month compute total budgeted and total actual; determine maxValue with 10% headroom; draw two grouped bars per month (budget bar in blue, actual bar in red if over-budget, green if under); draw axes
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [~] 8.2 Implement `drawBarLegend(ctx, canvas, padding)`
    - Render small colored rectangles + labels for "Anggaran" (budget) and "Aktual" (actual) at top-right of chart area
    - _Requirements: 7.6_

- [ ] 9. Implement UIController — Progress bars
  - [~] 9.1 Implement `renderProgressBars(container, comparisons)`
    - For each BudgetComparison: determine color based on percentage thresholds (≥100 → red, 80–99 → amber, <80 → green); build HTML string with category label, progress bar fill div, and "actual / budget" text; set `container.innerHTML`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [~] 9.2 Write property test for progress bar color thresholds (Property 11)
    - **Property 11: Progress bar color thresholds**
    - For any percentage ≥ 100: assert color is warning (red)
    - For any 80 ≤ percentage < 100: assert color is caution (amber)
    - For any percentage < 80: assert color is safe (green)
    - **Validates: Requirements 8.3, 8.4, 8.5**

- [ ] 10. Implement UIController — Transaction list and form
  - [~] 10.1 Implement `renderTransactionList(container, transactions, monthKey)`
    - Filter transactions to activeMonth; sort by date descending then by `createdAt` descending; build HTML rows with date, description, category badge, amount (colored), and delete button; set `container.innerHTML`; show empty-state message if no transactions
    - _Requirements: 4.3, 2.9_

  - [~] 10.2 Implement `clearTransactionForm(form)`
    - Reset all input values to empty; re-focus the description input
    - _Requirements: 2.8_

  - [~] 10.3 Implement `populateCategorySelect(selectElement)`
    - Populate the category `<select>` with an option for each entry in CATEGORIES plus an "Pendapatan" option for income type
    - _Requirements: 2.5_

  - [~] 10.4 Implement form submit handler
    - Read form field values; call `validateTransaction(formData)`; if invalid, display inline error spans next to each invalid field; if valid, build Transaction object with `generateUUID()` and `Date.now()`, call `DataStore.addTransaction`, call `clearTransactionForm`, call `renderAll`
    - _Requirements: 2.1, 2.7, 2.8_

  - [~] 10.5 Implement delete transaction handler (event delegation on transaction list)
    - Listen for click on delete buttons within the list container; extract transaction ID from `data-id` attribute; call `DataStore.deleteTransaction(id)`; call `renderAll`
    - _Requirements: 2.9_

- [ ] 11. Implement UIController — Month filter and budget panel
  - [~] 11.1 Implement `populateMonthFilter(selectElement, transactions)`
    - Collect unique MonthKeys from all transactions; merge with current month; sort descending; populate `<select>` options with formatted labels (e.g., "Juli 2025")
    - _Requirements: 4.1, 4.2, 4.5_

  - [~] 11.2 Implement month filter change handler
    - On select change, update `FilterState.activeMonth`; call `renderTransactionList`; call `ChartRenderer.renderAll`
    - _Requirements: 4.3, 4.4_

  - [~] 11.3 Implement `renderBudgetPanel(container, budgets, activeMonth)`
    - For each category, render an input row with current budget value (or empty if none set); attach blur/save handler that calls `validateBudget`, then `DataStore.setBudget`, then `ChartRenderer.renderAll`
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

- [~] 12. Checkpoint — All rendering modules
  - Ensure pie chart, bar chart, and progress bars render with sample data; verify delete and add flows update all three charts; ask the user if questions arise.

- [ ] 13. Implement responsive CSS
  - [~] 13.1 Write mobile-first CSS layout rules
    - `.app-layout`: CSS Grid single column, `gap: 1rem`, `padding: 1rem`
    - Panel, form, list, and chart containers: `width: 100%`, `box-sizing: border-box`
    - Canvas elements: `width: 100%`, fixed height via CSS (e.g., `height: 280px`)
    - All interactive controls: `min-height: 44px`, `min-width: 44px` for touch targets
    - Typography, color variables, and form styles
    - _Requirements: 9.1, 9.5, 9.6_

  - [~] 13.2 Write desktop breakpoint CSS (≥768px)
    - `.app-layout`: `grid-template-columns: 360px 1fr`, `gap: 1.5rem`, `padding: 1.5rem`
    - Adjust chart heights for larger viewport
    - _Requirements: 9.2_

  - [~] 13.3 Implement resize handler with debounce
    - In `js/script.js`, add `window.addEventListener('resize', debounce(onResize, 150))`
    - `onResize` calls `ChartRenderer.resizeAllCanvases()` then `ChartRenderer.renderAll()`
    - Implement `debounce(fn, delay)` helper
    - _Requirements: 9.3, 9.4_

  - [~] 13.4 Write property test for debounce (Property implied by 9.4)
    - For any function and delay, calling the debounced wrapper N times rapidly should result in the function being called exactly once after the delay
    - **Validates: Requirements 9.4**

- [ ] 14. Implement app initialization and final wiring
  - [~] 14.1 Implement `initApp()`
    - Call `DataStore.readTransactions()` and `DataStore.readBudgets()` to populate in-memory cache
    - Set `FilterState.activeMonth` to current month key
    - Call `populateMonthFilter`, `populateCategorySelect`, `renderBudgetPanel`, `renderTransactionList`
    - Call `ChartRenderer.resizeAllCanvases()` and `ChartRenderer.renderAll()`
    - Bind all event listeners (form submit, delete delegation, month filter change, budget panel save)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [~] 14.2 Implement `ChartRenderer.renderAll(activeMonth)`
    - Convenience function that calls `resizeAllCanvases()`, `renderPieChart()`, `renderBarChart()`, and `renderProgressBars()` in sequence for the given month
    - _Requirements: 4.4, 5.3, 6.2, 7.7, 8.8_

  - [~] 14.3 Wire `DOMContentLoaded` event to `initApp()`
    - Add `document.addEventListener('DOMContentLoaded', initApp)` at the bottom of `js/script.js`
    - _Requirements: 10.1_

  - [~] 14.4 Write property test for serialization round-trip (Property 8)
    - **Property 8: Serialization round-trip**
    - For any array of valid Transaction or Budget objects, assert `JSON.parse(JSON.stringify(arr))` produces structurally equivalent objects
    - **Validates: Requirements 3.1, 3.2**

- [~] 15. Final checkpoint — Full application
  - Ensure all tests pass; manually verify add transaction → charts update, delete → charts update, budget set → progress bars update, month filter → all charts and list update, page reload → data persists; ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. Property tests validate universal correctness but are not required for the UI to function.
- The design uses pseudocode; all implementation is in **vanilla JavaScript** (ES6+, no transpilation needed).
- `js/script.js` should be organized into clearly commented sections (CONSTANTS, DataStore, Validator, Aggregation, ChartRenderer, UIController, Init) rather than actual ES modules, since no bundler is used.
- Canvas `width` and `height` attributes must be set via JavaScript (not CSS alone) to avoid blurry rendering — see `resizeCanvas()`.
- Use `textContent` (never `innerHTML`) when rendering user-supplied strings to avoid XSS.
- Each chart property test can use a simple in-memory mock for localStorage (override `localStorage.getItem` / `setItem` in test setup).

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "3.2"] },
    { "id": 2, "tasks": ["2.2", "2.4", "5.1"] },
    { "id": 3, "tasks": ["2.3", "2.5", "2.6", "2.7", "5.2", "5.4", "5.6", "5.8"] },
    { "id": 4, "tasks": ["3.3", "5.3", "5.5", "5.7", "5.9", "6.1", "6.2", "6.3"] },
    { "id": 5, "tasks": ["7.1", "8.1", "9.1", "10.1", "10.2", "10.3"] },
    { "id": 6, "tasks": ["7.2", "8.2", "9.2", "10.4", "10.5", "11.1"] },
    { "id": 7, "tasks": ["11.2", "11.3", "13.1", "13.2"] },
    { "id": 8, "tasks": ["13.3", "14.1", "14.2"] },
    { "id": 9, "tasks": ["13.4", "14.3", "14.4"] }
  ]
}
```
