import { useState, useRef, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  Plus,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  MapPin,
  Pencil,
  Check,
  Info,
  Phone,
  Mail,
} from "lucide-react";
import RepDetailsDialog from "@/components/RepDetailsDialog";
import type { ClientTerritory } from "@/pages/home";

interface ColorOption {
  name: string;
  value: string;
}

interface TerritoryPanelProps {
  territories: ClientTerritory[];
  selectedCounties: Set<string>;
  selectedColor: string;
  colors: ColorOption[];
  onColorChange: (color: string) => void;
  onAddColor: (hex: string) => void;
  onRemoveColor: (value: string) => void;
  onClearSelection: () => void;
  onHighlightTerritory: (id: number | null) => void;
  onCreateTerritory: (name: string, color: string, counties: string[]) => void;
  onUpdateTerritory: (id: number, updates: Partial<Pick<ClientTerritory, "name" | "color">>) => void;
  onDeleteTerritory: (id: number) => void;
  onEditTerritoryCounties: (id: number) => void;
  onSaveTerritoryCounties: () => void;
  onCancelEditCounties: () => void;
  editingTerritoryId: number | null;
  countyNames: Record<string, { name: string; state: string }>;
  /** Match on-map territory opacity for visual consistency */
  swatchOpacity?: number;
}

