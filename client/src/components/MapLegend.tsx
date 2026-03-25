import type { ClientTerritory } from "@/pages/home";

interface MapLegendProps {
  territories: ClientTerritory[];
  onHighlight: (id: number | null) => void;
}

export default function MapLegend({ territories, onHighlight }: MapLegendProps) {
  if (territories.length === 0) return null;

  return (
    <div
      className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-3 shadow-md max-w-xs"
      data-testid="map-legend"
    >
      <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
        Territories
      </h3>
      <div className="space-y-1.5">
        {territories.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onMouseEnter={() => onHighlight(t.id)}
            onMouseLeave={() => onHighlight(null)}
            data-testid={`legend-item-${t.id}`}
          >
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: t.color }}
            />
            <span className="text-xs font-medium truncate">{t.name}</span>
            <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
              {t.countyFips.length}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-border flex items-center gap-2">
        <div className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
        <span className="text-xs text-muted-foreground">Unassigned</span>
      </div>
    </div>
  );
}
