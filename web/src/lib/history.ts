import type { EnrichedDraw, EnrichedHistory, EnrichedNumber, RawHistory } from "../types";

export function buildHistory(rawHistory: RawHistory): EnrichedHistory {
  const sortedDraws = [...rawHistory.draws].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const lastSeen = new Map<number, number | null>();

  for (let number = 1; number <= 49; number += 1) {
    lastSeen.set(number, null);
  }

  const draws: EnrichedDraw[] = sortedDraws.map((draw, drawIndex) => {
    const currentGaps = new Map<number, number>();

    for (let number = 1; number <= 49; number += 1) {
      const previousIndex = lastSeen.get(number) ?? null;
      currentGaps.set(
        number,
        previousIndex === null ? drawIndex : drawIndex - previousIndex - 1,
      );
    }

    const maxGap = Math.max(...currentGaps.values(), 0);
    const numbers: EnrichedNumber[] = draw.numbers.map((value) => {
      const gap = currentGaps.get(value) ?? 0;
      const enrichedNumber = {
        value,
        gap,
        lastSeenOffset: maxGap - gap,
      };
      lastSeen.set(value, drawIndex);
      return enrichedNumber;
    });

    return {
      date: draw.date,
      numbers,
    };
  });

  return { draws };
}

export function limitHistory(history: EnrichedHistory, count: number): EnrichedHistory {
  if (count >= history.draws.length) {
    return history;
  }

  return {
    draws: history.draws.slice(-count).map((draw) => ({
      date: draw.date,
      numbers: draw.numbers.map((number) => ({ ...number })),
    })),
  };
}

export function refreshHistoryGaps(history: EnrichedHistory): EnrichedHistory {
  const lastSeen = new Map<number, number | null>();

  for (let number = 1; number <= 49; number += 1) {
    lastSeen.set(number, null);
  }

  return {
    draws: history.draws.map((draw, drawIndex) => {
      const currentGaps = new Map<number, number>();

      for (let number = 1; number <= 49; number += 1) {
        const previousIndex = lastSeen.get(number) ?? null;
        currentGaps.set(
          number,
          previousIndex === null ? drawIndex : drawIndex - previousIndex - 1,
        );
      }

      const maxGap = Math.max(...currentGaps.values(), 0);
      const numbers: EnrichedNumber[] = draw.numbers.map((number) => {
        const gap = currentGaps.get(number.value) ?? 0;
        const refreshedNumber = {
          value: number.value,
          gap,
          lastSeenOffset: maxGap - gap,
        };
        lastSeen.set(number.value, drawIndex);
        return refreshedNumber;
      });

      return {
        date: draw.date,
        numbers,
      };
    }),
  };
}
