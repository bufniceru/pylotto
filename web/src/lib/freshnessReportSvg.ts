import type { FreshnessModel } from "../types";

const width = 1400;
const height = 1900;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function gapLabel(gap: number | null): string {
  return gap === null ? "new" : String(gap);
}

function bucketColor(model: FreshnessModel, bucketId: string): string {
  return model.buckets.find((bucket) => bucket.id === bucketId)?.color ?? "#7b8798";
}

function text(value: string | number, x: number, y: number, className = "text"): string {
  return `<text x="${x}" y="${y}" class="${className}">${escapeXml(String(value))}</text>`;
}

function panel(x: number, y: number, panelWidth: number, panelHeight: number, title: string): string {
  return `<rect x="${x}" y="${y}" width="${panelWidth}" height="${panelHeight}" class="panel" rx="10" />
${text(title, x + 22, y + 38, "panel-title")}`;
}

function buildBucketLegend(model: FreshnessModel): string {
  const x = 48;
  const y = 150;
  const cardWidth = 314;
  const cardHeight = 82;

  return `${panel(32, 112, 1336, 234, "Freshness Characterization")}
${model.buckets
  .map((bucket, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const cardX = x + column * 326;
    const cardY = y + row * 94;
    return `<rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" class="legend-card" rx="8" />
<rect x="${cardX + 14}" y="${cardY + 14}" width="12" height="54" fill="${bucket.color}" rx="4" />
${text(bucket.label, cardX + 38, cardY + 32, "legend-title")}
<text x="${cardX + 38}" y="${cardY + 56}" class="small">${escapeXml(bucket.description)}</text>`;
  })
  .join("")}`;
}

function buildBucketChart(model: FreshnessModel): string {
  const x = 32;
  const y = 374;
  const chartX = x + 58;
  const chartBottom = y + 284;
  const maxDrawn = Math.max(...model.bucketSummaries.map((summary) => summary.drawnCount), 1);

  return `${panel(x, y, 650, 354, "Historical Bucket Frequency")}
<line x1="${chartX}" x2="${x + 620}" y1="${chartBottom}" y2="${chartBottom}" class="axis" />
${model.bucketSummaries
  .map((summary, index) => {
    const barHeight = Math.max(3, (summary.drawnCount / maxDrawn) * 210);
    const barX = chartX + index * 72;
    const barY = chartBottom - barHeight;
    return `<rect x="${barX}" y="${barY}" width="38" height="${barHeight}" fill="${bucketColor(
      model,
      summary.bucketId,
    )}" rx="7" />
${text(summary.drawnCount, barX + 19, barY - 8, "chart-value")}
${text(summary.label, barX + 19, chartBottom + 24, "chart-label")}`;
  })
  .join("")}`;
}

function buildBucketTable(model: FreshnessModel): string {
  const x = 718;
  const y = 374;
  const rowHeight = 31;
  const headerY = y + 72;

  return `${panel(x, y, 650, 354, "Bucket Hit Rates")}
<rect x="${x + 22}" y="${headerY - 22}" width="606" height="30" class="table-head" rx="6" />
${text("Bucket", x + 38, headerY, "table-head-text")}
${text("Drawn", x + 220, headerY, "table-head-text")}
${text("Available", x + 330, headerY, "table-head-text")}
${text("Hit rate", x + 486, headerY, "table-head-text")}
${model.bucketSummaries
  .map((summary, index) => {
    const rowY = headerY + 36 + index * rowHeight;
    return `${text(summary.label, x + 38, rowY, "table-text")}
${text(summary.drawnCount, x + 220, rowY, "table-text")}
${text(summary.exposureCount, x + 330, rowY, "table-text")}
${text(percent(summary.hitRate), x + 486, rowY, "table-text")}`;
  })
  .join("")}`;
}

function buildLatestProfile(model: FreshnessModel): string {
  const x = 32;
  const y = 756;
  const profile = model.latestProfile;

  if (!profile) {
    return `${panel(x, y, 650, 260, "Latest Draw Profile")}${text("No draw data available.", x + 22, y + 86)}`;
  }

  return `${panel(x, y, 650, 260, `Latest Draw Profile: ${profile.date}`)}
<rect x="${x + 22}" y="${y + 58}" width="606" height="42" class="signature" rx="8" />
${text(profile.signature, x + 40, y + 85, "signature-text")}
${profile.numbers
  .map((number, index) => {
    const cardX = x + 26 + (index % 3) * 202;
    const cardY = y + 124 + Math.floor(index / 3) * 62;
    return `<rect x="${cardX}" y="${cardY}" width="184" height="48" class="number-card" rx="8" />
<rect x="${cardX}" y="${cardY}" width="8" height="48" fill="${bucketColor(model, number.bucketId)}" rx="4" />
${text(number.number, cardX + 22, cardY + 31, "number-large")}
${text(`${number.label} | gap ${gapLabel(number.gap)}`, cardX + 74, cardY + 30, "small-bold")}`;
  })
  .join("")}`;
}

function buildSituations(model: FreshnessModel): string {
  const x = 718;
  const y = 756;
  const maxCount = Math.max(...model.situations.map((situation) => situation.count), 1);

  return `${panel(x, y, 650, 610, "Most Common Six-Number Situations")}
${model.situations
  .slice(0, 16)
  .map((situation, index) => {
    const rowY = y + 68 + index * 32;
    const barWidth = Math.max(8, (situation.count / maxCount) * 192);
    return `${text(situation.signature, x + 22, rowY, "situation-text")}
${text(`${situation.count} | ${percent(situation.percent)}`, x + 400, rowY, "table-text")}
<rect x="${x + 22}" y="${rowY + 8}" width="208" height="7" class="mini-track" rx="4" />
<rect x="${x + 22}" y="${rowY + 8}" width="${barWidth}" height="7" class="mini-bar" rx="4" />`;
  })
  .join("")}`;
}

