import type {
  EnrichedHistory,
  FreshnessBucket,
  FreshnessBucketSummary,
  FreshnessDrawProfile,
  FreshnessModel,
  FreshnessPrediction,
  FreshnessSituation,
} from "../types";

export const freshnessBuckets: FreshnessBucket[] = [
  {
    id: "new",
    label: "New",
    description: "The number had not appeared before that draw.",
    color: "#7b8798",
  },
  {
    id: "repeat",
    label: "Repeat",
    description: "Drawn in the immediately previous draw.",
    color: "#d93a3a",
  },
  {
    id: "veryFresh",
    label: "Very fresh",
    description: "Last drawn 2-3 draws ago.",
    color: "#f27d42",
  },
  {
    id: "fresh",
    label: "Fresh",
    description: "Last drawn 4-6 draws ago.",
    color: "#f0b44f",
  },
  {
    id: "warm",
    label: "Warm",
    description: "Last drawn 7-11 draws ago.",
    color: "#4b9f68",
  },
  {
    id: "stale",
    label: "Stale",
    description: "Last drawn 12-21 draws ago.",
    color: "#3f7fc4",
  },
  {
    id: "cold",
    label: "Cold",
    description: "Last drawn 22-36 draws ago.",
    color: "#7255b5",
  },
  {
    id: "veryCold",
    label: "Very cold",
    description: "Last drawn more than 36 draws ago.",
    color: "#28344d",
  },
];

const bucketOrder = new Map(freshnessBuckets.map((bucket, index) => [bucket.id, index]));
const bucketById = new Map(freshnessBuckets.map((bucket) => [bucket.id, bucket]));

function bucketForGap(gap: number | null): FreshnessBucket {
  if (gap === null) {
    return bucketById.get("new") ?? freshnessBuckets[0];
  }

  if (gap === 0) {
    return bucketById.get("repeat") ?? freshnessBuckets[1];
  }

  if (gap <= 2) {
    return bucketById.get("veryFresh") ?? freshnessBuckets[2];
  }

  if (gap <= 5) {
    return bucketById.get("fresh") ?? freshnessBuckets[3];
  }

  if (gap <= 10) {
    return bucketById.get("warm") ?? freshnessBuckets[4];
  }

  if (gap <= 20) {
    return bucketById.get("stale") ?? freshnessBuckets[5];
  }

  if (gap <= 35) {
    return bucketById.get("cold") ?? freshnessBuckets[6];
  }

  return bucketById.get("veryCold") ?? freshnessBuckets[7];
}

function signatureForLabels(labels: string[]): string {
  const counts = new Map<string, number>();

  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return freshnessBuckets
    .map((bucket) => {
      const count = counts.get(bucket.label) ?? 0;
      return count > 0 ? `${bucket.label} x${count}` : "";
    })
    .filter(Boolean)
    .join(" + ");
}

function emptyBucketMap(): Map<string, number> {
  return new Map(freshnessBuckets.map((bucket) => [bucket.id, 0]));
}

function countNumbersNeededToCoverDraw(
  drawnValues: number[],
  rankedNumbers: number[],
  coverSize: number,
): number {
  const rankByNumber = new Map(rankedNumbers.map((number, index) => [number, index + 1]));
  const ranks = drawnValues
    .map((number) => rankByNumber.get(number) ?? 49)
    .sort((left, right) => left - right);
  const coverIndex = Math.min(Math.max(coverSize, 1), ranks.length) - 1;

  return ranks[coverIndex] ?? 49;
}

