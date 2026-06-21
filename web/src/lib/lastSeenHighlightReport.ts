import type {
  LastSeenDifferenceHighlightModel,
  LastSeenGapHighlightModel,
  LastSeenHighlightModel,
} from "../types";

const svgWidth = 1680;
const chartLeft = 70;
const chartTop = 90;
const chartBottom = 45;
const chartRight = 30;
const rowHeight = 30;
const pointRadius = 13.5;
const undrawnStripWidth = (pointRadius * 2) / 3;
const gapHighlightRibbonWidth = 9;
const topGapRibbonMatchWidth = 18;
const plotWidth = svgWidth - chartLeft - chartRight;
const topGapRibbonY = chartTop - 48;
const topGapRibbonHeight = 30;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function xForNumber(number: number): number {
  return chartLeft + ((number - 1) / 48) * plotWidth;
}

function xForGap(model: LastSeenGapHighlightModel, gap: number): number {
  if (model.maxGap <= 0) {
    return chartLeft + plotWidth / 2;
  }

  return chartLeft + (gap / model.maxGap) * plotWidth;
}

function xForDifference(model: LastSeenDifferenceHighlightModel, difference: number): number {
  if (model.maxDifference <= 1) {
    return chartLeft + plotWidth / 2;
  }

  return chartLeft + ((difference - 1) / (model.maxDifference - 1)) * plotWidth;
}

function yForDraw(
  model: LastSeenHighlightModel | LastSeenGapHighlightModel | LastSeenDifferenceHighlightModel,
  drawIndex: number,
): number {
  return chartTop + (model.drawCount - 1 - drawIndex) * rowHeight;
}

function displayDrawIndex(
  model: LastSeenHighlightModel | LastSeenGapHighlightModel | LastSeenDifferenceHighlightModel,
  drawIndex: number,
): number {
  return model.drawCount - drawIndex;
}

function yTicks(
  model: LastSeenHighlightModel | LastSeenGapHighlightModel | LastSeenDifferenceHighlightModel,
): { drawIndex: number; label: number }[] {
  const step = Math.max(1, Math.floor(model.drawCount / 30));
  const ticks: { drawIndex: number; label: number }[] = [];

  for (let index = model.drawCount - 1; index >= 0; index -= step) {
    ticks.push({
      drawIndex: index,
      label: displayDrawIndex(model, index),
    });
  }

  return ticks;
}

