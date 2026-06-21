import type { EnrichedHistory } from "../types";

const numberCount = 49;
const pickCount = 6;
const minNumber = 1;
const maxNumber = 49;

/*
 * Structural entropy is intentionally different from the fair lottery entropy.
 *
 * Fair lottery entropy asks: "How many bits identify one exact combination if all
 * 6/49 combinations are equally likely?" That answer is always log2(C(49, 6)).
 *
 * Structural entropy asks: "Can this exact draw be described by a shorter,
 * human-recognizable pattern?" The report below uses a minimum-description-length
 * style estimate: build several credible encodings, measure each in bits, and use
 * the cheapest valid encoding as the structural score. The full lens list is still
 * returned so the UI can show why the selected score was chosen.
 */
const possibleSums = maxNumber * pickCount - (pickCount * (pickCount - 1)) / 2
  - ((minNumber * pickCount) + (pickCount * (pickCount - 1)) / 2)
  + 1;
const septadeBuckets = [
  { start: 1, end: 7 },
  { start: 8, end: 14 },
  { start: 15, end: 21 },
  { start: 22, end: 28 },
  { start: 29, end: 35 },
  { start: 36, end: 42 },
  { start: 43, end: 49 },
];

const binomial = Array.from({ length: numberCount + 1 }, () =>
  Array.from({ length: pickCount + 1 }, () => 0),
);

for (let n = 0; n <= numberCount; n += 1) {
  binomial[n][0] = 1;

  for (let k = 1; k <= Math.min(n, pickCount); k += 1) {
    binomial[n][k] = k === n ? 1 : binomial[n - 1][k - 1] + binomial[n - 1][k];
  }
}

const totalDrawCombinations = choose(numberCount, pickCount);
const exactLotteryBits = log2(totalDrawCombinations);
const arithmeticProgressionCount = Array.from({ length: 9 }, (_value, index) => {
  const step = index + 1;
  return maxNumber - (pickCount - 1) * step;
}).reduce((total, count) => total + count, 0);

export interface StructuralEntropyLens {
  id: string;
  label: string;
  bits: number;
  normalized: number;
  detail: string;
  selected: boolean;
}

export interface StructuralEntropyFactor {
  label: string;
  value: string;
  impact: "low" | "medium" | "high";
  explanation: string;
}

export interface StructuralEntropyReport {
  numbers: number[];
  valid: boolean;
  exactLotteryBits: number;
  structuralBits: number;
  structuralPercent: number;
  selectedLensId: string;
  selectedLensLabel: string;
  complexityLabel: string;
  summary: string;
  metrics: {
    sum: number;
    span: number;
    oddCount: number;
    evenCount: number;
    longestRun: number;
    gaps: number[];
    gapEntropyBits: number;
    gapEntropyPercent: number;
    repeatedGapCount: number;
    septadeSignature: string;
  };
  lenses: StructuralEntropyLens[];
  factors: StructuralEntropyFactor[];
  notes: string[];
}

export interface EntropyBucket {
  id: string;
  label: string;
  description: string;
  color: string;
}

export interface EntropySituation {
  signature: string;
  count: number;
  percent: number;
  latestDate: string;
}

export interface EntropyBucketSummary {
  bucketId: string;
  label: string;
  count: number;
  share: number;
  averageBits: number;
  averagePercent: number;
}

export interface EntropyPrediction {
  number: number;
  rank: number;
  score: number;
  entropyPercent: number;
  highEntropyShare: number;
  appearances: number;
  currentGap: number;
  bucketId: string;
  label: string;
}

export interface EntropyProfileNumber {
  number: number;
  score: number;
  label: string;
  currentGap: number;
  entropyPercent: number;
}

export interface EntropyModel {
  buckets: EntropyBucket[];
  drawCount: number;
  situationCount: number;
  bucketSummaries: EntropyBucketSummary[];
  situations: EntropySituation[];
  predictions: EntropyPrediction[];
  latestProfile: {
    date: string | null;
    signature: string;
    report: StructuralEntropyReport | null;
    numbers: EntropyProfileNumber[];
  };
}

