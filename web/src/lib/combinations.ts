const numberCount = 49;
const pickCount = 6;

const binomial = Array.from({ length: numberCount + 1 }, () =>
  Array.from({ length: pickCount + 1 }, () => 0),
);

for (let n = 0; n <= numberCount; n += 1) {
  binomial[n][0] = 1;

  for (let k = 1; k <= Math.min(n, pickCount); k += 1) {
    binomial[n][k] = k === n ? 1 : binomial[n - 1][k - 1] + binomial[n - 1][k];
  }
}

export const totalGeneratedDrawCombinations = binomial[numberCount][pickCount];

function choose(n: number, k: number): number {
  if (n < 0 || k < 0 || k > n) {
    return 0;
  }

  return binomial[n][k] ?? 0;
}

export function generatedDrawCombinationAt(index: number): number[] {
  const normalizedIndex = Math.min(
    Math.max(Math.trunc(index), 0),
    totalGeneratedDrawCombinations - 1,
  );
  const combination: number[] = [];
  let rank = normalizedIndex;
  let previousNumber = 0;

  for (let position = 0; position < pickCount; position += 1) {
    const remainingPicks = pickCount - position - 1;

    for (
      let candidate = previousNumber + 1;
      candidate <= numberCount - remainingPicks;
      candidate += 1
    ) {
      const skippedCount = choose(numberCount - candidate, remainingPicks);

      if (rank < skippedCount) {
        combination.push(candidate);
        previousNumber = candidate;
        break;
      }

      rank -= skippedCount;
    }
  }

  return combination;
}

export function generatedDrawCombinationRows(startIndex: number, count: number) {
  const start = Math.min(Math.max(Math.trunc(startIndex), 0), totalGeneratedDrawCombinations);
  const end = Math.min(start + Math.max(Math.trunc(count), 0), totalGeneratedDrawCombinations);

  return Array.from({ length: end - start }, (_value, offset) => {
    const index = start + offset;
    const numbers = generatedDrawCombinationAt(index);

    return {
      index,
      numbers,
      sum: numbers.reduce((total, number) => total + number, 0),
    };
  });
}
