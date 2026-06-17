from __future__ import annotations

import math
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path
from typing import Any

import yaml

from .models import DrawRecord, LottoDataset, ScoreGridConfig


def _validate_numbers(numbers: list[int], config: ScoreGridConfig) -> tuple[int, ...]:
    clean = [int(number) for number in numbers]

    if len(clean) != config.numbers_per_draw:
        raise ValueError(f"Expected {config.numbers_per_draw} numbers, got {len(clean)}.")

    if len(set(clean)) != len(clean):
        raise ValueError(f"Duplicate numbers found in draw: {clean}")

    for number in clean:
        if not (config.min_number <= number <= config.max_number):
            raise ValueError(
                f"Number {number} out of range [{config.min_number}, {config.max_number}]."
            )

    return tuple(sorted(clean))


def load_draws_from_yaml(
    yaml_path: str | Path,
    config: ScoreGridConfig | None = None,
) -> LottoDataset:
    config = config or ScoreGridConfig()
    path = Path(yaml_path)

    with path.open("r", encoding="utf-8") as source_file:
        payload: dict[str, Any] = yaml.safe_load(source_file) or {}

    lotto_results = payload.get("lotto_results", {})
    raw_draws = lotto_results.get("draws", [])
    if not isinstance(raw_draws, list):
        raise ValueError("YAML lotto_results.draws must be a list.")

    draws = tuple(
        DrawRecord(
            draw_date=str(raw_draw["date"]),
            numbers=_validate_numbers(raw_draw["numbers"], config),
        )
        for raw_draw in raw_draws
    )

    if not draws:
        raise ValueError("No lotto draws found.")

    return LottoDataset(
        total_draws=len(draws),
        first_draw=draws[0].draw_date,
        last_draw=draws[-1].draw_date,
        draws=draws,
    )


