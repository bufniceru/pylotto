import type {
  EnrichedDraw,
  EnrichedHistory,
  ProximityBucket,
  ProximityBucketSummary,
  ProximityDrawProfile,
  ProximityModel,
  ProximityPrediction,
  ProximitySituation,
} from "../types";

export const proximityBuckets: ProximityBucket[] = [
  {
    id: "paired",
    label: "Paired",
    description: "Nearest neighbor is 1 number away.",
    color: "#d93a3a",
  },
  {
    id: "tight",
    label: "Tight",
    description: "Nearest neighbor is 2-3 numbers away.",
    color: "#f27d42",
  },
  {
    id: "near",
    label: "Near",
    description: "Nearest neighbor is 4-6 numbers away.",
    color: "#f0b44f",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Nearest neighbor is 7-10 numbers away.",
    color: "#4b9f68",
  },
  {
    id: "wide",
    label: "Wide",
    description: "Nearest neighbor is 11-15 numbers away.",
    color: "#3f7fc4",
  },
  {
    id: "isolated",
    label: "Isolated",
    description: "Nearest neighbor is more than 15 numbers away.",
    color: "#28344d",
  },
];

const bucketById = new Map(proximityBuckets.map((bucket) => [bucket.id, bucket]));
const bucketOrder = new Map(proximityBuckets.map((bucket, index) => [bucket.id, index]));

function bucketForDistance(distance: number): ProximityBucket {
  if (distance <= 1) {
    return bucketById.get("paired") ?? proximityBuckets[0];
  }

  if (distance <= 3) {
    return bucketById.get("tight") ?? proximityBuckets[1];
  }

  if (distance <= 6) {
    return bucketById.get("near") ?? proximityBuckets[2];
  }

  if (distance <= 10) {
    return bucketById.get("balanced") ?? proximityBuckets[3];
  }

  if (distance <= 15) {
    return bucketById.get("wide") ?? proximityBuckets[4];
  }

  return bucketById.get("isolated") ?? proximityBuckets[5];
}

function signatureForLabels(labels: string[]): string {
  const counts = new Map<string, number>();

  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return proximityBuckets
    .map((bucket) => {
      const count = counts.get(bucket.label) ?? 0;
      return count > 0 ? `${bucket.label} x${count}` : "";
    })
    .filter(Boolean)
    .join(" + ");
}

function analyzeDraw(draw: EnrichedDraw): ProximityDrawProfile["numbers"] {
  const sortedNumbers = draw.numbers
    .map((number) => number.value)
    .sort((left, right) => left - right);

  return sortedNumbers.map((number, index) => {
    const leftDistance = index === 0 ? null : number - sortedNumbers[index - 1];
    const rightDistance =
      index === sortedNumbers.length - 1 ? null : sortedNumbers[index + 1] - number;
    const distances = [leftDistance, rightDistance].filter(
      (distance): distance is number => distance !== null,
    );
    const nearestDistance = Math.min(...distances);
    const bucket = bucketForDistance(nearestDistance);

    return {
      number,
      nearestDistance,
      leftDistance,
      rightDistance,
      bucketId: bucket.id,
      label: bucket.label,
    };
  });
}

function emptyBucketCountMap(): Map<string, number> {
  return new Map(proximityBuckets.map((bucket) => [bucket.id, 0]));
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

export function buildProximityModel(history: EnrichedHistory): ProximityModel {
  const situationCounts = new Map<string, ProximitySituation>();
  const bucketCounts = emptyBucketCountMap();
  const bucketDistanceTotals = emptyBucketCountMap();
  const numberAppearances = new Map<number, number>();
  const numberBucketCounts = new Map<number, Map<string, number>>();
  let latestProfile: ProximityDrawProfile | null = null;

  for (let number = 1; number <= 49; number += 1) {
    numberAppearances.set(number, 0);
    numberBucketCounts.set(number, emptyBucketCountMap());
  }

  for (const draw of history.draws) {
    const numbers = analyzeDraw(draw);
    const signature = signatureForLabels(numbers.map((number) => number.label));
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

    for (const number of numbers) {
      bucketCounts.set(number.bucketId, (bucketCounts.get(number.bucketId) ?? 0) + 1);
      bucketDistanceTotals.set(
        number.bucketId,
        (bucketDistanceTotals.get(number.bucketId) ?? 0) + number.nearestDistance,
      );
      numberAppearances.set(number.number, (numberAppearances.get(number.number) ?? 0) + 1);
      const countsForNumber = numberBucketCounts.get(number.number) ?? emptyBucketCountMap();
      countsForNumber.set(number.bucketId, (countsForNumber.get(number.bucketId) ?? 0) + 1);
      numberBucketCounts.set(number.number, countsForNumber);
    }

    latestProfile = {
      date: draw.date,
      signature,
      numbers,
    };
  }

  const drawCount = history.draws.length;
  const totalDrawnNumbers = drawCount * 6;
  const bucketSummaries: ProximityBucketSummary[] = proximityBuckets.map((bucket) => {
    const count = bucketCounts.get(bucket.id) ?? 0;
    const distanceTotal = bucketDistanceTotals.get(bucket.id) ?? 0;

    return {
      bucketId: bucket.id,
      label: bucket.label,
      count,
      share: totalDrawnNumbers === 0 ? 0 : count / totalDrawnNumbers,
      averageNearestDistance: count === 0 ? 0 : distanceTotal / count,
    };
  });
  const bucketShare = new Map(bucketSummaries.map((summary) => [summary.bucketId, summary.share]));
  const predictions: ProximityPrediction[] = Array.from({ length: 49 }, (_value, index) => {
    const number = index + 1;
    const appearances = numberAppearances.get(number) ?? 0;
    const countsForNumber = numberBucketCounts.get(number) ?? emptyBucketCountMap();
    let score = 0;
    let topBucketId = proximityBuckets[0].id;
    let topBucketCount = -1;

    for (const bucket of proximityBuckets) {
      const count = countsForNumber.get(bucket.id) ?? 0;
      score += count * (bucketShare.get(bucket.id) ?? 0);

      if (
        count > topBucketCount ||
        (count === topBucketCount &&
          (bucketOrder.get(bucket.id) ?? 0) < (bucketOrder.get(topBucketId) ?? 0))
      ) {
        topBucketId = bucket.id;
        topBucketCount = count;
      }
    }

    const bucket = bucketById.get(topBucketId) ?? proximityBuckets[0];

    return {
      number,
      bucketId: bucket.id,
      label: bucket.label,
      appearances,
      score: drawCount === 0 ? 0 : score / drawCount,
      rank: 0,
    };
  })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.appearances - left.appearances ||
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
    buckets: proximityBuckets,
    drawCount,
    situationCount: situations.length,
    situations,
    bucketSummaries,
    predictions,
    latestProfile,
  };
}

