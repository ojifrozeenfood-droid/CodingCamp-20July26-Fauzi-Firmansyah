/* ============================================================
   Expense & Budget Visualizer — js/script.js
   Vanilla JavaScript, no external dependencies.
   Organized into sections:
     1. CONSTANTS
     2. DataStore
     3. Validator
     4. Aggregation
     5. ChartRenderer
     6. UIController
     7. Init
   ============================================================ */

/* ============================================================
   SECTION 1: CONSTANTS
   ============================================================ */

/** LocalStorage key for the transactions array. */
const LS_TRANSACTIONS = "ebv_transactions";

/** LocalStorage key for the budgets array. */
const LS_BUDGETS = "ebv_budgets";

/** Ordered list of expense categories. */
const CATEGORIES = [
  "Makanan & Minuman",
  "Transportasi",
  "Belanja",
  "Hiburan",
  "Kesehatan",
  "Pendidikan",
  "Tagihan & Utilitas",
  "Lainnya"
];

/**
 * Distinct hex colors assigned to each category.
 * Used consistently for pie slices, legends, and badges.
 */
const CATEGORY_COLORS = {
  "Makanan & Minuman":  "#f97316",  // orange
  "Transportasi":       "#3b82f6",  // blue
  "Belanja":            "#a855f7",  // purple
  "Hiburan":            "#ec4899",  // pink
  "Kesehatan":          "#22c55e",  // green
  "Pendidikan":         "#eab308",  // yellow
  "Tagihan & Utilitas": "#14b8a6",  // teal
  "Lainnya":            "#94a3b8"   // slate
};

/* ============================================================
   SECTION 2: DataStore
   ============================================================ */

/**
 * Shows the #storageError notification div by adding the "visible" class
 * and setting its text content to the provided message.
 * @param {string} message - The error message to display.
 */
function showStorageError(message) {
  const el = document.getElementById("storageError");
  if (el) {
    el.textContent = message;
    el.classList.add("visible");
  }
}

const DataStore = {
  /**
   * Reads the transactions array from LocalStorage.
   * Returns [] if the key is absent or if JSON parsing fails.
   * @returns {Array}
   */
  readTransactions() {
    try {
      const raw = localStorage.getItem(LS_TRANSACTIONS);
      if (raw === null) return [];
      return JSON.parse(raw);
    } catch (err) {
      console.error("DataStore.readTransactions: failed to parse stored data", err);
      return [];
    }
  },

  /**
   * Serializes the given array and writes it to LocalStorage under LS_TRANSACTIONS.
   * Calls showStorageError() if a DOMException is thrown (e.g. quota exceeded).
   * @param {Array} array
   */
  writeTransactions(array) {
    try {
      localStorage.setItem(LS_TRANSACTIONS, JSON.stringify(array));
    } catch (err) {
      if (err instanceof DOMException) {
        showStorageError("Data tidak dapat disimpan — penyimpanan penuh atau diblokir.");
      } else {
        throw err;
      }
    }
  },

  /**
   * Reads the budgets array from LocalStorage.
   * Returns [] if the key is absent or if JSON parsing fails.
   * @returns {Array}
   */
  readBudgets() {
    try {
      const raw = localStorage.getItem(LS_BUDGETS);
      if (raw === null) return [];
      return JSON.parse(raw);
    } catch (err) {
      console.error("DataStore.readBudgets: failed to parse stored data", err);
      return [];
    }
  },

  /**
   * Serializes the given array and writes it to LocalStorage under LS_BUDGETS.
   * Calls showStorageError() if a DOMException is thrown (e.g. quota exceeded).
   * @param {Array} array
   */
  writeBudgets(array) {
    try {
      localStorage.setItem(LS_BUDGETS, JSON.stringify(array));
    } catch (err) {
      if (err instanceof DOMException) {
        showStorageError("Data tidak dapat disimpan — penyimpanan penuh atau diblokir.");
      } else {
        throw err;
      }
    }
  },

  /**
   * Upserts a budget record for the given category and month.
   * If a record with matching (category, monthKey) already exists, its amount is updated.
   * Otherwise a new record is pushed to the array.
   * Writes the updated array back to LocalStorage.
   *
   * @param {string} category - Must be one of CATEGORIES.
   * @param {string} monthKey - "YYYY-MM" format string.
   * @param {number} amount   - Non-negative budget amount.
   * @returns {boolean} true on success.
   *
   * Requirements: 5.2, 3.5
   */
  setBudget(category, monthKey, amount) {
    const budgets = this.readBudgets();
    const idx = budgets.findIndex(b => b.category === category && b.monthKey === monthKey);
    if (idx >= 0) {
      budgets[idx].amount = amount;
    } else {
      budgets.push({ category, monthKey, amount });
    }
    this.writeBudgets(budgets);
    return true;
  },

  /**
   * Adds a transaction to the stored transactions array.
   * Reads the current array, appends the new transaction, and writes back.
   * @param {Object} tx - A valid Transaction object.
   * @returns {boolean} Always returns true on success.
   *
   * Requirements: 2.1, 3.4
   */
  addTransaction(tx) {
    const transactions = this.readTransactions();
    transactions.push(tx);
    this.writeTransactions(transactions);
    return true;
  },

  /**
   * Deletes the transaction with the given id from the stored transactions array.
   * Reads the current array, filters out the matching record, and writes back.
   * Returns true whether or not a matching record was found.
   * @param {string} id - The UUID of the transaction to remove.
   * @returns {boolean} Always returns true.
   *
   * Requirements: 2.9
   */
  deleteTransaction(id) {
    const transactions = this.readTransactions();
    const filtered = transactions.filter(function(tx) {
      return tx.id !== id;
    });
    this.writeTransactions(filtered);
    return true;
  }
};

