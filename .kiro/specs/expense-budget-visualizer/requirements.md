# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side single-page web application for personal finance tracking. Users can record income and expense transactions, assign expenses to categories, set monthly budgets per category, and view real-time visualizations — a pie chart by expense category, a bar chart comparing budgeted vs actual spend per month, and per-category progress bars. The application requires no backend; all data is persisted using the browser's LocalStorage API. It is delivered as three files: `index.html`, `css/style.css`, and `js/script.js`.

---

## Glossary

- **App**: The Expense & Budget Visualizer single-page application
- **Transaction**: A single financial record of type income or expense, with a description, amount, category, and date
- **Category**: One of the eight predefined expense groups: Makanan & Minuman, Transportasi, Belanja, Hiburan, Kesehatan, Pendidikan, Tagihan & Utilitas, Lainnya
- **Budget**: A monthly spending limit set by the user for a specific Category
- **MonthKey**: A string in `YYYY-MM` format identifying a calendar month (e.g., "2025-07")
- **ActiveMonth**: The MonthKey currently selected in the month filter, controlling which data is displayed
- **DataStore**: The in-memory data layer in `js/script.js` that reads and writes to LocalStorage
- **ChartRenderer**: The Canvas-based drawing module in `js/script.js`
- **UIController**: The DOM manipulation module in `js/script.js`
- **Validator**: The input validation logic in `js/script.js`
- **LocalStorage**: The browser's Web Storage API used to persist transactions and budgets
- **Canvas**: An HTML5 `<canvas>` element drawn on via the 2D Canvas API
- **HiDPI**: High-density pixel displays (e.g., Retina screens) requiring devicePixelRatio scaling
- **Progress Bar**: A horizontal bar showing the ratio of actual category spend to budgeted amount

---

## Requirements

---

### Requirement 1: Project File Structure

**User Story:** As a developer, I want the application delivered as three specific files with clear separation of concerns, so that the project is easy to understand, modify, and deploy without a build step.

#### Acceptance Criteria

1. THE App SHALL be delivered with an `index.html` file at the project root containing only HTML structural markup and no inline JavaScript logic.
2. THE App SHALL include a `css/style.css` file containing all visual styling rules.
3. THE App SHALL include a `js/script.js` file containing all application logic, data management, and chart rendering code.
4. THE `index.html` SHALL reference `css/style.css` via a `<link>` tag and `js/script.js` via a `<script>` tag.
5. THE App SHALL function without any external JavaScript libraries, CSS frameworks, or CDN-hosted resources.

---

### Requirement 2: Transaction Management

**User Story:** As a user, I want to add, view, and delete income and expense transactions, so that I can maintain an accurate record of my financial activity.

#### Acceptance Criteria

1. WHEN a user submits the transaction form with valid data, THE App SHALL create a new Transaction record with a unique ID, persist it to LocalStorage, and display it in the transaction list.
2. WHEN a user submits the transaction form, THE Validator SHALL require a non-whitespace description of up to 100 characters.
3. WHEN a user submits the transaction form, THE Validator SHALL require a positive numeric amount greater than zero.
4. WHEN a user submits the transaction form, THE Validator SHALL require the type field to be either "income" or "expense".
5. WHEN a user submits the transaction form with type "expense", THE Validator SHALL require the category to be one of the eight predefined Categories.
6. WHEN a user submits the transaction form, THE Validator SHALL require the date field to contain a valid calendar date.
7. WHEN a user submits an invalid transaction form, THE Validator SHALL display inline error messages adjacent to each invalid field and SHALL NOT create a Transaction record.
8. WHEN a valid transaction is added, THE UIController SHALL clear the transaction form fields and return focus to the description input.
9. WHEN a user clicks the delete button on a transaction row, THE DataStore SHALL remove that Transaction from LocalStorage and THE UIController SHALL remove the row from the transaction list without a page reload.
10. THE DataStore SHALL assign each new Transaction a UUID-format unique identifier at creation time.

---

### Requirement 3: Data Persistence (LocalStorage)

**User Story:** As a user, I want my transactions and budgets to survive page reloads, so that I don't lose my financial data when I close and reopen the browser.

#### Acceptance Criteria

