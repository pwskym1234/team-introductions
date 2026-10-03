"""누락값을 제외한 달력 기준 통계. 건기식과 변화의 인과관계를 추론하지 않는다."""
import json
import os
from datetime import date, timedelta
from pathlib import Path
from statistics import mean, pstdev
from threading import RLock
from typing import Protocol

from medbot.models import DailyInput, Memory, WearableBatch


class UserRepository(Protocol):
    def get_user(self, user_id: str) -> dict: ...
    def user_ids(self) -> list[str]: ...
    def upsert_wearable(self, user_id: str, batch: WearableBatch) -> list[dict]: ...
    def upsert_daily(self, user_id: str, entry: DailyInput) -> dict: ...
    def list_memories(self, user_id: str) -> list[Memory]: ...
    def save_memories(self, user_id: str, memories: list[Memory]) -> list[Memory]: ...
    def delete_memory(self, user_id: str, memory_id: str) -> bool: ...
    def get_memories_for_report(self, user_id: str, start: date, end: date) -> list[Memory]: ...


_REPOSITORY_LOCK = RLock()
SAMPLE_PATH = Path(__file__).parent / "data/users.json"


class JSONUserRepository:
    """단일 프로세스용. 원본을 보호하고 지정한 JSON 복사본만 갱신한다."""
    def __init__(self, path: str | Path | None = None):
        self.path = Path(path or os.getenv("MEDBOT_DATA_PATH", "data/users.json"))
        if self.path.resolve() == SAMPLE_PATH.resolve():
            raise ValueError("원본 샘플은 쓰기 저장소로 사용할 수 없습니다.")
        with _REPOSITORY_LOCK:
            if not self.path.exists():
                self.path.parent.mkdir(parents=True, exist_ok=True)
                self.path.write_bytes(SAMPLE_PATH.read_bytes())

    def _read(self) -> dict:
        return json.loads(self.path.read_text(encoding="utf-8"))

    def _write(self, users: dict):
        # 잠금 + 원자적 교체. 다중 worker/서버는 DB 저장소 구현으로 교체한다.
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_text(json.dumps(users, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(self.path)

    def get_user(self, user_id: str) -> dict:
        with _REPOSITORY_LOCK:
            return self._read()[user_id]

    def user_ids(self) -> list[str]:
        with _REPOSITORY_LOCK:
            return list(self._read())

    def reset_demo(self):
        """원본은 읽기만 하고 런타임 복사본의 기록/메모를 초기화한다."""
        with _REPOSITORY_LOCK:
            self._write(json.loads(SAMPLE_PATH.read_text(encoding="utf-8")))

    @staticmethod
    def _merge_day(user: dict, entry: dict) -> dict:
        logs = user.setdefault("daily_logs", [])
        row = next((r for r in logs if r["date"] == entry["date"]), None)
        if row is None:
            row = {"date": entry["date"], "sleep_hours": None, "steps": None,
                   "exercise": None, "weight_kg": None, "intake": None, "feeling": None, "note": None}
            logs.append(row)
        row.update(entry)
        logs.sort(key=lambda r: r["date"])
        return row

    def upsert_wearable(self, user_id: str, batch: WearableBatch) -> list[dict]:
        batch = WearableBatch.model_validate(batch)
        with _REPOSITORY_LOCK:
            users = self._read()
            user = users[user_id]
            wearable = user.setdefault("wearable_logs", {})
            rows = []
            for record in batch.records:
                entry = record.model_dump(mode="json") | {"source": batch.source}
                wearable[entry["date"]] = entry
                rows.append(self._merge_day(user, entry).copy())
            self._write(users)
            return rows

    def upsert_daily(self, user_id: str, entry: DailyInput) -> dict:
        entry = DailyInput.model_validate(entry)
        with _REPOSITORY_LOCK:
            users = self._read()
            # 생략 필드는 보존, 명시적인 null은 모름으로 갱신한다.
            row = self._merge_day(users[user_id], entry.model_dump(mode="json", exclude_unset=True))
            self._write(users)
            return row

    def list_memories(self, user_id: str) -> list[Memory]:
        return [Memory.model_validate(m) for m in self.get_user(user_id).get("memories", [])
                if m["status"] == "active"]

    def save_memories(self, user_id: str, memories: list[Memory]) -> list[Memory]:
        with _REPOSITORY_LOCK:
            users = self._read()
            existing = users[user_id].setdefault("memories", [])
            saved = []
            for memory in memories:
                if memory.user_id != user_id or memory.status != "active":
                    raise ValueError("메모 소유자/상태 오류")
                if not any(m["content"] == memory.content and m["created_at"] == memory.created_at.isoformat()
                           for m in existing):
                    existing.append(memory.model_dump(mode="json"))
                    saved.append(memory)
            self._write(users)
            return saved

    def delete_memory(self, user_id: str, memory_id: str) -> bool:
        with _REPOSITORY_LOCK:
            users = self._read()
            user = users[user_id]
            existing = user.get("memories", [])
            remaining = [m for m in existing if m["id"] != memory_id]
            if len(remaining) == len(existing):
                return False
            user["memories"] = remaining  # tombstone/삭제 내용/별도 캐시를 남기지 않는다.
            self._write(users)
            return True

    def get_memories_for_report(self, user_id: str, start: date, end: date) -> list[Memory]:
        if start > end:
            raise ValueError("시작일은 종료일 이전이어야 합니다.")
        return [m for m in self.list_memories(user_id) if start <= m.created_at <= end]


def daily_prefill(user: dict, day: date) -> dict:
    eligible = [r for r in user.get("daily_logs", [])
                if r["date"] <= day.isoformat() and r.get("weight_kg") is not None]
    last = max(eligible, key=lambda r: r["date"], default={})
    wearable = user.get("wearable_logs", {}).get(day.isoformat(), {})
    return {"date": day.isoformat(), "weight_kg": last.get("weight_kg"), "intake": "평소대로",
            "exercise": wearable.get("exercise"), "feeling": 3, "note": None}


def exercise_minutes(exercise) -> float | None:
    if exercise is None:
        return None
    entries = exercise if isinstance(exercise, list) else [exercise]
    if any(e.get("minutes") is None for e in entries):
        return None
    return sum(e["minutes"] for e in entries)


METRICS = {
    "sleep_hours": ("수면", "시간"), "steps": ("걸음", "보"),
    "exercise_minutes": ("운동", "분"), "weight_kg": ("체중", "kg"),
    "feeling": ("컨디션", "점"),
}


def build_context(user: dict, as_of: date | None = None) -> dict:
    logs = user.get("daily_logs", [])
    end = as_of or max((date.fromisoformat(row["date"]) for row in logs), default=date.today())
    periods = {}
    for name, offset in (("recent", 0), ("previous", 7)):
        last = end - timedelta(days=offset)
        first = last - timedelta(days=6)
        rows = [row for row in logs if first <= date.fromisoformat(row["date"]) <= last]
        metrics = {}
        for key in METRICS:
            values = [
                exercise_minutes(row.get("exercise")) if key == "exercise_minutes"
                else row.get(key) for row in rows
            ]
            values = [value for value in values if value is not None]
            metrics[key] = {
                "mean": round(mean(values), 2) if values else None,
                "stddev": round(pstdev(values), 2) if values else None,
                "recorded_days": len(values), "unknown_days": 7 - len(values),
            }
        intake = {label: sum(row.get("intake") == label for row in rows)
                  for label in ("평소대로", "변경", "안 함")}
        intake["모름"] = 7 - sum(intake.values())
        periods[name] = {"start": first.isoformat(), "end": last.isoformat(),
                         "metrics": metrics, "intake_days": intake}
    changes = {}
    for key in METRICS:
        a, b = (periods[p]["metrics"][key]["mean"] for p in ("recent", "previous"))
        changes[key] = round(a - b, 2) if a is not None and b is not None else None
    return {"profile": user["profile"], "products": user.get("products", []),
            "as_of": end.isoformat(), "periods": periods, "changes": changes,
            "recent_notes": [{"date": r["date"], "note": r["note"]} for r in logs
                             if r.get("note") and end - timedelta(days=6) <= date.fromisoformat(r["date"]) <= end],
            "interpretation": "null은 모름. 표준편차는 모집단 기준. 평균 차이는 인과관계나 효능의 증거가 아님."}


def context_text(context: dict) -> str:
    return json.dumps(context, ensure_ascii=False, separators=(",", ":"))
