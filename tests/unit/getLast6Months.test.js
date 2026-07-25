/**
 * Unit tests for getLast6Months(activeMonthKey)
 * Validates: Requirements 7.2
 */

// Inline the implementation (mirrors Aggregation.getLast6Months in js/script.js)
function getLast6Months(activeMonthKey) {
  const [yearStr, monthStr] = activeMonthKey.split("-");
  let year  = parseInt(yearStr,  10);
  let month = parseInt(monthStr, 10); // 1-based

  const months = [];
  for (let i = 0; i < 6; i++) {
    months.unshift(year + "-" + String(month).padStart(2, "0"));
    month -= 1;
    if (month === 0) {
      month = 12;
      year  -= 1;
    }
  }
  return months;
}

describe("getLast6Months", () => {
  test("returns exactly 6 items", () => {
    expect(getLast6Months("2025-07")).toHaveLength(6);
  });

  test("last item equals the activeMonthKey", () => {
    expect(getLast6Months("2025-07")[5]).toBe("2025-07");
  });

  test("array is sorted in chronological ascending order", () => {
    const result = getLast6Months("2025-07");
    for (let i = 1; i < result.length; i++) {
      expect(result[i] > result[i - 1]).toBe(true);
    }
  });

  test("mid-year: 2025-07 → 2025-02 through 2025-07", () => {
    expect(getLast6Months("2025-07")).toEqual([
      "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07"
    ]);
  });

  test("year boundary: 2025-01 → 2024-08 through 2025-01", () => {
    expect(getLast6Months("2025-01")).toEqual([
      "2024-08", "2024-09", "2024-10", "2024-11", "2024-12", "2025-01"
    ]);
  });

  test("mid-year: 2024-06 → 2024-01 through 2024-06", () => {
    expect(getLast6Months("2024-06")).toEqual([
      "2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06"
    ]);
  });

  test("year boundary spanning two years: 2020-01 → 2019-08 through 2020-01", () => {
    expect(getLast6Months("2020-01")).toEqual([
      "2019-08", "2019-09", "2019-10", "2019-11", "2019-12", "2020-01"
    ]);
  });

  test("December: 2023-12 → 2023-07 through 2023-12", () => {
    expect(getLast6Months("2023-12")).toEqual([
      "2023-07", "2023-08", "2023-09", "2023-10", "2023-11", "2023-12"
    ]);
  });

  test("month values are always zero-padded two digits", () => {
    const result = getLast6Months("2025-03");
    // months 10, 11, 12, 01, 02, 03 — some single-digit, all should be zero-padded
    result.forEach((m) => {
      expect(m).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});
