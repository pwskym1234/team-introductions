from datetime import date as Date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class HistoryMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class GuardClassification(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category: Literal["in_scope", "off_topic", "malicious"]
    reasons: list[str]
    attack_types: list[Literal[
        "prompt_injection", "prompt_leak", "data_exfiltration", "jailbreak", "other"
    ]]
    confidence: float = Field(ge=0, le=1)


class GuardVerdict(GuardClassification):
    source: Literal["prefilter", "jev", "heuristic", "llm_judge"]
    health_relevant: float = Field(ge=0, le=1, allow_inf_nan=False)
    extraction_attempt: float = Field(ge=0, le=1, allow_inf_nan=False)
    health_band: Literal["low", "mid", "high"]
    extraction_band: Literal["low", "mid", "high"]
    judge_decisions: dict[str, bool] = Field(default_factory=dict)


class JudgeDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answer: bool = Field(strict=True)


class Exercise(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: str = Field(min_length=1, max_length=80)
    minutes: float | None = Field(default=None, ge=0, le=1440, allow_inf_nan=False)
    intensity: str | None = Field(default=None, max_length=40)


class WearableDay(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: Date
    sleep_hours: float | None = Field(default=None, ge=0, le=24, allow_inf_nan=False)
    steps: int | None = Field(default=None, ge=0, strict=True)
    exercise: list[Exercise] | None = Field(default=None, max_length=100)


class WearableBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: str = Field(min_length=1, max_length=100)
    records: list[WearableDay] = Field(min_length=1, max_length=366)


class DailyInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: Date
    weight_kg: float | None = Field(default=None, ge=20, le=300, allow_inf_nan=False)
    intake: Literal["평소대로", "변경", "안 함", "기록 안 함"] | None = None
    exercise: list[Exercise] | None = Field(default=None, max_length=100)
    feeling: int | None = Field(default=None, ge=1, le=5, strict=True)
    note: str | None = Field(default=None, max_length=1000)


class Memory(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    user_id: str
    created_at: Date
    category: Literal["lifestyle", "symptom", "medication", "goal"]
    content: str = Field(min_length=1, max_length=200)
    source_message_excerpt: str = Field(min_length=1, max_length=300)
    status: Literal["active", "deleted"] = "active"


class Recommendation(BaseModel):
    product_id: str
    name: str
    price: int
    reason_lines: list[str]
    coupang_url: str | None
    disclosure: str


class ChatResult(BaseModel):
    reply: str
    verdict: GuardVerdict
    blocked: bool
    block_reason: str | None = None
    saved_memories: list[Memory] = Field(default_factory=list)
    deleted_memory_ids: list[str] = Field(default_factory=list)
    recommendations: list[Recommendation] = Field(default_factory=list)
