import { z } from "zod";

// --- Schemas ---

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

const territorySchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string().min(1),
  color: z.string().regex(hexColorRegex),
  countyFips: z.array(z.string()),
  title: z.string().optional(),
  branch: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

export const territoriesSchema = z.array(territorySchema);

const colorOptionSchema = z.object({
  name: z.string(),
  value: z.string().regex(hexColorRegex),
});

export const colorsSchema = z.array(colorOptionSchema);

// Schema for the exported JSON file format (counties as objects with metadata)
export const importFileSchema = z.array(
  z.object({
    name: z.string().min(1),
    color: z.string().regex(hexColorRegex),
    counties: z.array(
      z.union([
        z.string(),
        z.object({ fips: z.string() }).passthrough(),
      ])
    ),
    title: z.string().optional(),
    branch: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
  })
);

export type Territory = z.infer<typeof territorySchema>;
export type ColorOption = z.infer<typeof colorOptionSchema>;

// --- Storage helpers ---

const TERRITORIES_KEY = "tmb:territories:v1";
const COLORS_KEY = "tmb:colors:v1";

function safeParse<T>(raw: string | null, schema: z.ZodType<T>): T | null {
  if (!raw) return null;
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadTerritories(): Territory[] | null {
  if (typeof window === "undefined") return null;
  return safeParse(window.localStorage.getItem(TERRITORIES_KEY), territoriesSchema);
}

export function saveTerritories(territories: Territory[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TERRITORIES_KEY, JSON.stringify(territories));
  } catch {
    // Quota exceeded or storage disabled — fail silently
  }
}

export function loadColors(): ColorOption[] | null {
  if (typeof window === "undefined") return null;
  return safeParse(window.localStorage.getItem(COLORS_KEY), colorsSchema);
}

export function saveColors(colors: ColorOption[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLORS_KEY, JSON.stringify(colors));
  } catch {
    // Ignore
  }
}
