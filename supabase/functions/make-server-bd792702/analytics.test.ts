import { describe, it, expect } from "vitest";
import { lastDays, countByDay, countByKey, averageRating } from "./analytics";

describe("admin analytics helpers", () => {
  const now = new Date("2026-10-01T12:00:00Z");

  it("lastDays is oldest-first and ends today", () => {
    const days = lastDays(3, now);
    expect(days).toEqual(["2026-09-29", "2026-09-30", "2026-10-01"]);
  });

  it("countByDay zero-fills and ignores out-of-range timestamps", () => {
    const days = lastDays(3, now);
    const out = countByDay(["2026-10-01T01:00:00Z", "2026-10-01T23:00:00Z", "2026-09-29T00:00:00Z", "2020-01-01T00:00:00Z"], days);
    expect(out.map((d) => d.count)).toEqual([1, 0, 2]);
  });

  it("countByKey sorts most-used first", () => {
    expect(countByKey(["a", "b", "b"])).toEqual([{ name: "b", count: 2 }, { name: "a", count: 1 }]);
  });

  it("averageRating skips nulls and returns null when empty", () => {
    expect(averageRating([5, 4, null])).toBe(4.5);
    expect(averageRating([null])).toBeNull();
  });
});