/**
 * Generates a UUID v4 string using Math.random() nibble replacement.
 * Format: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
 * The '4' is fixed (version 4); 'y' is masked to produce RFC 4122 variant bits.
 * @returns {string} A UUID v4 string.
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/* ============================================================
   SECTION 3: Validator
   ============================================================ */

const Validator = {

  /**
   * Validates transaction form data.
   * @param {Object} formData - Plain object with fields: description, amount, type, category, date
   * @returns {{ valid: true } | { valid: false, errors: Object }}
   */
  validateTransaction(formData) {
    const errors = {};

    // --- description ---
    const desc = formData.description;
    if (desc === null || desc === undefined || String(desc).trim() === "") {
      errors.description = "Deskripsi tidak boleh kosong.";
    } else if (String(desc).length > 100) {
      errors.description = "Deskripsi maksimal 100 karakter.";
    }

    // --- amount ---
    const amount = Number(formData.amount);
    if (!isFinite(amount) || amount <= 0) {
      errors.amount = "Jumlah harus berupa angka positif lebih dari nol.";
    }

    // --- type ---
    const type = formData.type;
    if (type !== "income" && type !== "expense") {
      errors.type = "Tipe transaksi harus 'income' atau 'expense'.";
    }

    // --- category ---
    // Only validate category when type is known to be valid
    if (type === "expense") {
      if (!CATEGORIES.includes(formData.category)) {
        errors.category = "Kategori tidak valid untuk pengeluaran.";
      }
    }
    // For income, category is always set to "income" — no rejection needed

    // --- date ---
    const dateStr = formData.date;
    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateStr || !ISO_DATE_RE.test(dateStr)) {
      errors.date = "Tanggal harus berupa tanggal valid (format YYYY-MM-DD).";
    } else {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        errors.date = "Tanggal tidak dapat dikenali sebagai tanggal yang valid.";
      }
    }

    if (Object.keys(errors).length > 0) {
      return { valid: false, errors };
    }
    return { valid: true };
  },

  /**
   * Validates a budget amount.
   *
   * Accepts a number or numeric string. Strings are parsed with parseFloat.
   * Rejects values that are not finite numbers or are negative (< 0).
   *
   * @param {number|string} amount - The budget amount to validate.
   * @returns {{ valid: true } | { valid: false, error: string }}
   *
   * Requirements: 5.4, 11.2
   */
  validateBudget(amount) {
    const parsed = typeof amount === "string" ? parseFloat(amount) : amount;

    if (!isFinite(parsed) || isNaN(parsed) || parsed < 0) {
      return { valid: false, error: "Jumlah anggaran harus berupa angka non-negatif." };
    }

    return { valid: true };
  }

};

/* ============================================================
   SECTION 4: Aggregation
   ============================================================ */

