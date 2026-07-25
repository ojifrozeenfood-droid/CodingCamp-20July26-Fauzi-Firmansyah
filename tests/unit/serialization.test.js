/**
 * Task 14.4 — Property test for serialization round-trip
 *
 * Property 8: For any array of valid Transaction or Budget objects,
 * JSON.parse(JSON.stringify(arr)) produces structurally equivalent objects.
 *
 * Validates: Requirements 3.1, 3.2
 */

"use strict";

const fc = require("fast-check");

/* ------------------------------------------------------------------ */
/* Constants (inlined from js/script.js)                               */
/* ------------------------------------------------------------------ */

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
/* Arbitraries                                                         */
/* ------------------------------------------------------------------ */

/** Valid ISO 8601 date string: "YYYY-MM-DD" in the range 2000-01-01 → 2099-12-31. */
const isoDateArb = fc
  .date({ min: new Date("2000-01-01"), max: new Date("2099-12-31") })
  .map((d) => d.toISOString().slice(0, 10));

/** Valid "YYYY-MM" month key. */
const monthKeyArb = fc
  .tuple(
    fc.integer({ min: 2000, max: 2099 }),
    fc.integer({ min: 1, max: 12 })
  )
  .map(([year, month]) => `${year}-${String(month).padStart(2, "0")}`);

/** Non-empty description, max 100 printable characters. */
const descriptionArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

/** Positive finite amount suitable for finance — avoids extreme floats. */
const positiveAmountArb = fc.float({
  min: 0.01,
  max: 1_000_000_000,
  noNaN: true,
  noDefaultInfinity: true,
});

/** Non-negative amount including zero (for budgets). */
const nonNegativeAmountArb = fc.float({
  min: 0,
  max: 1_000_000_000,
  noNaN: true,
  noDefaultInfinity: true,
});

/** Complete valid Transaction object with all required fields. */
const transactionArb = fc.record({
  id:          fc.uuid(),
  type:        fc.constantFrom("income", "expense"),
  category:    fc.oneof(fc.constantFrom(...CATEGORIES), fc.constant("income")),
  description: descriptionArb,
  amount:      positiveAmountArb,
  date:        isoDateArb,
  createdAt:   fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
});

/** Complete valid Budget object: { category, monthKey, amount }. */
const budgetArb = fc.record({
  category: fc.constantFrom(...CATEGORIES),
  monthKey: monthKeyArb,
  amount:   nonNegativeAmountArb,
});

/* ------------------------------------------------------------------ */
/* Helper: deep structural equality for a single object pair          */
/* ------------------------------------------------------------------ */

/**
 * Returns true when every own-enumerable key in `original` is present in
 * `parsed` with the same value (primitive equality).
 * Numbers are compared with a small epsilon tolerance to accommodate
 * floating-point encoding; strings, booleans, and integers are exact.
 */
