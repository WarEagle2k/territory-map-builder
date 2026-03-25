import { useEffect, useRef, useCallback, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { Topology } from "topojson-specification";
import type { ClientTerritory } from "@/pages/home";

interface CountyInfo {
  name: string;
  state: string;
}

interface TerritoryMapProps {
  territories: ClientTerritory[];
  selectedCounties: Set<string>;
  selectedColor: string; // the color currently chosen in the panel
  onCountyClick: (fips: string) => void;
  onCountyHover: (info: { fips: string; name: string; state: string } | null) => void;
  highlightTerritoryId: number | null;
}

export default function TerritoryMap({
  territories,
  selectedCounties,
  selectedColor,
  onCountyClick,
  onCountyHover,
  highlightTerritoryId,
}: TerritoryMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [topoData, setTopoData] = useState<Topology | null>(null);
  const [countyNames, setCountyNames] = useState<Record<string, CountyInfo>>({});
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [mapInitialized, setMapInitialized] = useState(false);

  // Stable refs for callbacks so D3 event handlers always see latest values
  const onCountyClickRef = useRef(onCountyClick);
  onCountyClickRef.current = onCountyClick;
  const onCountyHoverRef = useRef(onCountyHover);
  onCountyHoverRef.current = onCountyHover;
  const countyNamesRef = useRef(countyNames);
  countyNamesRef.current = countyNames;

  // Load data
  useEffect(() => {
    Promise.all([
      fetch("./region-topo.json").then((r) => r.json()),
      fetch("./county-names.json").then((r) => r.json()),
    ]).then(([topo, names]) => {
      setTopoData(topo);
      setCountyNames(names);
    }).catch(() => {});
  }, []);

  // Responsive resize
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

  // Build a county→territory lookup
  const countyToTerritory = useCallback(() => {
    const map = new Map<string, { color: string; id: number; name: string }>();
    for (const t of territories) {
      for (const fips of t.countyFips) {
        map.set(fips, { color: t.color, id: t.id, name: t.name });
      }
    }
    return map;
  }, [territories]);

  // INITIAL MAP RENDER — runs once when data + dimensions are ready,
  // or when dimensions change (resize). Sets up paths, zoom, event handlers.
  useEffect(() => {
    if (!topoData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const counties = topojson.feature(
      topoData as any,
      (topoData as any).objects.counties
    ) as any;
    const states = topojson.feature(
      topoData as any,
      (topoData as any).objects.states
    ) as any;

    const projection = d3.geoAlbersUsa().fitSize([width, height], counties);
    const path = d3.geoPath().projection(projection);

    // Map group
    const g = svg.append("g");
    gRef.current = g;

    // Zoom — filter out clicks so they don't trigger zoom reset
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 12])
      .filter((event) => {
        // Allow wheel, dblclick, and drag (mousedown+mousemove) for zoom
        // Block single click from triggering zoom
        if (event.type === "mousedown" || event.type === "touchstart") {
          // Only allow if it's a middle-click or ctrl+click for panning
          // D3 default: allow button 0 (left) for panning
          return true;
        }
        return true;
      })
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    zoomRef.current = zoom;

    svg.call(zoom);

    // County paths — fill/stroke set to defaults; updated in the style effect
    g.selectAll("path.county")
      .data(counties.features)
      .join("path")
      .attr("class", "county")
      .attr("d", path as any)
      .attr("data-fips", (d: any) => String(d.id).padStart(5, "0"))
      .attr("data-testid", (d: any) => `county-${String(d.id).padStart(5, "0")}`)
      .attr("fill", "#e2e8f0")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("click", (event: any, d: any) => {
        event.stopPropagation(); // prevent zoom from firing
        const fips = String(d.id).padStart(5, "0");
        onCountyClickRef.current(fips);
      })
      .on("mouseenter", (_event: any, d: any) => {
        const fips = String(d.id).padStart(5, "0");
        const info = countyNamesRef.current[fips];
        if (info) {
          onCountyHoverRef.current({ fips, name: info.name, state: info.state });
        }
      })
      .on("mouseleave", () => {
        onCountyHoverRef.current(null);
      });

    // State borders
    g.selectAll("path.state")
      .data(states.features)
      .join("path")
      .attr("class", "state")
      .attr("d", path as any)
      .attr("fill", "none")
      .attr("stroke", "#475569")
      .attr("stroke-width", 1.5)
      .style("pointer-events", "none");

    // State labels
    g.selectAll("text.state-label")
      .data(states.features)
      .join("text")
      .attr("class", "state-label")
      .attr("x", (d: any) => path.centroid(d)[0])
      .attr("y", (d: any) => path.centroid(d)[1])
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("fill", "#334155")
      .attr("opacity", 0.5)
      .style("pointer-events", "none")
      .text((d: any) => {
        const stateAbbr: Record<string, string> = {
          "48": "TX", "22": "LA", "28": "MS", "01": "AL",
          "05": "AR", "40": "OK", "47": "TN", "12": "FL",
        };
        return stateAbbr[String(d.id).padStart(2, "0")] || "";
      });

    setMapInitialized(true);
  }, [topoData, dimensions]);

  // STYLE UPDATE — runs whenever territories, selection, color, or highlight changes.
  // Only updates fill/stroke attributes on existing paths — does NOT recreate geometry or zoom.
  useEffect(() => {
    if (!mapInitialized || !gRef.current) return;

    const g = gRef.current;
    const ctMap = countyToTerritory();

    g.selectAll<SVGPathElement, any>("path.county")
      .attr("fill", function () {
        const fips = d3.select(this).attr("data-fips");
        if (selectedCounties.has(fips)) {
          return selectedColor;
        }
        const territory = ctMap.get(fips);
        if (territory) return territory.color;
        return "#e2e8f0";
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
        if (territory) return 0.75;
        return 1;
      });
  }, [
    mapInitialized,
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
        data-testid="territory-map-svg"
      />
    </div>
  );
}
