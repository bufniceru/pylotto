# Predictive Score Grid Specification

This document is the project reference for the Predictive Score Grid used in the
Next Possible Draw workflow. Treat it as the source of truth when changing the
backend scorer, generated JSON, or frontend display.

## Purpose

The Predictive Score Grid ranks lotto numbers 1 through 49 for the next possible
draw. It does not predict certainty; it combines historical signals into a
relative score so the UI can highlight stronger and weaker candidates.

## Data Source

- Source history: `data/lotto_results.yaml`
- Export script: `scripts/export_predictive_score_grid_json.py`
- Generated frontend data: `web/src/data/predictive-score-grid.json`
- Backend analyzer: `src/pylotto/backend/predictive_score_grid/analyzer.py`
- Frontend display: `web/src/components/NextPossibleDrawDialog.vue`

## Default Configuration

The scorer uses `ScoreGridConfig` defaults:

| Field | Value | Meaning |
| --- | ---: | --- |
| `min_number` | 1 | Lowest lotto number. |
| `max_number` | 49 | Highest lotto number. |
| `numbers_per_draw` | 6 | Numbers in each draw. |
| `recent_draw_window` | 20 | Number of latest draws used for recency. |
| `gap_state_max_gap` | 35 | Maximum Markov gap bucket; larger gaps are capped. |
| `markov_prior_strength` | 8.0 | Smoothing weight for gap-state probabilities. |
| `markov_decay_half_life` | 500.0 | Recency decay half-life used in gap-state Markov training. |

## Score Components

Each number receives six normalized component scores. Normalization scales each
component across all 49 numbers to the range `0.0` to `1.0`.

| Component | Weight | Field | Description |
| --- | ---: | --- | --- |
| Gap-State Markov | 0.35 | `markovScore` | Probability of a number appearing based on its current absence gap bucket. This is the largest signal. |
| Last-Draw Transition | 0.20 | `transitionScore` | Average historical transition probability from each number in the latest draw to the candidate number in the next draw. |
| Long-Term Frequency | 0.15 | `frequencyScore` | How often the candidate has appeared across all historical draws, divided by total draw count. |
| Recent Hits | 0.15 | `recencyScore` | How many times the candidate appeared in the latest `recent_draw_window` draws. |
| Current Gap | 0.10 | `gapScore` | Current number of draws since the candidate last appeared; larger current gaps score higher after normalization. |
| Pair Affinity | 0.05 | `pairAffinityScore` | Average historical co-occurrence count between the candidate and the numbers in the latest draw. |

The final score formula is:

```text
score =
  0.35 * markovScore
+ 0.20 * transitionScore
+ 0.15 * frequencyScore
+ 0.15 * recencyScore
+ 0.10 * gapScore
+ 0.05 * pairAffinityScore
```

## Gap-State Markov Model

The Markov component is based on absence gaps rather than direct number identity.

1. For every draw after the first, compute each number's gap before that draw.
2. Cap the gap into a bucket from `0` to `gap_state_max_gap`.
3. Count weighted opportunities and weighted hits for each bucket.
4. Apply exponential recency decay using `markov_decay_half_life`.
5. Smooth the probability with a base lottery probability of `6 / 49` and
   `markov_prior_strength`.

Each scored number stores:

- `gapStateBucket`: the capped current gap bucket.
- `gapStateProbability`: the raw smoothed probability for that bucket.
- `currentGap`: draws since the number last appeared.

## Output Contract

The generated JSON has this top-level shape:

```ts
interface PredictiveScoreGrid {
  name: string;
  totalDraws: number;
  firstDraw: string;
  lastDraw: string;
  recentDrawWindow: number;
  markovModel: string;
  gapStateMaxGap: number;
  topNumbers: number[];
  numbers: PredictiveScoreNumber[];
}
```

Each number row has this shape:

```ts
interface PredictiveScoreNumber {
  number: number;
  score: number;
  rank: number;
  isTopPick: boolean;
  markovScore: number;
  transitionScore: number;
  frequencyScore: number;
  recencyScore: number;
  gapScore: number;
  pairAffinityScore: number;
  gapStateBucket: number;
  gapStateProbability: number;
  recentHits: number;
  currentGap: number;
}
```

Rows in `numbers` are sorted by `number`. Ranking is assigned by descending
`score`, with the lower number winning ties. `topNumbers` contains the first six
ranked numbers by default, and `isTopPick` is true for those rows.

## Frontend Behavior

The Next Possible Draw dialog has a `Predictive Score Grid` tab that:

- Renders numbers 1 through 49 in grid order.
- Colors each cell by rank strength, not raw score.
- Marks top picks with the `topPick` class.
- Lets a click focus the number's predictive rank and queue selection.
- Lets a double-click mark the number as uncertain.
- Shows a summary with the model name, top numbers, and recent window.
- Provides a rank navigator from rank 1 through rank 49.

The dialog also computes a user-facing model agreement score for the manually
selected next draw:

```text
agreement =
  (0.55 * averageSelectedStrength
+ 0.35 * topPickOverlap
+ 0.10 * completeness) * 100
```

Where:

- `averageSelectedStrength` uses selected numbers' ranks.
- `topPickOverlap` is selected top-pick count divided by 6.
- `completeness` is selected number count divided by 6.

## Current Generated Snapshot

As of the checked-in generated JSON:

- Total draws: `2550`
- First draw: `1993-08-15`
- Last draw: `2026-06-18`
- Model: `Gap-State Markov`
- Recent window: `20`
- Top numbers: `5, 33, 25, 17, 6, 11`

Regenerate the snapshot after changing history or scoring logic:

```powershell
uv run python scripts/export_predictive_score_grid_json.py
```
