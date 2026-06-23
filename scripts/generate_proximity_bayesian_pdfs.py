from __future__ import annotations

from pathlib import Path

from generate_freshness_calculation_pdf import Canvas, PdfDocument, PAGE_HEIGHT, PAGE_WIDTH


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"


def add_header(c: Canvas, title: str, subtitle: str) -> None:
    c.text(42, PAGE_HEIGHT - 44, title, size=20, bold=True)
    c.text(42, PAGE_HEIGHT - 64, subtitle, size=10)
    c.line(42, PAGE_HEIGHT - 78, PAGE_WIDTH - 42, PAGE_HEIGHT - 78, "#c7d0de")


def write_pdf(path: Path, pages: list[str]) -> None:
    doc = PdfDocument()
    for page in pages:
        doc.add_page(page)
    doc.write(path)


def proximity_page_one() -> str:
    c = Canvas()
    add_header(c, "PyLotto Proximity Calculation", "Flow diagram for nearest-neighbor spacing and number ranking")

    boxes = [
        ("Draw", "Take one historical draw with six numbers.", "#eff5ff"),
        ("Sort", "Sort the six numbers from low to high.", "#f8fafc"),
        ("Distances", "For each number, compute distance to the previous and next selected number.", "#fff8e0"),
        ("Nearest", "nearestDistance = min(leftDistance, rightDistance), ignoring missing sides.", "#edf8f1"),
        ("Bucket", "Map nearestDistance into Paired, Tight, Near, Balanced, Wide, or Isolated.", "#f7f0ff"),
        ("Counts", "Update bucket totals, per-number bucket counts, appearances, and situation signatures.", "#fff2ee"),
    ]
    x = 42
    y = 424
    for index, (title, body, fill) in enumerate(boxes):
        c.box(x, y, 112, 86, title, body, fill)
        if index < len(boxes) - 1:
            c.line(x + 112, y + 43, x + 126, y + 43, "#6c7a90")
        x += 126

    c.text(42, 326, "Nearest-neighbor example", size=14, bold=True)
    c.wrapped_text(
        42,
        304,
        "If a draw is 4, 8, 9, 17, 31, 45, then number 8 has left distance 4 and right distance 1, so nearestDistance is 1 and the bucket is Paired. Number 31 has distances 14 and 14, so it is Wide.",
        124,
        size=10,
    )

    c.text(42, 236, "Bucket rules", size=14, bold=True)
    buckets = [
        ("Paired", "distance <= 1", "#d93a3a"),
        ("Tight", "distance 2-3", "#f27d42"),
        ("Near", "distance 4-6", "#f0b44f"),
        ("Balanced", "distance 7-10", "#4b9f68"),
        ("Wide", "distance 11-15", "#3f7fc4"),
        ("Isolated", "distance > 15", "#28344d"),
    ]
    for i, (label, rule, color) in enumerate(buckets):
        bx = 42 + (i % 3) * 250
        by = 190 - (i // 3) * 52
        c.pill(bx, by, 86, 28, label, color)
        c.text(bx + 98, by + 10, rule, size=10)

    c.text(42, 74, "The proximity model describes the shape of actual drawn sets. It does not score unused numbers by their current board distance; it scores numbers by the historical spacing patterns they appeared in.", size=10, bold=True)
    return c.stream()


def proximity_page_two() -> str:
    c = Canvas()
    add_header(c, "Proximity Ranking Formula", "How bucket shares and per-number spacing histories become predictions")

    c.text(42, 480, "Historical counting", size=14, bold=True)
    c.box(42, 392, 230, 64, "Bucket counts", "For every drawn number, increment the bucket that matches its nearest-neighbor distance.", "#eff5ff")
    c.box(306, 392, 230, 64, "Distance totals", "Add nearestDistance into that bucket to compute average spacing per bucket.", "#fff8e0")
    c.box(570, 392, 230, 64, "Number profiles", "For each number, count how many times it appeared in each proximity bucket.", "#edf8f1")
    c.line(272, 424, 306, 424)
    c.line(536, 424, 570, 424)

    c.text(42, 330, "Summary formulas", size=14, bold=True)
    c.box(42, 258, 350, 52, "Bucket share", "share(bucket) = bucketCount(bucket) / (drawCount * 6)", "#f7f0ff")
    c.box(450, 258, 350, 52, "Average nearest distance", "averageNearestDistance = bucketDistanceTotal / bucketCount", "#fff2ee")

    c.text(42, 204, "Prediction formula for number n", size=14, bold=True)
    c.wrapped_text(
        42,
        182,
        "For each bucket, multiply how often number n historically appeared in that bucket by the global share of that bucket. Sum those products, then divide by drawCount.",
        122,
        size=10,
    )
    c.box(
        42,
        104,
        756,
        52,
        "Score",
        "score(n) = sum over buckets [ countForNumber(n,bucket) * bucketShare(bucket) ] / drawCount",
        "#eff5ff",
    )
    c.text(42, 70, "Sort order: score descending, then appearances descending, then smaller number.", size=10, bold=True)
    return c.stream()


def proximity_page_three() -> str:
    c = Canvas()
    add_header(c, "Proximity Backtesting", "How Draw Scores and Score Graphs evaluate proximity predictions")

    c.text(42, 480, "Previous-history-only evaluation", size=14, bold=True)
    c.wrapped_text(
        42,
        458,
        "For each draw after the first, the app builds proximity predictions using only earlier draws. Then it compares the actual draw against that ranking.",
        122,
        size=10,
    )
    c.box(42, 356, 230, 64, "Train so far", "Use bucket counts and number bucket profiles from previous draws only.", "#eff5ff")
    c.box(306, 356, 230, 64, "Rank 1..49", "Calculate score for all numbers and sort them.", "#edf8f1")
    c.box(570, 356, 230, 64, "Score actual draw", "Convert each actual number's rank into a 0..100 score and average all six.", "#fff8e0")
    c.line(272, 388, 306, 388)
    c.line(536, 388, 570, 388)

    c.text(42, 292, "Backtest metrics", size=14, bold=True)
    c.box(42, 214, 350, 54, "Per-number score", "((49 - rank) / 48) * 100. Rank 1 scores 100; rank 49 scores 0.", "#f7f0ff")
    c.box(450, 214, 350, 54, "Draw score", "Average of the six per-number scores for the actual draw.", "#fff2ee")
    c.box(42, 142, 350, 54, "Top picks", "The six highest ranked proximity numbers from the previous-history-only model.", "#eff5ff")
    c.box(450, 142, 350, 54, "Cover count", "How deep into the ranked list you must go to include the requested number of actual draw hits.", "#edf8f1")
    c.text(42, 88, "The report also records situation signatures such as Paired x2 + Near x1 + Wide x3 to describe full-draw spacing patterns.", size=10, bold=True)
    return c.stream()


def bayesian_page_one() -> str:
    c = Canvas()
    add_header(c, "PyLotto Bayesian Markov Calculation", "Beta-Binomial gap-state model for ranking next-draw numbers")

    boxes = [
        ("History", "Process historical draws oldest to newest.", "#eff5ff"),
        ("Gap state", "For each number before a draw, calculate how long since it last appeared.", "#f8fafc"),
        ("Bucket", "Clamp gap into buckets 0..35. Gaps above 35 use bucket 35.", "#fff8e0"),
        ("Opportunity", "Every number before every draw is one opportunity for its current bucket.", "#edf8f1"),
        ("Hit", "If the number is drawn, that bucket receives a hit.", "#fff2ee"),
        ("Bayes", "Estimate bucket hit probabilities with a Beta-Binomial model.", "#f7f0ff"),
        ("Rank", "Apply posterior bucket probabilities to current gaps and rank numbers.", "#eff5ff"),
    ]
    x = 42
    y = 420
    for index, (title, body, fill) in enumerate(boxes):
        c.box(x, y, 94, 84, title, body, fill)
        if index < len(boxes) - 1:
            c.line(x + 94, y + 42, x + 112, y + 42, "#6c7a90")
        x += 112

    c.text(42, 306, "Model constants from the export script", size=14, bold=True)
    constants = [
        ("MAX_GAP_BUCKET", "35"),
        ("NUMBERS_PER_DRAW", "6"),
        ("NUMBER_COUNT", "49"),
        ("PRIOR_STRENGTH", "8.0"),
        ("POSTERIOR_DRAWS", "1000"),
        ("TUNE_DRAWS", "1000"),
        ("CHAINS", "2"),
        ("RANDOM_SEED", "20260619"),
    ]
    for i, (name, value) in enumerate(constants):
        bx = 42 + (i % 4) * 190
        by = 252 - (i // 4) * 48
        c.box(bx, by, 160, 34, name, value, "#ffffff")

    c.text(42, 122, "Gap formula", size=14, bold=True)
    c.box(42, 54, 756, 48, "Before a draw", "gap = drawIndex if never seen, otherwise drawIndex - 1 - previousSeenIndex", "#fff8e0")
    return c.stream()


def bayesian_page_two() -> str:
    c = Canvas()
    add_header(c, "Bayesian Posterior", "How opportunities and hits become bucket probabilities")

    c.text(42, 480, "Training counts", size=14, bold=True)
    c.wrapped_text(
        42,
        458,
        "The first draw initializes lastSeen and is not counted as training. For every later draw, every number 1..49 contributes one opportunity to its current gap bucket. Drawn numbers also contribute one hit.",
        122,
        size=10,
    )

    c.text(42, 386, "Prior", size=14, bold=True)
    c.box(42, 316, 350, 52, "Base probability", "baseProbability = numbersPerDraw / numberCount = 6 / 49", "#eff5ff")
    c.box(450, 316, 350, 52, "Beta prior", "alpha = priorStrength * baseProbability; beta = priorStrength * (1 - baseProbability)", "#edf8f1")

    c.text(42, 262, "Likelihood and posterior sampling", size=14, bold=True)
    c.box(42, 184, 350, 54, "Bucket probability", "p_bucket ~ Beta(alpha, beta), one probability for each gap bucket 0..35.", "#f7f0ff")
    c.box(450, 184, 350, 54, "Observed hits", "hits_bucket ~ Binomial(opportunities_bucket, p_bucket)", "#fff2ee")

    c.text(42, 132, "Posterior summary per bucket", size=14, bold=True)
    c.wrapped_text(
        42,
        110,
        "The export stores posterior mean, median, 5th percentile, and 95th percentile. The 5th and 95th percentiles form the displayed 90% credible interval.",
        122,
        size=10,
    )
    c.text(42, 70, "The generated JSON lives at web/src/data/bayesian-markov-score.json.", size=10, bold=True)
    return c.stream()


def bayesian_page_three() -> str:
    c = Canvas()
    add_header(c, "Bayesian Ranking and Scores", "How posterior bucket means become next-draw rankings")

    c.text(42, 480, "Current prediction", size=14, bold=True)
    c.box(42, 392, 230, 64, "Current gaps", "After all draws, compute current gap for each number.", "#eff5ff")
    c.box(306, 392, 230, 64, "Bucket mean", "Assign each number the posterior mean of its current gap bucket.", "#edf8f1")
    c.box(570, 392, 230, 64, "Scale", "Min-max scale all 49 posterior means to a 0..100 score.", "#fff8e0")
    c.line(272, 424, 306, 424)
    c.line(536, 424, 570, 424)

    c.text(42, 330, "Score formula", size=14, bold=True)
    c.box(42, 258, 756, 52, "Scaled score", "score(n) = (posteriorMean(n) - minMean) / (maxMean - minMean) * 100", "#f7f0ff")

    c.text(42, 204, "Band labels", size=14, bold=True)
    bands = [
        ("Elite", "score >= 80", "#0a562c"),
        ("Strong", "score 60-79.99", "#47b25c"),
        ("Active", "score 40-59.99", "#f0b44f"),
        ("Soft", "score < 40", "#7b8798"),
    ]
    for i, (label, rule, color) in enumerate(bands):
        bx = 42 + i * 190
        c.pill(bx, 158, 78, 28, label, color)
        c.text(bx + 88, 168, rule, size=9)

    c.text(42, 116, "Sort order", size=14, bold=True)
    c.wrapped_text(
        42,
        94,
        "Numbers are ranked by score descending, posterior mean descending, current gap descending, then smaller number. The top six become the Bayesian top numbers.",
        122,
        size=10,
    )
    return c.stream()


def bayesian_page_four() -> str:
    c = Canvas()
    add_header(c, "Bayesian Backtesting", "How Bayesian scores are evaluated in Draw Scores and Score Graphs")

    c.text(42, 480, "Previous-history-only scoring", size=14, bold=True)
    c.wrapped_text(
        42,
        458,
        "For each draw after the first, the app rebuilds simple posterior means from previous opportunities and hits using the same prior. It ranks numbers using only earlier draws, then scores the actual draw.",
        122,
        size=10,
    )
    c.box(42, 356, 230, 64, "Posterior mean", "(hits + priorStrength * baseProbability) / (opportunities + priorStrength)", "#eff5ff")
    c.box(306, 356, 230, 64, "Rank", "Apply posterior means to current gaps and sort the 49 numbers.", "#edf8f1")
    c.box(570, 356, 230, 64, "Compare", "Convert actual drawn numbers' ranks to scores and average them.", "#fff8e0")
    c.line(272, 388, 306, 388)
    c.line(536, 388, 570, 388)

    c.text(42, 292, "Backtest metrics", size=14, bold=True)
    c.box(42, 214, 350, 54, "Per-number score", "((49 - rank) / 48) * 100. Rank 1 scores 100; rank 49 scores 0.", "#f7f0ff")
    c.box(450, 214, 350, 54, "Draw score", "Average of the six per-number scores for the actual draw.", "#fff2ee")
    c.box(42, 142, 350, 54, "Top picks", "The six highest ranked Bayesian numbers from the previous-history-only model.", "#eff5ff")
    c.box(450, 142, 350, 54, "Cover count", "How deep into the ranked list you must go to include the requested number of actual draw hits.", "#edf8f1")
    c.text(42, 88, "The UI report uses the generated PyMC JSON for the current model display, while backtests use the closed-form posterior mean for each historical prefix.", size=10, bold=True)
    return c.stream()


def main() -> None:
    DOCS.mkdir(parents=True, exist_ok=True)
    write_pdf(
        DOCS / "proximity-calculation.pdf",
        [proximity_page_one(), proximity_page_two(), proximity_page_three()],
    )
    write_pdf(
        DOCS / "bayesian-markov-calculation.pdf",
        [bayesian_page_one(), bayesian_page_two(), bayesian_page_three(), bayesian_page_four()],
    )
    print(DOCS / "proximity-calculation.pdf")
    print(DOCS / "bayesian-markov-calculation.pdf")


if __name__ == "__main__":
    main()
