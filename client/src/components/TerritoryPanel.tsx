import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  Plus,
  Save,
  Edit2,
  X,
  ChevronDown,
  ChevronUp,
  MapPin,
} from "lucide-react";
import { TERRITORY_COLORS } from "@/lib/territory-colors";
import type { ClientTerritory } from "@/pages/home";

interface TerritoryPanelProps {
  territories: ClientTerritory[];
  selectedCounties: Set<string>;
  selectedColor: string;
  onColorChange: (color: string) => void;
  onClearSelection: () => void;
  onHighlightTerritory: (id: number | null) => void;
  onCreateTerritory: (name: string, color: string, counties: string[]) => void;
  onUpdateTerritory: (id: number, updates: Partial<Pick<ClientTerritory, "name" | "color">>) => void;
  onDeleteTerritory: (id: number) => void;
  countyNames: Record<string, { name: string; state: string }>;
}

export default function TerritoryPanel({
  territories,
  selectedCounties,
  selectedColor,
  onColorChange,
  onClearSelection,
  onHighlightTerritory,
  onCreateTerritory,
  onUpdateTerritory,
  onDeleteTerritory,
  countyNames,
}: TerritoryPanelProps) {
  const [territoryName, setTerritoryName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleSave = () => {
    if (!territoryName.trim()) return;
    if (selectedCounties.size === 0) return;
    onCreateTerritory(
      territoryName.trim(),
      selectedColor,
      Array.from(selectedCounties)
    );
    setTerritoryName("");
  };

  // Colors already used
  const usedColors = new Set(territories.map((t) => t.color));

  const getCountyLabel = (fips: string) => {
    const info = countyNames[fips];
    return info ? `${info.name}, ${info.state}` : fips;
  };

  return (
    <div className="flex flex-col h-full" data-testid="territory-panel">
      {/* Create Territory Section */}
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Territory
        </h2>

        <div className="space-y-3">
          <Input
            placeholder="Territory name"
            value={territoryName}
            onChange={(e) => setTerritoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            data-testid="territory-name-input"
          />

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Color
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TERRITORY_COLORS.map((c) => (
                <button
                  key={c.value}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    selectedColor === c.value
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  } ${usedColors.has(c.value) ? "opacity-30" : ""}`}
                  style={{ backgroundColor: c.value }}
                  onClick={() => onColorChange(c.value)}
                  title={c.name}
                  data-testid={`color-${c.name.toLowerCase()}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Badge variant="secondary" data-testid="selected-count">
              <MapPin className="w-3 h-3 mr-1" />
              {selectedCounties.size} counties selected
            </Badge>
            {selectedCounties.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                data-testid="clear-selection-btn"
              >
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}
          </div>

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={!territoryName.trim() || selectedCounties.size === 0}
            data-testid="save-territory-btn"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Territory
          </Button>
        </div>
      </div>

      {/* Territory List */}
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-sm font-semibold mb-3">
          Territories ({territories.length})
        </h2>

        {territories.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Click counties on the map, name your territory, pick a color, and
            save.
          </p>
        )}

        <div className="space-y-2">
          {territories.map((t) => {
            const isExpanded = expandedId === t.id;

            return (
              <Card
                key={t.id}
                className="p-3 hover:bg-accent/50 transition-colors"
                onMouseEnter={() => onHighlightTerritory(t.id)}
                onMouseLeave={() => onHighlightTerritory(null)}
                data-testid={`territory-card-${t.id}`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: t.color }}
                  />

                  {editingId === t.id ? (
                    <div className="flex-1 flex gap-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onUpdateTerritory(t.id, { name: editName });
                            setEditingId(null);
                          }
                        }}
                        data-testid="edit-name-input"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => {
                          onUpdateTerritory(t.id, { name: editName });
                          setEditingId(null);
                        }}
                        data-testid="confirm-edit-btn"
                      >
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium truncate">
                        {t.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs flex-shrink-0"
                      >
                        {t.countyFips.length}
                      </Badge>
                    </>
                  )}

                  {editingId !== t.id && (
                    <div className="flex gap-0.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : t.id)
                        }
                        data-testid={`expand-territory-${t.id}`}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setEditingId(t.id);
                          setEditName(t.name);
                        }}
                        data-testid={`edit-territory-${t.id}`}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => onDeleteTerritory(t.id)}
                        data-testid={`delete-territory-${t.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="mt-2 pl-6">
                    <div className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                      {t.countyFips.map((fips) => (
                        <div key={fips}>{getCountyLabel(fips)}</div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
