import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import TerritoryMap from "@/components/TerritoryMap";
import TerritoryPanel from "@/components/TerritoryPanel";
import MapLegend from "@/components/MapLegend";
import RepDetailsDialog from "@/components/RepDetailsDialog";
import { PanelLeftClose, PanelLeft, Download, Upload, FileDown, Trash2 } from "lucide-react";
import { exportTerritoryPDF } from "@/lib/export-pdf";
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
  title?: string;
  branch?: string;
  phone?: string;
  email?: string;
}

interface CountyInfo {
  name: string;
  state: string;
}

function nextIdFrom(territories: { id: number }[]): number {
  return territories.length === 0
    ? 1
    : Math.max(...territories.map((t) => t.id)) + 1;
}

// Compact icon button used only in the branded header (white text on teal bg)
// Shows a styled tooltip on hover/focus.
function HeaderButton({
  onClick,
  title,
  testId,
  destructive,
  children,
}: {
  onClick: () => void;
  title: string;
  testId?: string;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        aria-label={title}
        data-testid={testId}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors
          ${destructive
            ? "text-white/85 hover:bg-red-500/80 hover:text-white"
            : "text-white/85 hover:bg-white/15 hover:text-white"}
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-gold))]`}
      >
        {children}
      </button>
      {/* Tooltip */}
      <div
        role="tooltip"
        className="pointer-events-none absolute top-full right-0 mt-2 z-50
                   whitespace-nowrap rounded-md bg-slate-900 px-2 py-1
                   text-[11px] font-medium text-white shadow-lg
                   opacity-0 scale-95 translate-y-0.5
                   transition-all duration-150
                   group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0
                   group-focus-within:opacity-100 group-focus-within:scale-100 group-focus-within:translate-y-0"
      >
        {title}
        {/* Little arrow pointing up at the button */}
        <span
          aria-hidden
          className="absolute -top-1 right-3 w-2 h-2 rotate-45 bg-slate-900"
        />
      </div>
    </div>
  );
}

export default function Home() {
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
  const [detailsId, setDetailsId] = useState<number | null>(null);
  // TEMPORARY opacity tuning slider — remove once we settle on a value
  const [territoryOpacity, setTerritoryOpacity] = useState(0.5);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Persistence ---
  useEffect(() => {
    saveTerritories(territories as StoredTerritory[]);
  }, [territories]);

  useEffect(() => {
    saveColors(colors);
  }, [colors]);

  useEffect(() => {
    if (!importError) return;
    const id = setTimeout(() => setImportError(null), 5000);
    return () => clearTimeout(id);
  }, [importError]);

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
      for (const fips of t.countyFips) set.add(fips);
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
    (
      id: number,
      updates: Partial<
        Pick<ClientTerritory, "name" | "color" | "title" | "branch" | "phone" | "email">
      >
    ) => {
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
    exportTerritoryPDF(svgEl, territories, countyNames, territoryOpacity);
  }, [territories, countyNames, territoryOpacity]);

  const handleExport = useCallback(() => {
    const data = territories.map((t) => ({
      name: t.name,
      color: t.color,
      title: t.title,
      branch: t.branch,
      phone: t.phone,
      email: t.email,
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
          let counter = 1;
          const imported: ClientTerritory[] = result.data.map((item) => ({
            id: counter++,
            name: item.name,
            color: item.color,
            countyFips: item.counties.map((c) =>
              typeof c === "string" ? c : c.fips
            ),
            title: item.title,
            branch: item.branch,
            phone: item.phone,
            email: item.email,
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
      {/* Branded header — gold accent strip over the deep teal bar */}
      <div
        className="h-1 flex-shrink-0"
        style={{ backgroundColor: "hsl(var(--brand-gold))" }}
      />
      <header
        className="h-14 flex items-center px-5 gap-4 flex-shrink-0 text-white shadow-md relative z-10"
        style={{ backgroundColor: "hsl(var(--brand-teal))" }}
        data-testid="app-header"
      >
        <img
          src="./csi-logo.png"
          alt="Connector Specialists Incorporated"
          className="h-8 w-auto"
        />
        <div className="w-px h-6 bg-white/20" aria-hidden />
        <h1
          className="text-sm font-medium tracking-wide uppercase"
          data-testid="app-title"
        >
          Territory Map Builder
        </h1>

        <div className="ml-auto flex items-center gap-1">
          {hoveredCounty && (
            <div
              className="text-xs text-white/80 hidden sm:block mr-3"
              data-testid="hovered-county-info"
            >
              <span className="font-semibold text-white">
                {hoveredCounty.name}
              </span>
              <span className="text-white/60">, {hoveredCounty.state}</span>
              {assignedCounties.has(hoveredCounty.fips) && (
                <span
                  className="ml-1.5 font-medium"
                  style={{ color: "hsl(var(--brand-gold))" }}
                >
                  · assigned
                </span>
              )}
            </div>
          )}

          {territories.length > 0 && (
            <>
              <HeaderButton
                onClick={handleExportPDF}
                title="Export as PDF"
                testId="export-pdf-btn"
              >
                <FileDown className="w-4 h-4" />
              </HeaderButton>
              <HeaderButton
                onClick={handleExport}
                title="Export as JSON"
                testId="export-btn"
              >
                <Download className="w-4 h-4" />
              </HeaderButton>
              <HeaderButton
                onClick={handleClearAllTerritories}
                title="Clear all territories"
                testId="clear-all-btn"
                destructive
              >
                <Trash2 className="w-4 h-4" />
              </HeaderButton>
              <div className="w-px h-5 bg-white/20 mx-1" aria-hidden />
            </>
          )}

          <HeaderButton
            onClick={() => fileInputRef.current?.click()}
            title="Import territories"
            testId="import-btn"
          >
            <Upload className="w-4 h-4" />
          </HeaderButton>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />

          <HeaderButton
            onClick={() => setPanelOpen(!panelOpen)}
            title={panelOpen ? "Hide panel" : "Show panel"}
            testId="toggle-panel-btn"
          >
            {panelOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeft className="w-4 h-4" />
            )}
          </HeaderButton>
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
            territoryOpacity={territoryOpacity}
          />

          {/* TEMP: opacity tuner — remove once we pick a final value */}
          <div
            className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm border border-border rounded-lg shadow-md px-3 py-2 flex items-center gap-3 z-20"
            data-testid="opacity-tuner"
          >
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Opacity
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={territoryOpacity}
              onChange={(e) => setTerritoryOpacity(parseFloat(e.target.value))}
              className="w-40 accent-[hsl(var(--brand-teal))]"
            />
            <span className="text-xs font-mono tabular-nums text-foreground w-10 text-right">
              {territoryOpacity.toFixed(2)}
            </span>
          </div>
          <MapLegend
            territories={territories}
            onHighlight={setHighlightTerritoryId}
            onOpenDetails={setDetailsId}
            swatchOpacity={territoryOpacity}
          />
        </div>

        {panelOpen && (
          <aside className="w-80 border-l border-border bg-sidebar flex-shrink-0 overflow-hidden">
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
              onOpenDetails={setDetailsId}
              editingTerritoryId={editingTerritoryId}
              countyNames={countyNames}
              swatchOpacity={territoryOpacity}
            />
          </aside>
        )}
      </div>

      {/* Rep details dialog — opened from the territory card's Info button
          or by double-clicking a name in the map legend */}
      {detailsId != null && (() => {
        const territory = territories.find((t) => t.id === detailsId);
        if (!territory) return null;
        // Colors used by OTHER territories — the one being edited keeps its own
        const usedByOthers = new Set(
          territories.filter((t) => t.id !== detailsId).map((t) => t.color)
        );
        return (
          <RepDetailsDialog
            territory={territory}
            colors={colors}
            usedColors={usedByOthers}
            onSave={(updates) => handleUpdateTerritory(territory.id, updates)}
            onClose={() => setDetailsId(null)}
          />
        );
      })()}
    </div>
  );
}
