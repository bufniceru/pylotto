import type {
  CoOccurrenceBand,
  CoOccurrenceEdge,
  CoOccurrenceModel,
  CoOccurrenceNode,
  CoOccurrencePrediction,
  EnrichedHistory,
} from "../types";

const numberCount = 49;
const numbersPerDraw = 6;
const pairsPerDraw = 15;
const pairUniverseSize = (numberCount * (numberCount - 1)) / 2;

export const coOccurrenceBands: CoOccurrenceBand[] = [
  {
    id: "low",
    label: "Low lift",
    description: "Pair appears below 80% of the random baseline.",
    color: "#2f6fb3",
  },
  {
    id: "normal",
    label: "Near baseline",
    description: "Pair appears within ordinary baseline range.",
    color: "#3f8f68",
  },
  {
    id: "elevated",
    label: "Elevated",
    description: "Pair appears at least 20% above the random baseline.",
    color: "#d58a1f",
  },
  {
    id: "high",
    label: "High lift",
    description: "Pair appears at least 50% above the random baseline.",
    color: "#c65335",
  },
];

const bandById = new Map(coOccurrenceBands.map((band) => [band.id, band]));

function pairKey(left: number, right: number): string {
  return `${Math.min(left, right)}-${Math.max(left, right)}`;
}

function pairNumbers(key: string): [number, number] {
  const [left, right] = key.split("-").map((value) => Number(value));

  return [left, right];
}

