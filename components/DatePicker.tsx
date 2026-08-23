"use client";

// Replaces raw <input type="date"> across the app. Two problems with the
// native control drove this (reported 2026-08-23): typing a 4-digit year
// gets cut off mid-entry because the browser advances/resets the year
// segment unpredictably (ending up with things like "27/07/0002"), and its
// calendar popup is rendered by the OS — it always shows a plain white
// background no matter what the app's dark theme looks like, and can't be
// restyled at all.
//
// Three plain <select> dropdowns sidestep both: there's no typing, so
// nothing can get cut off mid-entry, and on a phone each <select> already
// opens the OS's native scroll-wheel picker — i.e. this already *is* the
// "handheld-friendly dropdown" the fix was asked for. Being plain <select>
// elements also means they're fully themeable, unlike the native date
// input's calendar popup.
//
// Use this instead of <input type="date"> everywhere, per AGENTS.md's
// "Data-sync & form standards" — that's a standing rule now, not just a
// one-off fix for the pages this pass touched.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(year: number, month: number): number {
  // month is 1-12; day 0 of the *next* month == last day of this month.
  return new Date(year, month, 0).getDate();
}

function parseIso(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function toIso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const selectCls =
  "rounded-lg border border-accent-blue/60 bg-[#173247] px-2 py-1.5 text-sm font-medium text-white outline-none " +
  "focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 [color-scheme:dark] cursor-pointer";

export default function DatePicker({
  value,
  onChange,
  className = "",
  yearRange,
  disabled,
}: {
  /** "" (empty) or an ISO "yyyy-mm-dd" string — same contract as <input type="date">.value */
  value: string;
  onChange: (v: string) => void;
  className?: string;
  /** [minYear, maxYear], inclusive. Defaults to 80 years back / 15 years forward from today. */
  yearRange?: [number, number];
  disabled?: boolean;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const [minYear, maxYear] = yearRange ?? [currentYear - 80, currentYear + 15];

  const parsed = parseIso(value);
  const y = parsed?.y ?? "";
  const m = parsed?.m ?? "";
  const d = parsed?.d ?? "";

  const years: number[] = [];
  for (let yr = maxYear; yr >= minYear; yr--) years.push(yr);

  const maxDay = y && m ? daysInMonth(Number(y), Number(m)) : 31;
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  const commit = (ny: number | "", nm: number | "", nd: number | "") => {
    if (ny === "" || nm === "" || nd === "") {
      onChange("");
      return;
    }
    const clampedDay = Math.min(Number(nd), daysInMonth(Number(ny), Number(nm)));
    onChange(toIso(Number(ny), Number(nm), clampedDay));
  };

  return (
    <div className={`flex gap-1 ${className}`}>
      <select
        aria-label="Day"
        value={d}
        disabled={disabled}
        onChange={(e) => commit(y === "" ? currentYear : y, m === "" ? now.getMonth() + 1 : m, Number(e.target.value))}
        className={`${selectCls} w-[4.2rem]`}
      >
        <option value="" disabled>
          DD
        </option>
        {days.map((day) => (
          <option key={day} value={day}>
            {day}
          </option>
        ))}
      </select>
      <select
        aria-label="Month"
        value={m}
        disabled={disabled}
        onChange={(e) => commit(y === "" ? currentYear : y, Number(e.target.value), d === "" ? 1 : d)}
        className={`${selectCls} w-[7.2rem]`}
      >
        <option value="" disabled>
          Month
        </option>
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Year"
        value={y}
        disabled={disabled}
        onChange={(e) => commit(Number(e.target.value), m === "" ? now.getMonth() + 1 : m, d === "" ? 1 : d)}
        className={`${selectCls} w-[5rem]`}
      >
        <option value="" disabled>
          YYYY
        </option>
        {years.map((yr) => (
          <option key={yr} value={yr}>
            {yr}
          </option>
        ))}
      </select>
    </div>
  );
}
