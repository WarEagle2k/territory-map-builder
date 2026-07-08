import { describe, it, expect } from "vitest";
import { computeMapFrame, type Rect } from "./export-pdf";

// A wide region (like the southeastern US) framed on a letter-landscape page
const FULL: Rect = { x: -10, y: 88, width: 820, height: 422 };
const FRAME_W = 255.4;
const FRAME_H = 150;

const coverScale = Math.max(FRAME_W / FULL.width, FRAME_H / FULL.height);

function windowOf(r: { scale: number; winX: number; winY: number }) {
  return {
    x: r.winX,
    y: r.winY,
    width: FRAME_W / r.scale,
    height: FRAME_H / r.scale,
  };
}

function contains(outer: Rect, inner: Rect, eps = 1e-6) {
  return (
    inner.x >= outer.x - eps &&
    inner.y >= outer.y - eps &&
    inner.x + inner.width <= outer.x + outer.width + eps &&
    inner.y + inner.height <= outer.y + outer.height + eps
  );
}

describe("computeMapFrame", () => {
  it("with no territories, cover-fits centered on the region", () => {
    const r = computeMapFrame(FULL, null, FRAME_W, FRAME_H);
    expect(r.scale).toBeCloseTo(coverScale, 6);
    const win = windowOf(r);
    // Centered: equal overflow on both sides
    expect(win.x - FULL.x).toBeCloseTo(
      FULL.x + FULL.width - (win.x + win.width),
      6,
    );
  });

  it("keeps plain cover framing when territories fit inside the window", () => {
    const plain = computeMapFrame(FULL, null, FRAME_W, FRAME_H);
    const core: Rect = { x: 300, y: 200, width: 100, height: 80 };
    const r = computeMapFrame(FULL, core, FRAME_W, FRAME_H);
    expect(r).toEqual(plain);
  });

  it("shifts (not zooms) for an edge territory that fits at cover scale", () => {
    const farWest: Rect = { x: FULL.x, y: 250, width: 40, height: 40 };
    const r = computeMapFrame(FULL, farWest, FRAME_W, FRAME_H);
    expect(r.scale).toBeCloseTo(coverScale, 6); // zoom preserved
    expect(contains(windowOf(r), farWest)).toBe(true);
    // Window stays inside the region — no empty space framed
    expect(r.winX).toBeGreaterThanOrEqual(FULL.x);
  });

  it("zooms out when territories span wider than the cover window", () => {
    const span: Rect = { x: FULL.x, y: 250, width: FULL.width, height: 40 };
    const r = computeMapFrame(FULL, span, FRAME_W, FRAME_H);
    expect(r.scale).toBeLessThan(coverScale);
    expect(r.scale).toBeCloseTo(FRAME_W / span.width, 6); // just enough
    expect(contains(windowOf(r), span)).toBe(true);
  });

  it("never frames outside the region when the window fits within it", () => {
    const farEast: Rect = {
      x: FULL.x + FULL.width - 40,
      y: 250,
      width: 40,
      height: 40,
    };
    const r = computeMapFrame(FULL, farEast, FRAME_W, FRAME_H);
    const win = windowOf(r);
    expect(contains(win, farEast)).toBe(true);
    expect(win.x + win.width).toBeLessThanOrEqual(FULL.x + FULL.width + 1e-6);
  });

  it("falls back to contain-fit when territories cover the whole region", () => {
    const r = computeMapFrame(FULL, FULL, FRAME_W, FRAME_H);
    const containScale = Math.min(FRAME_W / FULL.width, FRAME_H / FULL.height);
    expect(r.scale).toBeCloseTo(containScale, 6);
    expect(contains(windowOf(r), FULL)).toBe(true);
  });
});