export function buildProximityPredictionScores(history: EnrichedHistory): (number | null)[] {
  return buildProximityPredictionResults(history).scores;
}

export function buildProximityPredictionCoverCounts(
  history: EnrichedHistory,
  coverSize = 6,
): (number | null)[] {
  return buildProximityPredictionResults(history, coverSize).coverCounts;
}

export function buildProximityPredictionTopPicks(history: EnrichedHistory): (number[] | null)[] {
  return buildProximityPredictionResults(history).topPicks;
}

export function buildProximityPredictionRankings(history: EnrichedHistory): (number[] | null)[] {
  return buildProximityPredictionResults(history).rankings;
}

function buildProximityPredictionResults(
  history: EnrichedHistory,
  coverSize = 6,
): {
  coverCounts: (number | null)[];
  scores: (number | null)[];
  topPicks: (number[] | null)[];
  rankings: (number[] | null)[];
} {
  const bucketCounts = emptyBucketCountMap();
  const numberAppearances = new Map<number, number>();
  const numberBucketCounts = new Map<number, Map<string, number>>();
  const coverCounts: (number | null)[] = [];
  const scores: (number | null)[] = [];
  const topPicks: (number[] | null)[] = [];
  const rankings: (number[] | null)[] = [];

  for (let number = 1; number <= 49; number += 1) {
    numberAppearances.set(number, 0);
    numberBucketCounts.set(number, emptyBucketCountMap());
  }

  history.draws.forEach((draw, drawIndex) => {
    if (drawIndex === 0) {
      coverCounts.push(null);
      scores.push(null);
      topPicks.push(null);
      rankings.push(null);
    } else {
      const totalDrawnNumbers = drawIndex * 6;
      const bucketShare = new Map(
        proximityBuckets.map((bucket) => [
          bucket.id,
          totalDrawnNumbers === 0 ? 0 : (bucketCounts.get(bucket.id) ?? 0) / totalDrawnNumbers,
        ]),
      );
      const predictions = Array.from({ length: 49 }, (_value, index) => {
        const number = index + 1;
        const appearances = numberAppearances.get(number) ?? 0;
        const countsForNumber = numberBucketCounts.get(number) ?? emptyBucketCountMap();
        let score = 0;

        for (const bucket of proximityBuckets) {
          const count = countsForNumber.get(bucket.id) ?? 0;
          score += count * (bucketShare.get(bucket.id) ?? 0);
        }

        return {
          number,
          appearances,
          score: score / drawIndex,
          rank: 0,
        };
      })
        .sort(
          (left, right) =>
            right.score - left.score ||
            right.appearances - left.appearances ||
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

    const numbers = analyzeDraw(draw);

    for (const number of numbers) {
      bucketCounts.set(number.bucketId, (bucketCounts.get(number.bucketId) ?? 0) + 1);
      numberAppearances.set(number.number, (numberAppearances.get(number.number) ?? 0) + 1);
      const countsForNumber = numberBucketCounts.get(number.number) ?? emptyBucketCountMap();
      countsForNumber.set(number.bucketId, (countsForNumber.get(number.bucketId) ?? 0) + 1);
      numberBucketCounts.set(number.number, countsForNumber);
    }
  });

  return { coverCounts, scores, topPicks, rankings };
}
