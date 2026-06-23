import type {
  EnrichedHistory,
  FreshnessBucket,
  FreshnessBucketSummary,
  FreshnessDoubletProfile,
  FreshnessDoubletSummary,
  FreshnessDrawProfile,
  FreshnessModel,
  FreshnessPrediction,
  FreshnessSituation,
  FreshnessTripletProfile,
  FreshnessTripletSummary,
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

function pairKey(left: number, right: number): string {
  return `${Math.min(left, right)}-${Math.max(left, right)}`;
}

function pairNumbers(key: string): [number, number] {
  const [left, right] = key.split("-").map((value) => Number(value));

  return [left, right];
}

function tripletKey(first: number, second: number, third: number): string {
  return [first, second, third].sort((left, right) => left - right).join("-");
}

function tripletNumbers(key: string): [number, number, number] {
  const [first, second, third] = key.split("-").map((value) => Number(value));

  return [first, second, third];
}

function allPairKeys(): string[] {
  const pairs: string[] = [];

  for (let left = 1; left <= 48; left += 1) {
    for (let right = left + 1; right <= 49; right += 1) {
      pairs.push(pairKey(left, right));
    }
  }

  return pairs;
}

function allTripletKeys(): string[] {
  const triplets: string[] = [];

  for (let first = 1; first <= 47; first += 1) {
    for (let second = first + 1; second <= 48; second += 1) {
      for (let third = second + 1; third <= 49; third += 1) {
        triplets.push(tripletKey(first, second, third));
      }
    }
  }

  return triplets;
}

function drawPairKeys(values: number[]): string[] {
  const sortedValues = [...values].sort((left, right) => left - right);
  const pairs: string[] = [];

  for (let leftIndex = 0; leftIndex < sortedValues.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sortedValues.length; rightIndex += 1) {
      pairs.push(pairKey(sortedValues[leftIndex], sortedValues[rightIndex]));
    }
  }

  return pairs;
}