export function buildFreshnessModel(history: EnrichedHistory): FreshnessModel {
  const lastSeen = new Map<number, number | null>();
  const situationCounts = new Map<string, FreshnessSituation>();
  const drawnByBucket = emptyBucketMap();
  const exposureByBucket = emptyBucketMap();
  let latestProfile: FreshnessDrawProfile | null = null;

  for (let number = 1; number <= 49; number += 1) {
    lastSeen.set(number, null);
  }

  history.draws.forEach((draw, drawIndex) => {
    const drawnValues = new Set(draw.numbers.map((number) => number.value));

    for (let number = 1; number <= 49; number += 1) {
      const previousIndex = lastSeen.get(number) ?? null;
      const gap = previousIndex === null ? null : drawIndex - previousIndex - 1;
      const bucket = bucketForGap(gap);

      exposureByBucket.set(bucket.id, (exposureByBucket.get(bucket.id) ?? 0) + 1);

      if (drawnValues.has(number)) {
        drawnByBucket.set(bucket.id, (drawnByBucket.get(bucket.id) ?? 0) + 1);
      }
    }

    const numbers = draw.numbers
      .map((number) => {
        const previousIndex = lastSeen.get(number.value) ?? null;
        const gap = previousIndex === null ? null : drawIndex - previousIndex - 1;
        const bucket = bucketForGap(gap);

        return {
          number: number.value,
          gap,
          bucketId: bucket.id,
          label: bucket.label,
        };
      })
      .sort(
        (left, right) =>
          (bucketOrder.get(left.bucketId) ?? 0) - (bucketOrder.get(right.bucketId) ?? 0) ||
          left.number - right.number,
      );
    const labels = numbers.map((number) => number.label);
    const signature = signatureForLabels(labels);
    const existingSituation = situationCounts.get(signature);

    if (existingSituation) {
      existingSituation.count += 1;
      existingSituation.latestDate = draw.date;
      existingSituation.examples = [draw.date, ...existingSituation.examples].slice(0, 3);
    } else {
      situationCounts.set(signature, {
        signature,
        count: 1,
        percent: 0,
        latestDate: draw.date,
        examples: [draw.date],
      });
    }

    latestProfile = {
      date: draw.date,
      signature,
      labels,
      numbers,
    };

    for (const number of draw.numbers) {
      lastSeen.set(number.value, drawIndex);
    }
  });

  const drawCount = history.draws.length;
  const bucketSummaries: FreshnessBucketSummary[] = freshnessBuckets.map((bucket) => {
    const drawnCount = drawnByBucket.get(bucket.id) ?? 0;
    const exposureCount = exposureByBucket.get(bucket.id) ?? 0;

    return {
      bucketId: bucket.id,
      label: bucket.label,
      drawnCount,
      exposureCount,
      hitRate: exposureCount === 0 ? 0 : drawnCount / exposureCount,
      drawShare: drawCount === 0 ? 0 : drawnCount / (drawCount * 6),
    };
  });
  const hitRateByBucket = new Map(
    bucketSummaries.map((summary) => [summary.bucketId, summary.hitRate]),
  );
  const predictions: FreshnessPrediction[] = Array.from({ length: 49 }, (_value, index) => {
    const number = index + 1;
    const previousIndex = lastSeen.get(number) ?? null;
    const currentGap = previousIndex === null ? null : drawCount - previousIndex - 1;
    const bucket = bucketForGap(currentGap);

    return {
      number,
      bucketId: bucket.id,
      label: bucket.label,
      currentGap,
      hitRate: hitRateByBucket.get(bucket.id) ?? 0,
      rank: 0,
    };
  })
    .sort(
      (left, right) =>
        right.hitRate - left.hitRate ||
        (right.currentGap ?? -1) - (left.currentGap ?? -1) ||
        left.number - right.number,
    )
    .map((prediction, index) => ({
      ...prediction,
      rank: index + 1,
    }));
  const situations = [...situationCounts.values()]
    .map((situation) => ({
      ...situation,
      percent: drawCount === 0 ? 0 : situation.count / drawCount,
    }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        right.latestDate.localeCompare(left.latestDate) ||
        left.signature.localeCompare(right.signature),
    );

  return {
    buckets: freshnessBuckets,
    drawCount,
    situationCount: situations.length,
    situations,
    bucketSummaries,
    predictions,
    latestProfile,
  };
}

export function buildFreshnessPredictionScores(history: EnrichedHistory): (number | null)[] {
  return buildFreshnessPredictionResults(history).scores;
}

export function buildFreshnessPredictionCoverCounts(
  history: EnrichedHistory,
  coverSize = 6,
): (number | null)[] {
  return buildFreshnessPredictionResults(history, coverSize).coverCounts;
}

export function buildFreshnessPredictionTopPicks(history: EnrichedHistory): (number[] | null)[] {
  return buildFreshnessPredictionResults(history).topPicks;
}

function buildFreshnessPredictionResults(
  history: EnrichedHistory,
  coverSize = 6,
): {
  coverCounts: (number | null)[];
  scores: (number | null)[];
  topPicks: (number[] | null)[];
} {
  const lastSeen = new Map<number, number | null>();
  const drawnByBucket = emptyBucketMap();
  const exposureByBucket = emptyBucketMap();
  const coverCounts: (number | null)[] = [];
  const scores: (number | null)[] = [];
  const topPicks: (number[] | null)[] = [];

  for (let number = 1; number <= 49; number += 1) {
    lastSeen.set(number, null);
  }

  history.draws.forEach((draw, drawIndex) => {
    if (drawIndex === 0) {
      coverCounts.push(null);
      scores.push(null);
      topPicks.push(null);
    } else {
      const bucketSummaries = freshnessBuckets.map((bucket) => {
        const drawnCount = drawnByBucket.get(bucket.id) ?? 0;
        const exposureCount = exposureByBucket.get(bucket.id) ?? 0;

        return {
          bucketId: bucket.id,
          hitRate: exposureCount === 0 ? 0 : drawnCount / exposureCount,
        };
      });
      const hitRateByBucket = new Map(
        bucketSummaries.map((summary) => [summary.bucketId, summary.hitRate]),
      );
      const predictions = Array.from({ length: 49 }, (_value, index) => {
        const number = index + 1;
        const previousIndex = lastSeen.get(number) ?? null;
        const currentGap = previousIndex === null ? null : drawIndex - previousIndex - 1;
        const bucket = bucketForGap(currentGap);

        return {
          number,
          currentGap,
          hitRate: hitRateByBucket.get(bucket.id) ?? 0,
          rank: 0,
        };
      })
        .sort(
          (left, right) =>
            right.hitRate - left.hitRate ||
            (right.currentGap ?? -1) - (left.currentGap ?? -1) ||
            left.number - right.number,
        )
        .map((prediction, index) => ({
          ...prediction,
          rank: index + 1,
        }));
      const rankByNumber = new Map(
        predictions.map((prediction) => [prediction.number, prediction.rank]),
      );
      const rankedNumbers = predictions.map((prediction) => prediction.number);
      const drawScore =
        draw.numbers.reduce((total, number) => {
          const rank = rankByNumber.get(number.value) ?? 49;

          return total + ((49 - rank) / 48) * 100;
        }, 0) / draw.numbers.length;

      coverCounts.push(
        countNumbersNeededToCoverDraw(
          draw.numbers.map((number) => number.value),
          rankedNumbers,
          coverSize,
        ),
      );
      scores.push(drawScore);
      topPicks.push(rankedNumbers.slice(0, 6));
    }

    const drawnValues = new Set(draw.numbers.map((number) => number.value));

    for (let number = 1; number <= 49; number += 1) {
      const previousIndex = lastSeen.get(number) ?? null;
      const gap = previousIndex === null ? null : drawIndex - previousIndex - 1;
      const bucket = bucketForGap(gap);

      exposureByBucket.set(bucket.id, (exposureByBucket.get(bucket.id) ?? 0) + 1);

      if (drawnValues.has(number)) {
        drawnByBucket.set(bucket.id, (drawnByBucket.get(bucket.id) ?? 0) + 1);
      }
    }

    for (const number of draw.numbers) {
      lastSeen.set(number.value, drawIndex);
    }
  });

  return { coverCounts, scores, topPicks };
}
