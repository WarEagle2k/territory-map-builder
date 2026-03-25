import jsPDF from "jspdf";
import type { ClientTerritory } from "@/pages/home";

interface CountyInfo {
  name: string;
  state: string;
}

// Convert SVG element to a PNG data URL via canvas
async function svgToImage(svgEl: SVGSVGElement): Promise<string> {
  // Get the viewBox dimensions — this is the actual coordinate space of the map
  const viewBox = svgEl.viewBox.baseVal;
  const vbWidth = viewBox.width || svgEl.clientWidth;
  const vbHeight = viewBox.height || svgEl.clientHeight;

  // Clone the SVG so we can modify it without affecting the live DOM
  const clone = svgEl.cloneNode(true) as SVGSVGElement;

  // Reset the D3 zoom transform on the clone
  const gEl = clone.querySelector("g");
  if (gEl) {
    gEl.setAttribute("transform", "");
  }

  // Set explicit width/height attributes so the image renders at the right size
  clone.setAttribute("width", String(vbWidth));
  clone.setAttribute("height", String(vbHeight));
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
      canvas.width = vbWidth * scale;
      canvas.height = vbHeight * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, vbWidth, vbHeight);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
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

  // --- MAP ---
  const mapTop = 28;
  const keyWidth = 70;
  // Give the map the full width minus just the key column
  const mapAreaWidth = pageW - margin - keyWidth - 6;
  const mapAreaHeight = pageH - mapTop - 12; // leave room for footer

  try {
    const mapImage = await svgToImage(svgEl);
    // Calculate aspect ratio to fit within the available area
    const svgAspect = svgEl.viewBox.baseVal.width / svgEl.viewBox.baseVal.height;
    let drawW = mapAreaWidth;
    let drawH = drawW / svgAspect;
    if (drawH > mapAreaHeight) {
      drawH = mapAreaHeight;
      drawW = drawH * svgAspect;
    }
    // Left-align the map with a small margin
    const mapX = margin / 2;
    const mapY = mapTop + (mapAreaHeight - drawH) / 2;
    pdf.addImage(mapImage, "PNG", mapX, mapY, drawW, drawH);
  } catch {
    pdf.setTextColor(150, 150, 150);
    pdf.setFontSize(12);
    pdf.text("Map could not be rendered", margin + mapWidth / 2, mapTop + mapHeight / 2, {
      align: "center",
    });
  }

  // --- TERRITORY KEY ---
  const keyX = pageW - margin - keyWidth;
  const keyTop = mapTop;

  // Key header
  pdf.setFillColor(...deepTeal);
  pdf.roundedRect(keyX, keyTop, keyWidth, 8, 2, 2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("TERRITORY KEY", keyX + keyWidth / 2, keyTop + 5.5, { align: "center" });

  // Key entries
  let keyY = keyTop + 13;
  pdf.setFontSize(8);

  for (const t of territories) {
    // Check if we need a new page
    if (keyY + 8 > pageH - 15) {
      // Just stop — in practice, the key should fit
      pdf.setTextColor(100, 100, 100);
      pdf.setFont("helvetica", "italic");
      pdf.text("... and more", keyX + 4, keyY + 3);
      break;
    }

    // Color swatch
    const hex = t.color;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    pdf.setFillColor(r, g, b);
    pdf.roundedRect(keyX + 2, keyY, 5, 5, 1, 1, "F");

    // Territory name
    pdf.setTextColor(30, 30, 30);
    pdf.setFont("helvetica", "bold");
    pdf.text(t.name, keyX + 10, keyY + 3.5);

    // County count
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 100, 100);
    pdf.text(`${t.countyFips.length} counties`, keyX + 10, keyY + 7.5);

    keyY += 12;

    // Subtle separator
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.2);
    pdf.line(keyX + 2, keyY - 2, keyX + keyWidth - 2, keyY - 2);
  }

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
