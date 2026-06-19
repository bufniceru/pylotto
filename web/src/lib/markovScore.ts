import type {
  EnrichedHistory,
  MarkovScoreBand,
  MarkovScoreBucketSummary,
  MarkovScoreDrawProfile,
  MarkovScoreModel,
  MarkovScorePrediction,
  MarkovScoreSituation,
} from "../types";

const maxGapBucket = 35;
const priorStrength = 8;
const halfLife = 500;
const numbersPerDraw = 6;
const numberCount = 49;

export const markovScoreBands: MarkovScoreBand[] = [
  {
    id: "elite",
    label: "Elite",
    description: "Markov score from 80 to 100.",
    color: "#0a562c",
  },
  {
    id: "strong",
    label: "Strong",
    description: "Markov score from 60 to 79.99.",
    color: "#47b25c",
  },
  {
    id: "active",
    label: "Active",
    description: "Markov score from 40 to 59.99.",
    color: "#f0b44f",
  },
  {
    id: "soft",
    label: "Soft",
    description: "Markov score below 40.",
    color: "#7b8798",
  },
];

const bandById = new Map(markovScoreBands.map((band) => [band.id, band]));
const bandOrder = new Map(markovScoreBands.map((band, index) => [band.id, index]));

function gapBucket(gap: number): number {
  return Math.min(Math.max(gap, 0), maxGapBucket);
}

function bandForScore(score: number): MarkovScoreBand {
  if (score >= 80) {
    return bandById.get("elite") ?? markovScoreBands[0];
  }

  if (score >= 60) {
    return bandById.get("strong") ?? markovScoreBands[1];
  }

  if (score >= 40) {
    return bandById.get("active") ?? markovScoreBands[2];
  }

  return bandById.get("soft") ?? markovScoreBands[3];
}

function scaleScores(values: Map<number, number>): Map<number, number> {
  const rawValues = [...values.values()];
  const minValue = Math.min(...rawValues);
  const maxValue = Math.max(...rawValues);
  const spread = maxValue - minValue;

  if (spread <= 0) {
    return new Map([...values.keys()].map((key) => [key, 0]));
  }

  return new Map(
    [...values.entries()].map(([key, value]) => [key, ((value - minValue) / spread) * 100]),
  );
}

function signatureForLabels(labels: string[]): string {
  const counts = new Map<string, number>();

  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return markovScoreBands
    .map((band) => {
      const count = counts.get(band.label) ?? 0;
      return count > 0 ? `${band.label} x${count}` : "";
    })
    .filter(Boolean)
    .join(" + ");
}

function buildGapStateBuckets(history: EnrichedHistory): MarkovScoreBucketSummary[] {
  const lastSeen = new Map<number, number | null>();
  const opportunityWeight = new Map<number, number>();
  const hitWeight = new Map<number, number>();
  const totalDraws = history.draws.length;

  for (let number = 1; number <= numberCount; number += 1) {
    lastSeen.set(number, null);
  }

  for (let bucket = 0; bucket <= maxGapBucket; bucket += 1) {
    opportunityWeight.set(bucket, 0);
    hitWeight.set(bucket, 0);
  }

  history.draws.forEach((draw, drawIndex) => {
    if (drawIndex === 0) {
      for (const number of draw.numbers) {
        lastSeen.set(number.value, drawIndex);
      }
      return;
    }

    const drawnValues = new Set(draw.numbers.map((number) => number.value));
    const age = totalDraws - 1 - drawIndex;
    const weight = 0.5 ** (age / halfLife);

    for (let number = 1; number <= numberCount; number += 1) {
      const seenAt = lastSeen.get(number) ?? null;
      const gap = seenAt === null ? drawIndex : drawIndex - 1 - seenAt;
      const bucket = gapBucket(gap);

      opportunityWeight.set(bucket, (opportunityWeight.get(bucket) ?? 0) + weight);
      if (drawnValues.has(number)) {
        hitWeight.set(bucket, (hitWeight.get(bucket) ?? 0) + weight);
      }
    }

    for (const number of draw.numbers) {
      lastSeen.set(number.value, drawIndex);
    }
  });

  const baseProbability = numbersPerDraw / numberCount;
  const probabilities = new Map<number, number>();

  for (let bucket = 0; bucket <= maxGapBucket; bucket += 1) {
    const opportunities = opportunityWeight.get(bucket) ?? 0;
    const hits = hitWeight.get(bucket) ?? 0;
    const probability =
      (hits + priorStrength * baseProbability) / (opportunities + priorStrength);

    probabilities.set(bucket, probability);
  }

  const scores = scaleScores(probabilities);

  return Array.from({ length: maxGapBucket + 1 }, (_value, bucket) => {
    const score = scores.get(bucket) ?? 0;
    const band = bandForScore(score);

    return {
      bucket,
      weightedOpportunities: opportunityWeight.get(bucket) ?? 0,
      weightedHits: hitWeight.get(bucket) ?? 0,
      probability: probabilities.get(bucket) ?? 0,
      score,
      bandId: band.id,
      label: band.label,
    };
  });
}

