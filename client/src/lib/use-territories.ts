import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { TERRITORY_COLORS } from "@/lib/territory-colors";
import {
  loadTerritories,
  saveTerritories,
  loadColors,
  saveColors,
  type Territory as StoredTerritory,
  type ColorOption,
} from "@/lib/storage";
import type { ClientTerritory } from "@/pages/home";

function nextIdFrom(territories: { id: number }[]): number {
  return territories.length === 0
    ? 1
    : Math.max(...territories.map((t) => t.id)) + 1;
}

/**
 * Owns the territory editing model: the territories, the color palette, the
 * current county selection, which territory is being re-edited, and every
 * operation on them — plus localStorage persistence. Keeping it here lets the
 * page component stay focused on layout and view-only state.
 */
export function useTerritories() {
  const [territories, setTerritories] = useState<ClientTerritory[]>(
    () => loadTerritories() ?? []
  );
  const [colors, setColors] = useState<ColorOption[]>(
    () => loadColors() ?? TERRITORY_COLORS
  );
  const [selectedCounties, setSelectedCounties] = useState<Set<string>>(
    new Set()
  );
  const [selectedColor, setSelectedColor] = useState(
    colors[0]?.value ?? "#3b82f6"
  );
  const [editingTerritoryId, setEditingTerritoryId] = useState<number | null>(
    null
  );
  const nextIdRef = useRef(nextIdFrom(territories));

  // --- Persistence ---
  // Mount-guard is CRITICAL: loadTerritories()/loadColors() return null on a
  // schema/parse/quota failure, so useState falls back to [] / defaults.
  // Without the guard the effect would fire on the initial mount and overwrite
  // whatever was in localStorage with that empty fallback — silently wiping the
  // user's real data. Skipping the first run persists only real changes.
  const didMountTerritories = useRef(false);
  useEffect(() => {
    if (!didMountTerritories.current) {
      didMountTerritories.current = true;
      return;
    }
    saveTerritories(territories as StoredTerritory[]);
  }, [territories]);

  const didMountColors = useRef(false);
  useEffect(() => {
    if (!didMountColors.current) {
      didMountColors.current = true;
      return;
    }
    saveColors(colors);
  }, [colors]);

  // Counties already assigned to a territory (excluding the one being edited).
  const assignedCounties = useMemo(() => {
    const set = new Set<string>();
    for (const t of territories) {
      if (t.id === editingTerritoryId) continue;
      for (const fips of t.countyFips) set.add(fips);
    }
    return set;
  }, [territories, editingTerritoryId]);

  // --- Colors ---
  const addColor = useCallback((hex: string) => {
    const normalized = hex.startsWith("#")
      ? hex.toLowerCase()
      : `#${hex.toLowerCase()}`;
    setColors((prev) => {
      if (prev.some((c) => c.value.toLowerCase() === normalized)) return prev;
      return [...prev, { name: normalized.toUpperCase(), value: normalized }];
    });
  }, []);

  const removeColor = useCallback(
    (value: string) => {
      setColors((prev) => {
        const next = prev.filter((c) => c.value !== value);
        if (selectedColor === value && next.length > 0) {
          setSelectedColor(next[0].value);
        }
        return next;
      });
    },
    [selectedColor]
  );

  // --- County selection ---
  const selectCounty = useCallback(
    (fips: string) => {
      if (assignedCounties.has(fips)) return;
      setSelectedCounties((prev) => {
        const next = new Set(prev);
        if (next.has(fips)) next.delete(fips);
        else next.add(fips);
        return next;
      });
    },
    [assignedCounties]
  );

  const dragSelectCounties = useCallback(
    (fipsList: string[]) => {
      setSelectedCounties((prev) => {
        const next = new Set(prev);
        for (const fips of fipsList) {
          if (!assignedCounties.has(fips)) next.add(fips);
        }
        return next;
      });
    },
    [assignedCounties]
  );

  const clearSelection = useCallback(() => {
    setSelectedCounties(new Set());
  }, []);

  // --- Territory CRUD ---
  const createTerritory = useCallback(
    (name: string, color: string, counties: string[]) => {
      setTerritories((prev) => {
        const id = nextIdRef.current++;
        return [...prev, { id, name, color, countyFips: counties }];
      });
      setSelectedCounties(new Set());
    },
    []
  );

  const updateTerritory = useCallback(
    (
      id: number,
      updates: Partial<
        Pick<
          ClientTerritory,
          "name" | "color" | "title" | "branch" | "phone" | "email"
        >
      >
    ) => {
      setTerritories((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
    },
    []
  );

  const deleteTerritory = useCallback(
    (id: number) => {
      const target = territories.find((t) => t.id === id);
      const confirmed = window.confirm(
        `Delete territory "${target?.name ?? ""}"? This cannot be undone.`
      );
      if (!confirmed) return;
      setTerritories((prev) => prev.filter((t) => t.id !== id));
      if (editingTerritoryId === id) {
        setEditingTerritoryId(null);
        setSelectedCounties(new Set());
      }
    },
    [territories, editingTerritoryId]
  );

  // --- Re-editing an existing territory's counties ---
  const startEditingCounties = useCallback(
    (id: number) => {
      const territory = territories.find((t) => t.id === id);
      if (!territory) return;
      setEditingTerritoryId(id);
      setSelectedCounties(new Set(territory.countyFips));
      setSelectedColor(territory.color);
    },
    [territories]
  );

  const saveEditingCounties = useCallback(() => {
    if (editingTerritoryId === null) return;
    setTerritories((prev) =>
      prev.map((t) =>
        t.id === editingTerritoryId
          ? { ...t, countyFips: Array.from(selectedCounties) }
          : t
      )
    );
    setEditingTerritoryId(null);
    setSelectedCounties(new Set());
  }, [editingTerritoryId, selectedCounties]);

  const cancelEditingCounties = useCallback(() => {
    setEditingTerritoryId(null);
    setSelectedCounties(new Set());
  }, []);

  const clearAll = useCallback(() => {
    if (territories.length === 0) return;
    const confirmed = window.confirm(
      `Delete all ${territories.length} territor${
        territories.length === 1 ? "y" : "ies"
      }? This cannot be undone.`
    );
    if (!confirmed) return;
    setTerritories([]);
    setEditingTerritoryId(null);
    setSelectedCounties(new Set());
    nextIdRef.current = 1;
  }, [territories.length]);

  // Replace the whole set (used by import); resets selection, editing, and ids.
  const replaceAll = useCallback((next: ClientTerritory[]) => {
    setTerritories(next);
    nextIdRef.current = nextIdFrom(next);
    setEditingTerritoryId(null);
    setSelectedCounties(new Set());
  }, []);

  return {
    territories,
    colors,
    selectedCounties,
    selectedColor,
    editingTerritoryId,
    assignedCounties,
    setSelectedColor,
    addColor,
    removeColor,
    selectCounty,
    dragSelectCounties,
    clearSelection,
    createTerritory,
    updateTerritory,
    deleteTerritory,
    startEditingCounties,
    saveEditingCounties,
    cancelEditingCounties,
    clearAll,
    replaceAll,
  };
}