const Aggregation = {
  /**
   * Extracts the "YYYY-MM" month key from an ISO 8601 date string.
   * @param {string} isoDateString - A date string in "YYYY-MM-DD" format.
   * @returns {string} The "YYYY-MM" prefix, e.g. "2025-07".
   */
  getMonthKey(isoDateString) {
    return isoDateString.slice(0, 7);
  },

  /**
   * Returns an array of exactly 6 MonthKey strings in chronological ascending order,
   * ending with (and including) the given activeMonthKey.
   *
   * @param {string} activeMonthKey - The last month in the window, "YYYY-MM" format.
   * @returns {string[]} Array of 6 "YYYY-MM" strings, oldest first.
   *
   * Requirements: 7.2
   */
  getLast6Months(activeMonthKey) {
    const [yearStr, monthStr] = activeMonthKey.split("-");
    let year  = parseInt(yearStr,  10);
    let month = parseInt(monthStr, 10); // 1-based

    const months = [];
    for (let i = 0; i < 6; i++) {
      // Format as "YYYY-MM" with zero-padded month
      months.unshift(year + "-" + String(month).padStart(2, "0"));

      // Step one month back
      month -= 1;
      if (month === 0) {
        month = 12;
        year  -= 1;
      }
    }

    return months;
  },

  /**
   * Aggregates transactions for a specific month into a MonthSummary object.
   *
   * @param {Array} transactions - Array of Transaction objects.
   * @param {string} monthKey - Month to aggregate in "YYYY-MM" format.
   * @returns {{ monthKey: string, totalIncome: number, totalExpense: number, byCategory: Object }}
   *
   * Requirements: 11.3, 11.4, 11.5
   */
  aggregateMonth(transactions, monthKey) {
    const summary = {
      monthKey,
      totalIncome: 0,
      totalExpense: 0,
      byCategory: {}
    };

    for (const tx of transactions) {
      if (this.getMonthKey(tx.date) !== monthKey) {
        continue;
      }

      if (tx.type === "income") {
        summary.totalIncome += tx.amount;
      } else {
        // expense
        summary.totalExpense += tx.amount;
        const prev = summary.byCategory[tx.category] || 0;
        summary.byCategory[tx.category] = prev + tx.amount;
      }
    }

    return summary;
  },

  /**
   * Filters an array of transactions to only those whose date falls in the given month.
   *
   * @param {Array} transactions - Array of Transaction objects.
   * @param {string} monthKey - The target month in "YYYY-MM" format.
   * @returns {Array} A new array containing only transactions whose date is in monthKey.
   *
   * Requirements: 4.3
   */
  getTransactionsForMonth(transactions, monthKey) {
    return transactions.filter(tx => this.getMonthKey(tx.date) === monthKey);
  },

  /**
   * Builds an array of BudgetComparison objects — one per category in CATEGORIES.
   *
   * @param {Array}  budgets  - Array of Budget objects { category, monthKey, amount }.
   * @param {Object} summary  - MonthSummary object with byCategory map.
   * @param {string} monthKey - "YYYY-MM" string identifying the month.
   * @returns {Array} Array of BudgetComparison: { category, budgeted, actual, percentage }
   *
   * Requirements: 5.5, 8.2, 8.7
   */
  buildBudgetComparisons(budgets, summary, monthKey) {
    const comparisons = [];

    for (const category of CATEGORIES) {
      const budgetRecord = budgets.find(
        b => b.category === category && b.monthKey === monthKey
      );

      const budgeted = budgetRecord ? budgetRecord.amount : 0;
      const actual   = summary.byCategory[category] || 0;
      const pct      = budgeted > 0 ? (actual / budgeted) * 100 : 0;

      comparisons.push({
        category,
        budgeted,
        actual,
        percentage: pct
      });
    }

    return comparisons;
  }
};

/* ============================================================
   SECTION 5: ChartRenderer
   ============================================================ */

