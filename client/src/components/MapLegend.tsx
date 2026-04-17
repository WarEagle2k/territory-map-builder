import type { ClientTerritory } from "@/pages/home";

interface MapLegendProps {
  territories: ClientTerritory[];
  onHighlight: (id: number | null) => void;
  onOpenDetails?: (id: number) => void;
  /** Matches the territory fill opacity on the map for visual consistency */
  swatchOpacity?: number;
}

export default function MapLegend({
  territories,
  onHighlight,
  onOpenDetails,
  swatchOpacity = 1,
}: MapLegendProps) {
  if (territories.length === 0) return null;

  return (
    <div
      className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm border border-border rounded-lg shadow-md overflow-hidden max-w-xs"
      data-testid="map-legend"
    >
      {/* Branded header strip */}
      <div
        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white"
        style={{ backgroundColor: "hsl(var(--brand-teal))" }}
      >
        Territories
      </div>

      <div className="p-3 space-y-1.5">
        {territories.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-accent/50 transition-colors select-none"
            onMouseEnter={() => onHighlight(t.id)}
            onMouseLeave={() => onHighlight(null)}
            onDoubleClick={() => onOpenDetails?.(t.id)}
            title="Double-click to edit rep details"
            data-testid={`legend-item-${t.id}`}
          >
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0 ring-1 ring-black/10"
              style={{ backgroundColor: t.color, opacity: swatchOpacity }}
            />
            <span className="text-xs font-medium truncate flex-1">{t.name}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
              {t.countyFips.length}
            </span>
          </div>
        ))}

        <div className="mt-2 pt-2 border-t border-border flex items-center gap-2 px-1">
          <div className="w-3 h-3 rounded-sm bg-slate-200 flex-shrink-0 ring-1 ring-black/5" />
          <span className="text-[11px] text-muted-foreground">Unassigned</span>
        </div>
      </div>
    </div>
  );
}
