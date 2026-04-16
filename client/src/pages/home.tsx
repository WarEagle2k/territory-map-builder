import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import TerritoryMap from "@/components/TerritoryMap";
import TerritoryPanel from "@/components/TerritoryPanel";
import MapLegend from "@/components/MapLegend";
import { Map, PanelLeftClose, PanelLeft, Download, Upload, FileDown, Trash2 } from "lucide-react";
import { exportTerritoryPDF } from "@/lib/export-pdf";
import { Button } from "@/components/ui/button";
import { TERRITORY_COLORS } from "@/lib/territory-colors";
import {
  loadTerritories,
  saveTerritories,
  loadColors,
  saveColors,
  importFileSchema,
  type Territory as StoredTerritory,
} from "@/lib/storage";

export interface ClientTerritory {
  id: number;
  name: string;
  color: string;
  countyFips: string[];
}

interface CountyInfo {
  name: string;
  state: string;
}

// Derive next ID from an array of territories so imports/restores can't clash
function nextIdFrom(territories: { id: number }[]): number {
  return territories.length === 0
    ? 1
    : Math.max(...territories.map((t) => t.id)) + 1;
}

export default function Home() {
  // Load once on mount from localStorage, fall back to empty / default palette
  const [territories, setTerritories] = useState<ClientTerritory[]>(
    () => loadTerritories() ?? []
  );
  const [colors, setColors] = useState(() => loadColors() ?? TERRITORY_COLORS);

  const nextIdRef = useRef(nextIdFrom(territories));

  const [selectedCounties, setSelectedCounties] = useState<Set<string>>(new Set());
  const [hoveredCounty, setHoveredCounty] = useState<{
    fips: string;
    name: string;
    state: string;
  } | null>(null);
  const [highlightTerritoryId, setHighlightTerritoryId] = useState<number | null>(null);
  const [countyNames, setCountyNames] = useState<Record<string, CountyInfo>>({});
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedColor, setSelectedColor] = useState(colors[0]?.value ?? "#3b82f6");
  const [editingTerritoryId, setEditingTerritoryId] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Persistence ---
  useEffect(() => {
    saveTerritories(territories as StoredTerritory[]);
  }, [territories]);

  useEffect(() => {
    saveColors(colors);
  }, [colors]);

  // Clear import error after a few seconds
  useEffect(() => {
    if (!importError) return;
    const id = setTimeout(() => setImportError(null), 5000);
    return () => clearTimeout(id);
  }, [importError]);

  // Load county names
  useEffect(() => {
    fetch("./county-names.json")
      .then((r) => r.json())
      .then(setCountyNames)
      .catch(() => {});
  }, []);

  // --- Color management ---
  const handleAddColor = useCallback((hex: string) => {
    const normalized = hex.startsWith("#") ? hex.toLowerCase() : `#${hex.toLowerCase()}`;
    setColors((prev) => {
      if (prev.some((c) => c.value.toLowerCase() === normalized)) return prev;
      return [...prev, { name: normalized.toUpperCase(), value: normalized }];
    });
  }, []);

  const handleRemoveColor = useCallback((value: string) => {
    setColors((prev) => {
      const next = prev.filter((c) => c.value !== value);
      // If the removed color was selected, switch to first remaining
      if (selectedColor === value && next.length > 0) {
        setSelectedColor(next[0].value);
      }
      return next;
    });
  }, [selectedColor]);

  // --- County selection ---
  const assignedCounties = useMemo(() => {
    const set = new Set<string>();
    for (const t of territories) {
      if (t.id === editingTerritoryId) continue;
      for (const fips of t.countyFips) {
        set.add(fips);
      }
    }
    return set;
  }, [territories, editingTerritoryId]);

  const handleCountyClick = useCallback(
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

  const handleCountyHover = useCallback(
    (info: { fips: string; name: string; state: string } | null) => {
      setHoveredCounty(info);
    },
    []
  );

  const handleCountiesDrag = useCallback(
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

  const handleClearSelection = useCallback(() => {
    setSelectedCounties(new Set());
  }, []);

  // --- Territory CRUD ---
  const handleCreateTerritory = useCallback(
    (name: string, color: string, counties: string[]) => {
      setTerritories((prev) => {
        const id = nextIdRef.current++;
        return [...prev, { id, name, color, countyFips: counties }];
      });
      setSelectedCounties(new Set());
    },
    []
  );

  const handleUpdateTerritory = useCallback(
    (id: number, updates: Partial<Pick<ClientTerritory, "name" | "color">>) => {
      setTerritories((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
    },
    []
  );

  const handleDeleteTerritory = useCallback((id: number) => {
    setTerritories((prev) => prev.filter((t) => t.id !== id));
    if (editingTerritoryId === id) {
      setEditingTerritoryId(null);
      setSelectedCounties(new Set());
    }
  }, [editingTerritoryId]);

  const handleEditTerritoryCounties = useCallback((id: number) => {
    const territory = territories.find((t) => t.id === id);
    if (!territory) return;
    setEditingTerritoryId(id);
    setSelectedCounties(new Set(territory.countyFips));
    setSelectedColor(territory.color);
  }, [territories]);

  const handleSaveTerritoryCounties = useCallback(() => {
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

  const handleCancelEditCounties = useCallback(() => {
    setEditingTerritoryId(null);
    setSelectedCounties(new Set());
  }, []);

  const handleClearAllTerritories = useCallback(() => {
    if (territories.length === 0) return;
    const confirmed = window.confirm(
      `Delete all ${territories.length} territor${territories.length === 1 ? "y" : "ies"}? This cannot be undone.`
    );
    if (!confirmed) return;
    setTerritories([]);
    setEditingTerritoryId(null);
    setSelectedCounties(new Set());
    nextIdRef.current = 1;
  }, [territories.length]);

  // --- Export / Import ---
  const handleExportPDF = useCallback(() => {
    const svgEl = document.querySelector(
      "[data-testid='territory-map-svg']"
    ) as SVGSVGElement | null;
    if (!svgEl) return;
    exportTerritoryPDF(svgEl, territories, countyNames);
  }, [territories, countyNames]);

  const handleExport = useCallback(() => {
    const data = territories.map((t) => ({
      name: t.name,
      color: t.color,
      counties: t.countyFips.map((fips) => ({
        fips,
        name: countyNames[fips]?.name || fips,
        state: countyNames[fips]?.state || "",
      })),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "territories.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [territories, countyNames]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target?.result as string);
          const result = importFileSchema.safeParse(parsed);
          if (!result.success) {
            setImportError(
              "Invalid file format. Expected an array of territories with name, color, and counties."
            );
            return;
          }

          // Renumber IDs from 1 so imports don't clash with existing
          let counter = 1;
          const imported: ClientTerritory[] = result.data.map((item) => ({
            id: counter++,
            name: item.name,
            color: item.color,
            countyFips: item.counties.map((c) =>
              typeof c === "string" ? c : c.fips
            ),
          }));
          setTerritories(imported);
          nextIdRef.current = nextIdFrom(imported);
          setEditingTerritoryId(null);
          setSelectedCounties(new Set());
        } catch {
          setImportError("Could not parse file — is it valid JSON?");
        }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    []
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-12 border-b border-border flex items-center px-4 gap-3 flex-shrink-0 bg-card">
        <Map className="w-5 h-5 text-primary" />
        <h1 className="text-sm font-semibold" data-testid="app-title">
          Territory Map Builder
        </h1>

        <div className="ml-auto flex items-center gap-2">
          {hoveredCounty && (
            <div
              className="text-xs text-muted-foreground hidden sm:block"
              data-testid="hovered-county-info"
            >
              <span className="font-medium text-foreground">
                {hoveredCounty.name}
              </span>
              , {hoveredCounty.state}
              {assignedCounties.has(hoveredCounty.fips) && (
                <span className="ml-1 text-primary">(assigned)</span>
              )}
            </div>
          )}

          {territories.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportPDF}
                data-testid="export-pdf-btn"
                title="Export as PDF"
              >
                <FileDown className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                data-testid="export-btn"
                title="Export as JSON"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAllTerritories}
                data-testid="clear-all-btn"
                title="Clear all territories"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            data-testid="import-btn"
            title="Import territories"
          >
            <Upload className="w-4 h-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPanelOpen(!panelOpen)}
            data-testid="toggle-panel-btn"
          >
            {panelOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeft className="w-4 h-4" />
            )}
          </Button>
        </div>
      </header>

      {/* Import error banner */}
      {importError && (
        <div
          className="px-4 py-2 bg-destructive/10 text-destructive text-xs border-b border-destructive/20"
          data-testid="import-error"
          role="alert"
        >
          {importError}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <TerritoryMap
            territories={territories}
            selectedCounties={selectedCounties}
            selectedColor={selectedColor}
            onCountyClick={handleCountyClick}
            onCountyHover={handleCountyHover}
            onCountiesDrag={handleCountiesDrag}
            highlightTerritoryId={highlightTerritoryId}
            editingTerritoryId={editingTerritoryId}
          />
          <MapLegend
            territories={territories}
            onHighlight={setHighlightTerritoryId}
          />
        </div>

        {panelOpen && (
          <div className="w-80 border-l border-border bg-card flex-shrink-0 overflow-hidden">
            <TerritoryPanel
              territories={territories}
              selectedCounties={selectedCounties}
              selectedColor={selectedColor}
              colors={colors}
              onColorChange={setSelectedColor}
              onAddColor={handleAddColor}
              onRemoveColor={handleRemoveColor}
              onClearSelection={handleClearSelection}
              onHighlightTerritory={setHighlightTerritoryId}
              onCreateTerritory={handleCreateTerritory}
              onUpdateTerritory={handleUpdateTerritory}
              onDeleteTerritory={handleDeleteTerritory}
              onEditTerritoryCounties={handleEditTerritoryCounties}
              onSaveTerritoryCounties={handleSaveTerritoryCounties}
              onCancelEditCounties={handleCancelEditCounties}
              editingTerritoryId={editingTerritoryId}
              countyNames={countyNames}
            />
          </div>
        )}
      </div>
    </div>
  );
}