function chartChrome({
  axisLabel,
  horizontalEnd,
  horizontalStart,
  model,
  points,
  referenceRibbon,
  title,
  xTickLabels,
  topTicks,
  verticalGuides,
}: {
  axisLabel: string;
  horizontalEnd: number;
  horizontalStart: number;
  model: LastSeenHighlightModel | LastSeenGapHighlightModel | LastSeenDifferenceHighlightModel;
  points: string;
  referenceRibbon: string;
  title: string;
  xTickLabels: string;
  topTicks: string;
  verticalGuides: string;
}): string {
  const chartHeight = Math.max(320, chartTop + model.drawCount * rowHeight + chartBottom);
  const plotHeight = Math.max(1, model.drawCount - 1) * rowHeight;
  const rowDrawIndices = Array.from(
    { length: model.drawCount },
    (_value, index) => model.drawCount - 1 - index,
  );

  const horizontalGuides = rowDrawIndices
    .map((drawIndex) => {
      const className =
        displayDrawIndex(model, drawIndex) % 5 === 0
          ? "horizontal-guide major"
          : "horizontal-guide";
      return `<line x1="${horizontalStart}" x2="${horizontalEnd}" y1="${yForDraw(
        model,
        drawIndex,
      )}" y2="${yForDraw(model, drawIndex)}" class="${className}" />`;
    })
    .join("");

  const yTickLabels = yTicks(model)
    .map(
      (tick) =>
        `<text x="${chartLeft - 16}" y="${yForDraw(model, tick.drawIndex) + 4}" class="tick-label y-tick">${tick.label}</text>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${chartHeight}" viewBox="0 0 ${svgWidth} ${chartHeight}">
<style>
.highlight-chart-bg { fill: #ffffff; }
.chart-title { font: 700 22px "Segoe UI", "Helvetica Neue", sans-serif; fill: #172033; }
.axis-label { font: 700 14px "Segoe UI", "Helvetica Neue", sans-serif; fill: #51607f; text-anchor: middle; }
.tick-label { font: 11px "Segoe UI", "Helvetica Neue", sans-serif; fill: #72809d; }
.x-tick, .top-x-tick { text-anchor: middle; }
.top-x-tick { font-size: 11px; font-weight: 800; fill: #ffffff; }
.top-number-strip { fill: #123b72; }
.top-gap-ribbon { fill: #0b2f5e; }
.top-gap-ribbon-match { fill: #2fa84f; }
.top-gap-ribbon-stripe { stroke: rgba(255, 255, 255, 0.7); stroke-width: 1; }
.top-gap-ribbon-stripe.major { stroke: #ffd08a; stroke-width: 2; }
.x-tick.major, .y-tick { font-weight: 700; fill: #42506a; }
.vertical-guide { stroke: rgba(78, 92, 118, 0.28); stroke-dasharray: 4 6; stroke-width: 1; }
.vertical-guide.major { stroke: rgba(78, 92, 118, 0.58); stroke-width: 2; }
.gap-unit-guide { stroke: rgba(242, 166, 79, 0.32); stroke-dasharray: none; }
.gap-unit-guide.major { stroke: rgba(242, 166, 79, 0.68); }
.current-reference-ribbon { fill: rgba(128, 128, 128, 0.1); }
.horizontal-guide { stroke: rgba(162, 170, 187, 0.72); stroke-width: 1; }
.horizontal-guide.major { stroke: rgba(78, 92, 118, 0.58); stroke-width: 2.4; }
.point-default { fill: #2e63c5; }
.point-highlighted { fill: #d93a3a; }
.point-reference-range { fill: rgba(128, 128, 128, 0.55); }
.undrawn-strip { fill: rgba(255, 190, 106, 0.62); }
.gap-highlight-ribbon { fill: rgba(255, 190, 106, 0.72); stroke: rgba(222, 124, 36, 0.55); stroke-width: 1; }
.point-label { font: 700 15px "Segoe UI", "Helvetica Neue", sans-serif; fill: #ffe25d; text-anchor: middle; }
</style>
<rect class="highlight-chart-bg" width="100%" height="100%" />
<text class="chart-title" x="${chartLeft}" y="34">${escapeXml(title)}</text>
<text class="axis-label" x="${svgWidth / 2}" y="${chartHeight - 10}">${escapeXml(axisLabel)}</text>
<text class="axis-label" x="18" y="${chartHeight / 2}" transform="rotate(-90, 18, 240)">Draw Index</text>
${verticalGuides}
${referenceRibbon}
${topTicks}
${horizontalGuides}
${yTickLabels}
${xTickLabels}
${points}
</svg>`;
}

export function buildLastSeenHighlightReportSvg(model: LastSeenHighlightModel): string {
  const plotHeight = Math.max(1, model.drawCount - 1) * rowHeight;
  const referenceDate = model.referenceDrawDate ?? "n/a";
  const title = `Last Draw (Index) Where Each Number Appeared up to ${referenceDate}`;

  const verticalGuides = Array.from({ length: 49 }, (_value, index) => {
    const number = index + 1;
    const className = number % 5 === 0 ? "vertical-guide major" : "vertical-guide";
    return `<line x1="${xForNumber(number)}" x2="${xForNumber(number)}" y1="${chartTop - 10}" y2="${
      chartTop + plotHeight + 10
    }" class="${className}" />`;
  }).join("");

  const topTicks = Array.from({ length: 49 }, (_value, index) => {
    const number = index + 1;

    return `<text x="${xForNumber(number)}" y="${chartTop - 25}" class="tick-label top-x-tick">${number}</text>`;
  }).join("");

  const xTickLabels = Array.from({ length: 49 }, (_value, index) => {
    const number = index + 1;
    const className = number % 5 === 0 ? "tick-label x-tick major" : "tick-label x-tick";
    return `<text x="${xForNumber(number)}" y="${chartTop + plotHeight + 28}" class="${className}">${number}</text>`;
  }).join("");

  const referenceRibbon =
    model.referenceDrawIndex === null
      ? ""
      : `<rect x="${xForNumber(1) - 11}" y="${
          yForDraw(model, model.referenceDrawIndex) - 14
        }" width="${plotWidth + 22}" height="28" class="current-reference-ribbon" />`;

  const undrawnStrips =
    model.referenceDrawIndex === null
      ? ""
      : model.points
          .filter((point) => point.highlighted && point.drawIndex < (model.referenceDrawIndex ?? 0))
          .map((point) => {
            const pointY = yForDraw(model, point.drawIndex);
            const referenceY = yForDraw(model, model.referenceDrawIndex ?? point.drawIndex);
            const topY = referenceY + pointRadius;
            const bottomY = pointY - pointRadius;
            const height = Math.max(0, bottomY - topY);

            if (height <= 0) {
              return "";
            }

            return `<rect x="${xForNumber(point.number) - undrawnStripWidth / 2}" y="${topY}" width="${undrawnStripWidth}" height="${height}" rx="4.5" class="undrawn-strip" />`;
          })
          .join("");

  const points = model.points
    .map((point) => {
      const pointClass =
        model.referenceDrawIndex !== null && point.drawIndex > model.referenceDrawIndex
          ? "point-reference-range"
          : point.highlighted
            ? "point-highlighted"
            : "point-default";
      const x = xForNumber(point.number);
      const y = yForDraw(model, point.drawIndex);

      return `<g><circle cx="${x}" cy="${y}" class="${pointClass}" r="${pointRadius}" /><text x="${x}" y="${
        y + 5
      }" class="point-label">${point.gap}</text></g>`;
    })
    .join("");

  return chartChrome({
    axisLabel: "Number",
    horizontalEnd: xForNumber(49),
    horizontalStart: xForNumber(1),
    model,
    points: `${undrawnStrips}${points}`,
    referenceRibbon,
    title,
    topTicks: `<rect x="${xForNumber(1) - 15}" y="${chartTop - 42}" width="${plotWidth + 30}" height="24" class="top-number-strip" rx="8" />${topTicks}`,
    verticalGuides,
    xTickLabels,
  });
}

export function buildLastSeenGapHighlightReportSvg(model: LastSeenGapHighlightModel): string {
  const plotHeight = Math.max(1, model.drawCount - 1) * rowHeight;
  const referenceDate = model.referenceDrawDate ?? "n/a";
  const title = `Last Draw (Index) Where Each Gap Appeared up to ${referenceDate}`;
  const gapStep = model.maxGap > 60 ? 5 : 1;
  const gapTicks = Array.from(
    { length: Math.floor(model.maxGap / gapStep) + 1 },
    (_value, index) => index * gapStep,
  );
  const gapUnits = Array.from({ length: model.maxGap + 1 }, (_value, gap) => gap);
  const referenceDrawGaps = new Set(model.referenceGaps);

  const verticalGuides = gapUnits
    .map((gap) => {
      const className =
        gap % 5 === 0 ? "vertical-guide gap-unit-guide major" : "vertical-guide gap-unit-guide";
      return `<line x1="${xForGap(model, gap)}" x2="${xForGap(model, gap)}" y1="${
        chartTop - 10
      }" y2="${chartTop + plotHeight + 10}" class="${className}" />`;
    })
    .join("");

  const topRibbonStripes = gapUnits
    .map((gap) => {
      const className =
        gap % 5 === 0 ? "top-gap-ribbon-stripe major" : "top-gap-ribbon-stripe";
      return `<line x1="${xForGap(model, gap)}" x2="${xForGap(model, gap)}" y1="${
        topGapRibbonY + 3
      }" y2="${topGapRibbonY + topGapRibbonHeight - 3}" class="${className}" />`;
    })
    .join("");

  const topTicks = gapUnits
    .map((gap) => {
      const matchBackground = referenceDrawGaps.has(gap)
        ? `<rect x="${
            xForGap(model, gap) - topGapRibbonMatchWidth / 2
          }" y="${topGapRibbonY + 3}" width="${topGapRibbonMatchWidth}" height="${
            topGapRibbonHeight - 6
          }" class="top-gap-ribbon-match" rx="6" />`
        : "";
      return `${matchBackground}<text x="${xForGap(model, gap)}" y="${
        topGapRibbonY + 21
      }" class="tick-label top-x-tick">${gap}</text>`;
    })
    .join("");

  const xTickLabels = gapTicks
    .map((gap) => {
      const className = gap % 5 === 0 ? "tick-label x-tick major" : "tick-label x-tick";
      return `<text x="${xForGap(model, gap)}" y="${
        chartTop + plotHeight + 28
      }" class="${className}">${gap}</text>`;
    })
    .join("");

  const referenceRibbon =
    model.referenceDrawIndex === null
      ? ""
      : `<rect x="${xForGap(model, 0) - 11}" y="${
          yForDraw(model, model.referenceDrawIndex) - 14
        }" width="${plotWidth + 22}" height="28" class="current-reference-ribbon" />`;

  const highlightRibbons = model.points
    .filter((point) => point.highlighted && referenceDrawGaps.has(point.gap))
    .map((point) => {
      const topY = topGapRibbonY + topGapRibbonHeight;
      const bottomY = yForDraw(model, point.drawIndex) - pointRadius;
      const height = Math.max(0, bottomY - topY);

      if (height <= 0) {
        return "";
      }

      return `<rect x="${
        xForGap(model, point.gap) - gapHighlightRibbonWidth / 2
      }" y="${topY}" width="${gapHighlightRibbonWidth}" height="${height}" rx="4.5" class="gap-highlight-ribbon" />`;
    })
    .join("");

  const points = model.points
    .map((point) => {
      const pointClass =
        model.referenceDrawIndex !== null && point.drawIndex > model.referenceDrawIndex
          ? "point-reference-range"
          : point.highlighted
            ? "point-highlighted"
            : "point-default";
      const x = xForGap(model, point.gap);
      const y = yForDraw(model, point.drawIndex);

      return `<g><circle cx="${x}" cy="${y}" class="${pointClass}" r="13.5" /><text x="${x}" y="${
        y + 5
      }" class="point-label">${point.gapGap}</text></g>`;
    })
    .join("");

  return chartChrome({
    axisLabel: "Gap",
    horizontalEnd: xForGap(model, model.maxGap),
    horizontalStart: xForGap(model, 0),
    model,
    points: `${highlightRibbons}${points}`,
    referenceRibbon,
    title,
    topTicks: `<rect x="${xForGap(model, 0) - 15}" y="${topGapRibbonY}" width="${
      plotWidth + 30
    }" height="${topGapRibbonHeight}" class="top-gap-ribbon" rx="8" />${topRibbonStripes}${topTicks}`,
    verticalGuides,
    xTickLabels,
  });
}

export function buildLastSeenDifferenceHighlightReportSvg(
  model: LastSeenDifferenceHighlightModel,
): string {
  const plotHeight = Math.max(1, model.drawCount - 1) * rowHeight;
  const referenceDate = model.referenceDrawDate ?? "n/a";
  const title = `Last Draw (Index) Where Each Sorted Draw Difference Appeared up to ${referenceDate}`;
  const differenceStep = model.maxDifference > 60 ? 5 : 1;
  const differenceTicks = Array.from(
    { length: Math.floor((model.maxDifference - 1) / differenceStep) + 1 },
    (_value, index) => 1 + index * differenceStep,
  );

  const verticalGuides = differenceTicks
    .map((difference) => {
      const className = difference % 5 === 0 ? "vertical-guide major" : "vertical-guide";
      return `<line x1="${xForDifference(model, difference)}" x2="${xForDifference(
        model,
        difference,
      )}" y1="${chartTop - 10}" y2="${chartTop + plotHeight + 10}" class="${className}" />`;
    })
    .join("");

  const topTicks = differenceTicks
    .map((difference) =>
      difference % 5 === 0
        ? `<text x="${xForDifference(model, difference)}" y="${chartTop - 18}" class="tick-label top-x-tick">${difference}</text>`
        : "",
    )
    .join("");

  const xTickLabels = differenceTicks
    .map((difference) => {
      const className =
        difference % 5 === 0 ? "tick-label x-tick major" : "tick-label x-tick";
      return `<text x="${xForDifference(model, difference)}" y="${
        chartTop + plotHeight + 28
      }" class="${className}">${difference}</text>`;
    })
    .join("");

  const referenceRibbon =
    model.referenceDrawIndex === null
      ? ""
      : `<rect x="${xForDifference(model, 1) - 11}" y="${
          yForDraw(model, model.referenceDrawIndex) - 14
        }" width="${plotWidth + 22}" height="28" class="current-reference-ribbon" />`;

  const points = model.points
    .map((point) => {
      const pointClass =
        model.referenceDrawIndex !== null && point.drawIndex > model.referenceDrawIndex
          ? "point-reference-range"
          : point.highlighted
            ? "point-highlighted"
            : "point-default";
      const x = xForDifference(model, point.difference);
      const y = yForDraw(model, point.drawIndex);

      return `<g><circle cx="${x}" cy="${y}" class="${pointClass}" r="13.5" /><text x="${x}" y="${
        y + 5
      }" class="point-label">${point.difference}</text></g>`;
    })
    .join("");

  return chartChrome({
    axisLabel: "Difference",
    horizontalEnd: xForDifference(model, model.maxDifference),
    horizontalStart: xForDifference(model, 1),
    model,
    points,
    referenceRibbon,
    title,
    topTicks,
    verticalGuides,
    xTickLabels,
  });
}