function drawTripletKeys(values: number[]): string[] {
  const sortedValues = [...values].sort((left, right) => left - right);
  const triplets: string[] = [];

  for (let firstIndex = 0; firstIndex < sortedValues.length - 2; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < sortedValues.length - 1; secondIndex += 1) {
      for (let thirdIndex = secondIndex + 1; thirdIndex < sortedValues.length; thirdIndex += 1) {
        triplets.push(
          tripletKey(
            sortedValues[firstIndex],
            sortedValues[secondIndex],
            sortedValues[thirdIndex],
          ),
        );
      }
    }
  }

  return triplets;
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
  const pairKeys = allPairKeys();
  const tripletKeys = allTripletKeys();
  const pairLastSeen = new Map<string, number | null>();
  const tripletLastSeen = new Map<string, number | null>();
  const situationCounts = new Map<string, FreshnessSituation>();
  const drawnByBucket = emptyBucketMap();
  const exposureByBucket = emptyBucketMap();
  const drawnDoubletsByBucket = emptyBucketMap();
  const exposureDoubletsByBucket = emptyBucketMap();
  const drawnTripletsByBucket = emptyBucketMap();
  const exposureTripletsByBucket = emptyBucketMap();
  let latestProfile: FreshnessDrawProfile | null = null;
  let latestDoubletProfile: FreshnessDoubletProfile | null = null;
  let latestTripletProfile: FreshnessTripletProfile | null = null;

  for (let number = 1; number <= 49; number += 1) {
    lastSeen.set(number, null);
  }

  for (const key of pairKeys) {
    pairLastSeen.set(key, null);
  }

  for (const key of tripletKeys) {
    tripletLastSeen.set(key, null);
  }

  history.draws.forEach((draw, drawIndex) => {
    const drawnValues = new Set(draw.numbers.map((number) => number.value));
    const currentPairKeys = drawPairKeys(draw.numbers.map((number) => number.value));
    const currentTripletKeys = drawTripletKeys(draw.numbers.map((number) => number.value));
    const drawnPairs = new Set(currentPairKeys);
    const drawnTriplets = new Set(currentTripletKeys);

    for (let number = 1; number <= 49; number += 1) {
      const previousIndex = lastSeen.get(number) ?? null;
      const gap = previousIndex === null ? null : drawIndex - previousIndex - 1;
      const bucket = bucketForGap(gap);

      exposureByBucket.set(bucket.id, (exposureByBucket.get(bucket.id) ?? 0) + 1);

      if (drawnValues.has(number)) {
        drawnByBucket.set(bucket.id, (drawnByBucket.get(bucket.id) ?? 0) + 1);
      }
    }

    for (const key of pairKeys) {
      const previousIndex = pairLastSeen.get(key) ?? null;
      const gap = previousIndex === null ? null : drawIndex - previousIndex - 1;
      const bucket = bucketForGap(gap);

      exposureDoubletsByBucket.set(
        bucket.id,
        (exposureDoubletsByBucket.get(bucket.id) ?? 0) + 1,
      );

      if (drawnPairs.has(key)) {
        drawnDoubletsByBucket.set(
          bucket.id,
          (drawnDoubletsByBucket.get(bucket.id) ?? 0) + 1,
        );
      }
    }

    for (const key of tripletKeys) {
      const previousIndex = tripletLastSeen.get(key) ?? null;
      const gap = previousIndex === null ? null : drawIndex - previousIndex - 1;
      const bucket = bucketForGap(gap);

      exposureTripletsByBucket.set(
        bucket.id,
        (exposureTripletsByBucket.get(bucket.id) ?? 0) + 1,
      );

      if (drawnTriplets.has(key)) {
        drawnTripletsByBucket.set(
          bucket.id,
          (drawnTripletsByBucket.get(bucket.id) ?? 0) + 1,
        );
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

    const doublets = currentPairKeys
      .map((key) => {
        const previousIndex = pairLastSeen.get(key) ?? null;
        const gap = previousIndex === null ? null : drawIndex - previousIndex - 1;
        const bucket = bucketForGap(gap);

        return {
          pair: key,
          numbers: pairNumbers(key),
          gap,
          bucketId: bucket.id,
          label: bucket.label,
          hitRate: 0,
          rank: 0,
        };
      })
      .sort(
        (left, right) =>
          (bucketOrder.get(left.bucketId) ?? 0) - (bucketOrder.get(right.bucketId) ?? 0) ||
          left.pair.localeCompare(right.pair),
      );

    latestDoubletProfile = {
      date: draw.date,
      signature: signatureForLabels(doublets.map((doublet) => doublet.label)),
      doublets,
    };

    const triplets = currentTripletKeys
      .map((key) => {
        const previousIndex = tripletLastSeen.get(key) ?? null;
        const gap = previousIndex === null ? null : drawIndex - previousIndex - 1;
        const bucket = bucketForGap(gap);

        return {
          triplet: key,
          numbers: tripletNumbers(key),
          gap,
          bucketId: bucket.id,
          label: bucket.label,
          hitRate: 0,
          rank: 0,
        };
      })
      .sort(
        (left, right) =>
          (bucketOrder.get(left.bucketId) ?? 0) - (bucketOrder.get(right.bucketId) ?? 0) ||
          left.triplet.localeCompare(right.triplet),
      );

    latestTripletProfile = {
      date: draw.date,
      signature: signatureForLabels(triplets.map((triplet) => triplet.label)),
      triplets,
    };

    for (const number of draw.numbers) {
      lastSeen.set(number.value, drawIndex);
    }

    for (const key of currentPairKeys) {
      pairLastSeen.set(key, drawIndex);
    }

    for (const key of currentTripletKeys) {
      tripletLastSeen.set(key, drawIndex);
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
  const doubletBucketSummaries = freshnessBuckets.map((bucket) => {
    const drawnCount = drawnDoubletsByBucket.get(bucket.id) ?? 0;
    const exposureCount = exposureDoubletsByBucket.get(bucket.id) ?? 0;

    return {
      bucketId: bucket.id,
      label: bucket.label,
      drawnCount,
      exposureCount,
      hitRate: exposureCount === 0 ? 0 : drawnCount / exposureCount,
      drawShare: drawCount === 0 ? 0 : drawnCount / (drawCount * 15),
    };
  });
  const doubletHitRateByBucket = new Map(
    doubletBucketSummaries.map((summary) => [summary.bucketId, summary.hitRate]),
  );
  const tripletBucketSummaries = freshnessBuckets.map((bucket) => {
    const drawnCount = drawnTripletsByBucket.get(bucket.id) ?? 0;
    const exposureCount = exposureTripletsByBucket.get(bucket.id) ?? 0;

    return {
      bucketId: bucket.id,
      label: bucket.label,
      drawnCount,
      exposureCount,
      hitRate: exposureCount === 0 ? 0 : drawnCount / exposureCount,
      drawShare: drawCount === 0 ? 0 : drawnCount / (drawCount * 20),
    };
  });
  const tripletHitRateByBucket = new Map(
    tripletBucketSummaries.map((summary) => [summary.bucketId, summary.hitRate]),
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
  const doubletPredictions: FreshnessDoubletSummary[] = pairKeys
    .map((key) => {
      const previousIndex = pairLastSeen.get(key) ?? null;
      const currentGap = previousIndex === null ? null : drawCount - previousIndex - 1;
      const bucket = bucketForGap(currentGap);

      return {
        pair: key,
        numbers: pairNumbers(key),
        gap: currentGap,
        bucketId: bucket.id,
        label: bucket.label,
        hitRate: doubletHitRateByBucket.get(bucket.id) ?? 0,
        rank: 0,
      };
    })
    .sort(
      (left, right) =>
        right.hitRate - left.hitRate ||
        (right.gap ?? -1) - (left.gap ?? -1) ||
        left.pair.localeCompare(right.pair),
    )
    .map((prediction, index) => ({
      ...prediction,
      rank: index + 1,
    }));
  const tripletPredictions: FreshnessTripletSummary[] = tripletKeys
    .map((key) => {
      const previousIndex = tripletLastSeen.get(key) ?? null;
      const currentGap = previousIndex === null ? null : drawCount - previousIndex - 1;
      const bucket = bucketForGap(currentGap);

      return {
        triplet: key,
        numbers: tripletNumbers(key),
        gap: currentGap,
        bucketId: bucket.id,
        label: bucket.label,
        hitRate: tripletHitRateByBucket.get(bucket.id) ?? 0,
        rank: 0,
      };
    })
    .sort(
      (left, right) =>
        right.hitRate - left.hitRate ||
        (right.gap ?? -1) - (left.gap ?? -1) ||
        left.triplet.localeCompare(right.triplet),
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
    doubletBucketSummaries,
    doubletPredictions,
    latestDoubletProfile,
    tripletBucketSummaries,
    tripletPredictions,
    latestTripletProfile,
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

export function buildFreshnessPredictionRankings(history: EnrichedHistory): (number[] | null)[] {
  return buildFreshnessPredictionResults(history).rankings;
}

function buildFreshnessPredictionResults(
  history: EnrichedHistory,
  coverSize = 6,
): {
  coverCounts: (number | null)[];
  scores: (number | null)[];
  topPicks: (number[] | null)[];
  rankings: (number[] | null)[];
} {
  const lastSeen = new Map<number, number | null>();
  const drawnByBucket = emptyBucketMap();
  const exposureByBucket = emptyBucketMap();
  const coverCounts: (number | null)[] = [];
  const scores: (number | null)[] = [];
  const topPicks: (number[] | null)[] = [];
  const rankings: (number[] | null)[] = [];

  for (let number = 1; number <= 49; number += 1) {
    lastSeen.set(number, null);
  }

  history.draws.forEach((draw, drawIndex) => {
    if (drawIndex === 0) {
      coverCounts.push(null);
      scores.push(null);
      topPicks.push(null);
      rankings.push(null);
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
      rankings.push(rankedNumbers);
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

  return { coverCounts, scores, topPicks, rankings };
}