export const entropyBuckets: EntropyBucket[] = [
  {
    id: "veryPatterned",
    label: "Very patterned",
    description: "Shortest-description score below 35% of fair-draw entropy.",
    color: "#c65335",
  },
  {
    id: "patterned",
    label: "Patterned",
    description: "Visible structure keeps the draw below 55% of fair-draw entropy.",
    color: "#d58a1f",
  },
  {
    id: "structured",
    label: "Structured",
    description: "Some structure remains, with score below 75% of fair-draw entropy.",
    color: "#b6a12a",
  },
  {
    id: "irregular",
    label: "Irregular",
    description: "Mostly irregular, with score below 92% of fair-draw entropy.",
    color: "#3f8f68",
  },
  {
    id: "high",
    label: "High entropy",
    description: "No shorter structure was found; close to exact fair-draw identity.",
    color: "#174b91",
  },
];

const bucketById = new Map(entropyBuckets.map((bucket) => [bucket.id, bucket]));

function choose(n: number, k: number): number {
  if (n < 0 || k < 0 || k > n) {
    return 0;
  }

  return binomial[n]?.[k] ?? 0;
}

function log2(value: number): number {
  return value <= 0 ? 0 : Math.log2(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatBits(bits: number): string {
  return `${bits.toFixed(2)} bits`;
}

function countSumCombinations(targetSum: number): number {
  const memo = new Map<string, number>();

  function visit(nextNumber: number, remainingPicks: number, remainingSum: number): number {
    if (remainingPicks === 0) {
      return remainingSum === 0 ? 1 : 0;
    }

    if (nextNumber > maxNumber || remainingSum <= 0) {
      return 0;
    }

    const key = `${nextNumber}:${remainingPicks}:${remainingSum}`;
    const cached = memo.get(key);

    if (cached !== undefined) {
      return cached;
    }

    let total = 0;
    const highestStart = maxNumber - remainingPicks + 1;

    for (let number = nextNumber; number <= highestStart; number += 1) {
      total += visit(number + 1, remainingPicks - 1, remainingSum - number);
    }

    memo.set(key, total);
    return total;
  }

  return visit(minNumber, pickCount, targetSum);
}

function entropy(values: number[]): number {
  const counts = new Map<number, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.values()).reduce((total, count) => {
    const probability = count / values.length;
    return total - probability * log2(probability);
  }, 0);
}

function longestConsecutiveRun(numbers: number[]): number {
  let longest = 1;
  let current = 1;

  for (let index = 1; index < numbers.length; index += 1) {
    if (numbers[index] === numbers[index - 1] + 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

function buildSeptadeCounts(numbers: number[]): number[] {
  return septadeBuckets.map(
    (bucket) => numbers.filter((number) => bucket.start <= number && number <= bucket.end).length,
  );
}

function septadeClassCount(septadeCounts: number[]): number {
  return septadeCounts.reduce((total, count, index) => {
    const bucket = septadeBuckets[index];
    return total * choose(bucket.end - bucket.start + 1, count);
  }, 1);
}

function makeLens(
  id: string,
  label: string,
  bits: number,
  detail: string,
): StructuralEntropyLens {
  return {
    id,
    label,
    bits,
    normalized: clamp(bits / exactLotteryBits, 0, 1),
    detail,
    selected: false,
  };
}

function classifyComplexity(structuralPercent: number): string {
  if (structuralPercent < 35) {
    return "Very patterned";
  }

  if (structuralPercent < 55) {
    return "Patterned";
  }

  if (structuralPercent < 75) {
    return "Moderately structured";
  }

  if (structuralPercent < 92) {
    return "Mostly irregular";
  }

  return "High structural complexity";
}

function bucketIdForPercent(structuralPercent: number): string {
  if (structuralPercent < 35) {
    return "veryPatterned";
  }

  if (structuralPercent < 55) {
    return "patterned";
  }

  if (structuralPercent < 75) {
    return "structured";
  }

  if (structuralPercent < 92) {
    return "irregular";
  }

  return "high";
}

function bucketForPercent(structuralPercent: number): EntropyBucket {
  return bucketById.get(bucketIdForPercent(structuralPercent)) ?? entropyBuckets[0];
}

function normalizeScores(values: Map<number, number>): Map<number, number> {
  const rawValues = [...values.values()];
  const minValue = Math.min(...rawValues);
  const maxValue = Math.max(...rawValues);
  const spread = maxValue - minValue;

  if (spread <= 0) {
    return new Map([...values.keys()].map((number) => [number, 50]));
  }

  return new Map(
    [...values.entries()].map(([number, value]) => [
      number,
      ((value - minValue) / spread) * 100,
    ]),
  );
}

export function buildStructuralEntropyReport(rawNumbers: number[]): StructuralEntropyReport {
  const numbers = [...new Set(rawNumbers)]
    .map((number) => Math.trunc(number))
    .sort((left, right) => left - right);
  const valid =
    numbers.length === pickCount &&
    numbers.every((number) => minNumber <= number && number <= maxNumber);

  const gaps = numbers.slice(1).map((number, index) => number - numbers[index]);
  const sum = numbers.reduce((total, number) => total + number, 0);
  const span = numbers[numbers.length - 1] - numbers[0];
  const oddCount = numbers.filter((number) => number % 2 === 1).length;
  const evenCount = pickCount - oddCount;
  const longestRun = longestConsecutiveRun(numbers);
  const gapEntropyBits = entropy(gaps);
  const maxGapEntropy = log2(gaps.length);
  const gapEntropyPercent = maxGapEntropy === 0 ? 0 : (gapEntropyBits / maxGapEntropy) * 100;
  const repeatedGapCount = gaps.length - new Set(gaps).size;
  const septadeCounts = buildSeptadeCounts(numbers);
  const septadeSignature = septadeCounts.join("-");
  const sumClassCount = countSumCombinations(sum);
  const spanClassCount = Math.max(maxNumber - span, 0) * choose(span - 1, pickCount - 2);
  const parityClassCount = choose(25, oddCount) * choose(24, evenCount);
  const septadeProfileCount = choose(
    pickCount + septadeBuckets.length - 1,
    septadeBuckets.length - 1,
  );
  const septadeBits = log2(septadeProfileCount) + log2(septadeClassCount(septadeCounts));

  const lenses = [
    makeLens(
      "exact",
      "Exact fair-draw identity",
      exactLotteryBits,
      `One exact unordered draw among ${totalDrawCombinations.toLocaleString()} possible 6/49 combinations.`,
    ),
    makeLens(
      "sum",
      "Same sum class",
      log2(possibleSums) + log2(sumClassCount),
      `Encode the total ${sum}, then the draw among ${sumClassCount.toLocaleString()} combinations with that sum.`,
    ),
    makeLens(
      "span",
      "Same span class",
      log2(numberCount - pickCount + 1) + log2(spanClassCount),
      `Encode the span ${span}, then the draw among ${spanClassCount.toLocaleString()} combinations with that span.`,
    ),
    makeLens(
      "parity",
      "Same odd/even class",
      log2(pickCount + 1) + log2(parityClassCount),
      `Encode the ${oddCount} odd / ${evenCount} even profile, then one draw from that profile.`,
    ),
    makeLens(
      "septades",
      "Same septade profile",
      septadeBits,
      `Encode the septade profile ${septadeSignature}, then one draw with those bucket counts.`,
    ),
  ];

  if (gaps.length > 0 && gaps.every((gap) => gap === 1)) {
    lenses.push(
      makeLens(
        "consecutive",
        "Consecutive run",
        log2(numberCount - pickCount + 1),
        `Only the start of the 6-number run must be encoded; there are ${numberCount - pickCount + 1} possible runs.`,
      ),
    );
  }

  if (gaps.length > 0 && gaps.every((gap) => gap === gaps[0])) {
    lenses.push(
      makeLens(
        "arithmetic",
        "Arithmetic progression",
        log2(arithmeticProgressionCount),
        `Encode start and constant step; there are ${arithmeticProgressionCount} valid 6-term progressions in 1..49.`,
      ),
    );
  }

  const selectedLens = lenses.reduce((best, lens) => (lens.bits < best.bits ? lens : best));
  const selectedLenses = lenses.map((lens) => ({
    ...lens,
    selected: lens.id === selectedLens.id,
  }));
  const structuralBits = valid ? selectedLens.bits : 0;
  const structuralPercent = valid ? (structuralBits / exactLotteryBits) * 100 : 0;
  const complexityLabel = valid ? classifyComplexity(structuralPercent) : "Invalid draw";

  const factors: StructuralEntropyFactor[] = [
    {
      label: "Gaps",
      value: gaps.join(", "),
      impact: gapEntropyPercent < 45 ? "low" : gapEntropyPercent < 80 ? "medium" : "high",
      explanation: `Gap entropy is ${formatBits(gapEntropyBits)} out of ${formatBits(maxGapEntropy)}; repeated or equal gaps make the shape easier to describe.`,
    },
    {
      label: "Longest run",
      value: String(longestRun),
      impact: longestRun >= 4 ? "low" : longestRun >= 2 ? "medium" : "high",
      explanation: "Long consecutive runs are compact patterns, so they reduce structural complexity.",
    },
    {
      label: "Span",
      value: String(span),
      impact: span <= 15 ? "low" : span <= 30 ? "medium" : "high",
      explanation: "A narrow span clusters the draw into fewer possible positions than a wide spread.",
    },
    {
      label: "Sum",
      value: String(sum),
      impact: sumClassCount < totalDrawCombinations * 0.01 ? "low" : "medium",
      explanation: `${sumClassCount.toLocaleString()} combinations have this exact sum; rare totals can shorten the description.`,
    },
    {
      label: "Odd/even",
      value: `${oddCount}/${evenCount}`,
      impact: oddCount === 0 || oddCount === pickCount ? "low" : oddCount === 3 ? "high" : "medium",
      explanation: "Extreme parity profiles are less common than balanced profiles.",
    },
    {
      label: "Septades",
      value: septadeSignature,
      impact: Math.max(...septadeCounts) >= 4 ? "low" : septadeCounts.filter(Boolean).length >= 4 ? "high" : "medium",
      explanation: "Numbers spread across more septade buckets usually have higher structural variety.",
    },
  ];

  return {
    numbers,
    valid,
    exactLotteryBits,
    structuralBits,
    structuralPercent,
    selectedLensId: selectedLens.id,
    selectedLensLabel: selectedLens.label,
    complexityLabel,
    summary: valid
      ? `${numbers.join(", ")} is ${complexityLabel.toLowerCase()} under the shortest-description model: ${formatBits(structuralBits)} versus ${formatBits(exactLotteryBits)} for an unconstrained fair draw.`
      : "A structural entropy report requires exactly 6 unique numbers from 1 to 49.",
    metrics: {
      sum,
      span,
      oddCount,
      evenCount,
      longestRun,
      gaps,
      gapEntropyBits,
      gapEntropyPercent,
      repeatedGapCount,
      septadeSignature,
    },
    lenses: selectedLenses.sort((left, right) => left.bits - right.bits),
    factors,
    notes: [
      "This is structural entropy, not lottery probability. A fair machine assigns every valid 6-number combination the same exact probability.",
      "The score is an estimate of how many bits are needed to describe the draw using simple human-recognizable structures.",
      "The selected lens is the cheapest valid description found; other lenses are shown to make the result inspectable.",
    ],
  };
}

export function buildEntropyModel(history: EnrichedHistory): EntropyModel {
  const drawReports = history.draws.map((draw) => ({
    draw,
    report: buildStructuralEntropyReport(draw.numbers.map((number) => number.value)),
  }));
  const bucketCounts = new Map(entropyBuckets.map((bucket) => [bucket.id, 0]));
  const bucketBitTotals = new Map(entropyBuckets.map((bucket) => [bucket.id, 0]));
  const bucketPercentTotals = new Map(entropyBuckets.map((bucket) => [bucket.id, 0]));
  const situationMap = new Map<string, EntropySituation>();
  const numberAppearances = new Map<number, number>();
  const numberEntropyTotals = new Map<number, number>();
  const numberHighEntropyHits = new Map<number, number>();
  const lastSeen = new Map<number, number | null>();

  for (let number = minNumber; number <= maxNumber; number += 1) {
    numberAppearances.set(number, 0);
    numberEntropyTotals.set(number, 0);
    numberHighEntropyHits.set(number, 0);
    lastSeen.set(number, null);
  }

  drawReports.forEach(({ draw, report }, drawIndex) => {
    const bucket = bucketForPercent(report.structuralPercent);
    const signature = `${bucket.label} | ${report.selectedLensLabel} | ${report.metrics.septadeSignature}`;
    const currentSituation = situationMap.get(signature);

    bucketCounts.set(bucket.id, (bucketCounts.get(bucket.id) ?? 0) + 1);
    bucketBitTotals.set(bucket.id, (bucketBitTotals.get(bucket.id) ?? 0) + report.structuralBits);
    bucketPercentTotals.set(
      bucket.id,
      (bucketPercentTotals.get(bucket.id) ?? 0) + report.structuralPercent,
    );
    situationMap.set(signature, {
      signature,
      count: (currentSituation?.count ?? 0) + 1,
      percent: 0,
      latestDate:
        currentSituation === undefined || draw.date.localeCompare(currentSituation.latestDate) > 0
          ? draw.date
          : currentSituation.latestDate,
    });

    for (const number of draw.numbers) {
      numberAppearances.set(number.value, (numberAppearances.get(number.value) ?? 0) + 1);
      numberEntropyTotals.set(
        number.value,
        (numberEntropyTotals.get(number.value) ?? 0) + report.structuralPercent,
      );
      if (report.structuralPercent >= 92) {
        numberHighEntropyHits.set(
          number.value,
          (numberHighEntropyHits.get(number.value) ?? 0) + 1,
        );
      }
      lastSeen.set(number.value, drawIndex);
    }
  });

  const drawCount = drawReports.length;
  const bucketSummaries = entropyBuckets.map((bucket) => {
    const count = bucketCounts.get(bucket.id) ?? 0;

    return {
      bucketId: bucket.id,
      label: bucket.label,
      count,
      share: drawCount === 0 ? 0 : count / drawCount,
      averageBits: count === 0 ? 0 : (bucketBitTotals.get(bucket.id) ?? 0) / count,
      averagePercent: count === 0 ? 0 : (bucketPercentTotals.get(bucket.id) ?? 0) / count,
    };
  });
  const rawPredictionScores = new Map<number, number>();

  for (let number = minNumber; number <= maxNumber; number += 1) {
    const appearances = numberAppearances.get(number) ?? 0;
    const averageEntropy = appearances === 0
      ? 50
      : (numberEntropyTotals.get(number) ?? 0) / appearances;
    const highEntropyShare = appearances === 0
      ? 0
      : (numberHighEntropyHits.get(number) ?? 0) / appearances;
    const seenAt = lastSeen.get(number);
    const currentGap = seenAt === null || seenAt === undefined ? drawCount : drawCount - 1 - seenAt;
    const gapScore = clamp(currentGap / 28, 0, 1) * 100;

    rawPredictionScores.set(
      number,
      averageEntropy * 0.55 + highEntropyShare * 100 * 0.3 + gapScore * 0.15,
    );
  }

  const scaledPredictionScores = normalizeScores(rawPredictionScores);
  const predictions = Array.from({ length: numberCount }, (_value, index) => {
    const number = index + 1;
    const appearances = numberAppearances.get(number) ?? 0;
    const entropyPercent = appearances === 0
      ? 0
      : (numberEntropyTotals.get(number) ?? 0) / appearances;
    const highEntropyShare = appearances === 0
      ? 0
      : (numberHighEntropyHits.get(number) ?? 0) / appearances;
    const seenAt = lastSeen.get(number);
    const currentGap = seenAt === null || seenAt === undefined ? drawCount : drawCount - 1 - seenAt;
    const score = scaledPredictionScores.get(number) ?? 0;
    const bucket = bucketForPercent(score);

    return {
      number,
      rank: 0,
      score,
      entropyPercent,
      highEntropyShare,
      appearances,
      currentGap,
      bucketId: bucket.id,
      label: bucket.label,
    };
  })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.highEntropyShare - left.highEntropyShare ||
        right.entropyPercent - left.entropyPercent ||
        left.number - right.number,
    )
    .map((prediction, index) => ({
      ...prediction,
      rank: index + 1,
    }));

  const predictionsByNumber = new Map(
    predictions.map((prediction) => [prediction.number, prediction]),
  );
  const latestReport = drawReports[drawReports.length - 1]?.report ?? null;
  const latestDraw = drawReports[drawReports.length - 1]?.draw ?? null;

  return {
    buckets: entropyBuckets,
    drawCount,
    situationCount: situationMap.size,
    bucketSummaries,
    situations: [...situationMap.values()]
      .map((situation) => ({
        ...situation,
        percent: drawCount === 0 ? 0 : situation.count / drawCount,
      }))
      .sort(
        (left, right) =>
          right.count - left.count || right.latestDate.localeCompare(left.latestDate),
      ),
    predictions,
    latestProfile: {
      date: latestDraw?.date ?? null,
      signature: latestReport === null
        ? "n/a"
        : `${latestReport.complexityLabel} | ${latestReport.selectedLensLabel} | ${latestReport.metrics.septadeSignature}`,
      report: latestReport,
      numbers: (latestDraw?.numbers ?? [])
        .map((number) => {
          const prediction = predictionsByNumber.get(number.value);

          return {
            number: number.value,
            score: prediction?.score ?? 0,
            label: prediction?.label ?? "n/a",
            currentGap: prediction?.currentGap ?? number.gap,
            entropyPercent: prediction?.entropyPercent ?? 0,
          };
        })
        .sort((left, right) => right.score - left.score || left.number - right.number),
    },
  };
}
