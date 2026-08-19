// Pure helpers for the Fitness section (2026-08-19) — BMI calculator and a
// calendar-based cycle-tracking prediction, same "pure function in lib/,
// tested by hand against known values" convention as financeUtils.ts.

export function calcBMI(weightKg: number, heightCm: number): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export type BMICategory = "Underweight" | "Healthy weight" | "Overweight" | "Obese";

export function bmiCategory(bmi: number): BMICategory {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy weight";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export const BMI_CATEGORY_COLOR: Record<BMICategory, string> = {
  Underweight: "text-accent-blue",
  "Healthy weight": "text-accent-green",
  Overweight: "text-accent-orange",
  Obese: "text-red-400",
};

// ---------------------------------------------------------------------
// Cycle tracker — standard calendar-based estimation (the same method
// most period-tracking apps use before/without basal-body-temperature or
// wearable data): average past cycle length predicts the next start,
// ovulation is estimated 14 days before the *next* predicted start (the
// luteal phase is the more consistent half of the cycle), and the fertile
// window is the 5 days before ovulation plus the day after — sperm can
// survive several days, the egg roughly one. This is an estimate, not a
// diagnosis or a contraceptive method — every screen that shows it should
// say so.
// ---------------------------------------------------------------------

export type CycleFlow = "none" | "spotting" | "light" | "medium" | "heavy";

export type CycleLogEntry = { entryDate: string; flow: CycleFlow };

/** First day of each period = a flow!=="none" day that isn't the very next day after another flow day. */
export function derivePeriodStarts(logs: CycleLogEntry[]): string[] {
  const periodDays = [...new Set(logs.filter((l) => l.flow !== "none").map((l) => l.entryDate))].sort();
  const starts: string[] = [];
  let prevTime: number | null = null;
  for (const d of periodDays) {
    const t = new Date(d + "T00:00:00").getTime();
    if (prevTime === null || (t - prevTime) / 86_400_000 > 1) starts.push(d);
    prevTime = t;
  }
  return starts;
}

export function averageCycleLength(starts: string[]): number | null {
  if (starts.length < 2) return null;
  const diffs: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const a = new Date(starts[i - 1] + "T00:00:00").getTime();
    const b = new Date(starts[i] + "T00:00:00").getTime();
    diffs.push(Math.round((b - a) / 86_400_000));
  }
  return Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length);
}

export function averagePeriodLength(logs: CycleLogEntry[], starts: string[]): number | null {
  if (starts.length === 0) return null;
  const flowDays = new Set(logs.filter((l) => l.flow !== "none").map((l) => l.entryDate));
  const lengths: number[] = [];
  for (const start of starts) {
    let len = 0;
    let d = new Date(start + "T00:00:00");
    while (flowDays.has(d.toISOString().slice(0, 10))) {
      len++;
      d = new Date(d.getTime() + 86_400_000);
    }
    if (len > 0) lengths.push(len);
  }
  if (lengths.length === 0) return null;
  return Math.round(lengths.reduce((s, l) => s + l, 0) / lengths.length);
}

export type CyclePrediction = {
  lastStart: string | null;
  cycleDay: number | null;
  avgCycleLength: number;
  avgPeriodLength: number;
  predictedNextStart: string | null;
  ovulationEstimate: string | null;
  fertileWindowStart: string | null;
  fertileWindowEnd: string | null;
  usingDefaultCycleLength: boolean;
};

const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;

export function predictCycle(logs: CycleLogEntry[], today: Date = new Date()): CyclePrediction {
  const starts = derivePeriodStarts(logs);
  const avgLen = averageCycleLength(starts);
  const avgPeriod = averagePeriodLength(logs, starts) ?? DEFAULT_PERIOD_LENGTH;
  const usingDefaultCycleLength = avgLen === null;
  const cycleLength = avgLen ?? DEFAULT_CYCLE_LENGTH;
  const lastStart = starts.length > 0 ? starts[starts.length - 1] : null;

  let cycleDay: number | null = null;
  let predictedNextStart: string | null = null;
  let ovulationEstimate: string | null = null;
  let fertileWindowStart: string | null = null;
  let fertileWindowEnd: string | null = null;

  if (lastStart) {
    const lastStartDate = new Date(lastStart + "T00:00:00");
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    cycleDay = Math.round((todayMid.getTime() - lastStartDate.getTime()) / 86_400_000) + 1;

    const nextStartDate = new Date(lastStartDate.getTime() + cycleLength * 86_400_000);
    predictedNextStart = nextStartDate.toISOString().slice(0, 10);

    const ovulationDate = new Date(nextStartDate.getTime() - 14 * 86_400_000);
    ovulationEstimate = ovulationDate.toISOString().slice(0, 10);
    fertileWindowStart = new Date(ovulationDate.getTime() - 5 * 86_400_000).toISOString().slice(0, 10);
    fertileWindowEnd = new Date(ovulationDate.getTime() + 1 * 86_400_000).toISOString().slice(0, 10);
  }

  return {
    lastStart,
    cycleDay,
    avgCycleLength: cycleLength,
    avgPeriodLength: avgPeriod,
    predictedNextStart,
    ovulationEstimate,
    fertileWindowStart,
    fertileWindowEnd,
    usingDefaultCycleLength,
  };
}