class PredictiveScoreGridAnalyzer:
    def __init__(
        self,
        dataset: LottoDataset,
        config: ScoreGridConfig | None = None,
    ) -> None:
        self.dataset = dataset
        self.config = config or ScoreGridConfig()

    @property
    def draws(self) -> tuple[DrawRecord, ...]:
        return self.dataset.draws

    def _number_range(self) -> range:
        return range(self.config.min_number, self.config.max_number + 1)

    @staticmethod
    def _scale_scores(values: dict[int, float]) -> dict[int, float]:
        if not values:
            return {}

        min_value = min(values.values())
        max_value = max(values.values())
        if math.isclose(min_value, max_value):
            return {number: 0.0 for number in values}

        spread = max_value - min_value
        return {
            number: (value - min_value) / spread
            for number, value in values.items()
        }

    def compute_transition_probabilities(self) -> dict[int, dict[int, float]]:
        transition_counts: dict[int, Counter[int]] = defaultdict(Counter)

        for previous_draw, next_draw in zip(self.draws, self.draws[1:]):
            for previous_number in previous_draw.numbers:
                for next_number in next_draw.numbers:
                    transition_counts[previous_number][next_number] += 1

        probabilities: dict[int, dict[int, float]] = {}
        for number, counter in transition_counts.items():
            total = sum(counter.values())
            probabilities[number] = {
                next_number: count / total
                for next_number, count in counter.items()
            }

        return probabilities

    def compute_markov_presence_model(self) -> dict[int, dict[str, float]]:
        sequences: dict[int, list[int]] = {number: [] for number in self._number_range()}

        for draw in self.draws:
            present = set(draw.numbers)
            for number in self._number_range():
                sequences[number].append(1 if number in present else 0)

        model: dict[int, dict[str, float]] = {}
        for number, sequence in sequences.items():
            c00 = c01 = c10 = c11 = 0

            for previous_state, next_state in zip(sequence, sequence[1:]):
                if previous_state == 0 and next_state == 0:
                    c00 += 1
                elif previous_state == 0 and next_state == 1:
                    c01 += 1
                elif previous_state == 1 and next_state == 0:
                    c10 += 1
                else:
                    c11 += 1

            total_absent = c00 + c01
            total_present = c10 + c11
            model[number] = {
                "p01": c01 / total_absent if total_absent else 0.0,
                "p11": c11 / total_present if total_present else 0.0,
            }

        return model

    def _gap_bucket(self, gap: int) -> int:
        return min(max(gap, 0), self.config.gap_state_max_gap)

    def compute_gap_state_markov_model(self) -> dict[int, dict[str, float]]:
        last_seen: dict[int, int | None] = {number: None for number in self._number_range()}
        opportunity_weight: dict[int, float] = defaultdict(float)
        hit_weight: dict[int, float] = defaultdict(float)
        total_draws = len(self.draws)

        for target_index, draw in enumerate(self.draws):
            if target_index == 0:
                for number in draw.numbers:
                    last_seen[number] = target_index
                continue

            present = set(draw.numbers)
            age = (total_draws - 1) - target_index
            weight = 0.5 ** (age / self.config.markov_decay_half_life)

            for number in self._number_range():
                seen_at = last_seen[number]
                gap = target_index if seen_at is None else target_index - 1 - seen_at
                bucket = self._gap_bucket(gap)

                opportunity_weight[bucket] += weight
                if number in present:
                    hit_weight[bucket] += weight

            for number in draw.numbers:
                last_seen[number] = target_index

        base_probability = self.config.numbers_per_draw / (
            self.config.max_number - self.config.min_number + 1
        )
        buckets = range(self.config.gap_state_max_gap + 1)
        model: dict[int, dict[str, float]] = {}

        for bucket in buckets:
            opportunities = opportunity_weight.get(bucket, 0.0)
            hits = hit_weight.get(bucket, 0.0)
            probability = (
                hits + self.config.markov_prior_strength * base_probability
            ) / (opportunities + self.config.markov_prior_strength)

            model[bucket] = {
                "bucket": bucket,
                "weightedOpportunities": opportunities,
                "weightedHits": hits,
                "probability": probability,
            }

        return model

    def compute_frequency_ratios(self) -> dict[int, float]:
        counts: Counter[int] = Counter()
        for draw in self.draws:
            counts.update(draw.numbers)

        total_draws = len(self.draws)
        return {
            number: counts.get(number, 0) / total_draws if total_draws else 0.0
            for number in self._number_range()
        }

    def compute_current_gaps(self) -> dict[int, int]:
        last_seen: dict[int, int | None] = {number: None for number in self._number_range()}

        for index, draw in enumerate(self.draws):
            for number in draw.numbers:
                last_seen[number] = index

        total_draws = len(self.draws)
        return {
            number: total_draws if seen_at is None else total_draws - 1 - seen_at
            for number, seen_at in last_seen.items()
        }

    def compute_recent_hit_counts(self) -> dict[int, int]:
        recent_draws = self.draws[-self.config.recent_draw_window :]
        counts: Counter[int] = Counter()

        for draw in recent_draws:
            counts.update(draw.numbers)

        return {number: counts.get(number, 0) for number in self._number_range()}

    def compute_pair_affinity_counts(self) -> dict[tuple[int, int], int]:
        pair_counts: dict[tuple[int, int], int] = Counter()

        for draw in self.draws:
            for first, second in combinations(draw.numbers, 2):
                pair_counts[(min(first, second), max(first, second))] += 1

        return pair_counts

    def score_numbers(self, top_k: int = 6) -> list[dict[str, Any]]:
        if len(self.draws) < 2:
            raise ValueError("At least two draws are required to score numbers.")

        last_draw = self.draws[-1]
        gap_state_markov_model = self.compute_gap_state_markov_model()
        transition_probabilities = self.compute_transition_probabilities()
        frequency_ratios = self.compute_frequency_ratios()
        current_gaps = self.compute_current_gaps()
        recent_hits = self.compute_recent_hit_counts()
        pair_counts = self.compute_pair_affinity_counts()

        markov_raw: dict[int, float] = {}
        transition_raw: dict[int, float] = {}
        pair_affinity_raw: dict[int, float] = {}

        for candidate in self._number_range():
            gap_bucket = self._gap_bucket(current_gaps[candidate])
            markov_raw[candidate] = gap_state_markov_model[gap_bucket]["probability"]

            transition_values = [
                transition_probabilities.get(last_number, {}).get(candidate, 0.0)
                for last_number in last_draw.numbers
            ]
            transition_raw[candidate] = (
                sum(transition_values) / len(transition_values)
                if transition_values
                else 0.0
            )

            affinities = []
            for last_number in last_draw.numbers:
                if candidate == last_number:
                    continue
                pair = (min(candidate, last_number), max(candidate, last_number))
                affinities.append(pair_counts.get(pair, 0))
            pair_affinity_raw[candidate] = sum(affinities) / len(affinities) if affinities else 0.0

        markov_scores = self._scale_scores(markov_raw)
        transition_scores = self._scale_scores(transition_raw)
        frequency_scores = self._scale_scores(frequency_ratios)
        recency_scores = self._scale_scores(
            {number: float(count) for number, count in recent_hits.items()}
        )
        gap_scores = self._scale_scores(
            {number: float(gap) for number, gap in current_gaps.items()}
        )
        pair_affinity_scores = self._scale_scores(pair_affinity_raw)

        rows = []
        for number in self._number_range():
            score = (
                0.35 * markov_scores[number]
                + 0.2 * transition_scores[number]
                + 0.15 * frequency_scores[number]
                + 0.15 * recency_scores[number]
                + 0.1 * gap_scores[number]
                + 0.05 * pair_affinity_scores[number]
            )
            rows.append(
                {
                    "number": number,
                    "score": score,
                    "rank": 0,
                    "isTopPick": False,
                    "markovScore": markov_scores[number],
                    "transitionScore": transition_scores[number],
                    "frequencyScore": frequency_scores[number],
                    "recencyScore": recency_scores[number],
                    "gapScore": gap_scores[number],
                    "pairAffinityScore": pair_affinity_scores[number],
                    "gapStateBucket": self._gap_bucket(current_gaps[number]),
                    "gapStateProbability": markov_raw[number],
                    "recentHits": recent_hits[number],
                    "currentGap": current_gaps[number],
                }
            )

        ranked_rows = sorted(rows, key=lambda row: (-row["score"], row["number"]))
        for index, row in enumerate(ranked_rows, start=1):
            row["rank"] = index
            row["isTopPick"] = index <= top_k

        return sorted(ranked_rows, key=lambda row: row["number"])

    def build_score_grid(self, top_k: int = 6) -> dict[str, Any]:
        numbers = self.score_numbers(top_k=top_k)
        ranked = sorted(numbers, key=lambda row: row["rank"])

        return {
            "name": "Predictive Score Grid",
            "totalDraws": self.dataset.total_draws,
            "firstDraw": self.dataset.first_draw,
            "lastDraw": self.dataset.last_draw,
            "recentDrawWindow": self.config.recent_draw_window,
            "markovModel": "Gap-State Markov",
            "gapStateMaxGap": self.config.gap_state_max_gap,
            "topNumbers": [row["number"] for row in ranked[:top_k]],
            "numbers": numbers,
        }
