import type { Restaurant, RoutePlan, VisitLogMap } from "../types";

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function pdfSafeLine(s: string): string {
  return s
    .replace(/\u2013|\u2014|\u2212/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2026/g, "...");
}

export async function downloadRoutePlanPdf(
  plan: RoutePlan,
  visitLog: VisitLogMap,
  allRestaurants: Restaurant[]
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = 52;

  const ensure = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = 52;
    }
  };

  const writeLines = (text: string, fontSize = 10, style: "normal" | "bold" = "normal") => {
    const safe = pdfSafeLine(text);
    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(safe, maxW) as string[];
    const lh = fontSize * 1.28;
    for (const line of lines) {
      ensure(lh + 2);
      doc.text(line, margin, y);
      y += lh;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  ensure(24);
  doc.text("Portland Pizza Week - your routes", margin, y);
  y += 26;

  doc.setFont("helvetica", "normal");
  writeLines(`Exported ${new Date().toLocaleString("en-US")}`, 10);

  const hours = Math.floor(plan.totalDriveMinutes / 60);
  const mins = plan.totalDriveMinutes % 60;
  const drive = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;
  writeLines(
    `Totals: ${plan.totalRestaurants} stops - ${drive} driving - Must-eats ${plan.mustEatsCovered}/${plan.mustEatsTotal} - ${plan.days.filter((d) => d.stops.length > 0).length} active days`,
    10
  );
  y += 8;

  if (plan.warnings.length > 0) {
    writeLines("Notes:", 11, "bold");
    for (const w of plan.warnings) {
      writeLines(`- ${w}`, 9);
    }
    y += 8;
  }

  for (const day of plan.days) {
    writeLines(formatDayLabel(day.date), 12, "bold");
    if (day.stops.length === 0) {
      writeLines("No stops.", 10);
      y += 6;
      continue;
    }
    writeLines(
      `Start / return: ${day.routeStart.lat.toFixed(4)}, ${day.routeStart.lng.toFixed(4)} - about ${day.totalDriveMinutes} min driving this day`,
      9
    );
    for (const stop of day.stops) {
      const r = stop.restaurant;
      const from = stop.order === 1 ? "from start" : `from previous stop`;
      writeLines(
        `${stop.order}. ${r.name} - ${stop.driveMinutesFromPrevious} min ${from}, ${stop.distanceMilesFromPrevious.toFixed(1)} mi`,
        10,
        "bold"
      );
      writeLines(`   ${r.address}`, 9);
      writeLines(`   ${r.special}`, 9);
      y += 4;
    }
    writeLines("Return to start.", 9);
    y += 14;
  }

  if (visitLog.size > 0) {
    const byId = new Map(allRestaurants.map((r) => [r.id, r]));
    writeLines("Visit diary", 12, "bold");
    const entries = [...visitLog.entries()].sort(([a], [b]) => {
      const na = byId.get(a)?.name ?? a;
      const nb = byId.get(b)?.name ?? b;
      return na.localeCompare(nb, undefined, { sensitivity: "base" });
    });
    for (const [id, v] of entries) {
      const r = byId.get(id);
      const name = r?.name ?? id;
      const scorePart =
        v.score !== undefined && Number.isFinite(v.score)
          ? `Score: ${v.score.toFixed(1)} / 10`
          : "Score: (none)";
      writeLines(`${name} — ${scorePart}`, 10, "bold");
      if (v.review && v.review.trim()) {
        writeLines(`   ${v.review.trim()}`, 9);
      }
      y += 4;
    }
    y += 8;
  }

  doc.save(`pizza-week-routes-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function downloadRoutePlanPng(): Promise<void> {
  const el = document.getElementById("route-plan-print-root");
  if (!el) throw new Error("Missing #route-plan-print-root");

  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(el, {
    scale: Math.min(2, Math.max(1.25, window.devicePixelRatio || 1)),
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    onclone: (clonedDoc) => {
      clonedDoc.querySelectorAll(".export-exclude").forEach((node) => {
        (node as HTMLElement).style.setProperty("display", "none", "important");
      });
      clonedDoc.querySelectorAll(".route-plan-leaflet-map").forEach((node) => {
        (node as HTMLElement).style.setProperty("display", "none", "important");
      });
    },
  });

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("PNG export failed"));
          return;
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `pizza-week-routes-${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
        resolve();
      },
      "image/png",
      0.92
    );
  });
}