function buildPredictionGrid(model: FreshnessModel): string {
  const x = 32;
  const y = 1044;

  return `${panel(x, y, 650, 322, "Next Draw Freshness Prediction")}
${model.predictions
  .map((prediction, index) => {
    const cellX = x + 26 + (index % 7) * 86;
    const cellY = y + 64 + Math.floor(index / 7) * 34;
    return `<rect x="${cellX}" y="${cellY}" width="72" height="28" class="prediction-cell" rx="7" />
<rect x="${cellX}" y="${cellY + 23}" width="72" height="5" fill="${bucketColor(model, prediction.bucketId)}" rx="3" />
${text(prediction.number, cellX + 15, cellY + 19, "prediction-number")}
${text(`#${prediction.rank}`, cellX + 42, cellY + 19, "prediction-rank")}`;
  })
  .join("")}`;
}

function buildTopPredictionTable(model: FreshnessModel): string {
  const x = 32;
  const y = 1394;

  return `${panel(x, y, 1336, 404, "Top Freshness-Based Predictions")}
<rect x="${x + 22}" y="${y + 58}" width="1292" height="30" class="table-head" rx="6" />
${text("Rank", x + 44, y + 80, "table-head-text")}
${text("Number", x + 160, y + 80, "table-head-text")}
${text("Freshness", x + 300, y + 80, "table-head-text")}
${text("Current gap", x + 540, y + 80, "table-head-text")}
${text("Bucket hit rate", x + 760, y + 80, "table-head-text")}
${model.predictions
  .slice(0, 12)
  .map((prediction, index) => {
    const rowY = y + 122 + index * 22;
    return `${text(prediction.rank, x + 44, rowY, "table-text")}
${text(prediction.number, x + 160, rowY, "table-text")}
${text(prediction.label, x + 300, rowY, "table-text")}
${text(gapLabel(prediction.currentGap), x + 540, rowY, "table-text")}
${text(percent(prediction.hitRate), x + 760, rowY, "table-text")}`;
  })
  .join("")}`;
}

export function buildFreshnessReportSvg(model: FreshnessModel): string {
  const latestDate = model.latestProfile?.date ?? "n/a";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<style>
.bg { fill: #f4f7fb; }
.title { font: 800 34px "Segoe UI", Arial, sans-serif; fill: #172033; }
.subtitle { font: 700 16px "Segoe UI", Arial, sans-serif; fill: #51607f; }
.panel { fill: #ffffff; stroke: rgba(23, 32, 51, 0.10); stroke-width: 1; }
.panel-title { font: 800 18px "Segoe UI", Arial, sans-serif; fill: #172033; }
.legend-card, .number-card, .prediction-cell { fill: #f8fafc; stroke: rgba(23, 32, 51, 0.08); stroke-width: 1; }
.legend-title { font: 800 14px "Segoe UI", Arial, sans-serif; fill: #172033; }
.small { font: 12px "Segoe UI", Arial, sans-serif; fill: #5d687c; }
.small-bold { font: 800 12px "Segoe UI", Arial, sans-serif; fill: #5d687c; }
.axis { stroke: rgba(78, 92, 118, 0.5); stroke-width: 1.4; }
.chart-label { font: 700 11px "Segoe UI", Arial, sans-serif; fill: #42506a; text-anchor: middle; }
.chart-value { font: 800 11px "Segoe UI", Arial, sans-serif; fill: #42506a; text-anchor: middle; }
.table-head { fill: #eef3fb; }
.table-head-text { font: 800 13px "Segoe UI", Arial, sans-serif; fill: #4c5d78; }
.table-text { font: 13px "Segoe UI", Arial, sans-serif; fill: #25334b; }
.signature { fill: #eef3fb; }
.signature-text { font: 800 14px "Segoe UI", Arial, sans-serif; fill: #25334b; }
.number-large { font: 800 21px "Segoe UI", Arial, sans-serif; fill: #172033; }
.situation-text { font: 700 12px "Segoe UI", Arial, sans-serif; fill: #172033; }
.mini-track { fill: #edf1f6; }
.mini-bar { fill: #f0b44f; }
.prediction-number { font: 800 14px "Segoe UI", Arial, sans-serif; fill: #172033; }
.prediction-rank { font: 800 11px "Segoe UI", Arial, sans-serif; fill: #5d687c; }
</style>
<rect class="bg" width="100%" height="100%" />
${text("PyLotto Freshness Report", 32, 54, "title")}
${text(`Historical draws: ${model.drawCount} | situations: ${model.situationCount} | latest draw: ${latestDate}`, 34, 84, "subtitle")}
${buildBucketLegend(model)}
${buildBucketChart(model)}
${buildBucketTable(model)}
${buildLatestProfile(model)}
${buildPredictionGrid(model)}
${buildSituations(model)}
${buildTopPredictionTable(model)}
${text("Shareable SVG generated by PyLotto. Freshness rank is based only on historical hit rate by current last-seen bucket.", 32, 1858, "subtitle")}
</svg>`;
}
