import type {
  EnrichedHistory,
  LastSeenGapHighlightModel,
  LastSeenGapHighlightPoint,
} from "../types";
import { limitHistory, refreshHistoryGaps } from "./history";

function gapLastSeenIndexForReferenceDraw(
  history: EnrichedHistory,
  referenceDrawIndex: number,
  maxGap: number,
): Map<number, number | null> {
  const lastSeen = new Map<number, number | null>();

  for (let gap = 0; gap <= maxGap; gap += 1) {
    lastSeen.set(gap, null);
  }

  for (let drawIndex = 0; drawIndex <= referenceDrawIndex; drawIndex += 1) {
    for (const number of history.draws[drawIndex].numbers) {
      lastSeen.set(number.gap, drawIndex);
    }
  }

  return lastSeen;
}

function gapGapMapsByDraw(history: EnrichedHistory, maxGap: number): Map<number, number>[] {
  const lastSeen = new Map<number, number | null>();

  for (let gap = 0; gap <= maxGap; gap += 1) {
    lastSeen.set(gap, null);
  }

  return history.draws.map((draw, drawIndex) => {
    const gapGapMap = new Map<number, number>();
    const drawGaps = new Set(draw.numbers.map((number) => number.gap));

    for (const gap of drawGaps) {
      const previousIndex = lastSeen.get(gap) ?? null;
      gapGapMap.set(gap, previousIndex === null ? drawIndex : drawIndex - previousIndex - 1);
      lastSeen.set(gap, drawIndex);
    }

    return gapGapMap;
  });
}

export function buildLastSeenGapHighlightModel(
  history: EnrichedHistory,
  count: number,
  referenceDrawOffset: number,
): LastSeenGapHighlightModel {
  const limitedHistory = refreshHistoryGaps(limitHistory(history, count));
  const drawCount = limitedHistory.draws.length;

  if (drawCount === 0) {
    return {
      points: [],
      drawCount: 0,
      maxGap: 0,
      maxReferenceOffset: 0,
      referenceDrawIndex: null,
      referenceDrawDate: null,
    };
  }

  const maxGap = Math.max(
    ...limitedHistory.draws.flatMap((draw) => draw.numbers.map((number) => number.gap)),
    0,
  );
  const maxReferenceOffset = Math.max(0, drawCount - 1);
  const safeReferenceOffset = Math.min(Math.max(referenceDrawOffset, 0), maxReferenceOffset);
  const referenceDrawIndex = drawCount - 1 - safeReferenceOffset;
  const lastSeen = gapLastSeenIndexForReferenceDraw(
    limitedHistory,
    referenceDrawIndex,
    maxGap,
  );
  const gapGapMaps = gapGapMapsByDraw(limitedHistory, maxGap);
  const points: LastSeenGapHighlightPoint[] = [];

  limitedHistory.draws.forEach((draw, drawIndex) => {
    for (const number of draw.numbers) {
      points.push({
        gap: number.gap,
        gapGap: gapGapMaps[drawIndex].get(number.gap) ?? 0,
        drawIndex,
        highlighted: lastSeen.get(number.gap) === drawIndex,
      });
    }
  });

  return {
    points,
    drawCount,
    maxGap,
    maxReferenceOffset,
    referenceDrawIndex,
    referenceDrawDate: limitedHistory.draws[referenceDrawIndex]?.date ?? null,
  };
}
