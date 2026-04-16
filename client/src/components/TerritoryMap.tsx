import { useEffect, useRef, useCallback, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { Topology } from "topojson-specification";
import type { ClientTerritory } from "@/pages/home";

interface CountyInfo {
  name: string;
  state: string;
}

interface City {
  name: string;
  state: string;
  lat: number;
  lon: number;
  tier: 1 | 2 | 3;
}

interface TerritoryMapProps {
  territories: ClientTerritory[];
  selectedCounties: Set<string>;
  selectedColor: string;
  onCountyClick: (fips: string) => void;
  onCountyHover: (info: { fips: string; name: string; state: string } | null) => void;
  onCountiesDrag: (fipsList: string[]) => void;
  highlightTerritoryId: number | null;
  editingTerritoryId: number | null;
}

// Only 2-digit state FIPS codes are present in our dataset; keep this table
// next to the rendering code so it's easy to extend when we grow the region.
const STATE_ABBR: Record<string, string> = {
  "48": "TX",
  "22": "LA",
  "28": "MS",
  "01": "AL",
  "05": "AR",
  "40": "OK",
  "47": "TN",
  "12": "FL",
};

export default function TerritoryMap({
  territories,
  selectedCounties,
  selectedColor,
  onCountyClick,
  onCountyHover,
  onCountiesDrag,
  highlightTerritoryId,
  editingTerritoryId,
}: TerritoryMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const pathRef = useRef<d3.GeoPath | null>(null);
  const [topoData, setTopoData] = useState<Topology | null>(null);
  const [highwayData, setHighwayData] = useState<Topology | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [countyNames, setCountyNames] = useState<Record<string, CountyInfo>>({});
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [geometryReady, setGeometryReady] = useState(false);

  // Drag painting state
  const isDraggingRef = useRef(false);
  const draggedCountiesRef = useRef<Set<string>>(new Set());
  const didDragRef = useRef(false);

  // Stable refs so D3 handlers always see latest callbacks
  const onCountyClickRef = useRef(onCountyClick);
  onCountyClickRef.current = onCountyClick;
  const onCountyHoverRef = useRef(onCountyHover);
  onCountyHoverRef.current = onCountyHover;
  const onCountiesDragRef = useRef(onCountiesDrag);
  onCountiesDragRef.current = onCountiesDrag;
  const countyNamesRef = useRef(countyNames);
  countyNamesRef.current = countyNames;

  // --- Load static data ---
  useEffect(() => {
    Promise.all([
      fetch("./region-topo.json").then((r) => r.json()),
      fetch("./county-names.json").then((r) => r.json()),
      fetch("./highways-topo.json").then((r) => r.json()),
      fetch("./cities.json").then((r) => r.json()),
    ])
      .then(([topo, names, highways, citiesData]) => {
        setTopoData(topo);
        setCountyNames(names);
        setHighwayData(highways);
        setCities(citiesData?.cities ?? []);
      })
      .catch(() => {});
  }, []);

  // --- Responsive resize ---
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // --- Build county→territory lookup ---
  const countyToTerritory = useCallback(() => {
    const map = new Map<string, { color: string; id: number; name: string }>();
    for (const t of territories) {
      if (t.id === editingTerritoryId) continue;
      for (const fips of t.countyFips) {
        map.set(fips, { color: t.color, id: t.id, name: t.name });
      }
    }
    return map;
  }, [territories, editingTerritoryId]);

  // --- GEOMETRY BUILD — runs once when data is available ---
  // Creates all SVG paths, zoom, and event handlers. Projection sized to the
  // CURRENT dimensions; resize is handled by a separate effect that just
  // re-runs path `d` attributes.
  useEffect(() => {
    if (!topoData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const counties = topojson.feature(
      topoData,
      topoData.objects.counties
    ) as unknown as GeoJSON.FeatureCollection;
    const states = topojson.feature(
      topoData,
      topoData.objects.states
    ) as unknown as GeoJSON.FeatureCollection;

    const { width, height } = dimensions;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const projection = d3.geoAlbersUsa().fitSize([width, height], counties);
    const path = d3.geoPath().projection(projection);
    pathRef.current = path;

    // Map group
    const g = svg.append("g");
    gRef.current = g;

    // Zoom: scroll to zoom, Shift+drag / right-click drag / ctrl+drag to pan
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 12])
      .filter((event) => {
        if (event.type === "wheel" || event.type === "dblclick") return true;
        if (event.type === "mousedown" || event.type === "touchstart") {
          return (
            event.button === 1 ||
            event.button === 2 ||
            event.shiftKey ||
            event.ctrlKey ||
            event.metaKey
          );
        }
        return false;
      })
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);
    svg.on("contextmenu", (event) => event.preventDefault());

    // County paths
    g.selectAll("path.county")
      .data(counties.features)
      .join("path")
      .attr("class", "county")
      .attr("d", path)
      .attr("data-fips", (d) => String(d.id).padStart(5, "0"))
      .attr("data-testid", (d) => `county-${String(d.id).padStart(5, "0")}`)
      .attr("fill", "#e2e8f0")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("mousedown", (event: MouseEvent, d) => {
        if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey) return;
        event.stopPropagation();
        event.preventDefault();
        isDraggingRef.current = true;
        didDragRef.current = false;
        draggedCountiesRef.current = new Set();
        const fips = String(d.id).padStart(5, "0");
        draggedCountiesRef.current.add(fips);
      })
      .on("mouseenter", (_event: MouseEvent, d) => {
        const fips = String(d.id).padStart(5, "0");
        const info = countyNamesRef.current[fips];
        if (info) {
          onCountyHoverRef.current({ fips, name: info.name, state: info.state });
        }
        if (isDraggingRef.current) {
          didDragRef.current = true;
          draggedCountiesRef.current.add(fips);
          onCountiesDragRef.current(Array.from(draggedCountiesRef.current));
        }
      })
      .on("mouseleave", () => {
        onCountyHoverRef.current(null);
      });

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      if (didDragRef.current) {
        onCountiesDragRef.current(Array.from(draggedCountiesRef.current));
      } else {
        const ids = Array.from(draggedCountiesRef.current);
        if (ids.length === 1) onCountyClickRef.current(ids[0]);
      }
      draggedCountiesRef.current = new Set();
    };
    document.addEventListener("mouseup", handleMouseUp);

    // Highway overlay, clipped to state boundaries
    if (highwayData) {
      const highways = topojson.feature(
        highwayData,
        highwayData.objects.highways
      ) as unknown as GeoJSON.FeatureCollection;

      const clipId = "states-clip";
      const defs = svg.append("defs");
      const clipPath = defs.append("clipPath").attr("id", clipId);
      clipPath
        .selectAll("path")
        .data(states.features)
        .join("path")
        .attr("d", path);

      g.selectAll("path.highway")
        .data(highways.features)
        .join("path")
        .attr("class", "highway")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "#922b21")
        .attr("stroke-width", 0.5)
        .attr("stroke-opacity", 0.4)
        .attr("clip-path", `url(#${clipId})`)
        .style("pointer-events", "none");
    }

    // State borders
    g.selectAll("path.state")
      .data(states.features)
      .join("path")
      .attr("class", "state")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", "#475569")
      .attr("stroke-width", 1.5)
      .style("pointer-events", "none");

    // City markers (dots) + labels. Inserted above county/highway/state-border
    // so they're readable, but below the big state labels.
    if (cities.length > 0) {
      const cityGroup = g.append("g").attr("class", "cities-layer");

      const tierStyle = (t: 1 | 2 | 3) => {
        if (t === 1) return { r: 1.8, fs: 8, fw: 700, opacity: 0.9 };
        if (t === 2) return { r: 1.4, fs: 7, fw: 600, opacity: 0.75 };
        return { r: 1.0, fs: 6, fw: 500, opacity: 0.6 };
      };

      cityGroup
        .selectAll("g.city")
        .data(cities)
        .join("g")
        .attr("class", "city")
        .style("pointer-events", "none")
        .each(function (c) {
          const point = projection([c.lon, c.lat]);
          if (!point) return;
          const [x, y] = point;
          const s = tierStyle(c.tier);
          const group = d3.select(this).attr("transform", `translate(${x}, ${y})`);

          // Dot (white halo + dark center)
          group
            .append("circle")
            .attr("r", s.r + 0.8)
            .attr("fill", "#ffffff")
            .attr("opacity", 0.9);
          group
            .append("circle")
            .attr("r", s.r)
            .attr("fill", "#1f2937")
            .attr("opacity", s.opacity);

          // Label
          group
            .append("text")
            .attr("x", s.r + 3)
            .attr("y", 0)
            .attr("dominant-baseline", "central")
            .attr("font-size", `${s.fs}px`)
            .attr("font-weight", s.fw)
            .attr("fill", "#111827")
            .attr("opacity", s.opacity)
            .text(c.name);
        });
    }

    // State labels
    g.selectAll("text.state-label")
      .data(states.features)
      .join("text")
      .attr("class", "state-label")
      .attr("x", (d) => path.centroid(d)[0])
      .attr("y", (d) => path.centroid(d)[1])
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("fill", "#334155")
      .attr("opacity", 0.5)
      .style("pointer-events", "none")
      .text((d) => STATE_ABBR[String(d.id).padStart(2, "0")] || "");

    setGeometryReady(true);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topoData, highwayData, cities]); // NOTE: dimensions intentionally excluded — resize handled below

  // --- RESIZE — re-project and update path `d` without rebuilding DOM ---
  useEffect(() => {
    if (!geometryReady || !gRef.current || !topoData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const counties = topojson.feature(
      topoData,
      topoData.objects.counties
    ) as unknown as GeoJSON.FeatureCollection;
    const projection = d3.geoAlbersUsa().fitSize([width, height], counties);
    const path = d3.geoPath().projection(projection);
    pathRef.current = path;

    const g = gRef.current;
    g.selectAll<SVGPathElement, GeoJSON.Feature>("path.county").attr("d", path);
    g.selectAll<SVGPathElement, GeoJSON.Feature>("path.state").attr("d", path);
    g.selectAll<SVGPathElement, GeoJSON.Feature>("path.highway").attr("d", path);
    // Clip path lives under svg > defs, not inside g
    svg
      .select("defs > clipPath")
      .selectAll<SVGPathElement, GeoJSON.Feature>("path")
      .attr("d", path);
    g.selectAll<SVGTextElement, GeoJSON.Feature>("text.state-label")
      .attr("x", (d) => path.centroid(d)[0])
      .attr("y", (d) => path.centroid(d)[1]);

    // Re-project city markers
    g.selectAll<SVGGElement, City>("g.cities-layer > g.city").attr(
      "transform",
      (c) => {
        const pt = projection([c.lon, c.lat]);
        return pt ? `translate(${pt[0]}, ${pt[1]})` : "";
      }
    );
  }, [dimensions, geometryReady, topoData]);

  // --- STYLE UPDATE — fill/stroke on selection / territory / highlight changes ---
  useEffect(() => {
    if (!geometryReady || !gRef.current) return;

    const g = gRef.current;
    const ctMap = countyToTerritory();

    g.selectAll<SVGPathElement, GeoJSON.Feature>("path.county")
      .attr("fill", function () {
        const fips = d3.select(this).attr("data-fips");
        if (selectedCounties.has(fips)) return selectedColor;
        const territory = ctMap.get(fips);
        return territory ? territory.color : "#e2e8f0";
      })
      .attr("stroke", function () {
        const fips = d3.select(this).attr("data-fips");
        if (selectedCounties.has(fips)) return selectedColor;
        const territory = ctMap.get(fips);
        if (territory && highlightTerritoryId === territory.id) return "#000";
        return "#94a3b8";
      })
      .attr("stroke-width", function () {
        const fips = d3.select(this).attr("data-fips");
        if (selectedCounties.has(fips)) return 1.5;
        const territory = ctMap.get(fips);
        if (territory && highlightTerritoryId === territory.id) return 1.5;
        return 0.5;
      })
      .attr("opacity", function () {
        const fips = d3.select(this).attr("data-fips");
        if (selectedCounties.has(fips)) return 0.6;
        const territory = ctMap.get(fips);
        return territory ? 0.75 : 1;
      });
  }, [
    geometryReady,
    territories,
    selectedCounties,
    selectedColor,
    countyToTerritory,
    highlightTerritoryId,
  ]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px] relative">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ userSelect: "none" }}
        data-testid="territory-map-svg"
      />
      <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground/60 pointer-events-none select-none">
        Scroll to zoom · Shift+drag to pan · Click or drag to select counties
      </div>
    </div>
  );
}
