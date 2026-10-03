"""서비스 생성 시 주입하거나 환경변수로 조정하는 프로토타입 설정."""
import os

from pydantic import BaseModel, Field, model_validator


class GuardConfig(BaseModel):
    history_turns: int = Field(default=4, ge=0, le=20)
    health_low: float = Field(default=.25, ge=0, le=1)
    health_high: float = Field(default=.75, ge=0, le=1)
    extraction_low: float = Field(default=.2, ge=0, le=1)
    extraction_high: float = Field(default=.6, ge=0, le=1)

    @model_validator(mode="after")
    def ordered_bands(self):
        if self.health_low >= self.health_high or self.extraction_low >= self.extraction_high:
            raise ValueError("밴드의 low는 high보다 작아야 합니다.")
        return self

    @classmethod
    def from_env(cls):
        return cls(**{name: os.environ["MEDBOT_" + name.upper()]
                      for name in cls.model_fields if "MEDBOT_" + name.upper() in os.environ})


def band(probability: float, low: float, high: float) -> str:
    return "low" if probability < low else "high" if probability > high else "mid"
