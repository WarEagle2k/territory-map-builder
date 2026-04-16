import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as topojson from "topojson-client";
import type { Topology } from "topojson-specification";
import type { ClientTerritory } from "@/pages/home";

interface CountyInfo {
  name: string;
  state: string;
}

interface TerritoryMapLeafletProps {
  territories: ClientTerritory[];
  selectedCounties: Set<string>;
  selectedColor: string;
  onCountyClick: (fips: string) => void;
  onCountyHover: (info: { fips: string; name: string; state: string } | null) => void;
  onCountiesDrag: (fipsList: string[]) => void;
  highlightTerritoryId: number | null;
  editingTerritoryId: number | null;
}

// Southeast US bounding box — matches our existing region data
const REGION_BOUNDS: L.LatLngBoundsExpression = [
  [24.4, -107.0], // SW corner
  [36.8, -79.5],  // NE corner
];

// CARTO Positron — clean, minimalist, plenty of contrast for colored overlays.
// Free for non-commercial + internal business use; no API key needed.
const CARTO_POSITRON_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export default function TerritoryMapLeaflet({
  territories,
  selectedCounties,
  selectedColor,
  onCountyClick,
  onCountyHover,
  onCountiesDrag,
  highlightTerritoryId,
  editingTerritoryId,
}: TerritoryMapLeafletProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const countyLayerRef = useRef<L.GeoJSON | null>(null);
  const fipsToLayerRef = useRef<Map<string, L.Path>>(new Map());

  const [countyFeatures, setCountyFeatures] = useState<GeoJSON.FeatureCollection | null>(null);
  const [countyNames, setCountyNames] = useState<Record<string, CountyInfo>>({});

  // Drag-to-select state
  const isDraggingRef = useRef(false);
  const draggedCountiesRef = useRef<Set<string>>(new Set());
  const didDragRef = useRef(false);

  // Stable refs for callbacks
  const onCountyClickRef = useRef(onCountyClick);
  onCountyClickRef.current = onCountyClick;
  const onCountyHoverRef = useRef(onCountyHover);
  onCountyHoverRef.current = onCountyHover;
  const onCountiesDragRef = useRef(onCountiesDrag);
  onCountiesDragRef.current = onCountiesDrag;
  const countyNamesRef = useRef(countyNames);
  countyNamesRef.current = countyNames;

  // Build county→territory lookup (exclude territory being edited)
  const countyToTerritory = useMemo(() => {
    const map = new Map<string, { color: string; id: number; name: string }>();
    for (const t of territories) {
      if (t.id === editingTerritoryId) continue;
      for (const fips of t.countyFips) {
        map.set(fips, { color: t.color, id: t.id, name: t.name });
      }
    }
    return map;
  }, [territories, editingTerritoryId]);

  // --- Load topojson + names ---
  useEffect(() => {
    Promise.all([
      fetch("./region-topo.json").then((r) => r.json()),
      fetch("./county-names.json").then((r) => r.json()),
    ])
      .then(([topo, names]: [Topology, Record<string, CountyInfo>]) => {
        const features = topojson.feature(
          topo,
          topo.objects.counties
        ) as unknown as GeoJSON.FeatureCollection;
        setCountyFeatures(features);
        setCountyNames(names);
      })
      .catch(() => {});
  }, []);

  // --- Build the Leaflet map once ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: false, // SVG gives us per-feature event bindings
      scrollWheelZoom: true,
      dragging: true,
    }).fitBounds(REGION_BOUNDS);

    L.tileLayer(CARTO_POSITRON_URL, {
      attribution: CARTO_ATTRIBUTION,
      subdomains: "abcd",
      maxZoom: 19,
      detectRetina: true,
    }).addTo(map);

    mapRef.current = map;

    // Global mouseup to finalize drag selection
    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      map.dragging.enable(); // re-enable map panning
      if (didDragRef.current) {
        onCountiesDragRef.current(Array.from(draggedCountiesRef.current));
      } else {
        const ids = Array.from(draggedCountiesRef.current);
        if (ids.length === 1) onCountyClickRef.current(ids[0]);
      }
      draggedCountiesRef.current = new Set();
    };
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- Add/refresh the county overlay when features arrive ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !countyFeatures) return;

    // Clear previous
    if (countyLayerRef.current) {
      countyLayerRef.current.remove();
      countyLayerRef.current = null;
    }
    fipsToLayerRef.current.clear();

    const geoLayer = L.geoJSON(countyFeatures, {
      style: () => ({
        weight: 0.5,
        color: "#64748b",
        fillColor: "transparent",
        fillOpacity: 0,
      }),
      onEachFeature: (feature, layer) => {
        const fips = String(feature.id).padStart(5, "0");
        fipsToLayerRef.current.set(fips, layer as L.Path);

        layer.on({
          mousedown: (e: L.LeafletMouseEvent) => {
            const oe = e.originalEvent;
            // Shift/ctrl/meta/right-click let the map pan
            if (
              oe.button !== 0 ||
              oe.shiftKey ||
              oe.ctrlKey ||
              oe.metaKey
            ) {
              return;
            }
            L.DomEvent.stop(e);
            map.dragging.disable();
            isDraggingRef.current = true;
            didDragRef.current = false;
            draggedCountiesRef.current = new Set([fips]);
          },
          mouseover: () => {
            const info = countyNamesRef.current[fips];
            if (info) {
              onCountyHoverRef.current({
                fips,
                name: info.name,
                state: info.state,
              });
            }
            if (isDraggingRef.current) {
              didDragRef.current = true;
              draggedCountiesRef.current.add(fips);
              onCountiesDragRef.current(Array.from(draggedCountiesRef.current));
            }
          },
          mouseout: () => {
            onCountyHoverRef.current(null);
          },
        });
      },
    }).addTo(map);

    countyLayerRef.current = geoLayer;
  }, [countyFeatures]);

  // --- Style update when selection / territories / highlight change ---
  useEffect(() => {
    const layerMap = fipsToLayerRef.current;
    if (!layerMap.size) return;

    layerMap.forEach((layer, fips) => {
      const isSelected = selectedCounties.has(fips);
      const territory = countyToTerritory.get(fips);
      const isHighlighted =
        territory && highlightTerritoryId === territory.id;

      let fillColor = "transparent";
      let fillOpacity = 0;
      let color = "#64748b";
      let weight = 0.5;

      if (isSelected) {
        fillColor = selectedColor;
        fillOpacity = 0.55;
        color = selectedColor;
        weight = 1.5;
      } else if (territory) {
        fillColor = territory.color;
        fillOpacity = 0.65;
        color = isHighlighted ? "#000" : territory.color;
        weight = isHighlighted ? 1.8 : 0.6;
      }

      layer.setStyle({ fillColor, fillOpacity, color, weight });
    });
  }, [
    selectedCounties,
    selectedColor,
    countyToTerritory,
    highlightTerritoryId,
  ]);

  return (
    <div className="w-full h-full min-h-[400px] relative">
      <div
        ref={containerRef}
        className="w-full h-full"
        data-testid="territory-map-leaflet"
        style={{ background: "#f8fafc" }}
      />
      <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground/80 pointer-events-none select-none z-[1000] bg-background/70 px-1.5 py-0.5 rounded">
        Scroll to zoom · Drag empty area to pan · Click or drag counties to select
      </div>
    </div>
  );
}
