from pydantic import BaseModel, conint, field_validator
from datetime import date

from src.pylotto.lotto_number import LottoNumber


class Draw(BaseModel):
    draw_date: date
    n1: LottoNumber
    n2: LottoNumber
    n3: LottoNumber
    n4: LottoNumber
    n5: LottoNumber
    n6: LottoNumber

    def numbers(self) -> list[LottoNumber]:
        return [self.n1, self.n2, self.n3, self.n4, self.n5, self.n6]

    @field_validator("n6")
    @classmethod
    def validate_unique_numbers(cls, v, info):
        nums = [
            info.data.get("n1"),
            info.data.get("n2"),
            info.data.get("n3"),
            info.data.get("n4"),
            info.data.get("n5"),
            v,
        ]
        if len(set(nums)) != 6:
            raise ValueError("Numbers in a draw must be unique")
        return v

    @property
    def total(self) -> int:
        return sum(self.numbers())

    @property
    def gap_total(self) -> int:
        return sum(number.gap for number in self.numbers())


# LottoNumber = conint(ge=1, le=49)
