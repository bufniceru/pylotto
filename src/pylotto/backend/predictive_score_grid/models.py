from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DrawRecord:
    draw_date: str
    numbers: tuple[int, ...]


@dataclass(frozen=True)
class LottoDataset:
    total_draws: int
    first_draw: str
    last_draw: str
    draws: tuple[DrawRecord, ...]


@dataclass(frozen=True)
class ScoreGridConfig:
    min_number: int = 1
    max_number: int = 49
    numbers_per_draw: int = 6
    recent_draw_window: int = 20
    gap_state_max_gap: int = 35
    markov_prior_strength: float = 8.0
    markov_decay_half_life: float = 500.0
