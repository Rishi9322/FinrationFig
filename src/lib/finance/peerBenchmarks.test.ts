import { describe, it, expect } from "vitest";
import { peerPosition, listPeerIndustries, ALL_PEERS } from "./peerBenchmarks";

describe("peerPosition", () => {
  it("lists the industries that have enough companies for their own distribution", () => {
    const names = listPeerIndustries();
    expect(names.length).toBeGreaterThan(30);
    expect(names).toContain("Construction");
    expect(names.length).toBeLessThan(60); // only industries with >= 15 companies get their own distribution
  });

  it("a value at the peer median beats about half of peers, whichever direction is better", () => {
    const de = peerPosition("de", 0.237)!; // all-company median debt/equity
    const cr = peerPosition("cr", 1.784)!; // all-company median current ratio
    expect(de.betterThanPct).toBeGreaterThanOrEqual(45);
    expect(de.betterThanPct).toBeLessThanOrEqual(55);
    expect(cr.betterThanPct).toBeGreaterThanOrEqual(45);
    expect(cr.betterThanPct).toBeLessThanOrEqual(55);
    expect(de.scope).toBe(ALL_PEERS);
  });

  it("low leverage ranks well and high leverage ranks badly; coverage the other way round", () => {
    expect(peerPosition("de", 0)!.betterThanPct).toBeGreaterThan(90);
    expect(peerPosition("de", 8)!.betterThanPct).toBeLessThanOrEqual(5);
    expect(peerPosition("icr", 150)!.betterThanPct).toBeGreaterThan(90);
    expect(peerPosition("icr", 0.5)!.betterThanPct).toBeLessThan(25);
  });

  it("uses the industry's own distribution when it has one, and says so", () => {
    const p = peerPosition("opm", 12, "Construction")!;
    expect(p.scope).toBe("Construction");
    expect(p.peers).toBeGreaterThan(100);
    expect(p.median).toBeGreaterThan(8);
    // The same margin is far better in low-margin Trading than in Construction.
    expect(peerPosition("opm", 12, "Trading")!.betterThanPct).toBeGreaterThan(p.betterThanPct);
  });

  it("falls back to all companies for an unknown industry, and gives nothing for a missing value", () => {
    expect(peerPosition("cr", 2, "No Such Industry")!.scope).toBe(ALL_PEERS);
    expect(peerPosition("cr", null)).toBeNull();
    expect(peerPosition("cr", NaN)).toBeNull();
  });
});