const ChartRenderer = {

  /**
   * Resizes a canvas element to match its CSS display size × devicePixelRatio,
   * then scales the 2D context so drawing coordinates use CSS pixels.
   * @param {HTMLCanvasElement} canvas
   */
  resizeCanvas(canvas) {
    const dpr  = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
  },

  /**
   * Calls resizeCanvas on both chart canvases, guarding against missing elements.
   */
  resizeAllCanvases() {
    const pie = document.getElementById("pieChart");
    const bar = document.getElementById("barChart");
    if (pie) this.resizeCanvas(pie);
    if (bar) this.resizeCanvas(bar);
  },

  /**
   * Draws a centered empty-state message on a canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {HTMLCanvasElement} canvas
   * @param {string} message
   */
  drawEmptyState(ctx, canvas, message) {
    const dpr = window.devicePixelRatio || 1;
    const w   = canvas.width  / dpr;
    const h   = canvas.height / dpr;
    ctx.font         = "16px sans-serif";
    ctx.fillStyle    = "#94a3b8";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, w / 2, h / 2);
  },

  /**
   * Draws the Y-axis line and 5 labelled horizontal tick marks.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ top:number, right:number, bottom:number, left:number }} padding
   * @param {number} chartHeight - CSS-pixel height of the chart area
   * @param {number} maxValue
   */
  drawYAxis(ctx, padding, chartHeight, maxValue) {
    ctx.strokeStyle = "#334155";
    ctx.lineWidth   = 1;

    // Vertical axis line
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.stroke();

    ctx.font      = "11px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= 4; i++) {
      const ratio = i / 4;
      const y     = padding.top + chartHeight - ratio * chartHeight;
      const value = maxValue * ratio;

      // Tick mark
      ctx.beginPath();
      ctx.moveTo(padding.left - 4, y);
      ctx.lineTo(padding.left,     y);
      ctx.strokeStyle = "#334155";
      ctx.stroke();

      // Horizontal grid line (subtle)
      ctx.beginPath();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = "#1e293b";
      ctx.moveTo(padding.left + 1, y);
      ctx.lineTo(padding.left + 9999, y); // will be clipped by canvas edge
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillText(
        Math.round(value).toLocaleString("id-ID"),
        padding.left - 8,
        y
      );
    }
  },

  /**
   * Draws X-axis month labels centred under each bar group.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ top:number, right:number, bottom:number, left:number }} padding
   * @param {number} chartWidth
   * @param {number} chartHeight
   * @param {string[]} months - Array of "YYYY-MM" strings (6 items)
   */
  drawXAxisLabels(ctx, padding, chartWidth, chartHeight, months) {
    const ID_MONTHS_SHORT = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
    const groupWidth = chartWidth / months.length;

    ctx.font         = "11px sans-serif";
    ctx.fillStyle    = "#64748b";
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";

    months.forEach(function(m, i) {
      const [y, mo] = m.split("-");
      const label   = ID_MONTHS_SHORT[parseInt(mo, 10) - 1] + " '" + y.slice(2);
      const x       = padding.left + i * groupWidth + groupWidth / 2;
      const yPos    = padding.top + chartHeight + 8;
      ctx.fillText(label, x, yPos);
    });
  },

  /**
   * Renders the pie chart for the given month summary.
   * @param {HTMLCanvasElement} canvas
   * @param {{ totalExpense: number, byCategory: Object }} monthSummary
   */
  renderPieChart(canvas, monthSummary) {
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d");
    const w   = canvas.width  / dpr;
    const h   = canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    const totalExpense = monthSummary.totalExpense;

    if (totalExpense === 0) {
      this.drawEmptyState(ctx, canvas, "Tidak ada pengeluaran bulan ini");
      return;
    }

    const cx     = w / 2;
    const cy     = h * 0.42; // slightly above center to leave room for legend
    const radius = Math.min(cx, cy) * 0.72;

    let startAngle = -Math.PI / 2;

    for (const category of CATEGORIES) {
      const amount = monthSummary.byCategory[category];
      if (!amount || amount === 0) continue;

      const sliceAngle = (amount / totalExpense) * 2 * Math.PI;
      const color      = CATEGORY_COLORS[category] || "#94a3b8";

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle   = color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth   = 2;
      ctx.stroke();

      startAngle += sliceAngle;
    }

    this.drawPieLegend(ctx, canvas, monthSummary, totalExpense);
  },

  /**
   * Draws the pie chart legend inside the canvas, below the pie circle.
   * @param {CanvasRenderingContext2D} ctx
   * @param {HTMLCanvasElement} canvas
   * @param {{ byCategory: Object }} monthSummary
   * @param {number} totalExpense
   */
  drawPieLegend(ctx, canvas, monthSummary, totalExpense) {
    const dpr = window.devicePixelRatio || 1;
    const w   = canvas.width  / dpr;
    const h   = canvas.height / dpr;

    // Build entries with amount > 0
    const entries = CATEGORIES
      .filter(cat => monthSummary.byCategory[cat] > 0)
      .map(cat => ({
        name:    cat,
        color:   CATEGORY_COLORS[cat] || "#94a3b8",
        pct:     ((monthSummary.byCategory[cat] / totalExpense) * 100).toFixed(1)
      }));

    if (entries.length === 0) return;

    const colCount   = 2;
    const rowHeight  = 18;
    const swatchSize = 12;
    const colWidth   = w / colCount;
    const legendTop  = h * 0.84; // start at ~84% of canvas height

    ctx.font         = "12px sans-serif";
    ctx.textBaseline = "middle";

    entries.forEach(function(entry, i) {
      const col = i % colCount;
      const row = Math.floor(i / colCount);
      const x   = col * colWidth + 8;
      const y   = legendTop + row * rowHeight;

      // Swatch
      ctx.fillStyle = entry.color;
      ctx.fillRect(x, y - swatchSize / 2, swatchSize, swatchSize);

      // Text
      ctx.fillStyle = "#f1f5f9";
      ctx.textAlign = "left";
      const label   = entry.name + " " + entry.pct + "%";
      ctx.fillText(label, x + swatchSize + 4, y);
    });
  },

  /**
   * Renders the bar chart (budget vs actual for last 6 months).
   * @param {HTMLCanvasElement} canvas
   * @param {Array} transactions
   * @param {Array} budgets
   * @param {string} activeMonthKey
   */
  renderBarChart(canvas, transactions, budgets, activeMonthKey) {
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d");
    const w   = canvas.width  / dpr;
    const h   = canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    const months = Aggregation.getLast6Months(activeMonthKey);

    // Compute totals per month
    const data = months.map(function(m) {
      const totalBudgeted = budgets
        .filter(b => b.monthKey === m)
        .reduce(function(sum, b) { return sum + b.amount; }, 0);
      const summary     = Aggregation.aggregateMonth(transactions, m);
      const totalActual = summary.totalExpense;
      return { month: m, budgeted: totalBudgeted, actual: totalActual };
    });

    const padding     = { top: 30, right: 20, bottom: 50, left: 65 };
    const chartWidth  = w - padding.left - padding.right;
    const chartHeight = h - padding.top  - padding.bottom;

    const groupWidth = chartWidth / 6;
    const barWidth   = groupWidth * 0.35;
    const gap        = groupWidth * 0.05;

    const allValues = data.reduce(function(arr, d) {
      arr.push(d.budgeted, d.actual);
      return arr;
    }, []);
    const rawMax  = Math.max.apply(null, allValues);
    const maxValue = (rawMax > 0 ? rawMax : 0) * 1.1 || 1;

    const COLOR_BUDGET = "#6366f1";
    const COLOR_OVER   = "#ef4444";
    const COLOR_UNDER  = "#22c55e";

    this.drawYAxis(ctx, padding, chartHeight, maxValue);
    this.drawXAxisLabels(ctx, padding, chartWidth, chartHeight, months);

    // Safe rounded-top rect (works in all browsers)
    function drawBar(ctx2, x, y, w2, h2, color) {
      if (h2 <= 0) return;
      const r = Math.min(3, w2 / 2, h2);
      ctx2.fillStyle = color;
      ctx2.beginPath();
      ctx2.moveTo(x + r, y);
      ctx2.lineTo(x + w2 - r, y);
      ctx2.arcTo(x + w2, y,     x + w2, y + r,      r);
      ctx2.lineTo(x + w2, y + h2);
      ctx2.lineTo(x,      y + h2);
      ctx2.arcTo(x,       y,     x + r,  y,          r);
      ctx2.closePath();
      ctx2.fill();
    }

    data.forEach(function(d, i) {
      const xBase = padding.left + i * groupWidth + gap;

      // Budget bar
      const barHBudget = (d.budgeted / maxValue) * chartHeight;
      drawBar(ctx, xBase, padding.top + chartHeight - barHBudget, barWidth, barHBudget, COLOR_BUDGET);

      // Actual bar
      const barHActual = (d.actual / maxValue) * chartHeight;
      const actualColor = d.actual > d.budgeted ? COLOR_OVER : COLOR_UNDER;
      drawBar(ctx, xBase + barWidth + gap, padding.top + chartHeight - barHActual, barWidth, barHActual, actualColor);
    });

    this.drawBarLegend(ctx, canvas, padding);
  },

  /**
   * Draws a small legend at the top-right of the bar chart area.
   * @param {CanvasRenderingContext2D} ctx
   * @param {HTMLCanvasElement} canvas
   * @param {{ top:number, right:number, bottom:number, left:number }} padding
   */
  drawBarLegend(ctx, canvas, padding) {
    const dpr = window.devicePixelRatio || 1;
    const w   = canvas.width / dpr;

    const items = [
      { color: "#6366f1", label: "Anggaran" },
      { color: "#22c55e", label: "Aktual"   }
    ];

    ctx.font         = "11px sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign    = "left";

    let x = w - padding.right - 140;
    const y = padding.top - 14;

    items.forEach(function(item) {
      ctx.fillStyle = item.color;
      ctx.fillRect(x, y - 5, 12, 12);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(item.label, x + 16, y + 1);
      x += 75;
    });
  },

  /**
   * Master render: resizes canvases, aggregates data, and calls all three renderers.
   * @param {Array}  transactions
   * @param {Array}  budgets
   * @param {string} activeMonthKey
   */
  renderAll(transactions, budgets, activeMonthKey) {
    this.resizeAllCanvases();

    const pieCanvas = document.getElementById("pieChart");
    const barCanvas = document.getElementById("barChart");

    const summary     = Aggregation.aggregateMonth(transactions, activeMonthKey);
    const comparisons = Aggregation.buildBudgetComparisons(budgets, summary, activeMonthKey);

    if (pieCanvas) this.renderPieChart(pieCanvas, summary);
    if (barCanvas) this.renderBarChart(barCanvas, transactions, budgets, activeMonthKey);

    const progressContainer = document.getElementById("progressBars");
    if (progressContainer) {
      UIController.renderProgressBars(progressContainer, comparisons);
    }
  }

};

