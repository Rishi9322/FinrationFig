// Pure aggregation helpers for the admin analytics endpoint (no Deno/Supabase APIs,
// so vitest can import this file directly).

export const ANALYTICS_DAYS = 30;

/** UTC `YYYY-MM-DD` keys for the last `days` days, oldest first, ending today. */
export function lastDays(days: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

/** Zero-filled per-day counts for the given ISO timestamps. */
export function countByDay(timestamps: string[], days: string[]): { date: string; count: number }[] {
  const counts = new Map(days.map((d) => [d, 0]));
  for (const ts of timestamps) {
    const day = String(ts).slice(0, 10);
    if (counts.has(day)) counts.set(day, counts.get(day)! + 1);
  }
  return days.map((date) => ({ date, count: counts.get(date)! }));
}

/** Most-used first. */
export function countByKey(keys: string[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

/** Mean rating rounded to 1 dp, or null when nothing has been rated. */
export function averageRating(ratings: (number | null)[]): number | null {
  const rated = ratings.filter((r): r is number => typeof r === "number");
  if (!rated.length) return null;
  return Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10;
}
