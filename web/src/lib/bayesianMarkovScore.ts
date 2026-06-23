import bayesianMarkovScoreJson from "../data/bayesian-markov-score.json";
import type { BayesianMarkovModel, EnrichedHistory } from "../types";

const model = bayesianMarkovScoreJson as BayesianMarkovModel;

const maxGapBucket = model.maxGapBucket;
const numbersPerDraw = model.numbersPerDraw;
const numberCount = model.numberCount;
const priorStrength = model.priorStrength;

function gapBucket(gap: number): number {
  return Math.min(Math.max(gap, 0), maxGapBucket);
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

function scoreDrawAgainstRanking(drawnValues: Set<number>, rankedNumbers: number[]): number {
  const rankByNumber = new Map(rankedNumbers.map((number, index) => [number, index + 1]));
  let totalScore = 0;

  for (const number of drawnValues) {
    const rank = rankByNumber.get(number) ?? numberCount;
    totalScore += ((numberCount - rank) / (numberCount - 1)) * 100;
  }

  return totalScore / drawnValues.size;
}

function countNumbersNeededToCoverDraw(
  drawnValues: Set<number>,
  rankedNumbers: number[],
  coverSize: number,
): number {
  const rankByNumber = new Map(rankedNumbers.map((number, index) => [number, index + 1]));
  const ranks = [...drawnValues]
    .map((number) => rankByNumber.get(number) ?? numberCount)
    .sort((left, right) => left - right);
  const coverIndex = Math.min(Math.max(coverSize, 1), ranks.length) - 1;

  return ranks[coverIndex] ?? numberCount;
}

function buildBayesianMarkovPredictionResults(
  history: EnrichedHistory,
  coverSize = numbersPerDraw,
): {
  coverCounts: (number | null)[];
  scores: (number | null)[];
  topPicks: (number[] | null)[];
  rankings: (number[] | null)[];
} {
  const coverCounts: (number | null)[] = [];
  const scores: (number | null)[] = [];
  const topPicks: (number[] | null)[] = [];
  const rankings: (number[] | null)[] = [];
  const lastSeen = new Map<number, number | null>();
  const opportunities = new Map<number, number>();
  const hits = new Map<number, number>();
  const baseProbability = numbersPerDraw / numberCount;

  for (let number = 1; number <= numberCount; number += 1) {
    lastSeen.set(number, null);
  }

  for (let bucket = 0; bucket <= maxGapBucket; bucket += 1) {
    opportunities.set(bucket, 0);
    hits.set(bucket, 0);
  }

  history.draws.forEach((draw, drawIndex) => {
    const drawnValues = new Set(draw.numbers.map((number) => number.value));

    if (drawIndex === 0) {
      coverCounts.push(null);
      scores.push(null);
      topPicks.push(null);
      rankings.push(null);
    } else {
      const posteriorMeans = new Map<number, number>();

      for (let bucket = 0; bucket <= maxGapBucket; bucket += 1) {
        const bucketOpportunities = opportunities.get(bucket) ?? 0;
        const bucketHits = hits.get(bucket) ?? 0;
        const posteriorMean =
          (bucketHits + priorStrength * baseProbability) /
          (bucketOpportunities + priorStrength);

        posteriorMeans.set(bucket, posteriorMean);
      }

      const numberMeans = new Map<number, number>();
      const currentGaps = new Map<number, number>();

      for (let number = 1; number <= numberCount; number += 1) {
        const seenAt = lastSeen.get(number) ?? null;
        const gap = seenAt === null ? drawIndex : drawIndex - 1 - seenAt;
        const bucket = gapBucket(gap);

        currentGaps.set(number, gap);
        numberMeans.set(number, posteriorMeans.get(bucket) ?? 0);
      }

      const scaledScores = scaleScores(numberMeans);
      const rankedNumbers = Array.from({ length: numberCount }, (_value, index) => index + 1).sort(
        (left, right) =>
          (scaledScores.get(right) ?? 0) - (scaledScores.get(left) ?? 0) ||
          (numberMeans.get(right) ?? 0) - (numberMeans.get(left) ?? 0) ||
          (currentGaps.get(right) ?? 0) - (currentGaps.get(left) ?? 0) ||
          left - right,
      );

      coverCounts.push(countNumbersNeededToCoverDraw(drawnValues, rankedNumbers, coverSize));
      scores.push(scoreDrawAgainstRanking(drawnValues, rankedNumbers));
      topPicks.push(rankedNumbers.slice(0, numbersPerDraw));
      rankings.push(rankedNumbers);
    }

    if (drawIndex > 0) {
      for (let number = 1; number <= numberCount; number += 1) {
        const seenAt = lastSeen.get(number) ?? null;
        const gap = seenAt === null ? drawIndex : drawIndex - 1 - seenAt;
        const bucket = gapBucket(gap);

        opportunities.set(bucket, (opportunities.get(bucket) ?? 0) + 1);
        if (drawnValues.has(number)) {
          hits.set(bucket, (hits.get(bucket) ?? 0) + 1);
        }
      }
    }

    for (const number of draw.numbers) {
      lastSeen.set(number.value, drawIndex);
    }
  });

  return { coverCounts, scores, topPicks, rankings };
}

export function buildBayesianMarkovPredictionScores(history: EnrichedHistory): (number | null)[] {
  return buildBayesianMarkovPredictionResults(history).scores;
}

export function buildBayesianMarkovPredictionCoverCounts(
  history: EnrichedHistory,
  coverSize = numbersPerDraw,
): (number | null)[] {
  return buildBayesianMarkovPredictionResults(history, coverSize).coverCounts;
}

export function buildBayesianMarkovPredictionTopPicks(
  history: EnrichedHistory,
): (number[] | null)[] {
  return buildBayesianMarkovPredictionResults(history).topPicks;
}

export function buildBayesianMarkovPredictionRankings(
  history: EnrichedHistory,
): (number[] | null)[] {
  return buildBayesianMarkovPredictionResults(history).rankings;
}

export function bayesianMarkovRankingCount(): number {
  return numberCount;
}
