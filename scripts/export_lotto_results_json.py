from __future__ import annotations

import json
from pathlib import Path

import yaml


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    source_path = root / "src" / "pylotto" / "lotto_results.yaml"
    target_path = root / "web" / "src" / "data" / "lotto-results.json"

    with source_path.open("r", encoding="utf-8") as source_file:
        payload = yaml.safe_load(source_file) or {}

    lotto_results = payload.get("lotto_results", {})
    draws = lotto_results.get("draws", [])

    normalized = {
        "totalDraws": lotto_results.get("total_draws", len(draws)),
        "firstDraw": lotto_results.get("first_draw"),
        "lastDraw": lotto_results.get("last_draw"),
        "draws": [
            {
                "date": draw["date"],
                "numbers": draw["numbers"],
            }
            for draw in draws
        ],
    }

    target_path.parent.mkdir(parents=True, exist_ok=True)
    with target_path.open("w", encoding="utf-8") as target_file:
        json.dump(normalized, target_file, indent=2)
        target_file.write("\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
