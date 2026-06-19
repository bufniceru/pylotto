from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root / "src"))

    from pylotto.backend.predictive_score_grid import (
        PredictiveScoreGridAnalyzer,
        load_draws_from_yaml,
    )

    source_path = root / "data" / "lotto_results.yaml"
    target_path = root / "web" / "src" / "data" / "predictive-score-grid.json"

    dataset = load_draws_from_yaml(source_path)
    analyzer = PredictiveScoreGridAnalyzer(dataset)
    payload = analyzer.build_score_grid(top_k=6)

    target_path.parent.mkdir(parents=True, exist_ok=True)
    with target_path.open("w", encoding="utf-8") as target_file:
        json.dump(payload, target_file, indent=2)
        target_file.write("\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
