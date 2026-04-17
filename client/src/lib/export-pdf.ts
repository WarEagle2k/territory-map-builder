import jsPDF, { GState } from "jspdf";
import type { ClientTerritory } from "@/pages/home";

interface CountyInfo {
  name: string;
  state: string;
}

// Rect in SVG coordinates
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Convert SVG element to a PNG data URL via canvas.
// Renders the full region; returns both the full bounding box used for the
// image and (optionally) a tighter focus bounding box the caller can use to
// zoom/position the image on a destination canvas (like a PDF page).
async function svgToImage(
  svgEl: SVGSVGElement,
  focusFips?: Set<string>
): Promise<{ dataUrl: string; fullBbox: Rect; focusBbox: Rect | null }> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const gEl = clone.querySelector("g");
  if (gEl) gEl.setAttribute("transform", "");

  const liveG = svgEl.querySelector("g");
  let fullBbox: Rect;
  let focusBbox: Rect | null = null;

  if (liveG) {
    const origTransform = liveG.getAttribute("transform") || "";
    liveG.setAttribute("transform", "");

    // Full bounds
    const allPaths = liveG.querySelectorAll("path.county, path.state");
    let fMinX = Infinity, fMinY = Infinity, fMaxX = -Infinity, fMaxY = -Infinity;
    allPaths.forEach((el) => {
      const b = (el as SVGPathElement).getBBox();
      fMinX = Math.min(fMinX, b.x);
      fMinY = Math.min(fMinY, b.y);
      fMaxX = Math.max(fMaxX, b.x + b.width);
      fMaxY = Math.max(fMaxY, b.y + b.height);
    });
    const pad = 10;
    fullBbox = {
      x: fMinX - pad,
      y: fMinY - pad,
      width: fMaxX - fMinX + pad * 2,
      height: fMaxY - fMinY + pad * 2,
    };

    // Focus bounds — only the assigned counties
    if (focusFips && focusFips.size > 0) {
      let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
      let found = false;
      liveG.querySelectorAll<SVGPathElement>("path.county").forEach((el) => {
        const fips = el.getAttribute("data-fips");
        if (!fips || !focusFips.has(fips)) return;
        const b = el.getBBox();
        bMinX = Math.min(bMinX, b.x);
        bMinY = Math.min(bMinY, b.y);
        bMaxX = Math.max(bMaxX, b.x + b.width);
        bMaxY = Math.max(bMaxY, b.y + b.height);
        found = true;
      });
      if (found) {
        // Tight focus — just a sliver of padding so territories aren't flush
        // against the map edges. Keeps the zoom aggressive.
        const fpad = Math.max(bMaxX - bMinX, bMaxY - bMinY) * 0.03;
        focusBbox = {
          x: bMinX - fpad,
          y: bMinY - fpad,
          width: bMaxX - bMinX + fpad * 2,
          height: bMaxY - bMinY + fpad * 2,
        };
      }
    }

    liveG.setAttribute("transform", origTransform);
  } else {
    const viewBox = svgEl.viewBox.baseVal;
    fullBbox = {
      x: 0,
      y: 0,
      width: viewBox.width || svgEl.clientWidth,
      height: viewBox.height || svgEl.clientHeight,
    };
  }

  const bbox = fullBbox;

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
      resolve({
        dataUrl: canvas.toDataURL("image/png"),
        fullBbox,
        focusBbox,
      });
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
  countyNames: Record<string, CountyInfo>,
  /** Fill opacity used for territory colors on the map — matches the app so
   *  key swatches and card accents look identical in the PDF. */
  territoryOpacity = 1
) {
  // Brand colors
  const deepTeal = [38, 75, 93] as const; // #264b5d
  const gold = [253, 205, 7] as const; // #fdcd07

  // Create landscape PDF
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const pageW = pdf.internal.pageSize.getWidth(); // 279.4mm
  const pageH = pdf.internal.pageSize.getHeight(); // 215.9mm
  const margin = 12;

  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Load the logo once — both pages use it
  let logoData: string | null = null;
  try {
    logoData = await loadImageAsDataUrl("./csi-logo.png");
  } catch {
    logoData = null;
  }

  // Helper: draw the branded header on the current page
  const drawHeader = (title: string) => {
    // Gold accent bar at top
    pdf.setFillColor(...gold);
    pdf.rect(0, 0, pageW, 3, "F");

    // Deep teal header background
    pdf.setFillColor(...deepTeal);
    pdf.rect(0, 3, pageW, 22, "F");

    // Logo
    if (logoData) {
      const logoH = 14;
      const logoW = logoH * 3.8;
      pdf.addImage(logoData, "PNG", margin, 6.5, logoW, logoH);
    } else {
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("CONNECTOR SPECIALISTS INCORPORATED", margin, 17);
    }

    // Title on the right
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(title, pageW - margin, 12, { align: "right" });
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(date, pageW - margin, 18, { align: "right" });

    // Gold accent line under header
    pdf.setFillColor(...gold);
    pdf.rect(0, 25, pageW, 1.5, "F");
  };

  // Helper: draw the footer on the current page
  const drawFooter = () => {
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
    pdf.text(`Generated ${date}`, pageW - margin, pageH - 3, { align: "right" });
  };

  // Helper: truncate a string so it fits a given px width
  const fit = (s: string, maxW: number): string => {
    if (pdf.getTextWidth(s) <= maxW) return s;
    let out = s;
    while (out.length > 0 && pdf.getTextWidth(out + "...") > maxW) {
      out = out.slice(0, -1);
    }
    return out + "...";
  };

  // Helper: clean + normalize a phone number for display.
  // Strips weird characters and re-formats common US shapes as (XXX) XXX-XXXX.
  // Falls back to the trimmed input if the digit count doesn't look US.
  const formatPhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits[0] === "1") {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return raw.trim();
  };

  // Graphics state that matches the on-screen territory opacity, so the key
  // swatches and card accent bars have the same visual weight as the colors
  // on the map itself.
  const territoryGState = new GState({ opacity: territoryOpacity });
  const solidGState = new GState({ opacity: 1 });

  // === PAGE 1: Map + compact legend ===
  drawHeader("Territory Map");

  // --- LAYOUT: full-width map on top, compact key below ---
  const mapTop = 28;
  const footerHeight = 8;
  const mapAreaWidth = pageW - margin * 2;

  // Compact key: just swatch + name. No header bar — the rows of colored
  // swatches under the map are obviously a legend.
  const keyCols = Math.min(territories.length || 1, 4);
  const keyRows = Math.max(1, Math.ceil(territories.length / keyCols));
  const keyRowHeight = 5.5;
  const keyPadding = 3;
  const keyHeight = keyPadding + keyRows * keyRowHeight;

  const mapAreaHeight = pageH - mapTop - keyHeight - footerHeight - 4;

  let mapBottomY = mapTop + mapAreaHeight;

  // Collect all assigned FIPS so the map crops to focus on the territory area
  const assignedFips = new Set<string>();
  for (const t of territories) {
    for (const f of t.countyFips) assignedFips.add(f);
  }

  try {
    const { dataUrl: mapImage, fullBbox, focusBbox } = await svgToImage(
      svgEl,
      assignedFips
    );

    // Clamp map to the mapArea rectangle — anything that falls outside gets
    // clipped by the page, so we can scale the map up aggressively and still
    // have surrounding context bleed toward the edges without crashing into
    // the header or key.
    const mapAreaX = margin;
    const mapAreaY = mapTop;

    const box = focusBbox ?? fullBbox;
    // Fit the focus box into the map area, then push a little further into
    // fill territory. Pure fit leaves whitespace when focus aspect ≠ map
    // aspect; pure fill (max) clips territories. 70-30 weighted blend feels
    // like "clearly zoomed in" without cropping assigned counties.
    const fitScale = Math.min(
      mapAreaWidth / box.width,
      mapAreaHeight / box.height
    );
    const fillScale = Math.max(
      mapAreaWidth / box.width,
      mapAreaHeight / box.height
    );
    const scale = fitScale * 0.85 + fillScale * 0.15;

    // Full rendered image size on the PDF
    const imgW = fullBbox.width * scale;
    const imgH = fullBbox.height * scale;

    // Position: put the center of the focus box at the center of the mapArea
    const focusCenterX = box.x + box.width / 2;
    const focusCenterY = box.y + box.height / 2;
    const mapCenterX = mapAreaX + mapAreaWidth / 2;
    const mapCenterY = mapAreaY + mapAreaHeight / 2;
    const imgX = mapCenterX - (focusCenterX - fullBbox.x) * scale;
    const imgY = mapCenterY - (focusCenterY - fullBbox.y) * scale;

    // Clip to the map rectangle so the overflow of the full region gets cut
    // at the map area's edges. jsPDF's rect() also strokes a visible outline
    // by default — use the context2d API instead, which creates a path
    // without painting it.
    pdf.saveGraphicsState();
    const ctx = pdf.context2d;
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapAreaX, mapAreaY, mapAreaWidth, mapAreaHeight);
    ctx.clip();
    pdf.addImage(mapImage, "PNG", imgX, imgY, imgW, imgH);
    ctx.restore();
    pdf.restoreGraphicsState();

    mapBottomY = mapAreaY + mapAreaHeight;
  } catch {
    pdf.setTextColor(150, 150, 150);
    pdf.setFontSize(12);
    pdf.text("Map could not be rendered", pageW / 2, mapTop + mapAreaHeight / 2, {
      align: "center",
    });
  }

  // --- COMPACT KEY (just the swatches + names below the map) ---
  const colWidth = (pageW - margin * 2) / keyCols;
  const entryTop = mapBottomY + 5;

  territories.forEach((t, i) => {
    const col = i % keyCols;
    const row = Math.floor(i / keyCols);
    const x = margin + col * colWidth;
    const y = entryTop + row * keyRowHeight;

    // Color swatch — matches the map opacity
    const [r, g, b] = [
      parseInt(t.color.slice(1, 3), 16),
      parseInt(t.color.slice(3, 5), 16),
      parseInt(t.color.slice(5, 7), 16),
    ];
    pdf.setGState(territoryGState);
    pdf.setFillColor(r, g, b);
    pdf.roundedRect(x, y, 3.5, 3.5, 0.7, 0.7, "F");
    pdf.setGState(solidGState);

    // Name
    pdf.setTextColor(30, 30, 30);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    const textX = x + 6;
    const textMaxW = colWidth - 8;
    pdf.text(fit(t.name, textMaxW), textX, y + 3);
  });

  drawFooter();

  // === PAGE 2: Rep directory with full contact details ===
  // Only add if any rep has something to show beyond name
  const hasDetails = territories.some((t) => t.title || t.phone || t.email);
  if (hasDetails) {
    pdf.addPage();
    drawHeader("Sales Representatives");

    // Two-column directory layout
    const dirTop = 34;
    const dirCols = 2;
    const dirColGap = 8;
    const dirColWidth = (pageW - margin * 2 - dirColGap) / dirCols;
    const cardHeight = 24;
    const cardGap = 4;
    const cardsPerCol = Math.max(
      1,
      Math.floor((pageH - dirTop - footerHeight - 2) / (cardHeight + cardGap))
    );

    territories.forEach((t, i) => {
      const col = Math.floor(i / cardsPerCol);
      const row = i % cardsPerCol;
      if (col >= dirCols) return; // overflow guard

      const cardX = margin + col * (dirColWidth + dirColGap);
      const cardY = dirTop + row * (cardHeight + cardGap);

      // Card background (very light)
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.2);
      pdf.roundedRect(cardX, cardY, dirColWidth, cardHeight, 1.5, 1.5, "FD");

      // Colored accent bar on the left — matches the map opacity
      const [r, g, b] = [
        parseInt(t.color.slice(1, 3), 16),
        parseInt(t.color.slice(3, 5), 16),
        parseInt(t.color.slice(5, 7), 16),
      ];
      pdf.setGState(territoryGState);
      pdf.setFillColor(r, g, b);
      pdf.rect(cardX, cardY, 1.5, cardHeight, "F");
      pdf.setGState(solidGState);

      const textX = cardX + 5;
      const textMaxW = dirColWidth - 7;

      // Name
      pdf.setTextColor(30, 30, 30);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text(fit(t.name, textMaxW), textX, cardY + 5);

      // Title (if present)
      let lineY = cardY + 9;
      if (t.title) {
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text(fit(t.title, textMaxW), textX, lineY);
        lineY += 4;
      }

      // Phone
      if (t.phone) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(60, 60, 60);
        pdf.text("Phone:", textX, lineY);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(30, 30, 30);
        pdf.text(fit(formatPhone(t.phone), textMaxW - 15), textX + 13, lineY);
        lineY += 4;
      }

      // Email
      if (t.email) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(60, 60, 60);
        pdf.text("Email:", textX, lineY);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(30, 30, 30);
        pdf.text(fit(t.email, textMaxW - 13), textX + 11, lineY);
        lineY += 4;
      }

      // Counties count (always shown, bottom-right of the card)
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      const countText = `${t.countyFips.length} ${t.countyFips.length === 1 ? "county" : "counties"}`;
      pdf.text(countText, cardX + dirColWidth - 2, cardY + cardHeight - 2, {
        align: "right",
      });
    });

    drawFooter();
  }

  pdf.save("territory-map.pdf");
}