1. THE DataStore SHALL persist all Transaction records as a JSON array under the LocalStorage key `ebv_transactions`.
2. THE DataStore SHALL persist all Budget records as a JSON array under the LocalStorage key `ebv_budgets`.
3. WHEN the App initializes, THE DataStore SHALL read transactions and budgets from LocalStorage and load them into the in-memory cache.
4. WHEN a transaction is added or deleted, THE DataStore SHALL immediately write the updated transaction array to LocalStorage.
5. WHEN a budget is set, THE DataStore SHALL immediately write the updated budget array to LocalStorage.
6. IF LocalStorage is unavailable or a write operation throws a DOMException, THEN THE App SHALL display a non-blocking notification informing the user that data cannot be saved and SHALL continue operating with in-memory data for the current session.
7. IF the data stored under `ebv_transactions` or `ebv_budgets` cannot be parsed as valid JSON, THEN THE DataStore SHALL treat the affected key as an empty array and SHALL overwrite the corrupt data on the next write operation.

---

### Requirement 4: Month Filter

**User Story:** As a user, I want to filter the transaction list and charts by a selected month, so that I can focus on a specific period of my finances.

#### Acceptance Criteria

1. THE UIController SHALL display a month-selector control populated with all months that contain at least one transaction, plus the current calendar month.
2. WHEN the App initializes, THE UIController SHALL set the ActiveMonth to the current calendar month.
3. WHEN a user selects a different month, THE UIController SHALL update the transaction list to show only transactions whose date falls within that month.
4. WHEN a user selects a different month, THE ChartRenderer SHALL re-render the pie chart and progress bars using data for the newly selected month.
5. WHEN a transaction is added, THE UIController SHALL add the transaction's month to the month-selector if it is not already present.

---

### Requirement 5: Budget Management

**User Story:** As a user, I want to set a monthly spending budget per category, so that I can track whether I am staying within my financial limits.

#### Acceptance Criteria

1. THE UIController SHALL display a budget input field for each of the eight Categories within the Budget Panel.
2. WHEN a user enters a budget amount and saves it, THE DataStore SHALL store exactly one Budget record per `(category, monthKey)` pair, upserting any existing record.
3. WHEN a budget amount is saved, THE ChartRenderer SHALL re-render the bar chart and progress bars to reflect the updated budget.
4. THE DataStore SHALL enforce that budget amounts are non-negative numbers; IF a negative or non-numeric value is entered, THEN THE Validator SHALL reject the input and display an error.
5. WHERE no budget has been set for a category in the active month, THE UIController SHALL display a "Belum diatur" placeholder in that category's progress bar.

---

### Requirement 6: Pie Chart — Expenses by Category

**User Story:** As a user, I want to see a pie chart of my expenses grouped by category for the selected month, so that I can understand where I am spending the most.

#### Acceptance Criteria

1. THE ChartRenderer SHALL draw the pie chart on a `<canvas id="pieChart">` element using only the Canvas 2D API.
2. WHEN the ActiveMonth changes or a transaction is added or deleted, THE ChartRenderer SHALL redraw the pie chart to reflect the current data.
3. THE ChartRenderer SHALL assign a distinct, consistent color to each Category and use those colors for both the pie slices and the legend.
4. THE ChartRenderer SHALL render each pie slice with an arc proportional to that category's share of total expense amount for the ActiveMonth.
5. THE ChartRenderer SHALL draw a legend below the pie canvas showing each category's name and its percentage of total expenses.
6. WHEN total expenses for the ActiveMonth equal zero, THE ChartRenderer SHALL display an empty-state message on the pie canvas instead of a chart.
7. THE ChartRenderer SHALL scale the canvas backing buffer by `window.devicePixelRatio` to produce sharp rendering on HiDPI displays.

---

### Requirement 7: Bar Chart — Budget vs Actual by Month

**User Story:** As a user, I want to see a bar chart comparing my total budgeted amount to my actual total spend for each of the last six months, so that I can track my budget adherence over time.

#### Acceptance Criteria

