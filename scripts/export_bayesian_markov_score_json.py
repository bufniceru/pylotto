from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import pymc as pm
import yaml

MAX_GAP_BUCKET = 35
NUMBERS_PER_DRAW = 6
NUMBER_COUNT = 49
PRIOR_STRENGTH = 8.0
POSTERIOR_DRAWS = 1000
TUNE_DRAWS = 1000
CHAINS = 2
RANDOM_SEED = 20260619


def _gap_bucket(gap: int) -> int:
    return min(max(gap, 0), MAX_GAP_BUCKET)


def _scale_scores(values: dict[int, float]) -> dict[int, float]:
    if not values:
        return {}

    min_value = min(values.values())
    max_value = max(values.values())
    spread = max_value - min_value
    if spread <= 0:
        return {key: 0.0 for key in values}

    return {key: ((value - min_value) / spread) * 100.0 for key, value in values.items()}


def _band_for_score(score: float) -> tuple[str, str]:
    if score >= 80:
        return "elite", "Elite"
    if score >= 60:
        return "strong", "Strong"
    if score >= 40:
        return "active", "Active"
    return "soft", "Soft"


def _load_draws(yaml_path: Path) -> list[dict[str, Any]]:
    with yaml_path.open("r", encoding="utf-8") as source_file:
        payload = yaml.safe_load(source_file) or {}

    draws = payload.get("lotto_results", {}).get("draws", [])
    if not isinstance(draws, list):
        raise ValueError("lotto_results.draws must be a list.")

    return [
        {
            "date": str(draw["date"]),
            "numbers": [int(number) for number in draw["numbers"]],
        }
        for draw in draws
    ]


def _bucket_training_counts(draws: list[dict[str, Any]]) -> tuple[np.ndarray, np.ndarray]:
    opportunities = np.zeros(MAX_GAP_BUCKET + 1, dtype=np.int64)
    hits = np.zeros(MAX_GAP_BUCKET + 1, dtype=np.int64)
    last_seen: dict[int, int | None] = {number: None for number in range(1, NUMBER_COUNT + 1)}

    for draw_index, draw in enumerate(draws):
        if draw_index == 0:
            for number in draw["numbers"]:
                last_seen[number] = draw_index
            continue

        present = set(draw["numbers"])
        for number in range(1, NUMBER_COUNT + 1):
            seen_at = last_seen[number]
            gap = draw_index if seen_at is None else draw_index - 1 - seen_at
            bucket = _gap_bucket(gap)

            opportunities[bucket] += 1
            if number in present:
                hits[bucket] += 1

        for number in draw["numbers"]:
            last_seen[number] = draw_index

    return opportunities, hits


def _current_gaps(draws: list[dict[str, Any]]) -> dict[int, int]:
    last_seen: dict[int, int | None] = {number: None for number in range(1, NUMBER_COUNT + 1)}

    for draw_index, draw in enumerate(draws):
        for number in draw["numbers"]:
            last_seen[number] = draw_index

    total_draws = len(draws)
    return {
        number: total_draws if seen_at is None else total_draws - 1 - seen_at
        for number, seen_at in last_seen.items()
    }


def _gap_before_each_draw(draws: list[dict[str, Any]]) -> list[dict[int, int]]:
    last_seen: dict[int, int | None] = {number: None for number in range(1, NUMBER_COUNT + 1)}
    gaps_by_draw: list[dict[int, int]] = []

    for draw_index, draw in enumerate(draws):
        draw_gaps = {}
        for number in range(1, NUMBER_COUNT + 1):
            seen_at = last_seen[number]
            draw_gaps[number] = draw_index if seen_at is None else draw_index - 1 - seen_at

        gaps_by_draw.append(draw_gaps)

        for number in draw["numbers"]:
            last_seen[number] = draw_index

    return gaps_by_draw


def _sample_bucket_probabilities(opportunities: np.ndarray, hits: np.ndarray) -> dict[int, dict[str, float]]:
    base_probability = NUMBERS_PER_DRAW / NUMBER_COUNT
    prior_alpha = PRIOR_STRENGTH * base_probability
    prior_beta = PRIOR_STRENGTH * (1.0 - base_probability)

    with pm.Model() as model:
        probabilities = pm.Beta(
            "bucket_probability",
            alpha=prior_alpha,
            beta=prior_beta,
            shape=MAX_GAP_BUCKET + 1,
        )
        pm.Binomial(
            "bucket_hits",
            n=opportunities,
            p=probabilities,
            observed=hits,
        )
        trace = pm.sample(
            draws=POSTERIOR_DRAWS,
            tune=TUNE_DRAWS,
            chains=CHAINS,
            random_seed=RANDOM_SEED,
            target_accept=0.9,
            progressbar=False,
        )

    samples = np.asarray(trace.posterior["bucket_probability"]).reshape(-1, MAX_GAP_BUCKET + 1)
    posterior: dict[int, dict[str, float]] = {}

    for bucket in range(MAX_GAP_BUCKET + 1):
        bucket_samples = samples[:, bucket]
        low, median, high = np.quantile(bucket_samples, [0.05, 0.5, 0.95])
        posterior[bucket] = {
            "mean": float(bucket_samples.mean()),
            "median": float(median),
            "low90": float(low),
            "high90": float(high),
        }

    return posterior