/* ============================================================
   SECTION 6: UIController
   ============================================================ */

const UIController = {

  /**
   * Populates a category <select> element based on transaction type.
   * @param {HTMLSelectElement} selectEl
   * @param {string} type - "income" or "expense"
   */
  populateCategorySelect(selectEl, type) {
    selectEl.innerHTML = "";
    if (type === "income") {
      const opt  = document.createElement("option");
      opt.value  = "income";
      opt.textContent = "Pendapatan";
      selectEl.appendChild(opt);
    } else {
      CATEGORIES.forEach(function(cat) {
        const opt  = document.createElement("option");
        opt.value  = cat;
        opt.textContent = cat;
        selectEl.appendChild(opt);
      });
    }
  },

  /**
   * Populates the month filter <select> with all months containing transactions
   * plus the current month, sorted descending.
   * @param {HTMLSelectElement} selectEl
   * @param {Array} transactions
   */
  populateMonthFilter(selectEl, transactions) {
    const keySet = new Set();

    transactions.forEach(function(tx) {
      keySet.add(Aggregation.getMonthKey(tx.date));
    });

    // Always include current month
    const now     = new Date();
    const current = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    keySet.add(current);

    const sorted = Array.from(keySet).sort(function(a, b) {
      return b.localeCompare(a); // descending
    });

    const ID_MONTHS_FULL = [
      "Januari","Februari","Maret","April","Mei","Juni",
      "Juli","Agustus","September","Oktober","November","Desember"
    ];

    selectEl.innerHTML = sorted.map(function(key) {
      const [y, m] = key.split("-");
      const label  = ID_MONTHS_FULL[parseInt(m, 10) - 1] + " " + y;
      return '<option value="' + key + '">' + label + '</option>';
    }).join("");
  },

  /**
   * Renders the transaction list for the given month.
   * @param {HTMLElement} container
   * @param {Array} transactions
   * @param {string} monthKey
   */
  renderTransactionList(container, transactions, monthKey) {
    const filtered = Aggregation.getTransactionsForMonth(transactions, monthKey);

    // Sort by date descending, then by createdAt descending for same-day stability
    filtered.sort(function(a, b) {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    if (filtered.length === 0) {
      container.innerHTML = '<p class="empty-state">Tidak ada transaksi bulan ini.</p>';
      return;
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    const rows = filtered.map(function(tx) {
      const badgeColor = tx.type === "income"
        ? "#34d399"
        : (CATEGORY_COLORS[tx.category] || "#94a3b8");
      const amountClass = tx.type === "income" ? "income" : "expense";
      const prefix      = tx.type === "income" ? "+" : "-";
      const amountStr   = prefix + "Rp\u00a0" + Math.round(tx.amount).toLocaleString("id-ID");
      const categoryLabel = tx.type === "income" ? "Pendapatan" : tx.category;

      return [
        '<div class="transaction-row" style="border-left: 3px solid ' + badgeColor + '">',
        '  <span class="transaction-date">' + escapeHtml(tx.date) + '</span>',
        '  <span class="transaction-description">' + escapeHtml(tx.description) + '</span>',
        '  <span class="category-badge" style="background:' + badgeColor + '22;color:' + badgeColor + '">' + escapeHtml(categoryLabel) + '</span>',
        '  <span class="transaction-amount ' + amountClass + '">' + amountStr + '</span>',
        '  <button class="btn btn-danger transaction-delete" data-action="delete" data-id="' + escapeHtml(tx.id) + '" aria-label="Hapus transaksi">&#x2715;</button>',
        '</div>'
      ].join("\n");
    });

    container.innerHTML = rows.join("\n");
  },

  /**
   * Clears all transaction form fields and re-focuses the description input.
   * @param {HTMLFormElement} form
   */
  clearTransactionForm(form) {
    form.reset();
    // Clear all field-error spans
    form.querySelectorAll(".field-error").forEach(function(el) {
      el.textContent = "";
    });
    // Remove is-invalid classes
    form.querySelectorAll(".is-invalid").forEach(function(el) {
      el.classList.remove("is-invalid");
    });
    // Re-focus description
    const descInput = form.querySelector('[name="description"]');
    if (descInput) descInput.focus();
  },

  /**
   * Renders the budget panel for the active month.
   * @param {HTMLElement} container
   * @param {Array} budgets
   * @param {string} activeMonth
   */
  renderBudgetPanel(container, budgets, activeMonth) {
    const rows = CATEGORIES.map(function(cat) {
      const record = budgets.find(b => b.category === cat && b.monthKey === activeMonth);
      const value  = record ? record.amount : "";

      function escHtml(str) {
        return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }

      return [
        '<div class="budget-row" data-category="' + escHtml(cat) + '">',
        '  <span class="budget-category-label">' + escHtml(cat) + '</span>',
        '  <input class="budget-input" type="number" min="0" step="any"',
        '    value="' + (value !== "" ? escHtml(String(value)) : "") + '"',
        '    placeholder="Belum diatur"',
        '    data-category="' + escHtml(cat) + '" />',
        '  <span class="budget-error"></span>',
        '</div>'
      ].join("\n");
    });

    container.innerHTML = rows.join("\n");

    // Attach change event listeners to all budget inputs
    container.querySelectorAll(".budget-input").forEach(function(input) {
      input.addEventListener("change", function() {
        const cat      = this.dataset.category;
        const rawValue = this.value.trim();
        const errEl    = this.closest(".budget-row").querySelector(".budget-error");

        if (rawValue === "") {
          // Empty means "no budget set" — skip saving, clear error
          if (errEl) errEl.textContent = "";
          input.classList.remove("is-invalid");
          return;
        }

        const result = Validator.validateBudget(rawValue);
        if (!result.valid) {
          if (errEl) errEl.textContent = result.error;
          input.classList.add("is-invalid");
          return;
        }

        if (errEl) errEl.textContent = "";
        input.classList.remove("is-invalid");

        DataStore.setBudget(cat, activeMonth, parseFloat(rawValue));
        AppState.budgets = DataStore.readBudgets();
        ChartRenderer.renderAll(AppState.transactions, AppState.budgets, AppState.activeMonth);
      });
    });
  },

  /**
   * Renders per-category progress bars.
   * @param {HTMLElement} container
   * @param {Array} comparisons - Array of BudgetComparison objects
   */
  renderProgressBars(container, comparisons) {
    const items = comparisons.map(function(comp) {
      const pct   = Math.min(comp.percentage, 100);
      let color;
      if (comp.percentage >= 100) {
        color = "#ef4444";
      } else if (comp.percentage >= 80) {
        color = "#f59e0b";
      } else {
        color = "#22c55e";
      }

      const budgetText = comp.budgeted > 0
        ? "Rp\u00a0" + Math.round(comp.actual).toLocaleString("id-ID") +
          " / Rp\u00a0" + Math.round(comp.budgeted).toLocaleString("id-ID")
        : "Rp\u00a0" + Math.round(comp.actual).toLocaleString("id-ID") + " / Belum diatur";

      const gradientStyle = comp.percentage >= 100
        ? "background: linear-gradient(90deg, #ef4444, #f87171);"
        : comp.percentage >= 80
          ? "background: linear-gradient(90deg, #f59e0b, #fbbf24);"
          : "background: linear-gradient(90deg, #22c55e, #4ade80);";

      return [
        '<div class="progress-item">',
        '  <div class="progress-label-row">',
        '    <span class="progress-category">' + comp.category + '</span>',
        '    <span class="progress-amounts">' + budgetText + '</span>',
        '  </div>',
        '  <div class="progress-track">',
        '    <div class="progress-fill" style="width:' + pct + '%; ' + gradientStyle + '"></div>',
        '  </div>',
        '</div>'
      ].join("\n");
    });

    container.innerHTML = items.join("\n");
  },

  /**
   * Convenience wrapper: populates the #txCategory select by type.
   * @param {string} type - "income" or "expense"
   */
  populateCategorySelectByType(type) {
    const selectEl = document.getElementById("txCategory");
    if (selectEl) this.populateCategorySelect(selectEl, type);
  }

};

/* ============================================================
   SECTION 7: Init
   ============================================================ */

// App state
let AppState = {
  transactions: [],
  budgets: [],
  activeMonth: ''
};

function getCurrentMonthKey() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

// Indonesian month names
const ID_MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-');
  return ID_MONTHS[parseInt(m, 10) - 1] + ' ' + y;
}

function formatCurrency(amount) {
  return 'Rp\u00a0' + Math.round(amount).toLocaleString('id-ID');
}

function initApp() {
  AppState.transactions = DataStore.readTransactions();
  AppState.budgets      = DataStore.readBudgets();
  AppState.activeMonth  = getCurrentMonthKey();

  const monthSelect      = document.getElementById('monthSelect');
  const categorySelect   = document.getElementById('txCategory');
  const typeSelect       = document.getElementById('txType');
  const form             = document.getElementById('transactionForm');
  const txListContainer  = document.getElementById('transactionListContainer');
  const budgetContainer  = document.getElementById('budgetPanelContainer');
  const monthLabel       = document.querySelector('.active-month-label');

  // Populate selects
  UIController.populateMonthFilter(monthSelect, AppState.transactions);
  UIController.populateCategorySelect(categorySelect, 'expense');

  // Set active month in filter to current
  monthSelect.value = AppState.activeMonth;

  // Update header month label
  if (monthLabel) monthLabel.textContent = formatMonthLabel(AppState.activeMonth);

  // Render lists and panels
  UIController.renderTransactionList(txListContainer, AppState.transactions, AppState.activeMonth);
  UIController.renderBudgetPanel(budgetContainer, AppState.budgets, AppState.activeMonth);

  // Set today's date as default in date picker
  const dateInput = document.getElementById('txDate');
  if (dateInput) {
    const today = new Date();
    dateInput.value = today.toISOString().slice(0, 10);
  }

  // Render charts
  ChartRenderer.renderAll(AppState.transactions, AppState.budgets, AppState.activeMonth);

  // --- Event: type select changes category options ---
  typeSelect.addEventListener('change', function() {
    UIController.populateCategorySelect(categorySelect, this.value);
  });

  // --- Event: month filter ---
  monthSelect.addEventListener('change', function() {
    AppState.activeMonth = this.value;
    if (monthLabel) monthLabel.textContent = formatMonthLabel(AppState.activeMonth);
    UIController.renderTransactionList(txListContainer, AppState.transactions, AppState.activeMonth);
    UIController.renderBudgetPanel(budgetContainer, AppState.budgets, AppState.activeMonth);
    ChartRenderer.renderAll(AppState.transactions, AppState.budgets, AppState.activeMonth);
  });

  // --- Event: form submit ---
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = {
      description: document.getElementById('txDescription').value,
      amount:      parseFloat(document.getElementById('txAmount').value),
      type:        document.getElementById('txType').value,
      category:    document.getElementById('txCategory').value,
      date:        document.getElementById('txDate').value
    };

    const result = Validator.validateTransaction(formData);
    if (!result.valid) {
      // Show inline errors
      const fields = ['description', 'amount', 'type', 'category', 'date'];
      fields.forEach(function(f) {
        const errEl   = document.getElementById('error' + f.charAt(0).toUpperCase() + f.slice(1));
        const inputEl = document.querySelector('[name="' + f + '"]');
        if (errEl)   errEl.textContent = result.errors[f] || '';
        if (inputEl) inputEl.classList.toggle('is-invalid', !!result.errors[f]);
      });
      return;
    }

    // Build transaction object
    const tx = {
      id:          generateUUID(),
      type:        formData.type,
      category:    formData.type === 'income' ? 'income' : formData.category,
      description: formData.description,
      amount:      formData.amount,
      date:        formData.date,
      createdAt:   Date.now()
    };

    DataStore.addTransaction(tx);
    AppState.transactions = DataStore.readTransactions();

    UIController.populateMonthFilter(monthSelect, AppState.transactions);
    monthSelect.value = AppState.activeMonth;
    UIController.clearTransactionForm(form);
    UIController.renderTransactionList(txListContainer, AppState.transactions, AppState.activeMonth);
    UIController.renderBudgetPanel(budgetContainer, AppState.budgets, AppState.activeMonth);
    ChartRenderer.renderAll(AppState.transactions, AppState.budgets, AppState.activeMonth);
  });

  // --- Event: delete transaction (event delegation) ---
  txListContainer.addEventListener('click', function(e) {
    const btn = e.target.closest('[data-action="delete"]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    DataStore.deleteTransaction(id);
    AppState.transactions = DataStore.readTransactions();
    UIController.populateMonthFilter(monthSelect, AppState.transactions);
    monthSelect.value = AppState.activeMonth;
    UIController.renderTransactionList(txListContainer, AppState.transactions, AppState.activeMonth);
    ChartRenderer.renderAll(AppState.transactions, AppState.budgets, AppState.activeMonth);
  });

  // --- Event: resize with debounce ---
  function debounce(fn, delay) {
    let timer;
    return function() {
      clearTimeout(timer);
      const args = arguments;
      const ctx  = this;
      timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
    };
  }
  window.addEventListener('resize', debounce(function() {
    ChartRenderer.renderAll(AppState.transactions, AppState.budgets, AppState.activeMonth);
  }, 150));
}

document.addEventListener('DOMContentLoaded', initApp);