1. THE ChartRenderer SHALL draw the bar chart on a `<canvas id="barChart">` element using only the Canvas 2D API.
2. THE ChartRenderer SHALL display grouped bars for each of the six most recent months relative to the ActiveMonth, showing one bar for total budgeted amount and one bar for total actual spend.
3. WHEN actual spend exceeds the budgeted amount for a month, THE ChartRenderer SHALL render the actual bar in a visually distinct warning color.
4. WHEN actual spend is within the budgeted amount for a month, THE ChartRenderer SHALL render the actual bar in a success color.
5. THE ChartRenderer SHALL draw labeled Y-axis tick marks and month labels on the X-axis.
6. THE ChartRenderer SHALL draw a legend identifying the budget bar color and the actual bar color.
7. WHEN the ActiveMonth changes or data changes, THE ChartRenderer SHALL re-render the bar chart.
8. THE ChartRenderer SHALL scale the canvas backing buffer by `window.devicePixelRatio` to produce sharp rendering on HiDPI displays.

---

### Requirement 8: Progress Bars — Per Category

**User Story:** As a user, I want to see a progress bar for each expense category showing how much of my budget I have used, so that I can quickly identify categories where I am close to or over budget.

#### Acceptance Criteria

1. THE UIController SHALL render one progress bar per Category in the progress bar section.
2. THE UIController SHALL display each progress bar filled to the ratio of actual spend to budget for the ActiveMonth, capped visually at 100%.
3. WHEN actual spend exceeds the budget for a category, THE UIController SHALL render that category's progress bar in a warning color (red).
4. WHEN actual spend is between 80% and 100% of the budget, THE UIController SHALL render that category's progress bar in a caution color (amber).
5. WHEN actual spend is below 80% of the budget, THE UIController SHALL render that category's progress bar in a safe color (green).
6. THE UIController SHALL display the actual amount spent and the budget amount as text alongside each progress bar.
7. WHERE no budget has been set for a category, THE UIController SHALL render the progress bar at 0% fill and display "Belum diatur" as the budget label.
8. WHEN the ActiveMonth changes or data changes, THE UIController SHALL re-render all progress bars.

---

### Requirement 9: Responsive Layout

**User Story:** As a user, I want to use the application on both desktop and mobile devices, so that I can manage my finances anywhere.

#### Acceptance Criteria

1. THE App SHALL use a single-column layout on viewports narrower than 768px, stacking the left panel above the right panel.
2. THE App SHALL use a two-column CSS Grid layout on viewports 768px wide or wider, with the input/list panel on the left and the chart panel on the right.
3. WHEN the viewport is resized, THE ChartRenderer SHALL resize and redraw all canvas charts to fit the available width.
4. THE ChartRenderer SHALL debounce the resize event handler with a delay of 150 milliseconds to avoid excessive redraws.
5. THE App SHALL ensure all interactive controls (buttons, inputs, selects) have touch targets of at least 44×44 CSS pixels.
6. THE App SHALL use relative units (rem, %, fr) for layout sizing to accommodate variable text sizes and screen widths.

---

### Requirement 10: Application Initialization

**User Story:** As a user, I want the application to load and display my existing data immediately when I open it, so that I can start reviewing my finances without any manual setup.

#### Acceptance Criteria

1. WHEN the DOM is fully loaded, THE App SHALL read all transactions and budgets from LocalStorage into the in-memory cache.
2. WHEN the App initializes, THE UIController SHALL populate the month filter with available months and set the ActiveMonth to the current month.
3. WHEN the App initializes, THE UIController SHALL render the transaction list for the current month.
4. WHEN the App initializes, THE UIController SHALL populate the budget panel with stored budget values for the current month.
5. WHEN the App initializes, THE ChartRenderer SHALL size all canvas elements and render all three visualizations for the current month.

---

### Requirement 11: Data Integrity and Validation

**User Story:** As a developer, I want all stored data to conform to the defined schemas, so that the application behaves predictably and chart calculations are always correct.

#### Acceptance Criteria

1. THE DataStore SHALL only store Transaction objects where `type` ∈ {"income", "expense"}, `amount` > 0, `date` is a valid ISO 8601 date string, and `category` is a valid Category or "income".
2. THE DataStore SHALL only store Budget objects where `category` ∈ CATEGORIES, `monthKey` matches the pattern `YYYY-MM`, and `amount` ≥ 0.
3. THE App SHALL compute `totalExpense` for any month as the exact sum of all expense transaction amounts for that month.
4. THE App SHALL compute `totalIncome` for any month as the exact sum of all income transaction amounts for that month.
5. FOR ALL valid Transaction arrays, the sum of `byCategory` values in the computed `MonthSummary` SHALL equal `totalExpense` for that month.
