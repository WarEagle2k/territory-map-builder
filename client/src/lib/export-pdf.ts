import jsPDF from "jspdf";
import type { ClientTerritory } from "@/pages/home";

interface CountyInfo {
  name: string;
  state: string;
}

// Convert SVG element to a PNG data URL via canvas, cropped to the map content
async function svgToImage(svgEl: SVGSVGElement): Promise<{ dataUrl: string; width: number; height: number }> {
  // Clone the SVG so we can modify it without affecting the live DOM
  const clone = svgEl.cloneNode(true) as SVGSVGElement;

  // Reset the D3 zoom transform on the clone
  const gEl = clone.querySelector("g");
  if (gEl) {
    gEl.setAttribute("transform", "");
  }

  // Get the bounding box of all the path elements (the actual map content)
  // We need to do this on the live SVG before zoom is applied
  const liveG = svgEl.querySelector("g");
  let bbox: { x: number; y: number; width: number; height: number };

  if (liveG) {
    // Temporarily reset zoom to get the un-zoomed bounding box
    const origTransform = liveG.getAttribute("transform") || "";
    liveG.setAttribute("transform", "");

    // Only measure county and state paths (not highways, which extend beyond visible area)
    const mapPaths = liveG.querySelectorAll("path.county, path.state");
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    mapPaths.forEach((el) => {
      const b = (el as SVGPathElement).getBBox();
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    });

    liveG.setAttribute("transform", origTransform);

    // Add a small padding around the content
    const pad = 10;
    bbox = {
      x: minX - pad,
      y: minY - pad,
      width: (maxX - minX) + pad * 2,
      height: (maxY - minY) + pad * 2,
    };
  } else {
    const viewBox = svgEl.viewBox.baseVal;
    bbox = { x: 0, y: 0, width: viewBox.width || svgEl.clientWidth, height: viewBox.height || svgEl.clientHeight };
  }

  // Set the viewBox to the tight bounding box so we only capture the map content
  clone.setAttribute("viewBox", `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
  clone.setAttribute("width", String(bbox.width));
  clone.setAttribute("height", String(bbox.height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const svgData = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Use a high-res canvas for crisp output
      const scale = 3;
      const canvas = document.createElement("canvas");
      canvas.width = bbox.width * scale;
      canvas.height = bbox.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, bbox.width, bbox.height);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: canvas.toDataURL("image/png"), width: bbox.width, height: bbox.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to render SVG to image"));
    };
    img.src = url;
  });
}

// Load image as base64 data URL
async function loadImageAsDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
}

export async function exportTerritoryPDF(
  svgEl: SVGSVGElement,
  territories: ClientTerritory[],
  countyNames: Record<string, CountyInfo>
) {
  // Brand colors
  const deepTeal = [38, 75, 93] as const; // #264b5d
  const gold = [253, 205, 7] as const; // #fdcd07

  // Create landscape PDF
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const pageW = pdf.internal.pageSize.getWidth(); // 279.4mm
  const pageH = pdf.internal.pageSize.getHeight(); // 215.9mm
  const margin = 12;

  // --- HEADER ---
  // Gold accent bar at top
  pdf.setFillColor(...gold);
  pdf.rect(0, 0, pageW, 3, "F");

  // Deep teal header background
  pdf.setFillColor(...deepTeal);
  pdf.rect(0, 3, pageW, 22, "F");

  // Logo
  try {
    const logoData = await loadImageAsDataUrl("./csi-logo.png");
    // Logo is roughly 4:1 aspect ratio
    const logoH = 14;
    const logoW = logoH * 3.8;
    pdf.addImage(logoData, "PNG", margin, 6.5, logoW, logoH);
  } catch {
    // Fallback: text if logo fails to load
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("CONNECTOR SPECIALISTS INCORPORATED", margin, 17);
  }

  // Title on the right side of header
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("Territory Map", pageW - margin, 12, { align: "right" });
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  pdf.text(date, pageW - margin, 18, { align: "right" });

  // Gold accent line under header
  pdf.setFillColor(...gold);
  pdf.rect(0, 25, pageW, 1.5, "F");

  // --- LAYOUT: full-width map on top, key grid below ---
  const mapTop = 28;
  const footerHeight = 8;
  const mapAreaWidth = pageW - margin * 2;

  // Calculate how tall the key will be based on territory count
  const keyCols = Math.min(territories.length || 1, 4);
  const keyRows = Math.max(1, Math.ceil(territories.length / keyCols));
  const keyHeaderHeight = 7; // teal bar
  const keyRowHeight = 7;    // each row of entries
  const keyPadding = 6;      // gap above entries + space below
  const keyHeight = keyHeaderHeight + keyPadding + keyRows * keyRowHeight;

  const mapAreaHeight = pageH - mapTop - keyHeight - footerHeight - 4; // 4mm gap between map and key

  let mapBottomY = mapTop + mapAreaHeight; // where the map ends

  try {
    const { dataUrl: mapImage, width: cropW, height: cropH } = await svgToImage(svgEl);
    const mapAspect = cropW / cropH;
    let drawW = mapAreaWidth;
    let drawH = drawW / mapAspect;
    if (drawH > mapAreaHeight) {
      drawH = mapAreaHeight;
      drawW = drawH * mapAspect;
    }
    // Center the map horizontally
    const mapX = (pageW - drawW) / 2;
    const mapY = mapTop + (mapAreaHeight - drawH) / 2;
    pdf.addImage(mapImage, "PNG", mapX, mapY, drawW, drawH);
    mapBottomY = mapY + drawH;
  } catch {
    pdf.setTextColor(150, 150, 150);
    pdf.setFontSize(12);
    pdf.text("Map could not be rendered", pageW / 2, mapTop + mapAreaHeight / 2, {
      align: "center",
    });
  }

  // --- TERRITORY KEY (horizontal grid below map) ---
  const keyTop = mapBottomY + 4;

  // Key header bar — full width
  pdf.setFillColor(...deepTeal);
  pdf.roundedRect(margin, keyTop, pageW - margin * 2, 7, 2, 2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text("TERRITORY KEY", pageW / 2, keyTop + 4.8, { align: "center" });

  // Arrange territories in a multi-column grid
  const colWidth = (pageW - margin * 2) / keyCols;
  const entryTop = keyTop + keyHeaderHeight + 3;

  territories.forEach((t, i) => {
    const col = i % keyCols;
    const row = Math.floor(i / keyCols);
    const x = margin + col * colWidth;
    const y = entryTop + row * keyRowHeight;

    // Color swatch
    const hex = t.color;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    pdf.setFillColor(r, g, b);
    pdf.roundedRect(x, y, 4, 4, 0.8, 0.8, "F");

    // Territory name
    pdf.setTextColor(30, 30, 30);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    // Truncate long names to fit column
    let name = t.name;
    if (pdf.getTextWidth(name) > colWidth - 14) {
      while (pdf.getTextWidth(name + "...") > colWidth - 14 && name.length > 0) {
        name = name.slice(0, -1);
      }
      name += "...";
    }
    pdf.text(name, x + 7, y + 3.5);
  });

  // --- FOOTER ---
  pdf.setFillColor(...gold);
  pdf.rect(0, pageH - 6, pageW, 1, "F");

  pdf.setFontSize(7);
  pdf.setTextColor(100, 100, 100);
  pdf.setFont("helvetica", "normal");
  pdf.text(
    "Connector Specialists Incorporated | Territory Map",
    margin,
    pageH - 3
  );
  pdf.text(
    `Generated ${date}`,
    pageW - margin,
    pageH - 3,
    { align: "right" }
  );

  // Save
  pdf.save("territory-map.pdf");
}
