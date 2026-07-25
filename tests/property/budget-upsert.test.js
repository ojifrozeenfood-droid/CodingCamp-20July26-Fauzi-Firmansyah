/**
 * Property 4: Budget upsert idempotence
 *
 * For any (category, monthKey, amount) triple, calling setBudget twice with
 * the same arguments must produce exactly one budget record for that
 * (category, monthKey) pair — equivalent to calling it once.
 *
 * Validates: Requirements 5.2
 */

"use strict";

const fc = require("fast-check");

/* ------------------------------------------------------------------ */
/* Constants (inlined from js/script.js)                               */
/* ------------------------------------------------------------------ */

const LS_BUDGETS = "ebv_budgets";

const CATEGORIES = [
  "Makanan & Minuman",
  "Transportasi",
  "Belanja",
  "Hiburan",
  "Kesehatan",
  "Pendidikan",
  "Tagihan & Utilitas",
  "Lainnya",
];

/* ------------------------------------------------------------------ */
/* localStorage mock                                                   */
/* ------------------------------------------------------------------ */

function createLocalStorageMock() {
  let store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key)
        ? store[key]
        : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
}

const localStorageMock = createLocalStorageMock();

/* ------------------------------------------------------------------ */
/* DataStore (inlined logic from js/script.js)                        */
/* ------------------------------------------------------------------ */

const DataStore = {
  readBudgets() {
    try {
      const raw = localStorageMock.getItem(LS_BUDGETS);
      if (raw === null) return [];
      return JSON.parse(raw);
    } catch (err) {
      return [];
    }
  },

  writeBudgets(array) {
    localStorageMock.setItem(LS_BUDGETS, JSON.stringify(array));
  },

  setBudget(category, monthKey, amount) {
    const budgets = this.readBudgets();
    const idx = budgets.findIndex(
      (b) => b.category === category && b.monthKey === monthKey
    );
    if (idx >= 0) {
      budgets[idx].amount = amount;
    } else {
      budgets.push({ category, monthKey, amount });
    }
    this.writeBudgets(budgets);
    return true;
  },
};

/* ------------------------------------------------------------------ */
/* Arbitraries                                                         */
/* ------------------------------------------------------------------ */

/** Generates valid "YYYY-MM" month keys (2000-01 … 2099-12). */
const monthKeyArb = fc.tuple(
  fc.integer({ min: 2000, max: 2099 }),
  fc.integer({ min: 1, max: 12 })
).map(([year, month]) => {
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}`;
});

/** Generates non-negative budget amounts (0 … 1,000,000). */
const amountArb = fc.float({ min: 0, max: 1_000_000, noNaN: true });

/** Picks a valid category from CATEGORIES. */
const categoryArb = fc.constantFrom(...CATEGORIES);

/* ------------------------------------------------------------------ */
/* Property test                                                       */
/* ------------------------------------------------------------------ */

test("Property 4: setBudget is idempotent — calling twice produces exactly one record", () => {
  fc.assert(
    fc.property(categoryArb, monthKeyArb, amountArb, (category, monthKey, amount) => {
      // Reset storage before each run
      localStorageMock.clear();

      // Call setBudget twice with the same arguments
      DataStore.setBudget(category, monthKey, amount);
      DataStore.setBudget(category, monthKey, amount);

      // Exactly one record must exist for this (category, monthKey) pair
      const budgets = DataStore.readBudgets();
      const matching = budgets.filter(
        (b) => b.category === category && b.monthKey === monthKey
      );

      return matching.length === 1;
    }),
    { numRuns: 200, verbose: true }
  );
});

test("Property 4 (amount update): second setBudget call updates the amount, not duplicates", () => {
  fc.assert(
    fc.property(
      categoryArb,
      monthKeyArb,
      amountArb,
      amountArb,
      (category, monthKey, amount1, amount2) => {
        localStorageMock.clear();

        // Set once with amount1, then again with amount2
        DataStore.setBudget(category, monthKey, amount1);
        DataStore.setBudget(category, monthKey, amount2);

        const budgets = DataStore.readBudgets();
        const matching = budgets.filter(
          (b) => b.category === category && b.monthKey === monthKey
        );

        // Still exactly one record, and its amount equals the last call
        return matching.length === 1 && matching[0].amount === amount2;
      }
    ),
    { numRuns: 200, verbose: true }
  );
});