def build_payload(draws: list[dict[str, Any]]) -> dict[str, Any]:
    if len(draws) < 2:
        raise ValueError("At least two draws are required.")

    opportunities, hits = _bucket_training_counts(draws)
    posterior = _sample_bucket_probabilities(opportunities, hits)
    bucket_mean_scores = _scale_scores(
        {bucket: values["mean"] for bucket, values in posterior.items()}
    )
    current_gaps = _current_gaps(draws)
    current_mean_by_number = {
        number: posterior[_gap_bucket(gap)]["mean"]
        for number, gap in current_gaps.items()
    }
    current_scores = _scale_scores(current_mean_by_number)

    bucket_summaries = []
    for bucket in range(MAX_GAP_BUCKET + 1):
        score = bucket_mean_scores[bucket]
        band_id, label = _band_for_score(score)
        bucket_summaries.append(
            {
                "bucket": bucket,
                "opportunities": int(opportunities[bucket]),
                "hits": int(hits[bucket]),
                "observedRate": float(hits[bucket] / opportunities[bucket])
                if opportunities[bucket]
                else 0.0,
                "posteriorMean": posterior[bucket]["mean"],
                "posteriorMedian": posterior[bucket]["median"],
                "credibleLow90": posterior[bucket]["low90"],
                "credibleHigh90": posterior[bucket]["high90"],
                "score": score,
                "bandId": band_id,
                "label": label,
            }
        )

    predictions = []
    for number in range(1, NUMBER_COUNT + 1):
        current_gap = current_gaps[number]
        bucket = _gap_bucket(current_gap)
        score = current_scores[number]
        band_id, label = _band_for_score(score)
        bucket_posterior = posterior[bucket]
        predictions.append(
            {
                "number": number,
                "rank": 0,
                "score": score,
                "currentGap": current_gap,
                "bucket": bucket,
                "posteriorMean": bucket_posterior["mean"],
                "posteriorMedian": bucket_posterior["median"],
                "credibleLow90": bucket_posterior["low90"],
                "credibleHigh90": bucket_posterior["high90"],
                "bandId": band_id,
                "label": label,
            }
        )

    predictions.sort(
        key=lambda row: (
            -row["score"],
            -row["posteriorMean"],
            -row["currentGap"],
            row["number"],
        )
    )
    for index, prediction in enumerate(predictions, start=1):
        prediction["rank"] = index

    gaps_by_draw = _gap_before_each_draw(draws)
    latest_draw = draws[-1]
    latest_draw_gaps = gaps_by_draw[-1]
    latest_numbers = []
    for number in latest_draw["numbers"]:
        gap = latest_draw_gaps[number]
        bucket = _gap_bucket(gap)
        score = bucket_mean_scores[bucket]
        band_id, label = _band_for_score(score)
        latest_numbers.append(
            {
                "number": number,
                "gap": gap,
                "bucket": bucket,
                "score": score,
                "posteriorMean": posterior[bucket]["mean"],
                "credibleLow90": posterior[bucket]["low90"],
                "credibleHigh90": posterior[bucket]["high90"],
                "bandId": band_id,
                "label": label,
            }
        )

    label_counts = Counter(number["label"] for number in latest_numbers)
    signature = " + ".join(
        f"{label} x{count}"
        for label, count in sorted(label_counts.items())
    )

    return {
        "name": "Bayesian Markov Score",
        "model": "PyMC Beta-Binomial Gap-State Markov",
        "totalDraws": len(draws),
        "firstDraw": draws[0]["date"],
        "lastDraw": draws[-1]["date"],
        "maxGapBucket": MAX_GAP_BUCKET,
        "numbersPerDraw": NUMBERS_PER_DRAW,
        "numberCount": NUMBER_COUNT,
        "priorStrength": PRIOR_STRENGTH,
        "posteriorDraws": POSTERIOR_DRAWS,
        "tuneDraws": TUNE_DRAWS,
        "chains": CHAINS,
        "randomSeed": RANDOM_SEED,
        "topNumbers": [prediction["number"] for prediction in predictions[:NUMBERS_PER_DRAW]],
        "bucketSummaries": bucket_summaries,
        "predictions": predictions,
        "latestProfile": {
            "date": latest_draw["date"],
            "signature": signature,
            "numbers": sorted(
                latest_numbers,
                key=lambda row: (-row["score"], row["number"]),
            ),
        },
    }


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    source_path = root / "data" / "lotto_results.yaml"
    target_path = root / "web" / "src" / "data" / "bayesian-markov-score.json"
    payload = build_payload(_load_draws(source_path))

    target_path.parent.mkdir(parents=True, exist_ok=True)
    with target_path.open("w", encoding="utf-8") as target_file:
        json.dump(payload, target_file, indent=2)
        target_file.write("\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
