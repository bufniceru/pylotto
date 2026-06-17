class LottoNumber(int):
    def __new__(cls, value: int, gap: int = 0, last_seen_offset: int = 0):
        obj = int.__new__(cls, value)
        obj.gap = gap
        obj.last_seen_offset = last_seen_offset
        return obj

    @classmethod
    def __get_pydantic_core_schema__(cls, source, handler):
        from pydantic_core import core_schema

        return core_schema.no_info_after_validator_function(
            cls.validate,
            core_schema.int_schema(),
        )

    @classmethod
    def validate(cls, value):
        if not isinstance(value, int):
            raise TypeError("LottoNumber must be an integer")
        if not 1 <= value <= 49:
            raise ValueError("LottoNumber must be between 1 and 49")
        return cls(value)