export default function TerritoryPanel({
  territories,
  selectedCounties,
  selectedColor,
  colors,
  onColorChange,
  onAddColor,
  onRemoveColor,
  onClearSelection,
  onHighlightTerritory,
  onCreateTerritory,
  onUpdateTerritory,
  onDeleteTerritory,
  onEditTerritoryCounties,
  onSaveTerritoryCounties,
  onCancelEditCounties,
  editingTerritoryId,
  countyNames,
  swatchOpacity = 1,
}: TerritoryPanelProps) {
  const [territoryName, setTerritoryName] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const [hexInput, setHexInput] = useState("#3b82f6");
  const [showColorManager, setShowColorManager] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

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

  // Colors already used — but allow the color of the territory currently being edited
  const usedColors = new Set(
    territories
      .filter((t) => t.id !== editingTerritoryId)
      .map((t) => t.color)
  );

  const getCountyLabel = (fips: string) => {
    const info = countyNames[fips];
    return info ? `${info.name}, ${info.state}` : fips;
  };

  const isEditingCounties = editingTerritoryId !== null;
  const editingTerritory = territories.find((t) => t.id === editingTerritoryId);

  return (
    <div className="flex flex-col h-full" data-testid="territory-panel">
      {/* Create Territory Section — or County Edit Mode */}
      <div className="p-4 border-b border-border">
        {isEditingCounties && editingTerritory ? (
          <>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5" />
              Editing · {editingTerritory.name}
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Click counties to remove them. Drag to add new ones.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" data-testid="selected-count">
                  <MapPin className="w-3 h-3 mr-1" />
                  {selectedCounties.size} counties
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={onSaveTerritoryCounties}
                  disabled={selectedCounties.size === 0}
                  data-testid="save-county-edits-btn"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={onCancelEditCounties}
                  data-testid="cancel-county-edits-btn"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-muted-foreground">
                    Color
                  </label>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowColorManager(!showColorManager)}
                  >
                    {showColorManager ? "Done" : "Manage"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {colors.map((c) => {
                    const isUsed = usedColors.has(c.value);
                    return (
                    <div key={c.value} className="relative group w-6 h-6 flex items-center justify-center">
                      <button
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          selectedColor === c.value
                            ? "border-foreground scale-110"
                            : "border-transparent hover:scale-105"
                        } ${isUsed && !showColorManager ? "opacity-50 cursor-not-allowed" : ""}`}
                        style={{ backgroundColor: c.value }}
                        onClick={() => {
                          // In manage mode, clicking a swatch copies its hex
                          // into the edit field so users can see / reuse it.
                          if (showColorManager) {
                            setHexInput(c.value);
                            return;
                          }
                          if (isUsed) return;
                          onColorChange(c.value);
                        }}
                        disabled={isUsed && !showColorManager}
                        title={
                          showColorManager
                            ? `${c.name} (${c.value}) — click to copy hex`
                            : isUsed
                            ? `${c.name} (already used)`
                            : c.name
                        }
                        data-testid={`color-${c.name.toLowerCase()}`}
                      />
                      {isUsed && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute top-1/2 left-1/2 w-[22px] h-[2px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-foreground rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.8)]"
                        />
                      )}
                      {showColorManager && !usedColors.has(c.value) && (
                        <button
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive text-destructive-foreground rounded-full text-[8px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveColor(c.value);
                          }}
                          title="Remove color"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    );
                  })}
                </div>
                {showColorManager && (
                  <div className="mt-2 space-y-2">
                    <div className="relative" ref={pickerRef}>
                      <div className="flex gap-1.5">
                        <div
                          className="w-7 h-7 rounded border border-border flex-shrink-0 cursor-pointer"
                          style={{ backgroundColor: hexInput }}
                          onClick={() => setShowPicker(!showPicker)}
                          title="Click to open color picker"
                        />
                        <Input
                          placeholder="#hex color"
                          value={hexInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHexInput(val);
                          }}
                          className="h-7 text-xs flex-1 font-mono"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && /^#?[0-9a-fA-F]{6}$/.test(hexInput.trim())) {
                              onAddColor(hexInput.trim());
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          disabled={!/^#?[0-9a-fA-F]{6}$/.test(hexInput.trim())}
                          onClick={() => {
                            onAddColor(hexInput.trim());
                          }}
                          title="Add color to palette"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      {showPicker && (
                        <div className="absolute z-50 mt-2 p-3 bg-popover border border-border rounded-lg shadow-lg">
                          <HexColorPicker
                            color={hexInput}
                            onChange={setHexInput}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
          </>
        )}
      </div>

      {/* Territory List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Territories
          </h2>
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {territories.length}
          </span>
        </div>

        {territories.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-4 text-center">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Click or drag counties on the map, name your territory, pick a
              color, and save.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {territories.map((t) => {
            const isExpanded = expandedId === t.id;
            const isBeingEdited = editingTerritoryId === t.id;

            return (
              <Card
                key={t.id}
                className={`relative overflow-hidden p-3 pl-4 transition-all cursor-default ${
                  isBeingEdited
                    ? "ring-2 ring-primary shadow-md"
                    : "hover:shadow-sm hover:-translate-y-px"
                }`}
                onMouseEnter={() => onHighlightTerritory(t.id)}
                onMouseLeave={() => onHighlightTerritory(null)}
                data-testid={`territory-card-${t.id}`}
              >
                {/* Colored left accent bar — 3px wide */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ backgroundColor: t.color, opacity: swatchOpacity }}
                  aria-hidden
                />
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/10"
                    style={{ backgroundColor: t.color, opacity: swatchOpacity }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    {t.title && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        {t.title}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {isBeingEdited ? selectedCounties.size : t.countyFips.length}
                  </Badge>

                  <div className="flex gap-0.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      data-testid={`expand-territory-${t.id}`}
                      title={isExpanded ? "Collapse" : "Expand"}
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
                        if (isBeingEdited) {
                          onCancelEditCounties();
                        } else {
                          onEditTerritoryCounties(t.id);
                        }
                      }}
                      title="Edit counties"
                      data-testid={`edit-counties-${t.id}`}
                    >
                      <Pencil className={`w-3 h-3 ${isBeingEdited ? "text-primary" : ""}`} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => setDetailsId(t.id)}
                      title="Edit rep details"
                      data-testid={`rep-details-${t.id}`}
                    >
                      <Info className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => onDeleteTerritory(t.id)}
                      data-testid={`delete-territory-${t.id}`}
                      title="Delete territory"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pl-6 space-y-3">
                    {/* Contact info */}
                    {(t.phone || t.email) && (
                      <div className="space-y-1">
                        {t.phone && (
                          <a
                            href={`tel:${t.phone}`}
                            className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors"
                          >
                            <Phone className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                            <span className="truncate">{t.phone}</span>
                          </a>
                        )}
                        {t.email && (
                          <a
                            href={`mailto:${t.email}`}
                            className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors"
                          >
                            <Mail className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                            <span className="truncate">{t.email}</span>
                          </a>
                        )}
                      </div>
                    )}
                    {/* County list */}
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Counties ({t.countyFips.length})
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                        {t.countyFips.map((fips) => (
                          <div key={fips}>{getCountyLabel(fips)}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {detailsId != null && (() => {
        const territory = territories.find((x) => x.id === detailsId);
        if (!territory) return null;
        return (
          <RepDetailsDialog
            territory={territory}
            onSave={(updates) => onUpdateTerritory(territory.id, updates)}
            onClose={() => setDetailsId(null)}
          />
        );
      })()}
    </div>
  );
}
