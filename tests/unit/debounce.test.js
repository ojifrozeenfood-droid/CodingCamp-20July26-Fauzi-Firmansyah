/**
 * Task 13.4 — Property test for debounce
 *
 * Property: For any function and delay, calling the debounced wrapper N times
 * rapidly must result in the function being called exactly once after the delay.
 *
 * The debounce helper is defined inside initApp() in js/script.js.
 * It is re-declared here verbatim for testing since the source has no module
 * exports (plain vanilla JS, no bundler).
 *
 * Validates: Requirements 9.4
 */

"use strict";

/* ------------------------------------------------------------------ */
/* debounce — verbatim copy from js/script.js (initApp local function) */
/* ------------------------------------------------------------------ */

function debounce(fn, delay) {
  let timer;
  return function () {
    clearTimeout(timer);
    const args = arguments;
    const ctx  = this;
    timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
  };
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("debounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ------------------------------------------------------------------
  // Core burst-suppression test
  // ------------------------------------------------------------------

  test("calling debounced fn 5 times rapidly → 0 calls immediately, 1 call after delay", () => {
    const fn = jest.fn();
    const delay = 150;
    const debounced = debounce(fn, delay);

    // Fire 5 times with no timer advancement
    debounced();
    debounced();
    debounced();
    debounced();
    debounced();

    // No call should have happened yet
    expect(fn).toHaveBeenCalledTimes(0);

    // Advance past the delay
    jest.advanceTimersByTime(delay);

    // Exactly one call after the burst
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // Single-call test
  // ------------------------------------------------------------------

  test("calling once → called exactly 1 time after delay", () => {
    const fn = jest.fn();
    const delay = 200;
    const debounced = debounce(fn, delay);

    debounced();

    expect(fn).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(delay);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // Two separate bursts → two total calls
  // ------------------------------------------------------------------

  test("calling, waiting for delay, calling again → called twice total (once per burst)", () => {
    const fn = jest.fn();
    const delay = 100;
    const debounced = debounce(fn, delay);

    // First burst
    debounced();
    debounced();
    jest.advanceTimersByTime(delay);

    expect(fn).toHaveBeenCalledTimes(1);

    // Second burst
    debounced();
    debounced();
    debounced();
    jest.advanceTimersByTime(delay);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  // ------------------------------------------------------------------
  // Timer reset: intermediate calls must reset the countdown
  // ------------------------------------------------------------------

  test("calls within the delay window reset the timer — fn fires only after last call + delay", () => {
    const fn = jest.fn();
    const delay = 100;
    const debounced = debounce(fn, delay);

    debounced();
    jest.advanceTimersByTime(50);  // 50 ms in — not yet fired

    debounced();                   // reset the timer
    jest.advanceTimersByTime(50);  // only 50 ms past the reset — still not fired

    expect(fn).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(50);  // now 100 ms past the last call

    expect(fn).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // Argument forwarding: the debounced wrapper forwards args correctly
  // ------------------------------------------------------------------

  test("forwarded arguments reach the wrapped function", () => {
    const fn = jest.fn();
    const delay = 50;
    const debounced = debounce(fn, delay);

    debounced("hello", 42);
    jest.advanceTimersByTime(delay);

    expect(fn).toHaveBeenCalledWith("hello", 42);
  });

  // ------------------------------------------------------------------
  // Different delays: property-style sweep over several delay values
  // ------------------------------------------------------------------

  test.each([0, 1, 50, 150, 500])(
    "burst of 10 calls with delay=%ims → exactly 1 call after delay",
    (delay) => {
      const fn = jest.fn();
      const debounced = debounce(fn, delay);

      for (let i = 0; i < 10; i++) {
        debounced();
      }

      // Nothing before delay elapses (for delay > 0)
      if (delay > 0) {
        jest.advanceTimersByTime(delay - 1);
        expect(fn).toHaveBeenCalledTimes(0);
      }

      jest.advanceTimersByTime(delay > 0 ? 1 : 0);

      expect(fn).toHaveBeenCalledTimes(1);
    }
  );
});
