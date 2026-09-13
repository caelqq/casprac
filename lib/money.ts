// frontend/lib/money.ts

// Small shared helpers so dollar<->cents conversion math lives in ONE
// place, instead of being retyped slightly differently in every
// component that displays or collects a money amount.
//
// The backend always stores and expects money as a whole number of
// CENTS (e.g. $5.50 is stored/sent as 550) — this avoids floating-point
// rounding errors. The UI, meanwhile, needs to show and collect DOLLARS
// (e.g. "5.50" in a text input, or "9,995.00" for display) because
// that's what a human expects to read and type. These two functions are
// the only places that math/formatting should happen.

// Converts a cents integer (e.g. 999500) into a display-ready dollar
// string WITH comma thousands separators (e.g. "9,995.00"). Always
// shows exactly 2 decimal places.
//
// toLocaleString("en-US") handles the comma grouping automatically at
// every scale — thousands, ten-thousands, hundred-thousands, millions,
// ten-millions, hundred-millions — so there's no manual logic needed
// per digit-group; it scales to any size number on its own.
export function centsToDollarsString(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Converts a raw string from a text input (e.g. "5.5", "5.50", "abc")
// into a whole number of cents, or `null` if the string isn't a valid
// positive number. Rounds to the nearest cent to guard against any
// floating-point artifacts from the multiplication itself (e.g.
// 0.1 * 100 can render as 9.999999999999998 in JS).
//
// NOTE: this only parses what the user TYPES (a plain input field never
// has commas in it), so no comma-stripping is needed here — commas only
// ever appear in the DISPLAY direction, via centsToDollarsString above.
export function dollarsStringToCents(value: string): number | null {
  const numericValue = parseFloat(value);

  if (isNaN(numericValue) || numericValue < 0) {
    return null;
  }

  return Math.round(numericValue * 100);
}