function shallowStructuralEqual(original, parsed) {
  for (const key of Object.keys(original)) {
    const orig = original[key];
    const pars = parsed[key];
    if (typeof orig === "number" && typeof pars === "number") {
      // Allow tiny float rounding that JSON encoding can introduce,
      // but reject any observable drift for reasonable financial values.
      if (!isFinite(orig)) {
        // Infinity / -Infinity becomes null in JSON — that is expected lossy behaviour;
        // our arbitraries exclude those, so this branch is a safety guard only.
        if (pars !== null) return false;
      } else {
        const diff = Math.abs(orig - pars);
        const tol  = Math.abs(orig) * Number.EPSILON * 2 + 1e-12;
        if (diff > tol) return false;
      }
    } else {
      if (orig !== pars) return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Property 8 — Transaction round-trip                                */
/* ------------------------------------------------------------------ */

describe("Property 8: Serialization round-trip — Transaction objects", () => {
  test("empty Transaction array survives JSON round-trip", () => {
    const result = JSON.parse(JSON.stringify([]));
    expect(result).toEqual([]);
  });

  test("single Transaction survives JSON.stringify + JSON.parse", () => {
    fc.assert(
      fc.property(transactionArb, (tx) => {
        const parsed = JSON.parse(JSON.stringify(tx));
        return shallowStructuralEqual(tx, parsed);
      }),
      { numRuns: 300 }
    );
  });

  test("array of Transactions (1–20) survives round-trip in order", () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 1, maxLength: 20 }),
        (txs) => {
          const parsed = JSON.parse(JSON.stringify(txs));
          if (parsed.length !== txs.length) return false;
          return txs.every((tx, i) => shallowStructuralEqual(tx, parsed[i]));
        }
      ),
      { numRuns: 200 }
    );
  });

  test("numeric amounts survive round-trip without floating-point drift for reasonable values", () => {
    // Spot-check representative financial values
    const amounts = [0.01, 1, 99.99, 1000, 50000, 999999.99, 1_000_000];
    for (const amount of amounts) {
      const obj    = { amount };
      const parsed = JSON.parse(JSON.stringify(obj));
      // Exact equality: these values all have exact IEEE 754 representations
      // or round-trip losslessly through JSON's numeric encoding.
      expect(parsed.amount).toBe(amount);
    }
  });

  test("string fields (id, type, category, description, date) are preserved exactly", () => {
    fc.assert(
      fc.property(transactionArb, (tx) => {
        const parsed = JSON.parse(JSON.stringify(tx));
        return (
          parsed.id          === tx.id          &&
          parsed.type        === tx.type        &&
          parsed.category    === tx.category    &&
          parsed.description === tx.description &&
          parsed.date        === tx.date
        );
      }),
      { numRuns: 300 }
    );
  });

  test("integer createdAt timestamp is preserved exactly", () => {
    fc.assert(
      fc.property(transactionArb, (tx) => {
        const parsed = JSON.parse(JSON.stringify(tx));
        return parsed.createdAt === tx.createdAt;
      }),
      { numRuns: 300 }
    );
  });
});

/* ------------------------------------------------------------------ */
/* Property 8 — Budget round-trip                                     */
/* ------------------------------------------------------------------ */

describe("Property 8: Serialization round-trip — Budget objects", () => {
  test("empty Budget array survives JSON round-trip", () => {
    const result = JSON.parse(JSON.stringify([]));
    expect(result).toEqual([]);
  });

  test("single Budget survives JSON.stringify + JSON.parse", () => {
    fc.assert(
      fc.property(budgetArb, (budget) => {
        const parsed = JSON.parse(JSON.stringify(budget));
        return shallowStructuralEqual(budget, parsed);
      }),
      { numRuns: 300 }
    );
  });

  test("array of Budgets (1–20) survives round-trip in order", () => {
    fc.assert(
      fc.property(
        fc.array(budgetArb, { minLength: 1, maxLength: 20 }),
        (budgets) => {
          const parsed = JSON.parse(JSON.stringify(budgets));
          if (parsed.length !== budgets.length) return false;
          return budgets.every((b, i) => shallowStructuralEqual(b, parsed[i]));
        }
      ),
      { numRuns: 200 }
    );
  });

  test("Budget category and monthKey strings are preserved exactly", () => {
    fc.assert(
      fc.property(budgetArb, (budget) => {
        const parsed = JSON.parse(JSON.stringify(budget));
        return (
          parsed.category === budget.category &&
          parsed.monthKey === budget.monthKey
        );
      }),
      { numRuns: 300 }
    );
  });

  test("zero Budget amount survives round-trip as exactly 0", () => {
    const zeroBudget = { category: "Belanja", monthKey: "2025-07", amount: 0 };
    const parsed = JSON.parse(JSON.stringify(zeroBudget));
    expect(parsed.amount).toBe(0);
    expect(parsed.category).toBe("Belanja");
    expect(parsed.monthKey).toBe("2025-07");
  });
});

/* ------------------------------------------------------------------ */
/* Property 8 — Mixed array round-trip                                */
/* ------------------------------------------------------------------ */

describe("Property 8: Serialization round-trip — mixed arrays", () => {
  test("mixed array of Transaction and Budget objects preserves structure", () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(transactionArb, budgetArb), {
          minLength: 1,
          maxLength: 20,
        }),
        (items) => {
          const parsed = JSON.parse(JSON.stringify(items));
          if (parsed.length !== items.length) return false;
          return items.every((item, i) =>
            shallowStructuralEqual(item, parsed[i])
          );
        }
      ),
      { numRuns: 150 }
    );
  });
});