function currentGaps(history: EnrichedHistory): Map<number, number> {
  const lastSeen = new Map<number, number | null>();

  for (let number = 1; number <= numberCount; number += 1) {
    lastSeen.set(number, null);
  }

  history.draws.forEach((draw, drawIndex) => {
    for (const number of draw.numbers) {
      lastSeen.set(number.value, drawIndex);
    }
  });

  const totalDraws = history.draws.length;

  return new Map(
    Array.from({ length: numberCount }, (_value, index) => {
      const number = index + 1;
      const seenAt = lastSeen.get(number) ?? null;
      return [number, seenAt === null ? totalDraws : totalDraws - 1 - seenAt];
    }),
  );
}

function buildHistoricalProfile(
  draw: EnrichedHistory["draws"][number],
  summariesByBucket: Map<number, MarkovScoreBucketSummary>,
): MarkovScoreDrawProfile["numbers"] {
  return draw.numbers
    .map((number) => {
      const bucket = gapBucket(number.gap);
      const summary = summariesByBucket.get(bucket);
      const score = summary?.score ?? 0;
      const band = bandForScore(score);

      return {
        number: number.value,
        gap: number.gap,
        bucket,
        probability: summary?.probability ?? 0,
        score,
        bandId: band.id,
        label: band.label,
      };
    })
    .sort(
      (left, right) =>
        (bandOrder.get(left.bandId) ?? 0) - (bandOrder.get(right.bandId) ?? 0) ||
        right.score - left.score ||
        left.number - right.number,
    );
}

export function buildMarkovScoreModel(history: EnrichedHistory): MarkovScoreModel {
  const bucketSummaries = buildGapStateBuckets(history);
  const summariesByBucket = new Map(bucketSummaries.map((summary) => [summary.bucket, summary]));
  const situationCounts = new Map<string, MarkovScoreSituation>();
  let latestProfile: MarkovScoreDrawProfile | null = null;

  for (const draw of history.draws) {
    const numbers = buildHistoricalProfile(draw, summariesByBucket);
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

    latestProfile = {
      date: draw.date,
      signature,
      numbers,
    };
  }

  const gaps = currentGaps(history);
  const currentProbabilities = new Map(
    Array.from({ length: numberCount }, (_value, index) => {
      const number = index + 1;
      const currentGap = gaps.get(number) ?? 0;
      const bucket = gapBucket(currentGap);
      const summary = summariesByBucket.get(bucket);

      return [number, summary?.probability ?? 0];
    }),
  );
  const currentScores = scaleScores(currentProbabilities);
  const predictions: MarkovScorePrediction[] = Array.from(
    { length: numberCount },
    (_value, index) => {
      const number = index + 1;
      const currentGap = gaps.get(number) ?? 0;
      const bucket = gapBucket(currentGap);
      const summary = summariesByBucket.get(bucket);
      const score = currentScores.get(number) ?? 0;
      const band = bandForScore(score);

      return {
        number,
        rank: 0,
        score,
        probability: summary?.probability ?? 0,
        currentGap,
        bucket,
        bandId: band.id,
        label: band.label,
      };
    },
  )
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.probability - left.probability ||
        right.currentGap - left.currentGap ||
        left.number - right.number,
    )
    .map((prediction, index) => ({
      ...prediction,
      rank: index + 1,
    }));
  const drawCount = history.draws.length;
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
    bands: markovScoreBands,
    drawCount,
    situationCount: situations.length,
    halfLife,
    priorStrength,
    maxGapBucket,
    situations,
    bucketSummaries,
    predictions,
    latestProfile,
  };
}
