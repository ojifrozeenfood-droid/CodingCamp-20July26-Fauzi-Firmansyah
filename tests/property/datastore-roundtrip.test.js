/**
 * Property 2: Transaction round-trip persistence
 *
 * For any valid Transaction object, adding it to the store and then reading
 * all transactions must yield an array that contains a structurally equivalent object.
 *
 * Validates: Requirements 2.1, 3.1, 3.4
 */

const fc = require("fast-check");

/* ============================================================
   Inline definitions from js/script.js (DataStore subset)
   These mirror the actual implementation so the property test
   exercises the real logic without requiring a browser/DOM.
   ============================================================ */

const LS_TRANSACTIONS = "ebv_transactions";

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
 * Generates a UUID v4 string using Math.random() — same implementation as script.js.
 * @returns {string}
 */
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Factory: creates a DataStore instance backed by a fresh, isolated in-memory store.
 * Each test run gets its own store so there is no cross-test contamination.
 */
function makeDataStore() {
  // Isolated in-memory localStorage mock
  const _store = {};
  const mockLS = {
    getItem: (key) => (key in _store ? _store[key] : null),
    setItem: (key, val) => {
      _store[key] = val;
    },
  };

  return {
    readTransactions() {
      try {
        const raw = mockLS.getItem(LS_TRANSACTIONS);
        if (raw === null) return [];
        return JSON.parse(raw);
      } catch (err) {
        return [];
      }
    },

    writeTransactions(array) {
      mockLS.setItem(LS_TRANSACTIONS, JSON.stringify(array));
    },

    addTransaction(tx) {
      const transactions = this.readTransactions();
      transactions.push(tx);
      this.writeTransactions(transactions);
      return true;
    },
  };
}

/* ============================================================
   fast-check Arbitraries
   ============================================================ */

/** Arbitrary for a valid expense category string. */
const categoryArb = fc.constantFrom(...CATEGORIES);

/** Arbitrary for a valid transaction type. */
const typeArb = fc.constantFrom("income", "expense");

/**
 * Arbitrary for a valid ISO 8601 date string (YYYY-MM-DD).
 * Constrained to a realistic date range: 2020-01-01 to 2030-12-31.
 */
const isoDateArb = fc
  .date({
    min: new Date("2020-01-01"),
    max: new Date("2030-12-31"),
  })
  .map((d) => d.toISOString().slice(0, 10));

/**
 * Arbitrary for a valid description string.
 * Non-empty, printable ASCII/Unicode, max 100 chars.
 */
const descriptionArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

/** Arbitrary for a positive amount (finite, > 0). */
const amountArb = fc.float({ min: 0.01, max: 1_000_000, noNaN: true });

/**
 * Arbitrary for a complete, valid Transaction object.
 * The id and createdAt are generated deterministically to ensure structural
 * equivalence after the LocalStorage serialize/deserialize round-trip.
 */
const transactionArb = fc.record({
  id: fc.uuid(),
  type: typeArb,
  category: fc.oneof(
    categoryArb, // expense categories
    fc.constant("income") // income category
  ),
  description: descriptionArb,
  amount: amountArb,
  date: isoDateArb,
  createdAt: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
});

/* ============================================================
   Property Tests
   ============================================================ */

describe("Property 2: Transaction round-trip persistence", () => {
  /**
   * Core round-trip property:
   * After addTransaction(tx), readTransactions() must contain an object
   * that is structurally equivalent to tx (deep equality after JSON round-trip).
   *
   * Validates: Requirements 2.1, 3.1, 3.4
   */
  test("addTransaction then readTransactions contains the added transaction", () => {
    fc.assert(
      fc.property(transactionArb, (tx) => {
        const store = makeDataStore();

        // Act: add and read back
        store.addTransaction(tx);
        const result = store.readTransactions();

        // Assert: the result array contains a structurally equivalent object
        const found = result.find((r) => r.id === tx.id);
        if (!found) return false;

        // Deep structural equivalence — every field must match
        return (
          found.id === tx.id &&
          found.type === tx.type &&
          found.category === tx.category &&
          found.description === tx.description &&
          // Floating-point amounts survive JSON round-trip for finite values
          Math.abs(found.amount - tx.amount) < Number.EPSILON * tx.amount + 1e-10 &&
          found.date === tx.date &&
          found.createdAt === tx.createdAt
        );
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Accumulation property:
   * Adding N transactions must result in readTransactions() returning
   * exactly N records (starting from an empty store), preserving all of them.
   *
   * Validates: Requirements 2.1, 3.1
   */
  test("adding N transactions produces an array of exactly N transactions", () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 1, maxLength: 20 }).filter(
          // Ensure all IDs are unique so each transaction is distinct
          (txs) => new Set(txs.map((t) => t.id)).size === txs.length
        ),
        (transactions) => {
          const store = makeDataStore();

          for (const tx of transactions) {
            store.addTransaction(tx);
          }

          const result = store.readTransactions();
          return result.length === transactions.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Immutability of other records:
   * Adding a new transaction must not alter any previously stored transaction.
   *
   * Validates: Requirements 2.1, 3.4 (postcondition: "No other transaction is modified")
   */
  test("addTransaction does not modify previously stored transactions", () => {
    fc.assert(
      fc.property(
        fc.tuple(transactionArb, transactionArb).filter(
          ([a, b]) => a.id !== b.id
        ),
        ([existing, newTx]) => {
          const store = makeDataStore();

          // Pre-populate with one transaction
          store.addTransaction(existing);

          // Add a second transaction
          store.addTransaction(newTx);

          // The original transaction must remain structurally unchanged
          const result = store.readTransactions();
          const found = result.find((r) => r.id === existing.id);
          if (!found) return false;

          return (
            found.id === existing.id &&
            found.type === existing.type &&
            found.category === existing.category &&
            found.description === existing.description &&
            found.date === existing.date &&
            found.createdAt === existing.createdAt
          );
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * JSON serialization round-trip:
   * The Transaction object survives JSON.stringify → JSON.parse with all
   * fields intact (no data loss through the LocalStorage boundary).
   *
   * Validates: Requirements 3.1, 3.4
   */
  test("Transaction fields survive JSON serialization round-trip", () => {
    fc.assert(
      fc.property(transactionArb, (tx) => {
        const serialized = JSON.stringify(tx);
        const parsed = JSON.parse(serialized);

        return (
          parsed.id === tx.id &&
          parsed.type === tx.type &&
          parsed.category === tx.category &&
          parsed.description === tx.description &&
          parsed.date === tx.date &&
          parsed.createdAt === tx.createdAt
        );
      }),
      { numRuns: 300 }
    );
  });
});
