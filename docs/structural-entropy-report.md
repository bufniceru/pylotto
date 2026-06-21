# Structural Entropy Report

The Draws workspace includes a structural entropy report for the currently selected
6/49 draw. The report separates two ideas that are easy to mix up:

- Fair-draw entropy: every valid unordered 6-number draw has the same probability,
  so every draw has `log2(C(49, 6)) = 23.737...` bits of exact lottery information.
- Structural entropy: some draws are easier to describe because they contain
  recognizable structure. `1, 2, 3, 4, 5, 6` is still just as likely as any other
  draw, but it has a much shorter description: "the consecutive run starting at 1."

The implementation lives in `web/src/lib/structuralEntropy.ts`.

## Model

The report uses a minimum-description-length estimate. It creates several possible
ways to describe the selected draw, converts each description to bits, and selects
the cheapest valid description as the structural entropy.

The selected score is therefore:

```text
structural_bits = min(candidate_encoding_bits)
```

The current candidates are:

- Exact fair-draw identity:
  `log2(C(49, 6))`
- Same sum class:
  encode the total, then encode the draw among all combinations with that total
- Same span class:
  encode the span, then encode the draw among all combinations with that span
- Same odd/even class:
  encode the odd/even count, then encode the draw among combinations with that
  parity profile
- Same septade profile:
  encode how many numbers landed in each bucket: `1-7`, `8-14`, `15-21`,
  `22-28`, `29-35`, `36-42`, `43-49`
- Consecutive run:
  available only when all gaps are `1`; encode the run start
- Arithmetic progression:
  available only when all gaps are equal; encode the start and constant step

The UI displays every candidate lens, not only the selected one, so a selected
draw can be inspected rather than treated as a black-box score.

## Pattern Factors

The report also shows explanatory factors that do not directly override the
minimum-description score:

- Gaps and gap Shannon entropy
- Longest consecutive run
- Span
- Sum rarity
- Odd/even balance
- Septade distribution

These factors explain why a draw feels more or less structured even when the
shortest available encoding remains the exact fair-draw identity.

## Interpretation

A lower structural percentage means the draw was easier to describe using the
implemented structural lenses. A higher percentage means the draw did not match a
shorter known structure and is close to the full fair-draw identity cost.

This report does not imply that patterned draws are more or less likely in a fair
lottery. It measures description complexity, not prediction quality.
