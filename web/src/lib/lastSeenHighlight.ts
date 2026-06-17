import type {
  EnrichedDraw,
  EnrichedHistory,
  LastSeenHighlightModel,
  LastSeenHighlightPoint,
} from "../types";
import { limitHistory } from "./history";

function lastSeenIndexForReferenceDraw(
  draws: EnrichedDraw[],
  referenceDrawIndex: number,
): Map<number, number | null> {
  const lastSeen = new Map<number, number | null>();

  for (let number = 1; number <= 49; number += 1) {
    lastSeen.set(number, null);
  }

  for (let drawIndex = 0; drawIndex <= referenceDrawIndex; drawIndex += 1) {
    for (const number of draws[drawIndex].numbers) {
      lastSeen.set(number.value, drawIndex);
    }
  }

  return lastSeen;
}

export function buildLastSeenHighlightModel(
  history: EnrichedHistory,
  count: number,
  referenceDrawOffset: number,
): LastSeenHighlightModel {
  const limitedHistory = limitHistory(history, count);
  const drawCount = limitedHistory.draws.length;

  if (drawCount === 0) {
    return {
      points: [],
      drawCount: 0,
      maxReferenceOffset: 0,
      referenceDrawIndex: null,
      referenceDrawDate: null,
    };
  }

  const maxReferenceOffset = Math.max(0, drawCount - 1);
  const safeReferenceOffset = Math.min(Math.max(referenceDrawOffset, 0), maxReferenceOffset);
  const referenceDrawIndex = drawCount - 1 - safeReferenceOffset;
  const lastSeen = lastSeenIndexForReferenceDraw(limitedHistory.draws, referenceDrawIndex);
  const highlightedNumbers = new Set<number>();

  for (const [number, drawIndex] of lastSeen.entries()) {
    if (drawIndex !== null) {
      highlightedNumbers.add(number);
    }
  }

  const points: LastSeenHighlightPoint[] = [];

  limitedHistory.draws.forEach((draw, drawIndex) => {
    const highlightedForRow = new Set<number>();
    for (const [number, lastSeenDrawIndex] of lastSeen.entries()) {
      if (lastSeenDrawIndex === drawIndex) {
        highlightedForRow.add(number);
      }
    }

    for (const number of draw.numbers) {
      points.push({
        number: number.value,
        drawIndex,
        gap: number.gap,
        highlighted: highlightedForRow.has(number.value) && highlightedNumbers.has(number.value),
      });
    }
  });

  return {
    points,
    drawCount,
    maxReferenceOffset,
    referenceDrawIndex,
    referenceDrawDate: limitedHistory.draws[referenceDrawIndex]?.date ?? null,
  };
}
