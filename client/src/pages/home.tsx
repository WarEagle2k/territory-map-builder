import { useState, useCallback, useEffect, useRef } from "react";
import TerritoryMap from "@/components/TerritoryMap";
import TerritoryPanel from "@/components/TerritoryPanel";
import MapLegend from "@/components/MapLegend";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { Map, PanelLeftClose, PanelLeft, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TERRITORY_COLORS } from "@/lib/territory-colors";

export interface ClientTerritory {
  id: number;
  name: string;
  color: string;
  countyFips: string[]; // direct array, no JSON serialization
}

interface CountyInfo {
  name: string;
  state: string;
}

let nextId = 1;

export default function Home() {
  const [territories, setTerritories] = useState<ClientTerritory[]>([]);
  const [selectedCounties, setSelectedCounties] = useState<Set<string>>(
    new Set()
  );
  const [hoveredCounty, setHoveredCounty] = useState<{
    fips: string;
    name: string;
    state: string;
  } | null>(null);
  const [highlightTerritoryId, setHighlightTerritoryId] = useState<
    number | null
  >(null);
  const [countyNames, setCountyNames] = useState<Record<string, CountyInfo>>(
    {}
  );
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedColor, setSelectedColor] = useState(TERRITORY_COLORS[0].value);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load county names
  useEffect(() => {
    fetch("./county-names.json")
      .then((r) => r.json())
      .then(setCountyNames)
      .catch(() => {});
  }, []);

  // Build set of all already-assigned county FIPS
  const assignedCounties = new Set<string>();
  for (const t of territories) {
    for (const fips of t.countyFips) {
      assignedCounties.add(fips);
    }
  }

  const handleCountyClick = useCallback(
    (fips: string) => {
      if (assignedCounties.has(fips)) return;
      setSelectedCounties((prev) => {
        const next = new Set(prev);
        if (next.has(fips)) {
          next.delete(fips);
        } else {
          next.add(fips);
        }
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [territories]
  );

  const handleCountyHover = useCallback(
    (info: { fips: string; name: string; state: string } | null) => {
      setHoveredCounty(info);
    },
    []
  );

  const handleClearSelection = useCallback(() => {
    setSelectedCounties(new Set());
  }, []);

  const handleCreateTerritory = useCallback(
    (name: string, color: string, counties: string[]) => {
      setTerritories((prev) => [
        ...prev,
        { id: nextId++, name, color, countyFips: counties },
      ]);
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
  }, []);

  // Export territories as JSON file
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

  // Import territories from JSON
  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target?.result as string);
          const imported: ClientTerritory[] = data.map((item: any) => ({
            id: nextId++,
            name: item.name,
            color: item.color,
            countyFips: item.counties.map((c: any) =>
              typeof c === "string" ? c : c.fips
            ),
          }));
          setTerritories(imported);
        } catch {
          // ignore bad files
        }
      };
      reader.readAsText(file);
      // Reset input
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
          {/* Hovered county info */}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              data-testid="export-btn"
              title="Export territories"
            >
              <Download className="w-4 h-4" />
            </Button>
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

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <TerritoryMap
            territories={territories}
            selectedCounties={selectedCounties}
            selectedColor={selectedColor}
            onCountyClick={handleCountyClick}
            onCountyHover={handleCountyHover}
            highlightTerritoryId={highlightTerritoryId}
          />
          <MapLegend
            territories={territories}
            onHighlight={setHighlightTerritoryId}
          />
        </div>

        {/* Side panel */}
        {panelOpen && (
          <div className="w-80 border-l border-border bg-card flex-shrink-0 overflow-hidden">
            <TerritoryPanel
              territories={territories}
              selectedCounties={selectedCounties}
              selectedColor={selectedColor}
              onColorChange={setSelectedColor}
              onClearSelection={handleClearSelection}
              onHighlightTerritory={setHighlightTerritoryId}
              onCreateTerritory={handleCreateTerritory}
              onUpdateTerritory={handleUpdateTerritory}
              onDeleteTerritory={handleDeleteTerritory}
              countyNames={countyNames}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="h-8 border-t border-border flex items-center justify-center flex-shrink-0">
        <PerplexityAttribution />
      </footer>
    </div>
  );
}
