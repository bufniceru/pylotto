import type {
  EnrichedDraw,
  EnrichedHistory,
  LastSeenDifferenceHighlightModel,
  LastSeenDifferenceHighlightPoint,
} from "../types";
import { limitHistory, refreshHistoryGaps } from "./history";

function differencesForDraw(draw: EnrichedDraw): number[] {
  const sortedNumbers = draw.numbers
    .map((number) => number.value)
    .sort((left, right) => left - right);
  const differences: number[] = [];

  for (let index = 1; index < sortedNumbers.length; index += 1) {
    differences.push(sortedNumbers[index] - sortedNumbers[index - 1]);
  }

  return differences;
}

function differenceLastSeenIndexForReferenceDraw(
  differencesByDraw: number[][],
  referenceDrawIndex: number,
  maxDifference: number,
): Map<number, number | null> {
  const lastSeen = new Map<number, number | null>();

  for (let difference = 1; difference <= maxDifference; difference += 1) {
    lastSeen.set(difference, null);
  }

  for (let drawIndex = 0; drawIndex <= referenceDrawIndex; drawIndex += 1) {
    for (const difference of differencesByDraw[drawIndex]) {
      lastSeen.set(difference, drawIndex);
    }
  }

  return lastSeen;
}

export function buildLastSeenDifferenceHighlightModel(
  history: EnrichedHistory,
  count: number,
  referenceDrawOffset: number,
): LastSeenDifferenceHighlightModel {
  const limitedHistory = refreshHistoryGaps(limitHistory(history, count));
  const drawCount = limitedHistory.draws.length;

  if (drawCount === 0) {
    return {
      points: [],
      drawCount: 0,
      maxDifference: 0,
      maxReferenceOffset: 0,
      referenceDrawIndex: null,
      referenceDrawDate: null,
    };
  }

  const differencesByDraw = limitedHistory.draws.map(differencesForDraw);
  const maxDifference = Math.max(...differencesByDraw.flat(), 0);
  const maxReferenceOffset = Math.max(0, drawCount - 1);
  const safeReferenceOffset = Math.min(Math.max(referenceDrawOffset, 0), maxReferenceOffset);
  const referenceDrawIndex = drawCount - 1 - safeReferenceOffset;
  const lastSeen = differenceLastSeenIndexForReferenceDraw(
    differencesByDraw,
    referenceDrawIndex,
    maxDifference,
  );
  const points: LastSeenDifferenceHighlightPoint[] = [];

  differencesByDraw.forEach((differences, drawIndex) => {
    for (const difference of differences) {
      points.push({
        difference,
        drawIndex,
        highlighted: lastSeen.get(difference) === drawIndex,
      });
    }
  });

  return {
    points,
    drawCount,
    maxDifference,
    maxReferenceOffset,
    referenceDrawIndex,
    referenceDrawDate: limitedHistory.draws[referenceDrawIndex]?.date ?? null,
  };
}
