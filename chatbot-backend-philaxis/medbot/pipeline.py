import hashlib
import json
import os
from collections import deque
from datetime import date, datetime, timezone
from pathlib import Path
from threading import Lock

from medbot.classifiers import ProbabilityClassifier
from medbot.config import GuardConfig
from medbot.context import JSONUserRepository, UserRepository, build_context, daily_prefill
from medbot.guard import InputGuard, recent_turns
from medbot.llm import LLMClient
from medbot.memories import MemoryExtractor, deletion_targets
from medbot.models import ChatResult, DailyInput, HistoryMessage, WearableBatch
from medbot.output_guard import check_output
from medbot.responder import Responder
from medbot.supplements import CSVSupplementRepository, SupplementRepository, recommend

OFF_TOPIC_REPLY = "저는 본인의 건강·수면·활동·체중·식단·복용 기록과 앱 리포트를 도와드려요. 관련 내용을 질문해 주세요."
MALICIOUS_REPLY = "요청을 처리할 수 없습니다. 본인의 건강 기록에 관한 질문을 해 주세요."
_AUDIT_LOCK = Lock()


class ChatService:
    def __init__(self, repository: UserRepository | None = None, client: LLMClient | None = None,
                 audit_path: str | Path | None = None, classifier: ProbabilityClassifier | None = None,
                 guard_config: GuardConfig | None = None, supplements: SupplementRepository | None = None,
                 memory_limit: int = 20, recommendation_threshold: float = 2.6):
        self.repository = repository if repository is not None else JSONUserRepository()
        self.guard = InputGuard(client, classifier, guard_config)
        self.responder = Responder(client)
        self.extractor = MemoryExtractor(client)
        self.supplements = supplements if supplements is not None else CSVSupplementRepository()
        self.memory_limit = max(0, memory_limit)
        self.recommendation_threshold = recommendation_threshold
        self.audit_path = Path(audit_path or os.getenv("MEDBOT_AUDIT_PATH", "logs/guard_audit.jsonl"))

    def recent_audit(self, limit: int = 20) -> list[dict]:
        """최근 유효 행만 반환한다. 원문 preview는 디스크에 보관하지 않는다."""
        rows = deque(maxlen=limit)
        with _AUDIT_LOCK:
            if self.audit_path.exists():
                with self.audit_path.open(encoding="utf-8") as stream:
                    for line in stream:
                        try:
                            row = json.loads(line)
                            if isinstance(row, dict) and "verdict" in row and "message_hash" in row:
                                # 이전 형식의 preview 등은 응답에도 노출하지 않는다.
                                rows.append({key: row[key] for key in
                                             ("timestamp", "user_id", "message_hash", "verdict", "source")})
                        except (ValueError, KeyError):
                            continue
        return list(reversed(rows))

    def reset_demo(self):
        if not isinstance(self.repository, JSONUserRepository):
            raise ValueError("데모 초기화는 JSON 저장소만 지원합니다.")
        self.repository.reset_demo()
        with _AUDIT_LOCK:
            if self.audit_path.exists():
                self.audit_path.write_text("", encoding="utf-8")

    def get_context(self, user_id: str) -> dict:
        context = build_context(self.repository.get_user(user_id))
        memories = self.repository.list_memories(user_id)
        context["memories"] = [self._memory_context(m) for m in memories[-self.memory_limit:]] if self.memory_limit else []
        return context

    @staticmethod
    def _memory_context(memory) -> dict:
        # 추출에 사용한 원문은 답변 LLM에 전달하지 않는다.
        return {"id": memory.id, "created_at": memory.created_at.isoformat(),
                "category": memory.category, "content": memory.content}

    def get_memories_for_report(self, user_id: str, start: date, end: date) -> list[dict]:
        return [self._memory_context(m) for m in self.repository.get_memories_for_report(user_id, start, end)]

    def ingest_wearable(self, user_id: str, batch: WearableBatch) -> list[dict]:
        return self.repository.upsert_wearable(user_id, batch)

    def ingest_daily(self, user_id: str, entry: DailyInput) -> dict:
        return self.repository.upsert_daily(user_id, entry)

    def prefill(self, user_id: str, day: date) -> dict:
        return daily_prefill(self.repository.get_user(user_id), day)

    def handle(self, user_id: str, message: str,
               history: list[HistoryMessage | dict] | None = None) -> ChatResult:
        if not message.strip() or len(message) > 4000:
            raise ValueError("메시지는 1~4000자여야 합니다.")
        turns = recent_turns([HistoryMessage.model_validate(h) for h in (history or [])], self.guard.config.history_turns)
        verdict = self.guard.classify(user_id, message, turns)
        event = {"timestamp": datetime.now(timezone.utc).isoformat(), "user_id": user_id,
                 "message_hash": hashlib.sha256(message.encode()).hexdigest(),
                 "verdict": verdict.model_dump(), "source": verdict.source}
        # 원문/메모는 감사 로그에 남기지 않아 삭제한 사실을 로그에서 재사용하지 않는다.
        with _AUDIT_LOCK:
            self.audit_path.parent.mkdir(parents=True, exist_ok=True)
            with self.audit_path.open("a", encoding="utf-8") as stream:
                stream.write(json.dumps(event, ensure_ascii=False) + "\n")
        user = self.repository.get_user(user_id)
        if verdict.category != "in_scope":
            return ChatResult(reply=OFF_TOPIC_REPLY if verdict.category == "off_topic" else MALICIOUS_REPLY,
                              verdict=verdict, blocked=True, block_reason=verdict.category)
        existing = self.repository.list_memories(user_id)
        targets = deletion_targets(message, existing)
        if targets is not None:
            deleted = [m.id for m in targets if self.repository.delete_memory(user_id, m.id)]
            return ChatResult(reply=(f"메모 {len(deleted)}개를 삭제했습니다. 이후 대화·리포트·추천에 사용하지 않습니다."
                                    if deleted else "일치하는 메모가 없습니다. 삭제할 메모의 주제를 알려주세요."),
                              verdict=verdict, blocked=False, deleted_memory_ids=deleted)
        known_ids = self.repository.user_ids()
        extracted = self.extractor.extract(user_id, message, known_ids)
        saved = self.repository.save_memories(user_id, extracted) if extracted else []
        active = self.repository.list_memories(user_id)
        cards = recommend(self.supplements, user, message, active, self.recommendation_threshold)
        # CSV/리뷰도 신뢰하지 않는 입력: 카드 문구의 알려진 누출 패턴을 동일하게 검사한다.
        cards = [card for card in cards if not check_output(
            card.model_dump_json(), user_id, known_ids)[1]]
        context = self.get_context(user_id)
        context["recommendation_explanations"] = [{"name": card.name, "reason_lines": card.reason_lines} for card in cards]
        # history는 guard의 주제 판정 전용. 삭제한 사실이 오래된 이력에서 재주입되지 않게 한다.
        reply = self.responder.reply(message, [], context)
        reply, reason = check_output(reply, user_id, known_ids)
        return ChatResult(reply=reply, verdict=verdict, blocked=reason is not None, block_reason=reason,
                          saved_memories=saved, recommendations=[] if reason else cards)
