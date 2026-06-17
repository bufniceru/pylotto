from collections import Counter
from pathlib import Path
from typing import List

import yaml
from pydantic import field_validator, BaseModel

from src.pylotto.draw import Draw
from src.pylotto.lotto_number import LottoNumber


class DrawHistory(BaseModel):

    draws: List[Draw] = []

    @classmethod
    def from_yaml(cls, yaml_path: str | Path) -> "DrawHistory":
        yaml_path = Path(yaml_path)

        with yaml_path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        lotto_results = data["lotto_results"]
        raw_draws = lotto_results["draws"]

        draws = []
        for item in raw_draws:
            nums = item["numbers"]
            if len(nums) != 6:
                raise ValueError(
                    f"Draw on {item['date']} does not contain exactly 6 numbers"
                )

            draw = Draw(
                draw_date=item["date"],
                n1=nums[0],
                n2=nums[1],
                n3=nums[2],
                n4=nums[3],
                n5=nums[4],
                n6=nums[5],
            )
            draws.append(draw)

        history = cls(draws=draws)
        history.sort_by_date()
        history.refresh_number_gaps()
        return history

    @property
    def total_draws(self) -> int:
        return len(self.draws)

    @property
    def first_draw_date(self):
        if not self.draws:
            return None
        return self.draws[0].draw_date

    @property
    def last_draw_date(self):
        if not self.draws:
            return None
        return self.draws[-1].draw_date

    def numbers_flat(self) -> list[LottoNumber]:
        return [n for draw in self.draws for n in draw.numbers()]

    def add_draw(self, draw: Draw):
        if draw.draw_date in {d.draw_date for d in self.draws}:
            raise ValueError("Draw already exists for this date")
        self.draws.append(draw)
        self.sort_by_date()
        self.refresh_number_gaps()

    def get_all_numbers(self):
        return [n for d in self.draws for n in d.numbers()]

    def get_last_draw(self):
        return max(self.draws, key=lambda d: d.draw_date)

    def sort_by_date(self):
        self.draws.sort(key=lambda d: d.draw_date)

    def refresh_number_gaps(self):
        if not self.draws:
            return

        last_seen: dict[int, int | None] = {n: None for n in range(1, 50)}

        for draw_index, draw in enumerate(self.draws):
            draw_numbers = draw.numbers()
            current_gaps = {
                number_value: (
                    draw_index
                    if last_seen[number_value] is None
                    else draw_index - last_seen[number_value] - 1
                )
                for number_value in range(1, 50)
            }
            max_gap = max(current_gaps.values(), default=0)

            for number in draw_numbers:
                number.gap = current_gaps[int(number)]
                number.last_seen_offset = max_gap - number.gap
                last_seen[int(number)] = draw_index

    def filter_by_number(self, number: int):
        return [d for d in self.draws if number in d.numbers()]

    def number_frequencies(self) -> Counter:
        return Counter(
            n
            for draw in self.draws
            for n in draw.numbers()
        )

    def gap_frequencies(self) -> Counter:
        return Counter(
            number.gap
            for draw in self.draws
            for number in draw.numbers()
        )

    def draw_sum_frequencies(self) -> Counter:
        return Counter(draw.total for draw in self.draws)

    def draw_gap_sum_frequencies(self) -> Counter:
        return Counter(draw.gap_total for draw in self.draws)

    def difference_frequencies(self) -> Counter:
        return Counter(
            current - previous
            for draw in self.draws
            for previous, current in zip(
                sorted(int(number) for number in draw.numbers()),
                sorted(int(number) for number in draw.numbers())[1:],
            )
        )

    def difference_last_seen_index(self) -> dict[int, int | None]:
        max_difference = max(
            (
                current - previous
                for draw in self.draws
                for previous, current in zip(
                    sorted(int(number) for number in draw.numbers()),
                    sorted(int(number) for number in draw.numbers())[1:],
                )
            ),
            default=0,
        )
        last_seen = {difference: None for difference in range(1, max_difference + 1)}

        for idx, draw in enumerate(self.draws):
            sorted_numbers = sorted(int(number) for number in draw.numbers())
            for previous, current in zip(sorted_numbers, sorted_numbers[1:]):
                last_seen[current - previous] = idx

        return last_seen

    def differences_by_draw(self) -> list[list[int]]:
        return [
            [
                current - previous
                for previous, current in zip(
                    sorted(int(number) for number in draw.numbers()),
                    sorted(int(number) for number in draw.numbers())[1:],
                )
            ]
            for draw in self.draws
        ]

    def count_number(self, number: int) -> int:
        return self.number_frequencies()[number]

    def last_seen_index(self, min_number=1, max_number=49) -> dict[int, int | None]:
        last_seen = {n: None for n in range(min_number, max_number + 1)}

        for idx, draw in enumerate(self.draws):
            for n in draw.numbers():
                last_seen[n] = idx

        return last_seen

    def gap_last_seen_index(self) -> dict[int, int | None]:
        max_gap = max((number.gap for draw in self.draws for number in draw.numbers()), default=0)
        last_seen = {gap: None for gap in range(0, max_gap + 1)}

        for idx, draw in enumerate(self.draws):
            for number in draw.numbers():
                last_seen[number.gap] = idx

        return last_seen

    def gap_gap_map_by_draw(self) -> list[dict[int, int]]:
        if not self.draws:
            return []

        max_gap = max(number.gap for draw in self.draws for number in draw.numbers())
        last_seen: dict[int, int | None] = {gap: None for gap in range(0, max_gap + 1)}
        gap_gap_maps: list[dict[int, int]] = []

        for draw_index, draw in enumerate(self.draws):
            gap_gap_map: dict[int, int] = {}
            for gap in {number.gap for number in draw.numbers()}:
                previous_index = last_seen[gap]
                gap_gap_map[gap] = (
                    draw_index if previous_index is None else draw_index - previous_index - 1
                )
                last_seen[gap] = draw_index
            gap_gap_maps.append(gap_gap_map)

        return gap_gap_maps

