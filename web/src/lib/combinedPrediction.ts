import { buildBayesianMarkovPredictionRankings } from "./bayesianMarkovScore";
import { buildFreshnessPredictionRankings } from "./freshness";
import { buildProximityPredictionRankings } from "./proximity";
import type {
  BayesianMarkovPrediction,
  CoOccurrencePrediction,
  EnrichedHistory,
  FreshnessPrediction,
  PredictiveScoreNumber,
  ProximityPrediction,
} from "../types";

const numberCount = 49;
const numbersPerDraw = 6;

export interface CombinedPredictionRow {
  number: number;
  rank: number;
  score: number;
  agreementCount: number;
  topSixCount: number;
  freshnessRank: number | null;
  proximityRank: number | null;
  bayesianRank: number | null;
  predictiveRank: number | null;
  coOccurrenceRank: number | null;
}

interface CurrentCombinedInput {
  freshnessPredictions: FreshnessPrediction[];
  proximityPredictions: ProximityPrediction[];
  bayesianPredictions: BayesianMarkovPrediction[];
  predictiveRows?: PredictiveScoreNumber[];
  coOccurrencePredictions?: CoOccurrencePrediction[];
}

interface RankSource {
  ranks: Map<number, number>;
  weight: number;
}

function rankingToMap(ranking: number[] | null): Map<number, number> {
  return new Map((ranking ?? []).map((number, index) => [number, index + 1]));
}

function rankStrength(rank: number | undefined, maxRank = numberCount): number {
  if (rank === undefined || maxRank <= 1) {
    return 0;
  }

  return Math.min(Math.max((maxRank - rank) / (maxRank - 1), 0), 1);
}

function scoreDrawAgainstRanking(drawnValues: Set<number>, rankedNumbers: number[]): number {
  const rankByNumber = rankingToMap(rankedNumbers);
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
  const rankByNumber = rankingToMap(rankedNumbers);
  const ranks = [...drawnValues]
    .map((number) => rankByNumber.get(number) ?? numberCount)
    .sort((left, right) => left - right);
  const coverIndex = Math.min(Math.max(coverSize, 1), ranks.length) - 1;

  return ranks[coverIndex] ?? numberCount;
}

function combineRankSources(sources: RankSource[]): CombinedPredictionRow[] {
  const weightTotal = sources.reduce((total, source) => total + source.weight, 0) || 1;

  return Array.from({ length: numberCount }, (_value, index) => {
    const number = index + 1;
    const sourceRanks = sources.map((source) => source.ranks.get(number));
    const weightedStrength = sources.reduce(
      (total, source) => total + rankStrength(source.ranks.get(number)) * source.weight,
      0,
    );
    const agreementCount = sourceRanks.filter(
      (rank) => rank !== undefined && rank <= Math.ceil(numberCount * 0.25),
    ).length;
    const topSixCount = sourceRanks.filter(
      (rank) => rank !== undefined && rank <= numbersPerDraw,
    ).length;
    const agreementBonus = Math.min(agreementCount / Math.max(sources.length, 1), 1) * 0.07;
    const topSixBonus = Math.min(topSixCount / Math.max(sources.length, 1), 1) * 0.05;

    return {
      number,
      rank: 0,
      score: ((weightedStrength / weightTotal) + agreementBonus + topSixBonus) * 100,
      agreementCount,
      topSixCount,
      freshnessRank: null,
      proximityRank: null,
      bayesianRank: null,
      predictiveRank: null,
      coOccurrenceRank: null,
    };
  })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.topSixCount - left.topSixCount ||
        right.agreementCount - left.agreementCount ||
        left.number - right.number,
    )
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}

export function buildCurrentCombinedPredictionRows({
  freshnessPredictions,
  proximityPredictions,
  bayesianPredictions,
  predictiveRows = [],
  coOccurrencePredictions = [],
}: CurrentCombinedInput): CombinedPredictionRow[] {
  const freshnessRanks = new Map(
    freshnessPredictions.map((prediction) => [prediction.number, prediction.rank]),
  );
  const proximityRanks = new Map(
    proximityPredictions.map((prediction) => [prediction.number, prediction.rank]),
  );
  const bayesianRanks = new Map(
    bayesianPredictions.map((prediction) => [prediction.number, prediction.rank]),
  );
  const predictiveRanks = new Map(predictiveRows.map((row) => [row.number, row.rank]));
  const coOccurrenceRanks = new Map(
    coOccurrencePredictions.map((prediction) => [prediction.number, prediction.rank]),
  );

  return combineRankSources([
    { ranks: freshnessRanks, weight: 0.24 },
    { ranks: proximityRanks, weight: 0.22 },
    { ranks: bayesianRanks, weight: 0.28 },
    { ranks: predictiveRanks, weight: 0.18 },
    { ranks: coOccurrenceRanks, weight: 0.08 },
  ]).map((row) => ({
    ...row,
    freshnessRank: freshnessRanks.get(row.number) ?? null,
    proximityRank: proximityRanks.get(row.number) ?? null,
    bayesianRank: bayesianRanks.get(row.number) ?? null,
    predictiveRank: predictiveRanks.get(row.number) ?? null,
    coOccurrenceRank: coOccurrenceRanks.get(row.number) ?? null,
  }));
}

function buildCombinedPredictionResults(
  history: EnrichedHistory,
  coverSize = numbersPerDraw,
): {
  coverCounts: (number | null)[];
  scores: (number | null)[];
  topPicks: (number[] | null)[];
  rankings: (number[] | null)[];
} {
  const freshnessRankings = buildFreshnessPredictionRankings(history);
  const proximityRankings = buildProximityPredictionRankings(history);
  const bayesianRankings = buildBayesianMarkovPredictionRankings(history);
  const coverCounts: (number | null)[] = [];
  const scores: (number | null)[] = [];
  const topPicks: (number[] | null)[] = [];
  const rankings: (number[] | null)[] = [];

  history.draws.forEach((draw, drawIndex) => {
    const freshnessRanking = freshnessRankings[drawIndex] ?? null;
    const proximityRanking = proximityRankings[drawIndex] ?? null;
    const bayesianRanking = bayesianRankings[drawIndex] ?? null;

    if (freshnessRanking === null || proximityRanking === null || bayesianRanking === null) {
      coverCounts.push(null);
      scores.push(null);
      topPicks.push(null);
      rankings.push(null);
      return;
    }

    const combinedRanking = combineRankSources([
      { ranks: rankingToMap(freshnessRanking), weight: 0.32 },
      { ranks: rankingToMap(proximityRanking), weight: 0.29 },
      { ranks: rankingToMap(bayesianRanking), weight: 0.39 },
    ]).map((row) => row.number);
    const drawnValues = new Set(draw.numbers.map((number) => number.value));

    coverCounts.push(countNumbersNeededToCoverDraw(drawnValues, combinedRanking, coverSize));
    scores.push(scoreDrawAgainstRanking(drawnValues, combinedRanking));
    topPicks.push(combinedRanking.slice(0, numbersPerDraw));
    rankings.push(combinedRanking);
  });

  return { coverCounts, scores, topPicks, rankings };
}

export function buildCombinedPredictionScores(history: EnrichedHistory): (number | null)[] {
  return buildCombinedPredictionResults(history).scores;
}

export function buildCombinedPredictionCoverCounts(
  history: EnrichedHistory,
  coverSize = numbersPerDraw,
): (number | null)[] {
  return buildCombinedPredictionResults(history, coverSize).coverCounts;
}

export function buildCombinedPredictionTopPicks(history: EnrichedHistory): (number[] | null)[] {
  return buildCombinedPredictionResults(history).topPicks;
}
