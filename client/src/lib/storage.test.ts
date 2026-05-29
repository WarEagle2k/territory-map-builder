import { describe, it, expect, beforeEach } from "vitest";
import {
  territoriesSchema,
  importFileSchema,
  loadTerritories,
  saveTerritories,
  loadColors,
  saveColors,
} from "./storage";

beforeEach(() => {
  localStorage.clear();
});

describe("territoriesSchema", () => {
  it("accepts a valid territory", () => {
    const r = territoriesSchema.safeParse([
      { id: 1, name: "North", color: "#3b82f6", countyFips: ["48001"] },
    ]);
    expect(r.success).toBe(true);
  });
  it("rejects a non-hex color", () => {
    const r = territoriesSchema.safeParse([
      { id: 1, name: "North", color: "blue", countyFips: [] },
    ]);
    expect(r.success).toBe(false);
  });
  it("rejects an empty name", () => {
    const r = territoriesSchema.safeParse([
      { id: 1, name: "", color: "#3b82f6", countyFips: [] },
    ]);
    expect(r.success).toBe(false);
  });
});

describe("importFileSchema", () => {
  it("accepts counties as plain FIPS strings", () => {
    const r = importFileSchema.safeParse([
      { name: "A", color: "#3b82f6", counties: ["48001", "48003"] },
    ]);
    expect(r.success).toBe(true);
  });
  it("accepts counties as objects with fips plus extra metadata", () => {
    const r = importFileSchema.safeParse([
      {
        name: "A",
        color: "#3b82f6",
        counties: [{ fips: "48001", name: "Anderson", state: "TX" }],
      },
    ]);
    expect(r.success).toBe(true);
  });
  it("rejects an entry missing a color", () => {
    const r = importFileSchema.safeParse([{ name: "A", counties: [] }]);
    expect(r.success).toBe(false);
  });
});

describe("storage round-trip", () => {
  it("saves and reloads territories", () => {
    const data = [
      { id: 1, name: "North", color: "#3b82f6", countyFips: ["48001"] },
    ];
    saveTerritories(data);
    expect(loadTerritories()).toEqual(data);
  });
  it("saves and reloads colors", () => {
    const colors = [{ name: "Blue", value: "#3b82f6" }];
    saveColors(colors);
    expect(loadColors()).toEqual(colors);
  });
  it("returns null when the stored value is not valid JSON", () => {
    localStorage.setItem("tmb:territories:v1", "{not json");
    expect(loadTerritories()).toBeNull();
  });
  it("returns null when stored data fails schema validation", () => {
    localStorage.setItem("tmb:territories:v1", JSON.stringify([{ id: 1 }]));
    expect(loadTerritories()).toBeNull();
  });
  it("returns null when nothing is stored", () => {
    expect(loadTerritories()).toBeNull();
    expect(loadColors()).toBeNull();
  });
});
