import type {
  ChiSquareBand,
  ChiSquareModel,
  ChiSquareNumberSummary,
  EnrichedHistory,
} from "../types";

const numberCount = 49;
const numbersPerDraw = 6;
const minNumber = 1;
const maxNumber = 49;
const critical95Df48 = 65.1708;
const critical99Df48 = 73.6837;
const epsilon = 1e-12;
const tiny = 1e-300;
const maxIterations = 200;

export const chiSquareBands: ChiSquareBand[] = [
  {
    id: "strongUnder",
    label: "Strong under",
    description: "Observed count is at least 2 standard residuals below expected.",
    color: "#174b91",
  },
  {
    id: "under",
    label: "Mild under",
    description: "Observed count is 1-2 standard residuals below expected.",
    color: "#2f6fb3",
  },
  {
    id: "near",
    label: "Near expected",
    description: "Observed count sits within 1 standard residual of expected.",
    color: "#3f8f68",
  },
  {
    id: "over",
    label: "Mild over",
    description: "Observed count is 1-2 standard residuals above expected.",
    color: "#d58a1f",
  },
  {
    id: "strongOver",
    label: "Strong over",
    description: "Observed count is at least 2 standard residuals above expected.",
    color: "#c65335",
  },
];

const bandById = new Map(chiSquareBands.map((band) => [band.id, band]));

function logGamma(value: number): number {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];

  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }

  let shiftedValue = value - 1;
  let series = 0.9999999999998099;

  for (let index = 0; index < coefficients.length; index += 1) {
    series += coefficients[index] / (shiftedValue + index + 1);
  }

  const base = shiftedValue + coefficients.length - 0.5;

  return (
    0.5 * Math.log(2 * Math.PI) +
    (shiftedValue + 0.5) * Math.log(base) -
    base +
    Math.log(series)
  );
}

function regularizedGammaP(shape: number, value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value < shape + 1) {
    let term = 1 / shape;
    let sum = term;

    for (let index = 1; index <= maxIterations; index += 1) {
      term *= value / (shape + index);
      sum += term;

      if (Math.abs(term) < Math.abs(sum) * epsilon) {
        break;
      }
    }

    return Math.min(
      Math.max(sum * Math.exp(-value + shape * Math.log(value) - logGamma(shape)), 0),
      1,
    );
  }

  let b = value + 1 - shape;
  let c = 1 / tiny;
  let d = 1 / Math.max(b, tiny);
  let h = d;

  for (let index = 1; index <= maxIterations; index += 1) {
    const an = -index * (index - shape);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) {
      d = tiny;
    }

    c = b + an / c;
    if (Math.abs(c) < tiny) {
      c = tiny;
    }

    d = 1 / d;
    const delta = d * c;
    h *= delta;

    if (Math.abs(delta - 1) < epsilon) {
      break;
    }
  }

  const q = Math.exp(-value + shape * Math.log(value) - logGamma(shape)) * h;

  return Math.min(Math.max(1 - q, 0), 1);
}

function chiSquareSurvival(statistic: number, degreesOfFreedom: number): number {
  if (degreesOfFreedom <= 0) {
    return 1;
  }

  return Math.min(
    Math.max(1 - regularizedGammaP(degreesOfFreedom / 2, statistic / 2), 0),
    1,
  );
}

function bandForResidual(residual: number): ChiSquareBand {
  if (residual <= -2) {
    return bandById.get("strongUnder") ?? chiSquareBands[0];
  }

  if (residual <= -1) {
    return bandById.get("under") ?? chiSquareBands[1];
  }

  if (residual >= 2) {
    return bandById.get("strongOver") ?? chiSquareBands[4];
  }

  if (residual >= 1) {
    return bandById.get("over") ?? chiSquareBands[3];
  }

  return bandById.get("near") ?? chiSquareBands[2];
}

function interpretationFor(pValue: number, statistic: number): string {
  if (statistic >= critical99Df48 || pValue < 0.01) {
    return "Strong deviation from a uniform 6/49 frequency baseline at the 1% level.";
  }

  if (statistic >= critical95Df48 || pValue < 0.05) {
    return "Moderate deviation from a uniform 6/49 frequency baseline at the 5% level.";
  }

  return "No statistically unusual frequency deviation from the uniform 6/49 baseline at the 5% level.";
}

export function buildChiSquareModel(history: EnrichedHistory): ChiSquareModel {
  const counts = new Map<number, number>();

  for (let number = minNumber; number <= maxNumber; number += 1) {
    counts.set(number, 0);
  }

  for (const draw of history.draws) {
    for (const number of draw.numbers) {
      counts.set(number.value, (counts.get(number.value) ?? 0) + 1);
    }
  }

  const drawCount = history.draws.length;
  const totalObserved = drawCount * numbersPerDraw;
  const expectedPerNumber = totalObserved / numberCount;
  const statistic =
    expectedPerNumber === 0
      ? 0
      : [...counts.values()].reduce((total, observed) => {
          const difference = observed - expectedPerNumber;

          return total + (difference * difference) / expectedPerNumber;
        }, 0);
  const degreesOfFreedom = numberCount - 1;
  const pValue = chiSquareSurvival(statistic, degreesOfFreedom);
  const maxContribution =
    expectedPerNumber === 0
      ? 1
      : Math.max(
          ...[...counts.values()].map((observed) => {
            const difference = observed - expectedPerNumber;

            return (difference * difference) / expectedPerNumber;
          }),
          1,
        );

  const numberSummaries: ChiSquareNumberSummary[] = Array.from(
    { length: numberCount },
    (_value, index) => {
      const number = index + 1;
      const observed = counts.get(number) ?? 0;
      const difference = observed - expectedPerNumber;
      const residual = expectedPerNumber === 0 ? 0 : difference / Math.sqrt(expectedPerNumber);
      const contribution =
        expectedPerNumber === 0 ? 0 : (difference * difference) / expectedPerNumber;
      const band = bandForResidual(residual);

      return {
        number,
        observed,
        expected: expectedPerNumber,
        difference,
        residual,
        contribution,
        share: totalObserved === 0 ? 0 : observed / totalObserved,
        rank: 0,
        bandId: band.id,
        label: band.label,
      };
    },
  )
    .sort(
      (left, right) =>
        right.contribution - left.contribution ||
        Math.abs(right.residual) - Math.abs(left.residual) ||
        left.number - right.number,
    )
    .map((summary, index) => ({
      ...summary,
      rank: index + 1,
    }));

  const summariesByNumber = new Map(
    numberSummaries.map((summary) => [summary.number, summary]),
  );
  const latestDraw = history.draws[history.draws.length - 1] ?? null;
  const latestNumbers = (latestDraw?.numbers ?? [])
    .map((number) => summariesByNumber.get(number.value))
    .filter((summary): summary is ChiSquareNumberSummary => summary !== undefined)
    .sort((left, right) => right.contribution - left.contribution || left.number - right.number);

  return {
    bands: chiSquareBands,
    drawCount,
    totalObserved,
    expectedPerNumber,
    statistic,
    degreesOfFreedom,
    pValue,
    critical95: critical95Df48,
    critical99: critical99Df48,
    maxContribution,
    interpretation: interpretationFor(pValue, statistic),
    numberSummaries,
    latestProfile: {
      date: latestDraw?.date ?? null,
      signature:
        latestNumbers.length === 0
          ? "n/a"
          : latestNumbers.map((summary) => `${summary.number}: ${summary.label}`).join(" | "),
      numbers: latestNumbers,
    },
  };
}