function allPairKeys(): string[] {
  const pairs: string[] = [];

  for (let left = 1; left <= numberCount - 1; left += 1) {
    for (let right = left + 1; right <= numberCount; right += 1) {
      pairs.push(pairKey(left, right));
    }
  }

  return pairs;
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

function bandForLift(lift: number): CoOccurrenceBand {
  if (lift >= 1.5) {
    return bandById.get("high") ?? coOccurrenceBands[3];
  }

  if (lift >= 1.2) {
    return bandById.get("elevated") ?? coOccurrenceBands[2];
  }

  if (lift < 0.8) {
    return bandById.get("low") ?? coOccurrenceBands[0];
  }

  return bandById.get("normal") ?? coOccurrenceBands[1];
}

function interpretationFor(edges: CoOccurrenceEdge[]): string {
  const strongest = edges[0];

  if (!strongest) {
    return "No co-occurrence network can be built without draw history.";
  }

  if (strongest.lift >= 1.5) {
    return `The strongest edge is ${strongest.pair}, appearing ${strongest.lift.toFixed(2)}x the random pair baseline.`;
  }

  if (strongest.lift >= 1.2) {
    return `The strongest edge is ${strongest.pair}; pair relationships are visible but not extreme.`;
  }

  return "Pair co-occurrences are close to the random 6/49 baseline.";
}

export function buildCoOccurrenceModel(history: EnrichedHistory): CoOccurrenceModel {
  const pairKeys = allPairKeys();
  const pairCounts = new Map(pairKeys.map((key) => [key, 0]));
  const appearances = new Map<number, number>();
  const weightedDegree = new Map<number, number>();

  for (let number = 1; number <= numberCount; number += 1) {
    appearances.set(number, 0);
    weightedDegree.set(number, 0);
  }

  for (const draw of history.draws) {
    for (const number of draw.numbers) {
      appearances.set(number.value, (appearances.get(number.value) ?? 0) + 1);
    }

    for (const key of drawPairKeys(draw.numbers.map((number) => number.value))) {
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    }
  }

  const drawCount = history.draws.length;
  const totalPairEvents = drawCount * pairsPerDraw;
  const expectedPairCount = pairUniverseSize === 0 ? 0 : totalPairEvents / pairUniverseSize;
  const pairProbability = pairsPerDraw / pairUniverseSize;
  const pairStdDev = Math.sqrt(Math.max(drawCount * pairProbability * (1 - pairProbability), 0));

  const edges: CoOccurrenceEdge[] = pairKeys
    .map((key) => {
      const count = pairCounts.get(key) ?? 0;
      const lift = expectedPairCount === 0 ? 0 : count / expectedPairCount;
      const residual = pairStdDev === 0 ? 0 : (count - expectedPairCount) / pairStdDev;
      const band = bandForLift(lift);

      return {
        pair: key,
        numbers: pairNumbers(key),
        count,
        expected: expectedPairCount,
        lift,
        residual,
        share: totalPairEvents === 0 ? 0 : count / totalPairEvents,
        rank: 0,
        bandId: band.id,
        label: band.label,
      };
    })
    .sort(
      (left, right) =>
        right.lift - left.lift ||
        right.count - left.count ||
        right.residual - left.residual ||
        left.pair.localeCompare(right.pair),
    )
    .map((edge, index) => ({
      ...edge,
      rank: index + 1,
    }));

  for (const edge of edges) {
    const [left, right] = edge.numbers;

    weightedDegree.set(left, (weightedDegree.get(left) ?? 0) + edge.count);
    weightedDegree.set(right, (weightedDegree.get(right) ?? 0) + edge.count);
  }

  const edgesByNumber = new Map<number, CoOccurrenceEdge[]>();

  for (let number = 1; number <= numberCount; number += 1) {
    edgesByNumber.set(
      number,
      edges.filter((edge) => edge.numbers.includes(number)),
    );
  }

  const nodes: CoOccurrenceNode[] = Array.from({ length: numberCount }, (_value, index) => {
    const number = index + 1;
    const partnerEdges = edgesByNumber.get(number) ?? [];
    const strongestEdge = [...partnerEdges].sort(
      (left, right) =>
        right.count - left.count ||
        right.lift - left.lift ||
        left.pair.localeCompare(right.pair),
    )[0];
    const strongestPartner =
      strongestEdge === undefined
        ? null
        : strongestEdge.numbers[0] === number
          ? strongestEdge.numbers[1]
          : strongestEdge.numbers[0];
    const degree = weightedDegree.get(number) ?? 0;

    return {
      number,
      appearances: appearances.get(number) ?? 0,
      weightedDegree: degree,
      averagePartnerCount: partnerEdges.length === 0 ? 0 : degree / partnerEdges.length,
      strongestPartner,
      strongestPartnerCount: strongestEdge?.count ?? 0,
      strongestPartnerLift: strongestEdge?.lift ?? 0,
      rank: 0,
    };
  })
    .sort(
      (left, right) =>
        right.weightedDegree - left.weightedDegree ||
        right.strongestPartnerCount - left.strongestPartnerCount ||
        left.number - right.number,
    )
    .map((node, index) => ({
      ...node,
      rank: index + 1,
    }));

  const maxEdgeCount = Math.max(...edges.map((edge) => edge.count), 1);
  const maxWeightedDegree = Math.max(...nodes.map((node) => node.weightedDegree), 1);
  const latestDraw = history.draws[history.draws.length - 1] ?? null;
  const edgesByPair = new Map(edges.map((edge) => [edge.pair, edge]));
  const latestNumbers = new Set(latestDraw?.numbers.map((number) => number.value) ?? []);
  const predictions: CoOccurrencePrediction[] = Array.from(
    { length: numberCount },
    (_value, index) => {
      const number = index + 1;
      const partnerEdges = [...latestNumbers]
        .filter((partner) => partner !== number)
        .map((partner) => edgesByPair.get(pairKey(number, partner)))
        .filter((edge): edge is CoOccurrenceEdge => edge !== undefined);
      const totalCount = partnerEdges.reduce((total, edge) => total + edge.count, 0);
      const averageLift =
        partnerEdges.length === 0
          ? 0
          : partnerEdges.reduce((total, edge) => total + edge.lift, 0) / partnerEdges.length;
      const strongestEdge = [...partnerEdges].sort(
        (left, right) =>
          right.count - left.count ||
          right.lift - left.lift ||
          left.pair.localeCompare(right.pair),
      )[0];
      const strongestPartner =
        strongestEdge === undefined
          ? null
          : strongestEdge.numbers[0] === number
            ? strongestEdge.numbers[1]
            : strongestEdge.numbers[0];
      const band = bandForLift(averageLift);

      return {
        number,
        rank: 0,
        score: averageLift * 70 + (totalCount / Math.max(drawCount, 1)) * 30,
        averageLift,
        totalCount,
        strongestPartner,
        strongestPartnerCount: strongestEdge?.count ?? 0,
        strongestPartnerLift: strongestEdge?.lift ?? 0,
        bandId: band.id,
        label: band.label,
      };
    },
  )
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.averageLift - left.averageLift ||
        right.totalCount - left.totalCount ||
        left.number - right.number,
    )
    .map((prediction, index) => ({
      ...prediction,
      rank: index + 1,
    }));
  const latestEdges = (latestDraw === null
    ? []
    : drawPairKeys(latestDraw.numbers.map((number) => number.value))
        .map((key) => edgesByPair.get(key))
        .filter((edge): edge is CoOccurrenceEdge => edge !== undefined)
  ).sort((left, right) => right.lift - left.lift || right.count - left.count);

  return {
    bands: coOccurrenceBands,
    drawCount,
    totalPairEvents,
    expectedPairCount,
    pairUniverseSize,
    maxEdgeCount,
    maxWeightedDegree,
    edges,
    nodes,
    predictions,
    networkEdges: edges.slice(0, 36),
    latestProfile: {
      date: latestDraw?.date ?? null,
      signature:
        latestEdges.length === 0
          ? "n/a"
          : latestEdges.slice(0, 8).map((edge) => `${edge.pair} x${edge.count}`).join(" | "),
      edges: latestEdges,
    },
    interpretation: interpretationFor(edges),
  };
}
