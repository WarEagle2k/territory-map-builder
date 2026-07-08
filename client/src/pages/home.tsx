import { useState, useCallback, useEffect, useRef } from "react";
import TerritoryMap from "@/components/TerritoryMap";
import TerritoryPanel from "@/components/TerritoryPanel";
import MapLegend from "@/components/MapLegend";
import RepDetailsDialog from "@/components/RepDetailsDialog";
import {
  PanelLeftClose,
  PanelLeft,
  Download,
  Upload,
  FileDown,
  Trash2,
} from "lucide-react";
import { importFileSchema } from "@/lib/storage";
import { useTerritories } from "@/lib/use-territories";

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
          ${
            destructive
              ? "text-white/85 hover:bg-red-500/80 hover:text-white"
              : "text-white/85 hover:bg-white/15 hover:text-white"
          }
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
  // Territory data, selection, editing, and persistence all live in the hook.
  const {
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
  } = useTerritories();

  // View-only state.
  const [hoveredCounty, setHoveredCounty] = useState<{
    fips: string;
    name: string;
    state: string;
  } | null>(null);
  const [highlightTerritoryId, setHighlightTerritoryId] = useState<
    number | null
  >(null);
  const [countyNames, setCountyNames] = useState<Record<string, CountyInfo>>(
    {},
  );
  const [panelOpen, setPanelOpen] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapSvgRef = useRef<SVGSVGElement>(null);

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

  const handleCountyHover = useCallback(
    (info: { fips: string; name: string; state: string } | null) => {
      setHoveredCounty(info);
    },
    [],
  );

  // --- Export / Import ---
  const handleExportPDF = useCallback(async () => {
    const svgEl = mapSvgRef.current;
    // The map paths must exist to capture — guards against clicking export
    // while the map data is still loading (territories can already be in
    // localStorage before the geometry arrives).
    if (!svgEl || !svgEl.querySelector("path.county")) return;
    // Lazy-loaded so jsPDF/html2canvas stay out of the initial bundle.
    const { exportTerritoryPDF } = await import("@/lib/export-pdf");
    exportTerritoryPDF(svgEl, territories);
  }, [territories]);

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
              "Invalid file format. Expected an array of territories with name, color, and counties.",
            );
            return;
          }
          let counter = 1;
          const imported: ClientTerritory[] = result.data.map((item) => ({
            id: counter++,
            name: item.name,
            color: item.color,
            countyFips: item.counties.map((c) =>
              typeof c === "string" ? c : c.fips,
            ),
            title: item.title,
            branch: item.branch,
            phone: item.phone,
            email: item.email,
          }));
          // Importing replaces everything — confirm like delete/clear-all do.
          if (territories.length > 0) {
            const confirmed = window.confirm(
              `Importing will replace your current ${territories.length} territor${
                territories.length === 1 ? "y" : "ies"
              } with ${imported.length} from the file. Continue?`,
            );
            if (!confirmed) return;
          }
          replaceAll(imported);
        } catch {
          setImportError("Could not parse file — is it valid JSON?");
        }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [replaceAll, territories.length],
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Desktop-only: this is a mouse-driven county-painting tool. On small
          screens show a notice instead of the cramped layout. */}
      <div
        className="md:hidden fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background px-8 text-center"
        data-testid="small-screen-notice"
      >
        <img
          src="./csi-logo.png"
          alt="Connector Specialists Incorporated"
          className="h-10 w-auto"
        />
        <h1 className="text-base font-semibold text-foreground">
          Territory Map Builder
        </h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          This tool is built for desktop. Please open it on a larger screen to
          build and edit territory maps.
        </p>
      </div>

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
                onClick={clearAll}
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
            svgRef={mapSvgRef}
            territories={territories}
            selectedCounties={selectedCounties}
            selectedColor={selectedColor}
            onCountyClick={selectCounty}
            onCountyHover={handleCountyHover}
            onCountiesDrag={dragSelectCounties}
            highlightTerritoryId={highlightTerritoryId}
            editingTerritoryId={editingTerritoryId}
          />

          <MapLegend
            territories={territories}
            onHighlight={setHighlightTerritoryId}
            onOpenDetails={setDetailsId}
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
              onAddColor={addColor}
              onRemoveColor={removeColor}
              onClearSelection={clearSelection}
              onHighlightTerritory={setHighlightTerritoryId}
              onCreateTerritory={createTerritory}
              onDeleteTerritory={deleteTerritory}
              onEditTerritoryCounties={startEditingCounties}
              onSaveTerritoryCounties={saveEditingCounties}
              onCancelEditCounties={cancelEditingCounties}
              onOpenDetails={setDetailsId}
              editingTerritoryId={editingTerritoryId}
              countyNames={countyNames}
            />
          </aside>
        )}
      </div>

      {/* Rep details dialog — opened from the territory card's Info button
          or by double-clicking a name in the map legend */}
      {detailsId != null &&
        (() => {
          const territory = territories.find((t) => t.id === detailsId);
          if (!territory) return null;
          // Colors used by OTHER territories — the one being edited keeps its own
          const usedByOthers = new Set(
            territories.filter((t) => t.id !== detailsId).map((t) => t.color),
          );
          return (
            <RepDetailsDialog
              territory={territory}
              colors={colors}
              usedColors={usedByOthers}
              onSave={(updates) => updateTerritory(territory.id, updates)}
              onClose={() => setDetailsId(null)}
            />
          );
        })()}
    </div>
  );
}
