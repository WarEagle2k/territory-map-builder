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
  Edit2,
  X,
  ChevronDown,
  ChevronUp,
  MapPin,
  Pencil,
  Check,
} from "lucide-react";
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
}: TerritoryPanelProps) {
  const [territoryName, setTerritoryName] = useState("");
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
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

  // Colors already used
  const usedColors = new Set(territories.map((t) => t.color));

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
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              Editing: {editingTerritory.name}
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
                  {colors.map((c) => (
                    <div key={c.value} className="relative group">
                      <button
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
                  ))}
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
            const isBeingEdited = editingTerritoryId === t.id;

            return (
              <Card
                key={t.id}
                className={`p-3 transition-colors ${
                  isBeingEdited
                    ? "ring-2 ring-primary bg-accent/50"
                    : "hover:bg-accent/50"
                }`}
                onMouseEnter={() => onHighlightTerritory(t.id)}
                onMouseLeave={() => onHighlightTerritory(null)}
                data-testid={`territory-card-${t.id}`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: t.color }}
                  />

                  {editingNameId === t.id ? (
                    <div className="flex-1 flex gap-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onUpdateTerritory(t.id, { name: editName });
                            setEditingNameId(null);
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
                          setEditingNameId(null);
                        }}
                        data-testid="confirm-edit-btn"
                      >
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => setEditingNameId(null)}
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
                        {isBeingEdited ? selectedCounties.size : t.countyFips.length}
                      </Badge>
                    </>
                  )}

                  {editingNameId !== t.id && (
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
                          if (isBeingEdited) {
                            // Already editing counties, cancel
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
                        onClick={() => {
                          setEditingNameId(t.id);
                          setEditName(t.name);
                        }}
                        title="Rename"
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
